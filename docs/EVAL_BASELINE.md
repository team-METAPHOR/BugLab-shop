# AI 재평가 기준 버전

문서 버전: v3.0 (2026-11-06)
상태: **기준 commit 확정 · 재평가 착수 확인 전** (5절 항목 완료 후 담당자 확인)

> 현재 배포된 쇼핑몰을 AI 재평가의 기준으로 고정한다. 이 문서에는 결함 위치·정답을 쓰지 않는다.
> 정답표는 팀 전용 [INJECTED_DEFECTS.md](./INJECTED_DEFECTS.md), 실행 조건은 [Playwright 실행 계약](./PLAYWRIGHT_CONTRACT.md)을 따른다.

## 1. 기준

| 항목 | 값 |
|---|---|
| 기준 commit | `d41f3b8f7530311d7066903181359049122a505f` (PR #14 merge) |
| 결함 정의 | `INJECTED_DEFECTS.md` v3.0, B01~B06 (PR #13 `356a5e1`에서 v2 교체) |
| 실행 계약 | `PLAYWRIGHT_CONTRACT.md` v3.0 |
| 배포 실행 | GitHub Actions Deploy run `42089581394`, 2026-11-06 03:59 KST, success. 이후 Deploy 실행 없음 |
| production origin | `https://shop.13-197-7-82.sslip.io` (동일 서버 `http://13.197.7.82:3200`) |
| dev origin | EC2 `127.0.0.1:3100`, 외부 비공개 |
| 프론트 번들 | `/assets/index-C1VdIsU0.js`, `/assets/index-C09LIhTl.css` |

## 2. 배포 일치 확인 (2026-11-06)

| 대상 | 확인 결과 |
|---|---|
| production 프론트 | 기준 commit을 로컬 `npm run build`한 결과와 배포 HTML의 번들 파일명(content hash)이 일치 |
| production health | `status=ok`, `env=production`, `commit=unknown`, `startedAt=2026-11-05T19:31:27Z`(04:31 KST) |
| dev health | 배포 로그 기준 `status=ok`, `env=dev`, `commit=unknown`, `startedAt=2026-11-05T19:00:01Z`. 현재 상태는 외부에서 확인 불가 |
| 정답 노출 | 기준 번들에 결함 ID·`INJECTED DEFECT` 주석 없음, sourcemap 없음 |
| TLS | sslip.io origin의 인증서가 검증 옵션 없이 통과. `:3200`은 평문 HTTP로도 열려 있음 |

- health의 `commit`이 `unknown`이다. 배포 rsync가 `.git`을 제외하고 `BUILD_COMMIT`도 넘기지 않기 때문이다.
- production은 배포 직후(04:00 KST) 재시작 뒤 04:31 KST에 한 번 더 재시작됐다. 사유는 확인하지 않았다.
- 서버 코드는 번들 해시로 확인되지 않는다. 이후 Deploy 실행이 없어 기준 commit과 같다고 보지만, 서버에서 직접 수정한 경우는 감지하지 못한다.
- `DEMO_VERIFICATION.md`에는 실행 commit이 기록되어 있지 않다. 기준 commit에서 다시 실행해야 기준 검증으로 쓸 수 있다.

## 3. 평가 시작 전 판정

health `commit`이 실제 값을 반환하기 전까지는 번들 파일명으로 판정한다.

1. 대상 origin의 `GET /api/health`가 `status=ok`이고 `env`가 기대 환경과 같다.
2. 대상 origin의 `/` HTML이 1절의 번들 파일명을 참조한다.
3. 하나라도 다르면 기준 불일치로 보고 평가를 시작하지 않는다.

배포 워크플로가 배포 commit을 `BUILD_COMMIT` 파일로 남기고 서버가 이를 health `commit`으로 반환하도록 변경했다.
이 변경이 배포된 뒤에는 health `commit`도 비교한다. 화면·결함 코드는 바뀌지 않으므로 번들 파일명은 1절과 같아야 하며, 새 배포 commit을 이 문서에 추가한다.

## 4. 실행 환경

| 항목 | 값 |
|---|---|
| 브라우저 | Chromium |
| viewport | 1440×1000, reduced-motion=reduce |
| 허용 요청 | `PLAYWRIGHT_CONTRACT.md` 3절 |
| 계정·초기화 | dev의 `qa1`/`qa2`와 `/api/test/reset`. production에는 초기화 API가 없다 |

원격 워커가 dev(`127.0.0.1:3100`)에 접근하는 경로는 아직 정하지 않았다.

## 5. 재평가 착수 전 남은 항목

- [ ] health가 실제 commit을 반환하도록 배포에 `BUILD_COMMIT` 연결(코드 반영), 배포 후 production·dev 응답과 번들 파일명 확인
- [ ] dev의 현재 health·번들이 기준과 같은지 서버에서 확인
- [ ] 원격 워커의 dev 접근 경로와 TLS 조건 확정
- [ ] 같은 기능의 수정 대조군(별도 브랜치·별도 origin) 준비
- [ ] case별 평가 manifest 작성: 모델 입력(신고 텍스트·스크린샷·기대 동작·테스트 데이터)과 채점 정답 분리, 단계별 이동 방식(SPA 클릭·goto·새로고침·뒤로 가기) 표시
- [ ] 배포 대상에서 참조 시나리오 실행: 결함 재현, 수정 대조에서 증상 소멸, qa1/qa2 병렬 간섭 없음. 결과 보존
- [ ] 담당자 확인: "이번 버전으로 AI 재평가 가능"

## 6. 버전 규칙

이 기준 이후 결함 정의·화면·테스트 데이터가 바뀌면 v3.1 또는 v4로 분리한다.
서로 다른 기준 버전에서 얻은 결과를 합치지 않는다.
