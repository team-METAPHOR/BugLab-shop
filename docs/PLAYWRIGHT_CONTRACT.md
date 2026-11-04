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

## 4. 엔진 요청 허용 범위

현재 Core_engine은 GET/HEAD/OPTIONS만 허용한다. 실제 인증 서버를 쓰므로 아래 POST/PATCH를 **정확한 경로 단위로** 허용하는 정책 확장이 필요하다. 이 작업은 엔진 담당 범위이고, BugLab-shop 쪽에서는 아직 반영하지 않았다.

| 메서드 | 경로 | 필요한 시나리오 |
|---|---|---|
| GET | `/`, `/login`, `/cart`, `/products/:id`, `/assets/*`, `/images/*`, `/favicon.svg` | 전체 |
| GET | `/api/health`, `/api/auth/me`, `/api/products`, `/api/products/:id`, `/api/cart` | 전체 |
| POST | `/api/auth/login` | B01, B02, N01(선택) |
| POST | `/api/cart/items` | B01, B02 |
| PATCH | `/api/cart/items/:productId` | B02 |
| POST | `/api/cart/coupons` | B01 |

차단 권장: `/api/auth/signup`, `/api/auth/logout`, `DELETE *`, `/api/test/*`(브라우저에서는 금지). 브라우저가 이 밖의 요청을 보내지 않도록 프론트는 외부 리소스(폰트·CDN·분석 스크립트)를 쓰지 않는다. 화면은 WebSocket·SSE·서비스 워커를 쓰지 않는다.

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

주의: 비활성 버튼을 click 하면 Playwright는 활성화를 기다리다 시간 초과된다. N01은 click 대신 `disabled` 속성으로 관찰해야 한다. 현재 Core_engine 계획 동작(`navigate`, `click`, `fill`, `assert_text`)에는 속성 확인이 없으므로 엔진 쪽에 `assert_disabled` 같은 관찰 동작 추가가 필요하다.

## 6. 실행 명령 (BugLab-shop)

```bash
npm install && npm --prefix server install
npm run build
cp server/.env.dev.example server/.env.dev   # 비밀값 수정
npm run start:dev                            # http://localhost:3100
```
