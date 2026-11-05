# BugLab Shop 기능 명세서

문서 버전: v1.0 (2026-11-04)
관련 문서: [API 명세서](./API_SPEC.md) · [Playwright 실행 계약](./PLAYWRIGHT_CONTRACT.md) · [의도적 결함 목록(팀 전용)](./INJECTED_DEFECTS.md)

BugLab Shop은 메타포 검증 플랫폼을 시연하기 위한 가상 쇼핑몰이다. 겉보기에는 평범한 쇼핑몰이고, 일부 로직에 의도적인 결함이 있다. 실제 결제·실제 개인정보는 다루지 않는다.

이 문서의 "제품 정책"은 플랫폼이 기대 동작의 근거로 사용할 수 있는 정상 정책이다. 실제로 심어진 결함은 [INJECTED_DEFECTS.md](./INJECTED_DEFECTS.md)에만 적고, 그 문서는 AI·엔진 입력으로 사용하지 않는다.

## 1. 실행 환경

같은 커밋을 두 가지 모드로 실행한다. 버그는 두 환경에 똑같이 존재한다.

| 구분 | 운영(production) | 개발·재현(dev) |
|---|---|---|
| 용도 | 일반 사용자가 쓰는 "실서비스". 사용자가 버그를 발견하는 곳 | Playwright가 로그인해서 재현하는 곳 |
| 로컬 주소 | http://localhost:3200 | http://localhost:3100 |
| `APP_ENV` | `production` | `dev` |
| 로그인 | 있음 (회원가입·로그인) | 있음 (같은 화면, 같은 인증 서버 코드) |
| 계정 | 회원가입 계정. 선택적으로 발표용 데모 계정 시드 | 고정 테스트 계정 `qa1@buglab.test`, `qa2@buglab.test` 시드 |
| 테스트 제어 API (`/api/test/*`) | 없음 (404) | 있음. `X-Test-Token` 헤더 필수 |
| 세션 쿠키 이름 | `buglab_sid` | `buglab_dev_sid` |
| DB 파일 | `server/data/production.db` | `server/data/dev.db` |
| CAPTCHA·OTP·팝업·외부 결제 | 없음 | 없음 |
| 메타포 SDK (`METAPHOR_SDK_*`) | 설정하면 켜짐 | 항상 꺼짐 (설정해도 무시) |

- 두 환경 모두 `npm run build`로 만든 정적 파일을 백엔드 서버가 같은 origin에서 서빙한다. 화면과 API가 같은 origin이어야 엔진의 단일 origin 정책을 통과한다.
- Vite 개발 서버(`npm run dev`, 5173)는 코드 작성용이다. HMR WebSocket이 열리므로 Playwright 대상으로 쓰지 않는다.
- 응답 압축(gzip/brotli)을 쓰지 않는다. 엔진이 압축 응답을 지원하지 않는다.
- localhost에서는 쿠키가 포트를 구분하지 않으므로 환경별로 쿠키 이름을 다르게 둔다.
- 화면 우측 하단 푸터에 `env · commit`을 작게 표시한다(`data-testid="app-env"`). 보고서에 대상 버전을 남기기 위한 용도다.

## 2. 로그인 필요 범위

| 기능 | 비로그인 | 로그인 |
|---|---|---|
| 상품 목록 `/` | 가능 | 가능 |
| 상품 검색 `/?q=` | 가능 | 가능 |
| 상품 상세 `/products/:id` | 가능 | 가능 |
| 장바구니 담기 | 불가 → `/login?next=/products/:id`로 이동 | 가능 |
| 장바구니 보기 `/cart` | 불가 → `/login?next=/cart`로 이동 | 가능 |
| 수량 변경·삭제 | 불가 | 가능 |
| 쿠폰 적용 | 불가 | 가능 |
| 회원가입 `/signup`, 로그인 `/login` | 가능 | 로그인 상태면 `/`로 이동 |

- 로그인 후에는 `next` 쿼리의 경로로 이동한다. `next`는 `/`로 시작하고 `//`로 시작하지 않는 상대 경로만 허용하고, 나머지는 `/`로 대체한다(오픈 리다이렉트 방지).
- 로그인 후 자동으로 장바구니에 담지 않는다. 사용자가 상세 페이지에서 다시 버튼을 누른다. 재현 단계를 단순하고 결정적으로 유지하기 위해서다.
- 품절 상품의 담기 버튼은 로그인 여부와 관계없이 비활성화된다.

## 3. 인증 정책

- 회원가입: 이름(1–30자), 이메일(형식 검사, 소문자 정규화), 비밀번호(8–128자). 가입 즉시 로그인된다.
- 비밀번호는 scrypt + 사용자별 salt로 해시해 저장한다. 평문·해시를 로그와 응답에 남기지 않는다.
- 세션: 서버 DB에 저장하는 불투명 토큰. 쿠키는 `HttpOnly`, `SameSite=Lax`, `Path=/`, 유효기간 24시간. `COOKIE_SECURE=true`이면 `Secure`.
- 로그인 실패 메시지는 이메일 존재 여부를 드러내지 않는다: "이메일 또는 비밀번호가 올바르지 않습니다."
- 같은 IP+이메일로 15분 안에 10회 실패하면 429를 반환한다.
- 상태를 바꾸는 API 요청은 `Content-Type: application/json`만 받는다(CSRF 완화). CORS 헤더를 내보내지 않는다.

## 4. 상품 데이터 (고정 시드)

| id | 이름 | 카테고리 | 가격 | 재고 | imageUrl |
|---|---|---|---|---|---|
| 1 | BugLab 무선 키보드 | 키보드 | 30,000원 | 50 | `/images/photos/wireless-keyboard.jpg` |
| 2 | BugLab 저소음 마우스 | 마우스 | 18,000원 | 40 | `/images/photos/silent-mouse.jpg` |
| 3 | BugLab 기계식 키보드 한정판 | 키보드 | 89,000원 | 0 (품절) | `/images/photos/mechanical-keyboard.jpg` |
| 4 | 7포트 USB 3.0 멀티 허브 | 액세서리 | 42,000원 | 25 | `/images/photos/usb-hub.jpg` |
| 5 | 데스크 매트 XL | 액세서리 | 15,000원 | 60 | `/images/photos/desk-mat.jpg` |
| 6 | 원목 모니터 받침대 | 액세서리 | 35,000원 | 15 | `/images/photos/monitor-stand.jpg` |

설명(description)은 한 문장의 가상 문구로 백엔드 시드에 둔다. 이미지 파일은 프론트 `public/images/photos/`에 있다. 사진은 Unsplash(Unsplash License)에서 받아 저장했고, 사진가 출처는 `/credits` 화면과 `src/data/photoCredits.js`에 있다. 메인 배너는 `/images/photos/hero-desk.jpg`를 쓴다.

- 재고는 주문 기능이 없으므로 변하지 않는다. 장바구니 담기가 재고를 차감하지 않는다.
- 상품 이미지는 같은 origin의 `/images/photos/*.jpg`를 사용한다. 외부 이미지·CDN을 쓰지 않는다(Unsplash 사진도 핫링크하지 않고 저장본을 서빙한다).

## 5. 제품 정책 (정상 동작 기준)

### 5.1 장바구니
- 사용자당 장바구니 1개. 서버 DB에 저장되며 새로고침·재로그인 후에도 유지된다.
- 같은 상품을 다시 담으면 수량이 1 늘어난다.
- 수량 범위는 1 ~ min(10, 재고). 범위를 벗어나는 변경은 거부한다.
- 품절(재고 0) 상품은 담을 수 없다.
- 상품 합계(subtotal) = Σ(단가 × 수량). 수량을 늘리거나 줄이면 즉시 다시 계산된다.
- 최종 금액(total) = max(0, 상품 합계 − 할인 금액). 배송비는 이번 범위에 없다.

### 5.2 쿠폰
- 쿠폰 `SAVE5000`: 정액 5,000원 할인. 최소 주문 금액 없음.
- **동일한 쿠폰은 한 장바구니에 한 번만 적용된다.** 이미 적용된 쿠폰을 다시 적용하면 거부하고 "이미 적용된 쿠폰입니다."를 안내한다. 금액은 바뀌지 않는다.
- 존재하지 않는 코드는 거부한다: "존재하지 않는 쿠폰입니다."
- 빈 장바구니에는 쿠폰을 적용할 수 없다.
- 쿠폰 코드는 앞뒤 공백을 제거하고 대문자로 바꿔 비교한다.

### 5.3 검색
- 상품명에 검색어가 포함된 상품을 보여준다(대소문자 무시, 앞뒤 공백 제거). 빈 검색어는 전체 목록이다.
- 검색할 때마다 목록은 새 응답으로 완전히 교체된다.
- 결과가 없으면 상품 카드를 하나도 보여주지 않고 "검색 결과가 없습니다."를 안내한다.

### 5.4 품절
- 품절 상품은 목록과 상세에 "품절" 배지를 보여준다.
- 상세의 담기 버튼은 비활성화(`disabled`)되고 문구가 "품절"로 바뀐다.
- 이는 정상 정책이다. "버튼이 안 눌려요"라는 제보는 재고 0 상품에 대해서는 정상 동작이다.

## 6. 화면 명세

모든 금액은 `30,000원` 형식(ko-KR 천 단위 구분 + "원")으로 표시한다. 할인은 `-5,000원`, 할인이 없으면 `0원`.
화면의 값은 서버 응답을 받은 뒤에만 바뀐다(낙관적 업데이트 없음). 요청 중에는 해당 버튼을 비활성화하고 `aria-busy="true"`를 붙인다. 금액이 불규칙하게 바뀌는 애니메이션을 넣지 않는다.

### 공통 헤더
- 상단 안내 띠(정적 문구), 로고(`/` 링크), 검색 입력·버튼, 장바구니 링크(로그인 시 수량 합계 배지), 로그인 링크 또는 "{이름}님" + 로그아웃 버튼.
- 카테고리 메뉴: 전체 상품(`/`), 키보드·마우스·USB 허브·데스크 매트·모니터 받침대(각각 `/?q=키보드`, `마우스`, `허브`, `매트`, `받침대` 검색 바로가기). 별도 카테고리 API는 없다.

### `/` 상품 목록·검색
- 기획전 배너 캐러셀(정적 문구·사진, 5초마다 자동 넘김, 이전·다음·전체 보기·정지 버튼. 모션 줄이기 설정이면 자동 넘김 없음)과 혜택 안내 3칸, 카테고리 바로가기, 셋업 가이드(상품 3개 소개)·쿠폰 안내(검색어가 없을 때만), 상품 카드 그리드. 정렬 탭(추천순·낮은 가격순·높은 가격순)은 화면 정렬만 바꾸고 다시 요청하지 않는다. 카드: 이미지·카테고리·이름·가격·품절 배지·무료배송 표시. 카드 클릭 시 상세로 이동.
- 검색어가 있으면 "'{검색어}' 검색 결과 {n}개" 요약을 보여준다.

### `/products/:id` 상품 상세
- 이미지·이름·카테고리·가격·재고 상태("재고 있음" 또는 "품절")·설명.
- "장바구니 담기" 버튼. 성공 시 "장바구니에 담았습니다." 메시지와 "장바구니로 이동" 링크를 보여준다. 자동 이동하지 않는다.
- 없는 상품 id는 "상품을 찾을 수 없습니다." 안내.

### `/login`, `/signup`
- 이메일·비밀번호(회원가입은 이름 포함) 입력, 제출 버튼, 오류 메시지 영역. Enter 키로도 제출된다.

### `/cart` 장바구니
- 상품 행: 이름·단가·수량(− / + 버튼)·행 합계·삭제 버튼.
- 쿠폰 영역: 쿠폰 코드 입력, "쿠폰 적용" 버튼(Enter 키 지원), 결과 메시지(성공: "쿠폰이 적용되었습니다.", 실패: API 오류 message), 적용된 쿠폰 목록. **첫 적용 후에도 입력창과 버튼을 비활성화하지 않는다.** 적용 후 입력값은 지우지 않는다(같은 코드를 다시 제출할 수 있어야 한다).
- 금액 요약: 상품 합계 / 할인 금액 / 최종 결제 예정 금액을 구분해 크게 표시.
- 비어 있으면 "장바구니가 비어 있습니다."와 쇼핑 계속하기 링크.
- "주문하기" 버튼은 표시하되 비활성화하고 "데모에서는 결제를 지원하지 않습니다." 안내를 붙인다.

## 7. 자동화용 selector 계약

`data-testid`는 화면에 노출하지 않는다. 버튼·입력은 `<button>`, `<input>`, `<a>`와 접근성 레이블(`aria-label` 또는 `<label>`)을 함께 쓴다.

| data-testid | 요소 | 위치 | 비고 |
|---|---|---|---|
| `search-input` | input | 헤더 | aria-label "상품 검색" |
| `search-submit` | button | 헤더 | "검색" |
| `search-summary` | p | `/` | 검색어가 있을 때만. 예: `'키보드' 검색 결과 2개` |
| `search-results` | ul | `/` | 상품 카드 목록 컨테이너 |
| `product-card` | li | `/` | `data-product-id` 속성. 안쪽의 `a`가 상세로 이동 |
| `empty-results` | p | `/` | "검색 결과가 없습니다." |
| `sold-out-badge` | span | 카드·상세 | "품절" |
| `product-name` | h1 | 상세 | |
| `product-price` | p | 상세 | 예: `30,000원` |
| `stock-status` | p | 상세 | "재고 있음" 또는 "품절" |
| `add-to-cart` | button | 상세 | "장바구니 담기", 품절이면 `disabled` + "품절" |
| `add-to-cart-message` | p | 상세 | "장바구니에 담았습니다." / 오류 문구, `data-status`=`success`·`error` |
| `go-to-cart` | a | 상세 | "장바구니로 이동" |
| `cart-link` | a | 헤더 | |
| `cart-count` | span | 헤더 | 수량 합계 |
| `login-link` | a | 헤더 | |
| `user-menu` | span | 헤더 | "{이름}님" |
| `logout` | button | 헤더 | |
| `login-email` / `login-password` / `login-submit` | input/button | `/login` | |
| `login-error` | p | `/login` | |
| `signup-name` / `signup-email` / `signup-password` / `signup-submit` / `signup-error` | | `/signup` | |
| `cart-item` | li | `/cart` | `data-product-id` 속성 |
| `cart-item-name` | a | 행 | 상품 상세 링크 |
| `cart-quantity` | span | 행 | 숫자만. 예: `2` |
| `quantity-decrease` / `quantity-increase` | button | 행 | aria-label "수량 줄이기"/"수량 늘리기" |
| `cart-line-total` | span | 행 | |
| `remove-item` | button | 행 | |
| `coupon-input` | input | `/cart` | label "쿠폰 코드" |
| `apply-coupon` | button | `/cart` | "쿠폰 적용" |
| `coupon-message` | p | `/cart` | `data-status`=`success`·`error` |
| `applied-coupons` | ul | `/cart` | 적용된 쿠폰마다 `li`: `SAVE5000 -5,000원` |
| `cart-subtotal` | strong | `/cart` | 예: `30,000원` |
| `cart-discount` | strong | `/cart` | 예: `-5,000원`, 없으면 `0원` |
| `cart-total` | strong | `/cart` | 예: `25,000원` |
| `cart-empty` | p | `/cart` | |
| `app-env` | small | 푸터 | 예: `dev · 1a2b3c4` |

## 8. 상태와 초기화

- 장바구니·쿠폰 적용 이력은 서버 DB에 사용자별로 저장된다. 새로고침·페이지 이동 후에도 같은 값이 나온다.
- dev의 시도별 초기화는 `POST /api/test/reset`(테스트 계정 하나 단위)으로 한다. 다른 계정의 상태는 건드리지 않는다. 자세한 내용은 [Playwright 실행 계약](./PLAYWRIGHT_CONTRACT.md).
- 운영 환경의 사용자는 장바구니에서 직접 상품을 삭제해 초기 상태로 돌아갈 수 있다. 발표 전 운영 데모 계정 초기화는 `server` 스크립트로 한다(`npm --prefix server run reset:prod-demo`).

## 9. 메타포 SDK 연동

메타포 JavaScript SDK는 사용자가 반응 없는 요소를 연타(레이지클릭)하거나 눌러도 아무 변화가 없을 때(데드클릭) 신고 안내를 띄운다. 쇼핑몰은 고객사 사이트 역할로 SDK를 HTML에 넣기만 한다. SDK 자체는 메타포 플랫폼(Metaphor-front) 범위다.

### 9.1 켜는 환경
- **production에서만 켠다.** `METAPHOR_SDK_URL`, `METAPHOR_API_URL`, `METAPHOR_PROJECT_KEY` 세 값이 모두 있어야 켜지고, 일부만 있으면 서버가 시작하지 않는다.
- **dev에서는 항상 끈다.** 설정이 있어도 경고만 남기고 무시한다. 이유:
  1. 엔진이 재현하며 누르는 클릭을 SDK가 다시 신고로 올리면 안 된다.
  2. SDK가 다른 origin으로 요청을 보내면 엔진의 단일 origin 정책에 막혀 판정이 inconclusive가 된다.

### 9.2 서버가 하는 일 (production, SDK 켬)
- `index.html`을 보낼 때 `</head>` 앞에 다음 태그를 넣는다. 속성 값은 HTML 이스케이프한다.
  ```html
  <script src="{METAPHOR_SDK_URL}" data-metaphor-project-key="{METAPHOR_PROJECT_KEY}" data-metaphor-api-base="{METAPHOR_API_URL}" defer></script>
  ```
- CSP에 SDK 스크립트 origin을 `script-src`·`style-src`·`img-src`에, API origin을 `connect-src`에 추가한다. 그 외 origin은 허용하지 않는다. SDK가 iframe을 쓰게 되면 `frame-src`를 추가해야 한다.
- 프로젝트 키는 브라우저에 노출되는 공개 키다. 비밀값을 넣지 않는다.

### 9.3 SDK 쪽 요구 (플랫폼 팀 참고)
- **비활성 버튼 연타는 `click`으로 잡히지 않는다.** 2026-11-04 Playwright 실측(Chromium 156, WebKit 27.2, Firefox 157)에서 `disabled` 버튼(N01 품절 버튼)을 4번 눌렀을 때 `document` 캡처 리스너에 `pointerdown`·`pointerup`은 4번씩 도달했다. `mousedown`·`mouseup`·`click`은 0번이었다. 감지는 **`document`의 캡처 단계 `pointerdown`**으로 해야 한다. `event.target`은 비활성 버튼 자체로 확인됐다.
- 같은 실측에서 시험용 스텁 SDK(레이지: 1초 안에 반경 30px 이내 3회, 데드: 1초 동안 DOM·주소 변화 없음)가 세 브라우저 모두에서 N01의 레이지클릭을, Chromium에서 단일 클릭의 데드클릭을 감지했다. 신고 요청은 CSP 오류 없이 API origin에 도달했다. 실제 SDK의 임계값은 플랫폼 팀이 정한다.
- API는 쇼핑몰 origin을 CORS로 허용해야 한다(등록된 프로젝트의 origin만).
- 비밀번호 입력란 등 민감한 값은 기록·스크린샷에서 지우고 보낸다.
- 시나리오별 적합도: N01은 자동 감지가 자연스럽다. B01·B02·B03은 클릭 패턴 문제가 아니어서 직접 신고 버튼이 필요하다.

## 10. 범위 밖

주문·결제, 주문 목록, 주문 IDOR 시나리오, 비밀번호 찾기, 소셜 로그인, 모바일 전용 레이아웃(깨지지 않는 정도만 유지).
