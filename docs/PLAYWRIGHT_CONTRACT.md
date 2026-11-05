# Playwright 실행 계약 (dev 환경)

문서 버전: v3.0 (2026-11-06)
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

## 2. 인증·시도별 준비

쿠폰·장바구니·찜에는 로그인이 필요하다. 상품 열람·카테고리·재입고 안내창·배송 팝업은 비로그인도 가능하다.

1. 신뢰된 워커가 `POST /api/test/reset`, `X-Test-Token`, `{"email":"qa1@buglab.test"}`로 200 확인.
2. 새 BrowserContext 생성. 서버 DB는 컨텍스트 생성만으로 초기화되지 않는다.
3. 인증이 필요한 시나리오는 `/login`에서 `login-email`, `login-password` 입력 → `login-submit` 클릭 → `user-menu` 대기.
4. 장바구니 시나리오는 **실제 상품 담기부터 실행**한다. 신고자 장바구니가 엔진 계정에도 있다고 가정하지 않는다.

초기화는 해당 계정의 장바구니·쿠폰·찜·세션·로그인 실패 기록을 비운다. 실패하면 `inconclusive`다.
초기화 API는 워커 브라우저에서 호출하지 않는다. 동시 실행은 qa1/qa2를 나눠 쓴다.
production에는 초기화 API가 없다. 발표용 계정 초기화는 `npm --prefix server run reset:prod-demo`를 사용한다.
로그인을 쿠키 주입으로 대체하지 않는다. 인증·상품 준비 단계가 실행 환경에서 지원되는지 먼저 확인한다.

## 3. 요청 허용 범위

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/`, `/login`, `/cart`, `/favorites`, `/products/:id`, `/assets/*`, `/images/*`, `/favicon.svg` | 페이지·정적 리소스 |
| GET | `/api/health`, `/api/auth/me`, `/api/products`, `/api/products/:id`, `/api/cart`, `/api/favorites` | 상태 조회 |
| POST | `/api/auth/login` | 정상 화면 로그인 |
| POST | `/api/cart/items`, `/api/cart/coupons`, `/api/favorites` | 담기·쿠폰·찜 |
| PATCH | `/api/cart/items/:productId` | 수량 변경 |
| DELETE | `/api/favorites/:favoriteId` | 찜 UUID로 해제 |
| DELETE | `/api/cart/items/:productId` | 필요한 정상 대조 |

이는 쇼핑몰이 요구하는 계약이며 엔진 구현 완료를 뜻하지 않는다.
JSON 본문·Content-Type·컨텍스트별 Cookie·응답 Set-Cookie 왕복을 지원해야 한다.
`/api/auth/me`의 세션 없음 응답(`200 + user:null`)은 정상 익명 상태다. 보호 API의 인증 오류 401, 쿠폰 중복 409, 품절 담기 409 등 예상 응답을 전체 실행 장애로 일괄 처리하지 않는다.
회원가입·`/api/test/*`·명시하지 않은 쓰기 요청은 워커 브라우저에서 허용하지 않는다.
독립 브라우저 검증의 production 회원가입은 격리된 테스트 준비이며 엔진 허용 범위의 근거가 아니다.

## 4. 처리 완료와 결과 관찰

각 `[tid=x]`는 `[data-testid="x"]`다. 상품 행·카드는 `data-product-id`로 한정한다.
화면의 확인 문구는 작업 결과의 성공 선언이 아니며 준비 완료 판단용이다. 정상 결과는 별도 검사한다.
반복 동작에서도 확인 문구의 내용 노드가 새로 갱신된다. 수정 후에도 같은 완료 문구를 실제 작업 완료 시 유지한다.

| 작업 | 완료 selector | 원문 문구 |
|---|---|---|
| 쿠폰 확인 | `coupon-status` | 쿠폰 확인 완료 |
| 수량 확인 | `quantity-status` | 수량 확인 완료 |
| 재입고 안내 확인 | `restock-status` | 재입고 알림 안내 확인 완료 |
| 카테고리 선택 확인 | `category-status` | 카테고리 선택 확인 완료 |
| 찜 상태 확인 | `favorite-status` | 찜 상태 확인 완료 |
| 배송 팝업 닫기 요청 확인 | `delivery-status` | 닫기 요청 확인 완료 |

`delivery-status`는 팝업 밖 body에 있어 팝업 닫기와 독립적으로 관찰할 수 있다.
신고에 순서·버튼 이름·실제 확인 문구를 포함한다. 완료 신호를 기대 금액이나 최종 결과로 대신하지 않는다.
고정 sleep·임의 버튼 클릭·신고에 없는 연타를 추가하지 않는다. 기능 검사와 SDK 신고 안내를 여는 연타는 다른 단계다.

## 5. 기준 시나리오와 정상 기대값

### B01 — 쿠폰 적용
1. 로그인 → 신고에 명시된 재고 있는 상품 상세 → `add-to-cart` → `장바구니에 담았습니다.` 대기.
2. `go-to-cart` → 상품·수량·최종 금액 확인.
3. `coupon-input`에 SAVE5000 입력 → `apply-coupon` 클릭 → `coupon-status` 대기.
4. 정상 기대: 할인 금액 5,000원, 적용 쿠폰 1개, 최종 금액이 5,000원 감소(최저 0원).
5. 대조: 안내 칩으로 입력 후 적용·Enter 제출·새로고침 뒤 재시도. 최초 적용만 할인하고 중복은 거부해야 한다.

### B02 — 수량 증가
1. 로그인 → 신고에 명시된 재고 있는 상품을 1개 담기 → 장바구니 이동.
2. 현재 수량이 상한 미만인지 확인. 대상 행의 `quantity-increase` 한 번 클릭 → `quantity-status` 대기.
3. 정상 기대: 해당 행 수량 1 증가, 행 금액·상품 합계·헤더 장바구니 수량도 일치.
4. 감소·새로고침은 증가 문제의 재현 선행 조건이 아니다. 상한에서 비활성화된 버튼은 정상 정책이다.

### B03 — 한정판 재입고 안내창
1. `/products/3` 직접 진입 → 상품명·품절 문구 대기.
2. `restock-open` 클릭 → `restock-status` 대기.
3. 정상 기대: `restock-dialog`가 보이고 `재입고 알림 신청` 제목 표시.
4. 홈·검색·다른 상품 추천에서 진입해도 기대값은 동일. 특정 직전 상품이나 라우트 이력은 필요 없다.
5. 품절 담기 버튼은 계속 비활성화가 정상이다. 실제 알림 발송 검사는 범위 밖이다.

### B04 — USB 허브 카테고리
1. 홈 또는 신고에 명시된 다른 검색·상세에서 시작. 이미 `/?q=허브`인 상태는 이동 검사에 쓰지 않는다.
2. `category-link` 중 `data-category=허브` 클릭 → `category-status` 대기.
3. 정상 기대: `/?q=허브`의 검색 결과 1개, 상품 4 카드 표시.
4. 전체 카테고리 펼침 메뉴의 `mega-category-link`에도 같은 기대 적용. 다른 카테고리·검색창 직접 검색은 정상 대조다.
5. 현재 엔진의 결과 predicate가 URL을 지원하지 않으면 검색 결과 DOM을 검사한다. 시작 상태와 구별되는 결과를 고른다.

### B05 — 상세 찜 버튼
1. 로그인 → 신고 상품 상세. 현재 `찜하기`/`찜 해제` 문구와 찜 개수를 기록.
2. `favorite-toggle` 한 번 클릭 → `favorite-status` 대기.
3. 정상 기대: 문구가 반전되고 해당 상품의 찜 상태·개수·서버 저장값이 일치.
4. `aria-pressed`만 지원되지 않는 엔진은 버튼의 정확한 텍스트를 관찰한다.
5. 모든 상품에서 같은 정책이다. 새로고침이나 기존 찜 등록은 필수 선행 조건이 아니다.

### B06 — 배송 팝업 닫기
1. 어느 상품 상세에서든 `delivery-open` 클릭 → `delivery-dialog` 표시 대기.
2. 신고에 적힌 `delivery-close` 또는 `delivery-confirm` 한 번 클릭 → `delivery-status` 대기.
3. 정상 기대: `delivery-dialog`가 보이지 않음, 배경 조작·스크롤 복구.
4. Escape·배경 클릭·실제 뒤로 가기/라우트 이탈도 정상적으로 닫혀야 한다. 뒤로 가기는 필수 재현 단계가 아니다.
5. SDK 신고창과 팝업의 포커스 상호작용은 실제 배포 SDK로 별도 확인한다.

## 6. 실패 분류와 실행

- 준비 누락·인증 실패·요청 차단·`TRANSPORT_ERROR`·`MODEL_HTTP_ERROR`는 상품 결함 재현 성공으로 계산하지 않는다.
- 이 문서를 변경했다고 엔진의 쓰기 요청·repair schema·통신 문제가 수정되는 것은 아니다.
- 쇼핑몰 브라우저 검증과 SPEAR 엔진 실행·SDK 통합·수정 배포 후 동일 계획 재검증을 구분한다.
- 팀 전용 정답표를 엔진에 넣거나 실제 실행 없이 성공률을 주장하지 않는다.

```sh
npm run build
npm --prefix server test
# Python Playwright와 Chromium이 준비된 환경에서:
python tests/demo_browser.py --repeat 2
```

브라우저 스크립트는 임시 DB·동적 포트·격리된 계정을 사용한다. 기존 `.env`·실행 중인 서버·DB를 수정하지 않는다.
검증 결과는 팀 전용 `DEMO_VERIFICATION.md`를 따른다.
