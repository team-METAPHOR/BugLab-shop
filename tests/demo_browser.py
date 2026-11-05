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


AVAILABLE = [(1, 30000), (2, 18000), (4, 42000), (5, 15000), (6, 35000)]


def won(amount):
    return f"{amount:,}원"


def refreshed_notice(page, name, text, action):
    """A repeated action must refresh the signal, not reuse an old completion."""
    target = tid(page, name)
    tracker = target.evaluate_handle("""node => {
        const state = {count: 0};
        state.observer = new MutationObserver(records => state.count += records.length);
        state.observer.observe(node, {childList: true, characterData: true, subtree: true});
        return state;
    }""")
    try:
        action()
        expect(target).to_have_text(text)
        assert tracker.evaluate("""state => {
            state.count += state.observer.takeRecords().length;
            return state.count > 0;
        }"""), "Completion must change for this action"
    finally:
        tracker.evaluate("state => state.observer.disconnect()")
        tracker.dispose()


def b01(page):
    requests = []
    page.on("request", lambda request: requests.append(request.url)
            if request.method == "POST" and request.url.endswith("/api/cart/coupons") else None)
    for product_id, price in AVAILABLE:
        add(page, product_id)
        page.goto("/cart")
        apply_coupon(page)
        expect(tid(page, "coupon-status")).to_have_text("쿠폰 확인 완료")
        refreshed_notice(page, "coupon-status", "쿠폰 확인 완료", lambda: tid(page, "apply-coupon").click())
        # Chip and Enter must not bypass the defect.
        tid(page, "coupon-input").fill("")
        page.get_by_role("button", name="SAVE5000 5,000원 할인").click()
        refreshed_notice(page, "coupon-status", "쿠폰 확인 완료", lambda: tid(page, "coupon-input").press("Enter"))
        expect(tid(page, "cart-total")).to_have_text(won(price))
        expect(tid(page, "cart-discount")).to_have_text("0원")
        expect(tid(page, "applied-coupons")).to_have_count(0)
        page.reload()
        apply_coupon(page)
        expect(tid(page, "coupon-status")).to_have_text("쿠폰 확인 완료")
        state = page.request.get("/api/cart").json()
        assert state["discount"] == 0 and state["appliedCoupons"] == [] and state["total"] == price
        tid(page, "remove-item").click()
        expect(tid(page, "cart-empty")).to_be_visible()
    # Mixed carts must fail in the same way.
    add(page, 1)
    add(page, 2)
    page.goto("/cart")
    apply_coupon(page)
    expect(tid(page, "cart-total")).to_have_text("48,000원")
    assert not requests, "The injected UI path must not submit a coupon"
    return {"products_checked": len(AVAILABLE), "mixed_cart": True, "chip_enter_reload": True, "coupon_posts": 0}


def b02(page):
    for product_id, price in AVAILABLE:
        add(page, product_id)
        add(page, product_id)
        page.goto("/cart")
        item = row(page, product_id)
        tid(item, "quantity-increase").click()
        expect(tid(page, "quantity-status")).to_have_text("수량 확인 완료")
        refreshed_notice(page, "quantity-status", "수량 확인 완료", lambda: tid(item, "quantity-increase").click())
        expect(tid(item, "cart-quantity")).to_have_text("2")
        expect(tid(page, "cart-subtotal")).to_have_text(won(price * 2))
        state = page.request.get("/api/cart").json()
        assert state["items"][0]["quantity"] == 2 and state["subtotal"] == price * 2
        # Decreases still work and the old mouse subtotal bug is gone.
        tid(item, "quantity-decrease").click()
        expect(tid(item, "cart-quantity")).to_have_text("1")
        expect(tid(page, "cart-subtotal")).to_have_text(won(price))
        tid(item, "quantity-increase").click()
        expect(tid(item, "cart-quantity")).to_have_text("1")
        page.reload()
        expect(tid(row(page, product_id), "cart-quantity")).to_have_text("1")
        expect(tid(page, "cart-subtotal")).to_have_text(won(price))
        tid(page, "remove-item").click()
        expect(tid(page, "cart-empty")).to_be_visible()
    add(page, 2)
    page.goto("/cart")
    tid(page, "quantity-increase").click()
    expect(tid(page, "quantity-status")).to_have_text("수량 확인 완료")
    expect(tid(page, "cart-quantity")).to_have_text("1")
    return {"products_checked": len(AVAILABLE), "increase": "unchanged", "decrease_and_persistence": "normal"}


def check_restock(page):
    expect(tid(page, "product-name")).to_have_text("BugLab 기계식 키보드 한정판")
    expect(tid(page, "stock-status")).to_have_text("품절")
    expect(tid(page, "add-to-cart")).to_be_disabled()
    tid(page, "restock-open").click()
    expect(tid(page, "restock-status")).to_have_text("재입고 알림 안내 확인 완료")
    refreshed_notice(page, "restock-status", "재입고 알림 안내 확인 완료", lambda: tid(page, "restock-open").click())
    expect(tid(page, "restock-dialog")).to_be_hidden()


def b03(page):
    ready_product(page, 3)
    check_restock(page)
    page.reload()
    check_restock(page)
    for path in ["/", "/?q=키보드"]:
        page.goto(path)
        tid(page, "search-results").locator('[data-product-id="3"] a').click()
        check_restock(page)
    for product_id, _ in AVAILABLE:
        ready_product(page, product_id)
        expect(tid(page, "restock-open")).to_have_count(0)
        tid(page, "related-products").locator('[data-product-id="3"] a').click()
        check_restock(page)
    return {"direct_reload_home_search": True, "recommendation_sources": len(AVAILABLE), "stock_button_disabled": True}


def b04(page):
    for path in ["/", "/?q=마우스", *[f"/products/{i}" for i in range(1, 7)]]:
        page.goto(path)
        expect(tid(page, "search-input")).to_be_visible()
        before = page.url
        link = page.locator('[data-testid="category-link"][data-category="허브"]')
        link.click()
        expect(tid(page, "category-status")).to_have_text("카테고리 선택 확인 완료")
        refreshed_notice(page, "category-status", "카테고리 선택 확인 완료", lambda: link.click())
        assert page.url == before
    page.get_by_role("button", name="전체 카테고리 열기").click()
    page.locator('[data-testid="mega-category-link"][data-category="허브"]').click()
    expect(tid(page, "category-status")).to_have_text("카테고리 선택 확인 완료")
    assert page.url == before
    page.get_by_role("button", name="전체 카테고리 닫기").click()
    # Other category links and a direct hub search are normal controls.
    page.locator('[data-testid="category-link"][data-category="마우스"]').click()
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(1)
    expect(tid(page, "search-summary")).to_contain_text("마우스")
    tid(page, "search-input").fill("허브")
    tid(page, "search-submit").click()
    expect(tid(page, "search-summary")).to_contain_text("허브")
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(1)
    ready_product(page, 4)
    page.locator('[data-testid="category-link"][data-category="허브"]').click()
    expect(tid(page, "category-status")).to_have_text("카테고리 선택 확인 완료")
    return {"entry_pages_checked": 8, "both_header_menus": True, "other_category_and_search": "normal"}


def b05(page):
    for product_id in range(1, 7):
        ready_product(page, product_id)
        button = tid(page, "favorite-toggle")
        expect(button).to_have_text("찜하기")
        before = page.request.get("/api/favorites").json()["items"]
        button.click()
        expect(tid(page, "favorite-status")).to_have_text("찜 상태 확인 완료")
        refreshed_notice(page, "favorite-status", "찜 상태 확인 완료", lambda: button.click())
        expect(button).to_have_text("찜하기")
        expect(button).to_have_attribute("aria-pressed", "false")
        expect(tid(page, "favorites-count")).to_have_text("0")
        assert page.request.get("/api/favorites").json()["items"] == before
        # A saved favorite must also stay saved when the broken detail button is used.
        response = page.request.post("/api/favorites", data={"productId": product_id})
        assert response.status == 200
        page.reload()
        expect(button).to_have_text("찜 해제")
        button.click()
        expect(tid(page, "favorite-status")).to_have_text("찜 상태 확인 완료")
        expect(button).to_have_text("찜 해제")
        assert len(page.request.get("/api/favorites").json()["items"]) == 1
        # The normal list removal uses the real UUID, including a hydrated mat.
        page.goto("/favorites")
        tid(page, "favorite-remove").click()
        expect(tid(page, "favorites-empty")).to_be_visible()
        assert page.request.get("/api/favorites").json()["items"] == []
    ready_product(page, 5)
    tid(page, "favorite-toggle").click()
    expect(tid(page, "favorite-status")).to_have_text("찜 상태 확인 완료")
    expect(tid(page, "favorite-toggle")).to_have_text("찜하기")
    return {"products_checked": 6, "both_initial_states": True, "list_removal_and_uuid": "normal"}


def b06(page):
    for product_id in range(1, 7):
        ready_product(page, product_id)
        tid(page, "delivery-open").click()
        expect(tid(page, "delivery-dialog")).to_be_visible()
        tid(page, "delivery-close").click()
        expect(tid(page, "delivery-status")).to_have_text("닫기 요청 확인 완료")
        refreshed_notice(page, "delivery-status", "닫기 요청 확인 완료", lambda: tid(page, "delivery-confirm").click())
        expect(tid(page, "delivery-dialog")).to_be_visible()
        assert page.locator("#app").evaluate("el => el.inert")
        page.keyboard.press("Escape")
        expect(tid(page, "delivery-dialog")).to_have_count(0)
        assert not page.locator("#app").evaluate("el => el.inert")
        expect(tid(page, "delivery-open")).to_be_focused()
        tid(page, "delivery-open").click()
        tid(page, "delivery-dialog").click(position={"x": 4, "y": 4})
        expect(tid(page, "delivery-dialog")).to_have_count(0)
        # Real history navigation removes every dialog, including the old stand bug.
        page.goto("/")
        tid(page, "search-results").locator(f'[data-product-id="{product_id}"] a').click()
        tid(page, "delivery-open").click()
        page.go_back()
        expect(tid(page, "delivery-dialog")).to_have_count(0)
        assert urlsplit(page.url).path == "/"
        assert not page.locator("#app").evaluate("el => el.inert")
    ready_product(page, 6)
    tid(page, "delivery-open").click()
    tid(page, "delivery-confirm").click()
    expect(tid(page, "delivery-status")).to_have_text("닫기 요청 확인 완료")
    expect(tid(page, "delivery-dialog")).to_be_visible()
    return {"products_checked": 6, "close_and_confirm": "unchanged", "escape_backdrop_route_exit": "normal"}


def controls(page):
    page.goto("/")
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(6)
    tid(page, "search-input").fill("키보드")
    tid(page, "search-submit").click()
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(2)
    tid(page, "search-input").fill("냉장고")
    tid(page, "search-submit").click()
    expect(tid(page, "empty-results")).to_be_visible()
    expect(tid(page, "search-results").get_by_test_id("product-card")).to_have_count(0)
    page.reload()
    expect(tid(page, "empty-results")).to_be_visible()
    # One hub quick-add click now submits once and adds exactly one.
    posts = []
    page.on("request", lambda request: posts.append(request.url)
            if request.method == "POST" and request.url.endswith("/api/cart/items") else None)
    page.goto("/?q=허브")
    tid(page, "quick-add").click()
    expect(tid(page, "quick-add-message")).to_have_text("장바구니에 담았습니다.")
    expect(tid(page, "quick-add")).to_be_enabled()
    assert len(posts) == 1
    page.goto("/cart")
    expect(tid(page, "cart-quantity")).to_have_text("1")
    expect(tid(page, "cart-subtotal")).to_have_text("42,000원")
    # The server remains correct despite the injected UI failures.
    assert page.request.post("/api/cart/items", data={"productId": 1}).status == 200
    assert page.request.post("/api/cart/items", data={"productId": 2, "quantity": 2}).status == 200
    changed = page.request.patch("/api/cart/items/2", data={"quantity": 1}).json()
    assert changed["subtotal"] == 90000
    response = page.request.post("/api/cart/coupons", data={"code": "SAVE5000"})
    assert response.status == 200 and response.json()["total"] == 85000
    duplicate = page.request.post("/api/cart/coupons", data={"code": "SAVE5000"})
    assert duplicate.status == 409 and duplicate.json()["error"]["code"] == "COUPON_ALREADY_APPLIED"
    page.reload()
    expect(tid(page, "cart-total")).to_have_text("85,000원")
    ready_product(page, 3)
    expect(tid(page, "add-to-cart")).to_be_disabled()
    response = page.request.post("/api/cart/items", data={"productId": 3, "quantity": 1})
    assert response.status == 409 and response.json()["error"]["code"] == "OUT_OF_STOCK"
    # Unauthenticated favorite clicks still use the ordinary login flow.
    anonymous = page.context.browser.new_context(base_url=page.url.split('/products/')[0])
    try:
        other = anonymous.new_page()
        ready_product(other, 1)
        tid(other, "favorite-toggle").click()
        expect(tid(other, "login-submit")).to_be_visible()
    finally:
        anonymous.close()
    return {"search": "normal", "hub_quick_add_posts": 1, "server_quantity_coupon_stock": "normal", "login_redirect": "normal"}


CASES = [("B01", b01), ("B02", b02), ("B03", b03), ("B04", b04), ("B05", b05), ("B06", b06), ("controls", controls)]
AUTH_CASES = {"B01", "B02", "B05", "controls"}


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
                                if name not in AUTH_CASES:
                                    page.goto("/")
                                elif app_env == "dev":
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
                                if name in AUTH_CASES:
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
