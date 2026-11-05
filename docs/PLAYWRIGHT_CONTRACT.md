# Playwright 실행 계약 (dev 환경)

문서 버전: v2.0 (2026-11-05)
대상: 메타포 엔진·백엔드 워커 담당자

dev는 production과 같은 코드·로그인 화면을 사용한다. 고정 테스트 계정과 워커 전용 초기화 API만 추가된다.
이 문서는 실행 조건과 **정상 기대값**을 정의한다. 실제 결함의 관찰값·구현 원인은 팀 전용 `INJECTED_DEFECTS.md`에만 있으며 AI·엔진 입력으로 넣지 않는다.

## 1. 대상 정보

| 항목 | 값 |
|---|---|
| 로컬 origin | `http://localhost:3100` |
| 준비 확인 | `GET /api/health`의 `status=ok`, `env=dev`, 대상 `commit` |
| 테스트 계정 | `qa1@buglab.test`, `qa2@buglab.test` |
| 비밀번호 | 워커 비밀 저장소의 `TEST_ACCOUNT_PASSWORD` |
| 초기화 토큰 | 워커 비밀 저장소의 `TEST_CONTROL_TOKEN` |
| 권장 viewport | 1440×1000, reduced-motion=reduce |

워커에서 실제 접근 가능한 동일 origin을 사용한다. 발표자의 localhost를 원격 워커의 localhost로 오인하지 않는다.
계획에는 `{{TEST_EMAIL}}`, `{{TEST_PASSWORD}}` 자리표시자만 넣고 실제 값·쿠키·토큰은 로그·보고서에 남기지 않는다.

## 2. 공통 로그인

1. `/login` 이동.
2. `[data-testid=login-email]`, `[data-testid=login-password]` 입력.
3. `[data-testid=login-submit]` 클릭.
4. `[data-testid=user-menu]`에 해당 테스트 사용자 이름이 표시될 때까지 기다린다.

로그인을 쿠키 주입으로 건너뛰지 않는다. B01/B02/B04/B05에는 로그인이 필요하다.
B03의 버튼 상태 관찰과 B06은 비로그인도 가능하지만 B03의 서버 응답까지 확인하려면 로그인한다.

## 3. 시도별 초기화

1. 신뢰된 워커 코드가 `POST /api/test/reset`, `X-Test-Token`, `{"email":"qa1@buglab.test"}`를 전송해 200 확인.
2. 새 BrowserContext 생성. 기존 컨텍스트를 재사용하지 않는다.
3. 공통 로그인 실행. 초기화는 해당 계정의 장바구니·쿠폰·찜·세션·로그인 실패 기록을 비운다.

초기화 실패는 `inconclusive`다. 브라우저 페이지에서는 `/api/test/*`를 호출하지 않는다.
동시 시도는 qa1/qa2를 나눠 사용한다. BrowserContext 분리만으로 서버 DB는 초기화되지 않는다.
production에는 초기화 API가 없다. 발표용 계정은 `npm --prefix server run reset:prod-demo`로 장바구니·쿠폰·찜을 초기화한다.

## 4. 엔진 요청 허용 범위

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/`, `/login`, `/cart`, `/favorites`, `/products/:id`, `/assets/*`, `/images/*`, `/favicon.svg` | 페이지·정적 리소스 |
| GET | `/api/health`, `/api/auth/me`, `/api/products`, `/api/products/:id`, `/api/cart`, `/api/favorites` | 상태 조회 |
| POST | `/api/auth/login` | 정상 화면 로그인 |
| POST | `/api/cart/items`, `/api/cart/coupons`, `/api/favorites` | 담기·쿠폰·찜 |
| PATCH | `/api/cart/items/:productId` | 수량 변경 |
| DELETE | `/api/favorites/:favoriteId` | 찜 항목 UUID로 해제 |
| DELETE | `/api/cart/items/:productId` | 정상 삭제 대조가 필요한 경우에만 |

`/api/auth/signup`, `/api/test/*` 및 명시하지 않은 쓰기 요청은 워커 브라우저에서 허용하지 않는다.

### 엔진 연동 확인 사항

- JSON 본문·Content-Type·시도별 Cookie·응답 Set-Cookie 왕복이 필요하다.
- 비로그인 `GET /api/auth/me`는 200 `{ "user": null }`이다(401을 내지 않음). 보호 API의 예상 오류도 전체 실행 실패로 일괄 변환하지 않는다.
- 관찰 가능한 오류 예: 쿠폰 중복 409, 품절 담기 409, 없는 찜 항목 해제 404. 오류 응답과 화면 전후 상태를 함께 기록한다.
- `reload`와 실제 브라우저 `back` 동작이 필요하다. 내부 링크 클릭을 전체 문서 이동으로 바꾸지 않는다.
- 수량·금액 텍스트, 행 개수, `disabled`, `aria-pressed`, 팝업 존재 여부, 현재 URL을 구조화해 기록한다.
- 고정 sleep 대신 로딩·요청 종료·버튼 활성화·기대 텍스트를 기다린다. 빠른 담기는 `aria-busy=false`까지 기다린다.
- 요청 예산은 새 화면의 추천·찜 조회를 포함해 실측 후 정한다. v1의 요청 수 측정을 v2에 그대로 적용하지 않는다.

과거 원본 Core_engine(b5fdf52)은 2026-11-04 검증에서 GET/HEAD/OPTIONS 중심 정책, 본문·쿠키·401 처리 문제로 차단됐다.
이는 **과거 엔진 상태**다. 이번 쇼핑몰 변경에서는 엔진 코드를 수정·재검증하지 않았다. 아래 시나리오의 일반 Playwright 통과가 실제 엔진 통과를 의미하지 않는다.

## 5. 상품별 기준 단계와 정상 기대값

아래 `[tid=x]`는 `[data-testid="x"]`다. 여러 상품이 있는 영역은 `data-product-id`로 범위를 한정한다.

### B01 — 쿠폰 사용 후 페이지 재진입
1. 로그인 → `/products/1` → `[tid=add-to-cart]` 클릭 → 완료 문구 확인.
2. `/cart` → `[tid=cart-total]` 30,000원 확인.
3. `[tid=coupon-input]`에 SAVE5000 입력 → `[tid=apply-coupon]` → 25,000원 확인.
4. 새로고침 → 같은 쿠폰 재적용.
5. 정상 기대: 25,000원 유지, 중복 안내, 적용 쿠폰 1개.
6. 대조: 새로고침 없이 재적용. 다른 상품만 담은 장바구니에서도 비교.

### B02 — 수량 증가 후 감소
1. 로그인 → `/products/2`에서 1개 담기 → `/cart`.
2. 상품 2 행의 `[tid=quantity-increase]` → 수량 2, 합계 36,000원 확인.
3. 같은 행의 `[tid=quantity-decrease]` → 수량 1 확인.
4. 정상 기대: `[tid=cart-line-total]`, `[tid=cart-subtotal]` 모두 18,000원.
5. 다른 재고 있는 상품에서도 같은 동작을 대조한다.

### B03 — 추천상품으로 상세 전환
1. 로그인 → `/products/1`.
2. `[tid=related-products] [data-product-id="3"] a` 클릭. `goto`로 대체하지 않는다.
3. `[tid=product-name]`이 한정판으로 바뀐 뒤 재고 문구·버튼 상태 관찰.
4. 정상 기대: 품절 표시, `[tid=add-to-cart]` disabled·문구 품절.
5. 버튼이 실제 활성화된 경우에만 클릭해 응답과 메시지를 관찰한다. 비활성 버튼을 강제 클릭하지 않는다.
6. 대조: `/products/3` 직접 이동 또는 새로고침.

### B04 — 검색 결과 빠른 담기
1. 로그인 → 홈 → 검색 입력에 `허브` → 검색 제출.
2. 상품 4 카드의 `[tid=quick-add]`를 **한 번** 클릭.
3. 해당 버튼 `aria-busy=false`, 완료 문구를 기다린다.
4. 장바구니로 이동해 수량·금액을 관찰.
5. 정상 기대: 1개, 42,000원. 담기 요청 1회.
6. 대조: `/products/4` 상세 담기, 다른 상품의 검색 빠른 담기.

### B05 — 저장된 찜 해제
1. 로그인 → `/products/5` → `[tid=favorite-toggle]` 클릭 → `aria-pressed=true` 확인.
2. 새로고침 → 찜 상태 복원 확인.
3. 같은 버튼 클릭 → `aria-pressed=false`, 요청 완료를 기다린다.
4. 새로고침 → 찜 상태 및 `/favorites`의 상품 5 존재 여부 관찰.
5. 정상 기대: 해제 상태 유지, 찜 목록에 상품 5 없음.
6. 대조: 새로고침 없이 추가 직후 해제, 다른 상품의 새로고침 후 해제.

### B06 — 배송 팝업을 연 채 뒤로 가기
1. 홈 → 상품 6 카드 클릭 → `[tid=delivery-open]` 클릭.
2. `[tid=delivery-dialog]`와 `[tid=delivery-product-name]` 확인.
3. 브라우저 `back` 실행. `goto('/')`로 대체하지 않는다.
4. URL이 홈으로 바뀐 뒤 팝업 존재·배경 조작 가능 여부 관찰.
5. 정상 기대: 배송 팝업 없음, 배경 스크롤·포커스 잠금 해제.
6. 대조: 다른 상품의 같은 경로, 상품 6의 X·확인·Escape·배경 클릭 닫기.

### 정상 회귀 확인
- 전체 6개 → `키보드` 검색 2개 → `냉장고` 검색 0개·빈 결과 안내. 직접 빈 결과 URL·새로고침도 동일.
- `/products/3` 직접 진입 시 품절 버튼 비활성화는 정상이다(기존 N01).
- 상품 1을 제외한 장바구니의 쿠폰 중복은 서버가 거부한다.
- 상품 2를 제외한 수량 감소는 상품 합계를 재계산한다.

## 6. 실행과 검증

```sh
npm run build
npm run start:dev
```

로컬 독립 검증: Python Playwright와 Chromium이 준비된 환경에서 `python tests/demo_browser.py --repeat 2`.
이 스크립트는 임시 DB·동적 포트·격리된 계정을 사용하며 기존 `.env`·실행 중인 서버·DB를 수정하지 않는다.
production 검증의 회원가입은 독립 검증 스크립트 전용이며 위 엔진 쓰기 허용 목록에 회원가입을 추가하는 근거가 아니다.
