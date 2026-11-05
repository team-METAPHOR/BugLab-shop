"""Isolated browser verification of the six intentional defects and normal controls.

Requires Python Playwright and its Chromium browser. Run after `npm run build`:
    python tests/demo_browser.py --repeat 2
Creates temporary dev/production databases; never reads server/.env files.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.request
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def tid(page, name):
    return page.get_by_test_id(name)


def ready_product(page, product_id):
    page.goto(f"/products/{product_id}")
    expect(tid(page, "product-price")).to_be_visible()


def add(page, product_id):
    ready_product(page, product_id)
    tid(page, "add-to-cart").click()
    expect(tid(page, "add-to-cart-message")).to_have_text("장바구니에 담았습니다.")


def apply_coupon(page):
    tid(page, "coupon-input").fill("SAVE5000")
    tid(page, "apply-coupon").click()
    expect(tid(page, "apply-coupon")).to_be_enabled()


def row(page, product_id):
    return page.locator(f'[data-testid="cart-item"][data-product-id="{product_id}"]')


def b01(page):
    add(page, 1)
    page.goto("/cart")
    apply_coupon(page)
    expect(tid(page, "cart-total")).to_have_text("25,000원")
    apply_coupon(page)
    expect(tid(page, "coupon-message")).to_have_text("이미 적용된 쿠폰입니다.")
    expect(tid(page, "cart-total")).to_have_text("25,000원")
    page.reload()
    apply_coupon(page)
    expect(tid(page, "cart-total")).to_have_text("20,000원")
    expect(tid(page, "applied-coupons").locator("li")).to_have_count(2)
    page.reload()
    expect(tid(page, "cart-total")).to_have_text("20,000원")
    return {"before": 25000, "after_reload_and_reapply": 20000, "coupons": 2}


def b02(page):
    add(page, 2)
    page.goto("/cart")
    tid(row(page, 2), "quantity-increase").click()
    expect(tid(page, "cart-subtotal")).to_have_text("36,000원")
    tid(row(page, 2), "quantity-decrease").click()
    expect(tid(row(page, 2), "cart-quantity")).to_have_text("1")
    expect(tid(row(page, 2), "cart-line-total")).to_have_text("18,000원")
    expect(tid(page, "cart-subtotal")).to_have_text("36,000원")
    page.reload()
    expect(tid(page, "cart-subtotal")).to_have_text("36,000원")
    return {"quantity": 1, "line_total": 18000, "subtotal": 36000}


def b03(page):
    ready_product(page, 3)
    expect(tid(page, "add-to-cart")).to_be_disabled()
    ready_product(page, 1)
    tid(page, "related-products").locator('[data-product-id="3"] a').click()
    expect(tid(page, "product-name")).to_have_text("BugLab 기계식 키보드 한정판")
    expect(tid(page, "stock-status")).to_have_text("품절")
    expect(tid(page, "add-to-cart")).to_be_enabled()
    tid(page, "add-to-cart").click()
    expect(tid(page, "add-to-cart-message")).to_have_text("품절된 상품입니다.")
    return {"direct_disabled": True, "via_related_disabled": False, "server_rejects": True}


def b04(page):
    posts = []
    page.on("request", lambda request: posts.append(request.url)
            if request.method == "POST" and request.url.endswith("/api/cart/items") else None)
    page.goto("/")
    tid(page, "search-input").fill("허브")
    tid(page, "search-submit").click()
    card = page.locator('[data-testid="product-card"][data-product-id="4"]')
    tid(card, "quick-add").click()
    expect(tid(page, "cart-count")).to_have_text("2")
    expect(tid(card, "quick-add")).to_be_enabled()
    assert len(posts) == 2, "One quick-add click must produce exactly two requests"
    tid(page, "quick-add-go-to-cart").click()
    expect(tid(row(page, 4), "cart-quantity")).to_have_text("2")
    expect(tid(page, "cart-subtotal")).to_have_text("84,000원")
    return {"clicks": 1, "post_requests": len(posts), "quantity": 2, "subtotal": 84000}


def b05(page):
    ready_product(page, 5)
    expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "false")
    tid(page, "favorite-toggle").click()
    expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "true")
    page.reload()
    expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "true")
    tid(page, "favorite-toggle").click()
    expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "false")
    expect(tid(page, "favorite-toggle")).to_be_enabled()
    assert len(page.request.get("/api/favorites").json()["items"]) == 1
    page.reload()
    expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "true")
    tid(page, "favorites-link").click()
    expect(tid(page, "favorite-item")).to_have_count(1)
    return {"after_remove_ui": 0, "after_reload": 1, "server_items": 1}


def b06(page):
    page.goto("/")
    page.locator('[data-testid="product-card"][data-product-id="6"] a').click()
    tid(page, "delivery-open").click()
    expect(tid(page, "delivery-dialog")).to_be_visible()
    page.go_back()
    page.wait_for_url(lambda url: urlsplit(url).path == "/")
    expect(tid(page, "delivery-dialog")).to_be_visible()
    expect(tid(page, "delivery-product-name")).to_have_text("원목 모니터 받침대")
    return {"url_after_back": "/", "dialog_still_visible": True}


def controls(page):
    # The old empty-search defect is fixed, including in-page and direct empty searches.
    page.goto("/")
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(6)
    tid(page, "search-input").fill("키보드")
    tid(page, "search-submit").click()
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(2)
    tid(page, "search-input").fill("냉장고")
    tid(page, "search-submit").click()
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(0)
    expect(tid(page, "empty-results")).to_be_visible()
    page.reload()
    expect(tid(page, "empty-results")).to_be_visible()
    # Every in-stock product other than the mouse recalculates downward correctly.
    for product_id, price in [(1, "30,000원"), (4, "42,000원"), (5, "15,000원"), (6, "35,000원")]:
        add(page, product_id)
        page.goto("/cart")
        tid(row(page, product_id), "quantity-increase").click()
        expect(tid(row(page, product_id), "cart-quantity")).to_have_text("2")
        tid(row(page, product_id), "quantity-decrease").click()
        expect(tid(row(page, product_id), "cart-quantity")).to_have_text("1")
        expect(tid(page, "cart-subtotal")).to_have_text(price)
        tid(row(page, product_id), "remove-item").click()
        expect(tid(page, "cart-empty")).to_be_visible()
    # Ordinary quick-add, including its disabled state and submitted quantity.
    page.goto("/?q=마우스")
    tid(page, "quick-add").click()
    expect(tid(page, "cart-count")).to_have_text("1")
    expect(tid(page, "quick-add")).to_be_enabled()
    page.goto("/cart")
    tid(page, "remove-item").click()
    expect(tid(page, "cart-empty")).to_be_visible()
    # Coupon API rejects duplicates for carts without the keyboard, also after reload.
    add(page, 4)
    page.goto("/cart")
    apply_coupon(page)
    expect(tid(page, "cart-total")).to_have_text("37,000원")
    page.reload()
    apply_coupon(page)
    expect(tid(page, "coupon-message")).to_have_text("이미 적용된 쿠폰입니다.")
    expect(tid(page, "cart-total")).to_have_text("37,000원")
    # Favorite immediately undone is normal even for the mat; other products hydrate correctly.
    for product_id, reload_first in [(5, False), (4, True)]:
        ready_product(page, product_id)
        tid(page, "favorite-toggle").click()
        expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "true")
        if reload_first:
            page.reload()
            expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "true")
        tid(page, "favorite-toggle").click()
        expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "false")
        expect(tid(page, "favorite-toggle")).to_be_enabled()
        page.reload()
        expect(tid(page, "favorite-toggle")).to_have_attribute("aria-pressed", "false")
    # All normal shipping dialogs close via X, Escape, backdrop, and route exit.
    for product_id in [1, 2, 3, 4, 5, 6]:
        ready_product(page, product_id)
        tid(page, "delivery-open").click()
        expect(tid(page, "delivery-dialog")).to_be_visible()
        tid(page, "delivery-close").click()
        expect(tid(page, "delivery-dialog")).to_have_count(0)
        assert not page.locator("#app").evaluate("el => el.inert")
        expect(tid(page, "delivery-open")).to_be_focused()
    ready_product(page, 6)
    tid(page, "delivery-open").click()
    page.keyboard.press("Escape")
    expect(tid(page, "delivery-dialog")).to_have_count(0)
    tid(page, "delivery-open").click()
    tid(page, "delivery-dialog").click(position={"x": 4, "y": 4})
    expect(tid(page, "delivery-dialog")).to_have_count(0)
    page.goto("/")
    page.locator('[data-testid="product-card"][data-product-id="2"] a').click()
    tid(page, "delivery-open").click()
    page.go_back()
    expect(tid(page, "delivery-dialog")).to_have_count(0)
    assert not page.locator("#app").evaluate("el => el.inert")
    # Direct sold-out detail and server stock rejection remain normal.
    ready_product(page, 3)
    expect(tid(page, "add-to-cart")).to_be_disabled()
    response = page.request.post("/api/cart/items", data={"productId": 3, "quantity": 1})
    assert response.status == 409 and response.json()["error"]["code"] == "OUT_OF_STOCK"
    return {"search": "fixed", "other_quantity": "normal", "other_coupon": "normal",
            "other_quick_add": "normal", "favorite_controls": "normal", "dialog_controls": "normal"}


CASES = [("B01", b01), ("B02", b02), ("B03", b03), ("B04", b04), ("B05", b05), ("B06", b06), ("controls", controls)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeat", type=int, default=2)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or Path(tempfile.mkdtemp(prefix="buglab-six-demo-"))
    output.mkdir(parents=True, exist_ok=True)
    results = []
    failed = False
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for app_env in ["dev", "production"]:
            password = secrets.token_urlsafe(24)
            token = secrets.token_urlsafe(24)
            port = free_port()
            origin = f"http://127.0.0.1:{port}"
            env = {**os.environ, "APP_ENV": app_env, "PORT": str(port), "HOST": "127.0.0.1",
                   "DATA_DIR": str(output / "data"), "STATIC_DIR": str(ROOT / "dist"),
                   "BUILD_COMMIT": "six-defects-browser-verification", "TEST_CONTROL_TOKEN": token,
                   "TEST_ACCOUNT_PASSWORD": password, "DEMO_ACCOUNT_EMAIL": "", "DEMO_ACCOUNT_PASSWORD": "",
                   "METAPHOR_SDK_URL": "", "METAPHOR_API_URL": "", "METAPHOR_PROJECT_KEY": ""}
            with (output / f"{app_env}-server.log").open("w") as log:
                server = subprocess.Popen(["node", "server/src/index.js"], cwd=ROOT, env=env, stdout=log, stderr=log)
                try:
                    for _ in range(100):
                        if server.poll() is not None:
                            raise RuntimeError("Isolated server exited; inspect its log")
                        try:
                            with urllib.request.urlopen(origin + "/api/health", timeout=1) as response:
                                health = json.load(response)
                                assert health["env"] == app_env and health["commit"] == env["BUILD_COMMIT"]
                                break
                        except OSError:
                            time.sleep(0.1)
                    else:
                        raise RuntimeError("Isolated server did not become ready")
                    control = playwright.request.new_context(base_url=origin)
                    assert control.get("/api/cart/unknown").status == 404
                    assert control.get("/api/favorites").status == 401
                    if app_env == "production":
                        assert control.post("/api/test/reset", data={}).status == 404
                    else:
                        assert control.post("/api/test/reset", data={"email": "qa1@buglab.test"},
                                            headers={"X-Test-Token": "invalid"}).status == 401
                    for attempt in range(1, args.repeat + 1):
                        for name, run in CASES:
                            context = browser.new_context(base_url=origin, viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
                            page = context.new_page()
                            page.set_default_timeout(10000)
                            page_errors = []
                            page.on("pageerror", lambda error: page_errors.append(str(error)))
                            prefix = f"{app_env}-{name}-{attempt}"
                            try:
                                if app_env == "dev":
                                    reset = control.post("/api/test/reset", data={"email": "qa1@buglab.test"}, headers={"X-Test-Token": token})
                                    assert reset.status == 200
                                    page.goto("/login")
                                    tid(page, "login-email").fill("qa1@buglab.test")
                                    tid(page, "login-password").fill(password)
                                    tid(page, "login-submit").click()
                                else:
                                    page.goto("/signup")
                                    tid(page, "signup-name").fill("데모 검증")
                                    tid(page, "signup-email").fill(f"{secrets.token_hex(8)}@buglab.test")
                                    tid(page, "signup-password").fill(password)
                                    tid(page, "signup-submit").click()
                                expect(tid(page, "user-menu")).to_be_visible()
                                observations = run(page)
                                assert not page_errors, "Unexpected browser runtime error"
                                page.screenshot(path=str(output / f"{prefix}.png"), full_page=True)
                                results.append({"env": app_env, "case": name, "attempt": attempt, "passed": True, "observations": observations})
                                print(f"PASS {prefix}", flush=True)
                            except Exception as error:
                                failed = True
                                # Avoid exception call logs containing form values or request headers.
                                results.append({"env": app_env, "case": name, "attempt": attempt, "passed": False,
                                                "error_type": type(error).__name__})
                                page.screenshot(path=str(output / f"{prefix}-failure.png"), full_page=True)
                                print(f"FAIL {prefix}: {type(error).__name__}", flush=True)
                                if os.environ.get("BUGLAB_DEBUG_TESTS") == "1":
                                    raise
                            finally:
                                context.close()
                    control.dispose()
                finally:
                    server.terminate()
                    try:
                        server.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        server.kill()
                        server.wait()
        browser.close()
    (output / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"{sum(item['passed'] for item in results)}/{len(results)} checks passed; artifacts: {output}")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
