# BugLab Shop API 명세서

문서 버전: v2.0 (2026-11-05)
관련 문서: [기능 명세서](./FUNCTIONAL_SPEC.md) · [Playwright 실행 계약](./PLAYWRIGHT_CONTRACT.md)

## 1. 공통 규약

- Base path: `/api`. 화면과 같은 origin에서 서빙한다.
- 요청·응답 본문은 JSON(UTF-8). 응답 압축 없음.
- 상태를 바꾸는 요청(POST·PATCH·DELETE)은 `Content-Type: application/json` 필수. 아니면 `415 UNSUPPORTED_MEDIA_TYPE`. 본문이 없는 요청도 `{}`를 보낸다.
- 요청 본문 최대 10KB. 초과하거나 JSON 형식이 깨지면 `400 VALIDATION_ERROR`.
- 인증: 세션 쿠키(`buglab_sid` / dev는 `buglab_dev_sid`). 인증이 필요한 API에 쿠키가 없거나 만료되면 `401 UNAUTHENTICATED`.
- CORS 헤더를 보내지 않는다.
- 모든 응답에 `Cache-Control: no-store`(API 한정).
- 금액은 원 단위 정수.
- 정의되지 않은 `/api/*` 경로는 로그인 여부와 무관하게 `404 NOT_FOUND`. 정의된 보호 API는 비로그인 시 `401 UNAUTHENTICATED`다.

### 오류 형식

```json
{ "error": { "code": "COUPON_NOT_FOUND", "message": "존재하지 않는 쿠폰입니다." } }
```

| HTTP | code | message (화면에 그대로 표시 가능) |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 입력값을 확인해 주세요. (필드별 문구로 대체 가능) |
| 401 | `UNAUTHENTICATED` | 로그인이 필요합니다. |
| 401 | `INVALID_CREDENTIALS` | 이메일 또는 비밀번호가 올바르지 않습니다. |
| 401 | `TEST_TOKEN_INVALID` | 테스트 토큰이 올바르지 않습니다. |
| 403 | `NOT_TEST_ACCOUNT` | 테스트 계정만 초기화할 수 있습니다. |
| 404 | `NOT_FOUND` | 요청한 리소스를 찾을 수 없습니다. |
| 404 | `PRODUCT_NOT_FOUND` | 상품을 찾을 수 없습니다. |
| 404 | `CART_ITEM_NOT_FOUND` | 장바구니에 없는 상품입니다. |
| 404 | `FAVORITE_NOT_FOUND` | 찜 목록에 없는 상품입니다. |
| 404 | `COUPON_NOT_FOUND` | 존재하지 않는 쿠폰입니다. |
| 409 | `EMAIL_TAKEN` | 이미 가입된 이메일입니다. |
| 409 | `OUT_OF_STOCK` | 품절된 상품입니다. |
| 409 | `QUANTITY_OUT_OF_RANGE` | 수량은 1개 이상 {max}개 이하로 선택할 수 있습니다. |
| 409 | `CART_EMPTY` | 장바구니가 비어 있습니다. |
| 409 | `COUPON_ALREADY_APPLIED` | 이미 적용된 쿠폰입니다. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | JSON 요청만 지원합니다. |
| 429 | `TOO_MANY_ATTEMPTS` | 잠시 후 다시 시도해 주세요. |
| 500 | `INTERNAL_ERROR` | 일시적인 오류가 발생했습니다. |

## 2. 공통 객체

### User
```json
{ "id": 1, "email": "qa1@buglab.test", "name": "QA 테스터 1" }
```

### Product
```json
{
  "id": 1,
  "name": "BugLab 무선 키보드",
  "category": "키보드",
  "price": 30000,
  "stock": 50,
  "soldOut": false,
  "imageUrl": "/images/photos/wireless-keyboard.jpg",
  "description": "둥근 키캡과 조용한 타건감의 2.4GHz 무선 키보드"
}
```

### Cart
```json
{
  "items": [
    { "productId": 1, "name": "BugLab 무선 키보드", "imageUrl": "/images/photos/wireless-keyboard.jpg",
      "unitPrice": 30000, "quantity": 1, "maxQuantity": 10, "lineTotal": 30000 }
  ],
  "appliedCoupons": [ { "code": "SAVE5000", "amount": 5000 } ],
  "itemCount": 1,
  "subtotal": 30000,
  "discount": 5000,
  "total": 25000
}
```
- `items`는 담은 순서(오래된 것 먼저).
- `itemCount` = 수량 합계. `maxQuantity` = min(10, 재고).
- `appliedCoupons`는 적용된 순서. `discount` = Σ amount. `total` = max(0, subtotal − discount).
- 빈 장바구니: `items: []`, `appliedCoupons: []`, 금액 0. 장바구니가 비면 적용 쿠폰도 함께 제거된다.

## 3. 엔드포인트 목록

| 메서드 | 경로 | 인증 | 환경 | 용도 |
|---|---|---|---|---|
| GET | `/api/health` | - | 모두 | 상태·환경·커밋 |
| POST | `/api/auth/signup` | - | 모두 | 회원가입 + 로그인 |
| POST | `/api/auth/login` | - | 모두 | 로그인 |
| POST | `/api/auth/logout` | 선택 | 모두 | 로그아웃 |
| GET | `/api/auth/me` | 필요 | 모두 | 현재 사용자 |
| GET | `/api/products` | - | 모두 | 목록·검색 |
| GET | `/api/products/:id` | - | 모두 | 상세 |
| GET | `/api/cart` | 필요 | 모두 | 장바구니 조회 |
| POST | `/api/cart/items` | 필요 | 모두 | 담기 |
| PATCH | `/api/cart/items/:productId` | 필요 | 모두 | 수량 변경 |
| DELETE | `/api/cart/items/:productId` | 필요 | 모두 | 삭제 |
| POST | `/api/cart/coupons` | 필요 | 모두 | 쿠폰 적용 |
| GET | `/api/favorites` | 필요 | 모두 | 계정별 찜 목록 |
| POST | `/api/favorites` | 필요 | 모두 | 찜 추가(같은 상품 중복 저장 안 함) |
| DELETE | `/api/favorites/:favoriteId` | 필요 | 모두 | 찜 항목 UUID로 해제 |
| POST | `/api/test/reset` | `X-Test-Token` | dev만 | 테스트 계정 초기화 |

## 4. 상세

### GET /api/health
200
```json
{ "status": "ok", "env": "dev", "commit": "1a2b3c4", "startedAt": "2026-11-04T13:00:00.000Z" }
```
`commit`은 `BUILD_COMMIT` 환경변수, 없으면 시작 시 `git rev-parse --short HEAD`, 실패하면 `"unknown"`.

### POST /api/auth/signup
요청 `{ "name": "홍길동", "email": "user@example.com", "password": "password123" }`
- 201 `{ "user": User }` + `Set-Cookie`
- 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`

### POST /api/auth/login
요청 `{ "email": "qa1@buglab.test", "password": "..." }`
- 200 `{ "user": User }` + `Set-Cookie`. 기존 세션 쿠키가 있으면 새 세션으로 교체한다.
- 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`, 429 `TOO_MANY_ATTEMPTS`

### POST /api/auth/logout
요청 `{}`. 204. 서버 세션을 삭제하고 쿠키를 만료시킨다. 세션이 없어도 204.

### GET /api/auth/me
200 `{ "user": User }` / 401 `UNAUTHENTICATED`

### GET /api/products?q=
- `q` 선택. 앞뒤 공백 제거 후 상품명 부분 일치(대소문자 무시). 비거나 없으면 전체.
- 200 `{ "items": Product[], "query": "키보드" }` — 결과가 없으면 `items: []`. id 오름차순.

### GET /api/products/:id
200 `Product` / 404 `PRODUCT_NOT_FOUND` (숫자가 아닌 id 포함)

### GET /api/cart
200 `Cart`

### POST /api/cart/items
요청 `{ "productId": 1, "quantity": 1 }` (`quantity` 생략 시 1)
- 이미 있으면 기존 수량에 더한다.
- 200 `Cart`
- 404 `PRODUCT_NOT_FOUND`, 409 `OUT_OF_STOCK`, 409 `QUANTITY_OUT_OF_RANGE`

### PATCH /api/cart/items/:productId
요청 `{ "quantity": 2 }` (변경 후 절대값)
- 200 `Cart`
- 404 `CART_ITEM_NOT_FOUND`, 409 `QUANTITY_OUT_OF_RANGE`, 400 `VALIDATION_ERROR`(정수가 아님)

### DELETE /api/cart/items/:productId
요청 `{}`. 200 `Cart` / 404 `CART_ITEM_NOT_FOUND`

### POST /api/cart/coupons
요청 `{ "code": "SAVE5000" }` (공백 제거·대문자 변환)
- 200 `Cart`
- 400 `VALIDATION_ERROR`(빈 코드), 404 `COUPON_NOT_FOUND`, 409 `CART_EMPTY`, 409 `COUPON_ALREADY_APPLIED`

### GET /api/favorites
200 `{ "items": [{ "id": "<UUID>", "productId": 5, "product": Product }] }`.
본인 계정의 항목만 생성 순서로 반환한다. 빈 목록은 `items: []`.

### POST /api/favorites
요청 `{ "productId": 5 }`. 200으로 위 목록 객체 반환. 이미 저장된 상품은 동일 항목을 유지한다.
400 `VALIDATION_ERROR`, 404 `PRODUCT_NOT_FOUND`. 서버는 상품 5를 포함해 동일하게 정상 동작한다.

### DELETE /api/favorites/:favoriteId
요청 `{}`. URL 인자는 상품 ID가 아니라 **찜 항목의 UUID**다.
200으로 남은 목록 객체 반환. 없거나 타인 소유 ID는 모두 404 `FAVORITE_NOT_FOUND`.

### POST /api/test/reset (dev 전용)
헤더 `X-Test-Token: <TEST_CONTROL_TOKEN>`, 요청 `{ "email": "qa1@buglab.test" }`
- 해당 테스트 계정의 장바구니 상품·쿠폰 적용 이력·찜·세션·로그인 실패 카운터를 지운다. 다른 계정은 건드리지 않는다.
- 200 `{ "email": "qa1@buglab.test", "cart": Cart(빈 장바구니) }`
- 401 `TEST_TOKEN_INVALID`(상수 시간 비교), 403 `NOT_TEST_ACCOUNT`, 404 `NOT_FOUND`(없는 계정)
- `APP_ENV=production`에서는 라우트 자체가 없다 → 404 `NOT_FOUND`.
- 브라우저(Playwright 페이지)가 아니라 워커의 신뢰된 서버 코드가 호출한다.

## 5. 정적 파일 서빙

- `/api`가 아닌 GET 요청은 `dist/`의 파일을 반환하고, 없으면 `dist/index.html`(SPA fallback).
- `index.html`은 `Cache-Control: no-cache`, `/assets/*`는 장기 캐시 가능.
- 보안 헤더: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`,
  `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'`.
- production에서 메타포 SDK가 켜져 있으면 `index.html`에 SDK 스크립트 태그를 넣고 CSP에 SDK·API origin을 추가한다. 자세한 내용은 [기능 명세서 9장](./FUNCTIONAL_SPEC.md#9-메타포-sdk-연동).

## 6. 서버 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `APP_ENV` | `dev` | `production` 또는 `dev` |
| `PORT` | 3100(dev) / 3200(production) | |
| `HOST` | `127.0.0.1` | Docker에서는 `0.0.0.0` |
| `DATA_DIR` | `server/data` | SQLite 파일 위치. 파일명 `{APP_ENV}.db` |
| `STATIC_DIR` | `<repo>/dist` | 빌드 결과물 |
| `SESSION_COOKIE_NAME` | `buglab_dev_sid` / `buglab_sid` | |
| `COOKIE_SECURE` | `false` | HTTPS 배포 시 `true` |
| `BUILD_COMMIT` | (git) | |
| `TEST_CONTROL_TOKEN` | 없음 | dev 필수. 없으면 dev 서버 시작 실패 |
| `TEST_ACCOUNT_PASSWORD` | 없음 | dev 필수. `qa1`/`qa2` 시드 비밀번호 |
| `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD` | 없음 | production 선택. 둘 다 있으면 발표용 계정 시드 |
| `METAPHOR_SDK_URL` | 없음 | production 선택. 메타포 SDK 스크립트 URL (http/https) |
| `METAPHOR_API_URL` | 없음 | production 선택. SDK가 신고를 보내는 메타포 API base URL |
| `METAPHOR_PROJECT_KEY` | 없음 | production 선택. 공개 프로젝트 키(영문·숫자·`_`·`-`, 1–128자). 세 SDK 값은 모두 있거나 모두 없어야 함. dev에서는 무시 |
