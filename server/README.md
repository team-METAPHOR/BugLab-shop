# BugLab Shop 서버

BugLab Shop의 API 서버(인증·상품·장바구니·쿠폰)이자, 빌드된 프론트엔드(`dist/`)를 같은 origin에서 서빙하는 정적 서버다.
계약은 [API 명세서](../docs/API_SPEC.md), [기능 명세서](../docs/FUNCTIONAL_SPEC.md), [Playwright 실행 계약](../docs/PLAYWRIGHT_CONTRACT.md)을 따른다.

- Node.js 22.13 이상(ESM), Express 5, `node:sqlite`(DatabaseSync). 네이티브 빌드 의존성 없음.
- 응답 압축·CORS·WebSocket을 쓰지 않는다.
- 시작할 때 `node:sqlite`의 ExperimentalWarning이 한 줄 출력되는데 정상이다.

## 실행

```bash
# 저장소 루트에서
npm install && npm --prefix server install
npm run build                                   # dist/ 생성 (없으면 /api 만 동작하고 나머지는 503 안내)

# dev(재현) 환경: http://localhost:3100
cp server/.env.dev.example server/.env.dev      # TEST_CONTROL_TOKEN, TEST_ACCOUNT_PASSWORD 수정
npm --prefix server run start:dev               # 또는 코드 수정 중에는 npm --prefix server run dev (--watch)

# production(운영) 환경: http://localhost:3200
cp server/.env.production.example server/.env.production
npm --prefix server run start:prod
```

| 스크립트 | 내용 |
|---|---|
| `dev` | `--watch` 모드, `.env.dev` 로드. 루트의 Vite 개발 서버(5173)가 `/api`를 `127.0.0.1:3100`으로 프록시한다 |
| `start:dev` | dev 서버 실행(`.env.dev` 로드) |
| `start:prod` | production 서버 실행(`.env.production` 로드) |
| `reset:prod-demo` | production DB에서 `DEMO_ACCOUNT_EMAIL` 계정의 장바구니·쿠폰 적용 이력 초기화 |

`.env.*` 파일이 없으면 셸 환경변수만 사용한다. 셸에 이미 있는 값이 파일 값보다 우선한다.
`APP_ENV` 기본값이 `dev`이므로 `start:prod`는 `.env.production`(또는 셸)에 `APP_ENV=production`이 있어야 운영 모드로 뜬다.

## 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `APP_ENV` | `dev` | `dev` 또는 `production` |
| `PORT` | 3100(dev) / 3200(production) | |
| `HOST` | `127.0.0.1` | Docker에서는 `0.0.0.0` |
| `DATA_DIR` | `server/data` | SQLite 파일 위치. 파일명 `{APP_ENV}.db` |
| `STATIC_DIR` | `<repo>/dist` | 프론트엔드 빌드 결과물 |
| `SESSION_COOKIE_NAME` | `buglab_dev_sid`(dev) / `buglab_sid`(production) | |
| `COOKIE_SECURE` | `false` | HTTPS 배포 시 `true` |
| `BUILD_COMMIT` | `git rev-parse --short HEAD`, 실패 시 `unknown` | `/api/health`의 `commit` |
| `TEST_CONTROL_TOKEN` | 없음 | dev 필수. `/api/test/reset`의 `X-Test-Token` |
| `TEST_ACCOUNT_PASSWORD` | 없음 | dev 필수. `qa1@buglab.test`, `qa2@buglab.test` 비밀번호 |
| `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD` | 없음 | production 선택. 둘 다 있으면 데모 계정 시드 |
| `METAPHOR_SDK_URL` / `METAPHOR_API_URL` / `METAPHOR_PROJECT_KEY` | 없음 | production 선택. 셋 다 있으면 index.html에 메타포 SDK 태그 삽입 + CSP 허용. dev에서는 무시 |

dev에서 `TEST_CONTROL_TOKEN` 또는 `TEST_ACCOUNT_PASSWORD`가 없으면 서버는 시작하지 않고 종료 코드 1로 끝난다.

## 시작 시 동작

1. `DATA_DIR/{APP_ENV}.db`를 열고 스키마를 만든다(없을 때만).
2. 상품 6개와 쿠폰 `SAVE5000`을 시드한다. 이미 있으면 시드 값으로 갱신한다.
3. 계정 시드: dev는 `qa1`/`qa2`(테스트 계정, 비밀번호는 매 시작 시 `TEST_ACCOUNT_PASSWORD`로 갱신), production은 `DEMO_ACCOUNT_*`가 있으면 데모 계정.
4. 만료된 세션과 오래된 로그인 실패 기록을 지운다(이후 1시간마다).

`/api/test/reset`은 해당 테스트 계정의 장바구니·쿠폰 이력과 함께 **세션도 지운다**. 초기화한 뒤에 로그인해야 한다.

## 디렉터리 구조

```
server/
├── package.json
├── .env.dev.example, .env.production.example   # 가짜 예시값
├── scripts/
│   └── reset-prod-demo.js      # reset:prod-demo
├── src/
│   ├── index.js                # 부트: 설정 검증, DB 열기, 시드, listen
│   ├── config.js               # 환경변수 → 설정
│   ├── db.js                   # 스키마, 상품·쿠폰 시드, 트랜잭션 헬퍼
│   ├── app.js                  # Express 앱: 보안 헤더, /api, 정적 파일 + SPA fallback, 오류 처리
│   ├── http.js                 # JSON 요청 강제(415), 쿠키, 세션 로드, 인증 미들웨어
│   ├── errors.js               # 오류 코드·메시지
│   ├── routes/                 # health, auth, products, cart, test(dev 전용)
│   └── services/               # passwords(scrypt), authService, productService, cartService
└── data/                       # SQLite 파일 (git 무시)
```

## 의도적 결함

[docs/INJECTED_DEFECTS.md](../docs/INJECTED_DEFECTS.md) 참조.
