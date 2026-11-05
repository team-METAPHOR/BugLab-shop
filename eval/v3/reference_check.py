"""Run the grader reference plans against the defect (A) and fixed (B) targets.

This verifies the evaluation environment, not AI performance: every case must show its
symptom on A and must not show it on B, for qa1 and qa2 running at the same time.

Local mode builds nothing; pass two `npm run build` outputs:
    python eval/v3/reference_check.py --local A=/path/dist-defect --local B=/path/dist-fixed
Remote mode (dev targets with /api/test/reset):
    EVAL_A_TEST_CONTROL_TOKEN=... EVAL_A_TEST_ACCOUNT_PASSWORD=... \\
    python eval/v3/reference_check.py --remote A=https://... --remote B=https://...
Add --capture-screenshots to save report screenshots of A into inputs/screenshots/.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request
from urllib.parse import parse_qs, urlsplit

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ACCOUNTS = ["qa1@buglab.test", "qa2@buglab.test"]
PREDICATE_TIMEOUT = 2.0


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def locate(page, sel):
    base = locate(page, sel["within"]) if "within" in sel else page
    if "css" in sel:
        return base.locator(sel["css"])
    attrs = "".join(f'[{key}="{value}"]' for key, value in sel.get("attrs", {}).items())
    return base.locator(f'[data-testid="{sel["testid"]}"]{attrs}')


def normalized(text):
    return " ".join(text.split())


def json_path(data, path):
    for part in path.split("."):
        if part == "length":
            data = len(data)
        elif isinstance(data, list):
            data = data[int(part)]
        else:
            data = data[part]
    return data


async def holds(page, pred):
    if "text" in pred:
        target = locate(page, pred["text"])
        # Only text the user can see counts; a closed dialog still holds its title in the DOM.
        return (await target.count() == 1 and await target.is_visible()
                and normalized(await target.inner_text()) == pred["equals"])
    if "attr" in pred:
        target = locate(page, pred["attr"])
        return await target.count() == 1 and await target.get_attribute(pred["attribute"]) == pred["equals"]
    if "count" in pred:
        return await locate(page, pred["count"]).count() == pred["equals"]
    if "visible" in pred:
        target = locate(page, pred["visible"])
        return await target.count() == 1 and await target.is_visible()
    if "url_path" in pred:
        url = urlsplit(page.url)
        query = {key: values[0] for key, values in parse_qs(url.query).items()}
        return url.path == pred["url_path"] and query == pred.get("url_query", {})
    if "js" in pred:
        return bool(await page.evaluate(pred["js"]))
    if "api" in pred:
        response = await page.request.get(pred["api"])
        if response.status != 200:
            return False
        data = await response.json()
        return all(json_path(data, path) == value for path, value in pred["json"].items())
    raise ValueError(f"Unknown predicate: {pred}")


async def poll(page, pred):
    deadline = time.monotonic() + PREDICATE_TIMEOUT
    while True:
        try:
            if await holds(page, pred):
                return True
        except (KeyError, IndexError, TypeError):
            pass
        if time.monotonic() > deadline:
            return False
        await asyncio.sleep(0.1)


async def run_step(page, step):
    if "goto" in step:
        await page.goto(step["goto"])
    elif "click" in step:
        if step.get("nav") == "spa":
            # A full page load would drop this marker; the report requires in-app navigation.
            await page.evaluate("window.__evalSpaMarker = true")
        await locate(page, step["click"]).click()
    elif "fill" in step:
        await locate(page, step["fill"]).fill(step["value"])
    elif "wait_visible" in step:
        await locate(page, step["wait_visible"]).wait_for(state="visible")
    elif "wait_text" in step:
        target = locate(page, step["wait_text"])
        await target.wait_for(state="visible")
        deadline = time.monotonic() + 10
        while normalized(await target.inner_text()) != step["text"]:
            if time.monotonic() > deadline:
                raise TimeoutError(f"Text not reached: {step['text']}")
            await asyncio.sleep(0.1)
    elif "reload" in step:
        await page.reload()
    elif "back" in step:
        await page.go_back()
    else:
        raise ValueError(f"Unknown step: {step}")


async def prepare_account(target, page, account):
    if target["mode"] == "signup":
        await page.goto("/signup")
        await locate(page, {"testid": "signup-name"}).fill("이서연")
        await locate(page, {"testid": "signup-email"}).fill(f"{secrets.token_hex(8)}@buglab.test")
        await locate(page, {"testid": "signup-password"}).fill(target["password"])
        await locate(page, {"testid": "signup-submit"}).click()
    else:
        await page.goto("/login")
        await locate(page, {"testid": "login-email"}).fill(account)
        await locate(page, {"testid": "login-password"}).fill(target["password"])
        await locate(page, {"testid": "login-submit"}).click()
    await locate(page, {"testid": "user-menu"}).wait_for(state="visible")


async def run_case(browser, control, target, case, account, screenshot=None):
    result = {"target": target["name"], "input": case["input"], "account": account if case["login"] else None}
    if case["login"] and target["mode"] == "reset":
        reset = await control.post("/api/test/reset", data={"email": account},
                                   headers={"X-Test-Token": target["token"]})
        if reset.status != 200:
            return {**result, "outcome": "inconclusive", "reason": f"reset HTTP {reset.status}"}
    context = await browser.new_context(base_url=target["origin"], viewport={"width": 1440, "height": 1000},
                                        reduced_motion="reduce")
    page = await context.new_page()
    page.set_default_timeout(10000)
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    try:
        if case["login"]:
            await prepare_account(target, page, account)
        for step in case["plan"]:
            await run_step(page, step)
        await run_step(page, {"wait_text": {"testid": case["completion"]["testid"]}, "text": case["completion"]["text"]})
        failed = [pred["name"] for pred in case["expected"] if not await poll(page, pred)]
        if any(step.get("nav") == "spa" for step in case["plan"]):
            result["spa_preserved"] = await page.evaluate("window.__evalSpaMarker === true")
        if screenshot:
            await page.screenshot(path=str(screenshot))
        result.update(outcome="symptom" if failed else "no_symptom", failed_expectations=failed)
    except Exception as error:
        # Keep only the type; call logs can contain form values.
        result.update(outcome="inconclusive", reason=type(error).__name__)
    finally:
        if page_errors:
            result["page_errors"] = len(page_errors)
        await context.close()
    return result


def read_target_identity(origin):
    with urllib.request.urlopen(origin + "/api/health", timeout=10) as response:
        health = json.load(response)
    with urllib.request.urlopen(origin + "/", timeout=10) as response:
        html = response.read().decode()
    return {"health": health, "bundle": sorted(set(re.findall(r"/assets/[^\"']+\.(?:js|css)", html)))}


def start_local(name, dist, app_env, workdir, commit):
    port = free_port()
    token, password = secrets.token_urlsafe(24), secrets.token_urlsafe(24)
    env = {**os.environ, "APP_ENV": app_env, "PORT": str(port), "HOST": "127.0.0.1",
           "DATA_DIR": str(workdir / f"data-{name}-{app_env}"), "STATIC_DIR": str(dist), "BUILD_COMMIT": commit,
           "TEST_CONTROL_TOKEN": token, "TEST_ACCOUNT_PASSWORD": password, "DEMO_ACCOUNT_EMAIL": "",
           "DEMO_ACCOUNT_PASSWORD": "", "METAPHOR_SDK_URL": "", "METAPHOR_API_URL": "", "METAPHOR_PROJECT_KEY": ""}
    log = (workdir / f"server-{name}-{app_env}.log").open("w")
    process = subprocess.Popen(["node", "server/src/index.js"], cwd=ROOT, env=env, stdout=log, stderr=log)
    origin = f"http://127.0.0.1:{port}"
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError(f"Local server {name} exited; see {log.name}")
        try:
            read_target_identity(origin)
            break
        except OSError:
            time.sleep(0.1)
    else:
        raise RuntimeError(f"Local server {name} did not start")
    mode = "reset" if app_env == "dev" else "signup"
    return process, {"name": name, "origin": origin, "token": token, "password": password, "mode": mode}


def split_pair(value):
    name, _, rest = value.partition("=")
    if not name or not rest:
        raise argparse.ArgumentTypeError("Use NAME=VALUE")
    return name, rest


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", type=split_pair, action="append", default=[], help="NAME=dist directory")
    parser.add_argument("--remote", type=split_pair, action="append", default=[], help="NAME=origin")
    parser.add_argument("--repeat", type=int, default=2)
    parser.add_argument("--capture-screenshots", action="store_true")
    parser.add_argument("--output", type=Path, default=HERE / "grader" / "results")
    args = parser.parse_args()

    manifest = json.loads((HERE / "manifest.json").read_text())
    grader = json.loads((HERE / "grader" / "cases.json").read_text())
    workdir = Path(tempfile.mkdtemp(prefix="buglab-eval-v3-"))
    processes, targets = [], []
    try:
        for name, dist in args.local:
            process, target = start_local(name, Path(dist).resolve(), "dev", workdir, f"local-{name}")
            processes.append(process)
            targets.append(target)
        for name, origin in args.remote:
            targets.append({"name": name, "origin": origin.rstrip("/"), "mode": "reset",
                            "token": os.environ[f"EVAL_{name}_TEST_CONTROL_TOKEN"],
                            "password": os.environ[f"EVAL_{name}_TEST_ACCOUNT_PASSWORD"]})
        report = {"version": grader["version"], "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                  "targets": {}, "runs": [], "cases": {}}
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            for target in targets:
                identity = read_target_identity(target["origin"])
                expected_bundle = manifest["targets"][target["name"]]["bundle"]
                identity["bundle_matches"] = identity["bundle"] == sorted(expected_bundle)
                report["targets"][target["name"]] = {"mode": "local" if target["origin"].startswith("http://127.0.0.1")
                                                     else "remote", **identity}
                if not identity["bundle_matches"]:
                    print(f"SKIP {target['name']}: bundle does not match manifest", flush=True)
                    continue
                control = await playwright.request.new_context(base_url=target["origin"])
                for case in grader["cases"]:
                    for attempt in range(1, args.repeat + 1):
                        runs = await asyncio.gather(*(run_case(browser, control, target, case, account)
                                                      for account in ACCOUNTS))
                        for run in runs:
                            run["attempt"] = attempt
                            report["runs"].append(run)
                            print(f"{target['name']} {case['input']} {run['account'] or '-'} #{attempt}: {run['outcome']}",
                                  flush=True)
                await control.dispose()
            if args.capture_screenshots:
                # Reports come from production users, so capture on a production-mode copy of A.
                dist = dict(args.local).get("A")
                if not dist:
                    raise SystemExit("--capture-screenshots needs --local A=<defect dist>")
                process, target = start_local("A", Path(dist).resolve(), "production", workdir,
                                              manifest["baseline_commit"][:7])
                processes.append(process)
                shots = HERE / "inputs" / "screenshots"
                shots.mkdir(parents=True, exist_ok=True)
                for case in grader["cases"]:
                    run = await run_case(browser, None, target, case, None, screenshot=shots / f"{case['input']}.png")
                    print(f"screenshot {case['input']}: {run['outcome']}", flush=True)
            await browser.close()

        for case in grader["cases"]:
            verdict = {}
            for name, info in report["targets"].items():
                role = grader["targets"].get(name)
                outcomes = [run["outcome"] for run in report["runs"] if run["target"] == name and run["input"] == case["input"]]
                spa = [run.get("spa_preserved") for run in report["runs"]
                       if run["target"] == name and run["input"] == case["input"] and "spa_preserved" in run]
                verdict[name] = {"role": role, "outcomes": outcomes,
                                 "as_expected": bool(outcomes) and all(o == grader["expected_outcome"][role] for o in outcomes),
                                 "spa_preserved": all(spa) if spa else None}
            verdict["valid"] = all(item["as_expected"] for item in verdict.values()) and len(verdict) == len(grader["targets"])
            report["cases"][case["input"]] = verdict
        report["environment_valid"] = all(item["valid"] for item in report["cases"].values())
        args.output.mkdir(parents=True, exist_ok=True)
        out = args.output / f"reference-{time.strftime('%Y%m%d-%H%M%S')}.json"
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        for name, verdict in report["cases"].items():
            print(f"{name}: {'VALID' if verdict['valid'] else 'INVALID'}")
        print(f"environment_valid={report['environment_valid']} -> {out}")
        raise SystemExit(0 if report["environment_valid"] else 1)
    finally:
        for process in processes:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    asyncio.run(main())
