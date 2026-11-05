# AI 재평가 세트 v3

기준: [EVAL_BASELINE.md](../../docs/EVAL_BASELINE.md)의 `d41f3b8`. 이 세트는 평가 환경을 고정하는 자료이며 AI 성능 점수가 아니다.

## 무엇을 누구에게 주는가

| 경로 | 내용 | 모델 입력 |
|---|---|---|
| `inputs/R01~R06.json` | 사용자 신고 텍스트·신고 화면 경로·정상 기대 동작·테스트 데이터 | 제공 |
| `inputs/screenshots/` | 결함 빌드의 production 화면에서 신고 시점에 찍은 화면 | 제공 |
| `manifest.json` | 대상 빌드·브라우저·계정·초기화·허용 요청·이동 방식·완료 신호 | 하네스만 사용. 대상 origin과 계정 자리표시자만 전달 |
| `grader/cases.json` | 대상 A/B의 역할, 결함 ID, 참조 계획, 정상 기대 판정식 | 제공 금지 |
| `grader/results/` | 참조 실행 결과 | 제공 금지 |
| `reference_check.py` | 참조 계획 실행기 | 제공 금지 |

- 모델 입력에는 결함 위치·정답 label·참조 계획·`INJECTED_DEFECTS.md`·채점 결과를 넣지 않는다.
- 대상 이름은 중립적인 `A`/`B`다. 수정 빌드의 origin·health·화면에 `fixed`·정답 같은 표시를 넣지 않는다.
- 같은 신고를 A와 B에 각각 실행한다. A에서는 재현, B에서는 재현되지 않는 것이 정답이다.
- 신고 화면 스크린샷의 가입 이름은 일반 이름이며 평가용임을 드러내지 않는다.

## 이동 방식

`grader/cases.json`의 각 단계에 `nav`를 둔다. `full_load`(주소 이동)는 시작 화면 준비에만 쓴다.
`spa` 단계는 화면 안 클릭으로 이동해야 하며 실행기가 전체 로드 여부를 확인한다. goto로 바꾸면 같은 재현이 아니다.
v3의 6건은 새로고침·뒤로 가기가 재현에 필요하지 않다.

## 참조 실행

```sh
# 기준 commit과 eval/v3-fixed 브랜치를 각각 빌드한 dist 두 개가 필요하다.
python eval/v3/reference_check.py --local A=<결함 dist> --local B=<수정 dist> --repeat 2 --capture-screenshots
# 배포된 dev 대상(초기화 API 필요):
EVAL_A_TEST_CONTROL_TOKEN=... EVAL_A_TEST_ACCOUNT_PASSWORD=... \
EVAL_B_TEST_CONTROL_TOKEN=... EVAL_B_TEST_ACCOUNT_PASSWORD=... \
python eval/v3/reference_check.py --remote A=<origin> --remote B=<origin>
```

- 대상마다 `/api/health`와 `/` HTML의 번들 파일명을 기록하고, manifest와 번들이 다르면 실행하지 않는다.
- 각 시도마다 계정 초기화 후 새 BrowserContext를 만든다. qa1·qa2 시도를 같은 서버에서 동시에 실행해 간섭을 확인한다.
- 완료 신호를 기다린 뒤 기대 판정식을 2초 동안 확인한다. 하나라도 실패하면 `symptom`, 모두 통과하면 `no_symptom`이다.
- 준비·초기화·완료 신호 실패는 `inconclusive`이며 재현 성공으로 계산하지 않는다.
- Python Playwright와 Chromium이 필요하다. 토큰·비밀번호는 결과에 남기지 않는다.

## 검증 기록

| 일시 | 대상 | 결과 |
|---|---|---|
| 2026-11-06 | 로컬 A(`d41f3b8` 빌드, 배포 번들과 동일), 로컬 B(`ba49b0c` 빌드) | 6건 모두 유효. 각 대상 6건 × 2회 × qa1/qa2 동시 = 24회씩, A 전부 `symptom`, B 전부 `no_symptom`, `inconclusive` 0. `grader/results/reference-20261106-062654.json` |

배포된 A(dev)·B에서의 실행은 아직 하지 않았다. B는 배포 대상이 정해지지 않았다.
