# Playwright 실행 계약 (dev 환경)

문서 버전: v1.0 (2026-11-04)
대상: 메타포 엔진(Core_engine)·백엔드 워커 담당자

dev 사이트는 운영과 같은 코드·같은 로그인 화면을 쓰고, 고정 테스트 계정과 워커 전용 초기화 API만 추가로 가진다. Playwright는 로그인을 건너뛰지 않고 화면에서 직접 로그인한다.

## 1. 대상 정보

| 항목 | 값 |
|---|---|
| 대상 origin (로컬) | `http://localhost:3100` (Docker 내부 예: `http://shop-dev:3100`) |
| 준비 확인 | `GET /api/health` → `status: "ok"`, `env: "dev"` |
| 대상 버전 | `/api/health`의 `commit`. 보고서에 기록 |
| 테스트 계정 | `qa1@buglab.test`, `qa2@buglab.test` (이름 "QA 테스터 1/2") |
| 테스트 계정 비밀번호 | dev 서버의 `TEST_ACCOUNT_PASSWORD`. 워커 비밀 저장소에서 주입 |
| 초기화 토큰 | dev 서버의 `TEST_CONTROL_TOKEN`. 워커 비밀 저장소에서 주입 |
| viewport 권장 | 1440×900 |

## 2. 비밀값 취급

- AI가 만드는 실행 계획에는 `{{TEST_EMAIL}}`, `{{TEST_PASSWORD}}` 자리표시자만 넣는다. 워커가 실행 직전에 실제 값으로 치환한다.
- 비밀번호·토큰·세션 쿠키를 실행 로그·보고서·스크린샷 설명에 남기지 않는다. 비밀번호 입력란은 `type="password"`라 스크린샷에 노출되지 않는다.
- `/api/test/reset`은 브라우저 페이지에서 호출하지 않는다. 엔진 `BrowserRunner.run()`의 `reset(attempt)` 콜백(신뢰된 서버 코드)이 호출한다.

## 3. 시도별 초기화

각 시도 직전에:
1. `POST /api/test/reset` 헤더 `X-Test-Token`, 본문 `{"email":"qa1@buglab.test"}` → 200 확인. 실패하면 그 시도는 초기화 실패(inconclusive).
2. 새 BrowserContext 생성(쿠키·스토리지 분리).
3. `/login`에서 로그인. reset이 해당 계정의 세션도 지우므로 로그인은 반드시 reset 뒤에 한다.

두 시도를 병렬로 돌리려면 시도마다 다른 계정(qa1, qa2)을 쓴다. 순차 실행이면 같은 계정을 초기화해서 써도 된다.

## 4. 엔진 요청 허용 범위와 필요한 엔진 변경

현재 Core_engine(b5fdf52)으로는 이 사이트의 어떤 시나리오도 끝까지 실행할 수 없다. 2026-11-04 독립 검증에서 원본 엔진을 실제로 실행해 확인했다. 아래 변경은 엔진 담당 범위이고, BugLab-shop 쪽에서는 반영할 것이 없다.

### 4.1 허용할 요청

| 메서드 | 경로 | 필요한 시나리오 |
|---|---|---|
| GET | `/`, `/login`, `/cart`, `/products/:id`, `/assets/*`, `/images/*`, `/favicon.svg` | 전체 |
| GET | `/api/health`, `/api/auth/me`, `/api/products`, `/api/products/:id`, `/api/cart` | 전체 |
| POST | `/api/auth/login` | B01, B02, N01(선택) |
| POST | `/api/cart/items` | B01, B02 |
| PATCH | `/api/cart/items/:productId` | B02 |
| POST | `/api/cart/coupons` | B01 |

차단 권장: `/api/auth/signup`, `/api/auth/logout`, `DELETE *`, `/api/test/*`(브라우저에서는 금지). 프론트는 외부 리소스(폰트·CDN·분석 스크립트)를 쓰지 않고, WebSocket·SSE·서비스 워커·응답 압축도 없다. 화면과 API는 같은 origin이다.

### 4.2 엔진 쪽에 필요한 변경 (검증으로 확인된 차단 지점)

1. **예상된 4xx 응답을 실행 오류로 취급하지 않기.** 비로그인 상태의 첫 화면은 `GET /api/auth/me` → 401을 정상적으로 받는다(`src/stores/session.js`). 현재 엔진은 400 이상 응답을 모두 `HTTP_ERROR`로 막아서, 로그인이 필요 없는 B03·N01도 첫 단계에서 `inconclusive`가 된다. 수정 후 버전의 B01은 두 번째 쿠폰 적용에 409 `COUPON_ALREADY_APPLIED`를 받는 것이 정상이므로 재검증에도 필요하다. 허용 목록 예: `GET /api/auth/me` 401, `POST /api/cart/coupons` 409, `POST /api/auth/login` 401(실패 시나리오 한정).
2. **메서드 상한 확장.** `policy.py`의 GET/HEAD/OPTIONS 전역 상한 때문에 `RunPolicy(allowed_methods=('GET','POST'))`도 예외가 난다. 4.1의 메서드+경로 단위 허용이 필요하다.
3. **요청 본문·헤더·쿠키 전달.** 현재 전송 모듈은 URL과 메서드만 넘기고 요청 본문·`Content-Type`·`Cookie`를 전달하지 않으며, 응답의 `Set-Cookie`를 제거한다. 메서드만 허용해서는 로그인이 성립하지 않는다. 필요한 것: JSON 본문과 `Content-Type: application/json` 전달, 시도(BrowserContext)별 세션 쿠키 왕복. 로그인 우회(쿠키 주입)로 대신하지 않는다.
4. **요청 예산.** 로그인 → 상품 → 장바구니를 페이지 이동으로 수행하는 B01은 시도당 약 33개, 두 시도 66개 요청을 보낸다(Node Playwright 실측). 엔진 기본값(분당 20, 전체 60)으로는 부족하다. 실측에 맞춰 명시 예산을 승인한다.
5. **구조화된 관찰.** B03의 카드 개수·API `items` 길이, N01의 `disabled` 여부를 보고서 근거로 남기려면 텍스트 비교 외의 관찰값(개수, 불리언 속성, 응답 필드)이 필요하다.

## 5. 시나리오별 기준 단계

selector는 [기능 명세서 7장](./FUNCTIONAL_SPEC.md#7-자동화용-selector-계약)의 `data-testid`를 쓴다. 표기 `[tid=x]`는 `[data-testid="x"]`.

### 공통: 로그인
1. navigate `/login`
2. fill `[tid=login-email]` ← `{{TEST_EMAIL}}`
3. fill `[tid=login-password]` ← `{{TEST_PASSWORD}}`
4. click `[tid=login-submit]`
5. 준비: `[tid=user-menu]` 텍스트 `QA 테스터 1님`

### B01 쿠폰 중복 적용
1. 공통 로그인
2. navigate `/products/1` → click `[tid=add-to-cart]` → 준비: `[tid=add-to-cart-message]` = `장바구니에 담았습니다.`
3. navigate `/cart` → 관찰 `[tid=cart-total]` = `30,000원`
4. fill `[tid=coupon-input]` ← `SAVE5000` → click `[tid=apply-coupon]` → 관찰 `[tid=cart-total]` = `25,000원`
5. fill `[tid=coupon-input]` ← `SAVE5000` → click `[tid=apply-coupon]` → 관찰 `[tid=cart-total]`, `[tid=coupon-message]`, `[tid=applied-coupons]`
6. 기대(정책 5.2): `25,000원` 유지, 메시지 `이미 적용된 쿠폰입니다.`

### B02 수량 감소 후 합계
1. 공통 로그인
2. navigate `/products/1` → click `[tid=add-to-cart]` → 준비 메시지 확인
3. navigate `/cart` → click `[tid=quantity-increase]` → 관찰 `[tid=cart-quantity]` = `2`, `[tid=cart-subtotal]` = `60,000원`
4. click `[tid=quantity-decrease]` → 관찰 `[tid=cart-quantity]` = `1`, `[tid=cart-subtotal]`
5. 기대(정책 5.1): `30,000원`

### B03 빈 검색 결과
로그인 불필요.
1. navigate `/`
2. fill `[tid=search-input]` ← `키보드` → click `[tid=search-submit]` → 준비: `[tid=search-summary]` = `'키보드' 검색 결과 2개`
3. fill `[tid=search-input]` ← `냉장고` → click `[tid=search-submit]` → 준비: `[tid=search-summary]` = `'냉장고' 검색 결과 0개`
4. 관찰: `[tid=product-card]` 개수, `[tid=empty-results]` 존재 여부, `GET /api/products?q=냉장고` 응답의 `items` 길이
5. 기대(정책 5.3): 카드 0개 + `검색 결과가 없습니다.`

### N01 품절 상품 담기 버튼
1. (선택) 공통 로그인
2. navigate `/products/3`
3. 관찰: `[tid=add-to-cart]`의 `disabled` 속성과 텍스트 `품절`, `[tid=sold-out-badge]` = `품절`, `[tid=stock-status]` = `품절`
4. 기대(정책 5.4): 비활성화가 정상. "버튼이 안 눌린다"는 현상은 재현되지만 정책상 정상 동작(`expected_behavior`)이다.

주의: 비활성 버튼을 click 하면 Playwright는 활성화를 기다리다 시간 초과된다. N01은 click 대신 `disabled` 속성으로 관찰한다. 현재 엔진에서도 `[data-testid="add-to-cart"][disabled]` 선택자 + 텍스트 `품절`로 존재 여부는 확인할 수 있다. 다만 속성이 없을 때 명확한 false가 아니라 선택자 실패(inconclusive)가 되므로, 엔진에 불리언 관찰(예: `assert_disabled`)을 추가하는 편이 판정에 적합하다.

### 금액 비교 기준
- B01은 **최종 금액(`cart-total`, API `total`)**을 비교한다. 상품 합계(`subtotal`)는 30,000원으로 변하지 않는다.
- B02는 **상품 합계(`cart-subtotal`, API `subtotal`)**를 비교한다.

## 6. 실행 명령 (BugLab-shop)

```bash
npm install && npm --prefix server install
npm run build
cp server/.env.dev.example server/.env.dev   # 비밀값 수정
npm run start:dev                            # http://localhost:3100
```
