# BugLab Shop

메타포 검증 플랫폼 시연용 가상 쇼핑몰입니다. 평범한 쇼핑몰처럼 보이지만 의도적인 결함이 들어 있습니다. 실제 결제·실제 개인정보는 다루지 않습니다.

- 프론트엔드: Vue 3 + Vue Router + Vite (`src/`)
- 백엔드: Node.js + Express 5 + SQLite(`node:sqlite`) 인증·장바구니 API 서버 (`server/`)
- 백엔드가 빌드된 프론트(`dist/`)와 `/api`를 같은 origin에서 서빙합니다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/FUNCTIONAL_SPEC.md](docs/FUNCTIONAL_SPEC.md) | 환경, 로그인 필요 범위, 제품 정책, 화면, selector 계약 |
| [docs/API_SPEC.md](docs/API_SPEC.md) | 엔드포인트, 오류 코드, 환경변수 |
| [docs/PLAYWRIGHT_CONTRACT.md](docs/PLAYWRIGHT_CONTRACT.md) | dev 환경 테스트 계정, 초기화, 엔진 허용 요청, 시나리오 단계 |
| [docs/INJECTED_DEFECTS.md](docs/INJECTED_DEFECTS.md) | 의도적 결함 목록. **팀 전용, AI·엔진 입력 금지** |

## 요구 사항

- Node.js 22.13 이상 (`node:sqlite` 사용)
- npm

## 설치

```sh
npm run setup        # 루트 + server 의존성 설치
npm run build        # dist/ 생성
```

## 실행 환경

같은 커밋을 두 모드로 띄웁니다. 결함은 두 환경에 똑같이 있습니다.

| 환경 | 주소 | 명령 | 용도 |
|---|---|---|---|
| production | http://localhost:3200 | `npm run start:prod` | "실서비스". 회원가입·로그인 |
| dev | http://localhost:3100 | `npm run start:dev` | Playwright 재현 대상. 테스트 계정·초기화 API |
| 코드 작성용 | http://localhost:5173 | `npm run dev` + `npm run dev:server` | Vite HMR. `/api`는 3100으로 프록시. **Playwright 대상으로 쓰지 말 것**(WebSocket 사용) |

환경변수는 `server/.env.dev.example`, `server/.env.production.example`을 복사해서 씁니다.

```sh
cp server/.env.dev.example server/.env.dev
cp server/.env.production.example server/.env.production
# 값 수정 후
npm run start:dev
npm run start:prod
```

dev는 `TEST_CONTROL_TOKEN`, `TEST_ACCOUNT_PASSWORD`가 없으면 시작하지 않습니다. 실제 값은 저장소에 커밋하지 않습니다.

## 데모 데이터

- 상품 6개(고정). 시연 기준 상품: `BugLab 무선 키보드` 30,000원(id 1), 품절 상품 `BugLab 기계식 키보드 한정판`(id 3)
- 쿠폰: `SAVE5000` (5,000원 할인, 한 장바구니에 한 번)
- dev 테스트 계정: `qa1@buglab.test`, `qa2@buglab.test` (비밀번호 = `TEST_ACCOUNT_PASSWORD`)
- production 발표용 계정: `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD`를 설정하면 시드

## 초기화

- dev, 시도별: `POST /api/test/reset` + `X-Test-Token` 헤더 (계정 하나 단위). [Playwright 실행 계약](docs/PLAYWRIGHT_CONTRACT.md#3-시도별-초기화) 참고.
- production 발표용 계정: `npm --prefix server run reset:prod-demo`
- 전체 초기화: 서버를 멈추고 `server/data/{env}.db`를 지운 뒤 다시 시작

## 메타포 SDK

production에서 `server/.env.production`에 `METAPHOR_SDK_URL`, `METAPHOR_API_URL`, `METAPHOR_PROJECT_KEY`를 넣으면 서버가 `index.html`에 SDK 스크립트를 넣고 CSP에 두 origin을 허용합니다. dev에서는 설정이 있어도 SDK를 넣지 않습니다(엔진 재현과 충돌 방지). 자세한 내용은 [기능 명세서 9장](docs/FUNCTIONAL_SPEC.md#9-메타포-sdk-연동).

## 알려진 제약

- 장바구니는 서버 DB에 사용자별로 저장됩니다. 새로고침·재로그인 후에도 유지됩니다.
- localhost에서는 쿠키가 포트를 구분하지 않으므로 환경별 쿠키 이름이 다릅니다(`buglab_sid`, `buglab_dev_sid`).
- 현재 Core_engine은 GET/HEAD/OPTIONS만 허용합니다. 로그인·장바구니 조작을 재현하려면 엔진에 경로 단위 POST/PATCH 허용과 `disabled` 속성 관찰이 추가되어야 합니다. 목록은 [Playwright 실행 계약 4장](docs/PLAYWRIGHT_CONTRACT.md#4-엔진-요청-허용-범위).
- 주문·결제는 없습니다.
