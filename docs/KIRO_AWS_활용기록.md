# 1조 Metaphor(SPEAR) 해커톤 Kiro·AWS 활용 기록

정리일: 2026-11-05
근거: 이 Mac의 Kiro CLI 세션 기록 `~/.kiro/sessions/` 9개 세션(대화가 있는 것만). 비밀번호·키·토큰은 넣지 않았다.
표기: 시각은 KST. 크레딧은 세션 기록의 `usage_summary` 합계라 대략값이다. "(불확실)"은 기록만으로 확정할 수 없는 항목이다.

## 1. 한눈에 보기

| 항목 | 내용 |
|---|---|
| 기간 | 2026-11-04 20:09 ~ 2026-11-05 22:30 KST |
| Kiro 세션 | 해커톤 관련 8개 + 무관 1개(Momentlit 영상) |
| 사용 크레딧 | 해커톤 관련 약 828 (전체 약 832) |
| 다룬 저장소 | BugLab-shop(데모 쇼핑몰), Metaphor-back(API·워커), Metaphor-front(대시보드), Core_engine(재현 엔진), Metaphor-sdk |
| 주요 결과물 | 데모 쇼핑몰 전체(프론트·백엔드·명세 4종), EC2 배포와 CI/CD, 시장조사 v1~v4, SDK 연동, 쇼핑몰 디자인 2회 개편 |
| PR | BugLab-shop #2, #3, #4, #7 / Metaphor-back #29 |
| AWS | EC2 1대(도쿄), IAM 역할, Amazon Bedrock(Claude Haiku 4.5 호출 확인) |

## 2. 시간순 작업 기록

| 시각(KST) | 세션 | 한 일 | 크레딧 |
|---|---|---|---|
| 11-04 20:38 ~ 22:42 | 백엔드 API v1/ERD 설계 (`sess_fa87a071`) | 백엔드 인수인계·API v1 초안과 제안서 PDF(7쪽)를 읽고 ERD 단순화 검토. 파일 변경 없음 | 2.1 |
| 11-04 22:59 ~ 11-05 00:47 | BugLab Shop 구축 (`sess_8bcab3a7`) | 명세 4종 작성, Vue 프론트 구현, 백엔드는 Orca로 다른 Kiro에 위임, Codex 독립 검증, SDK 삽입 준비. 브랜치 `feat/shop-auth-mvp` 커밋 4개 push | 109.7 |
| 11-04 23:09 ~ 11-05 00:52 | Orca 워커로 백엔드 구현 (`sess_a10bc616`) | Express 5 + node:sqlite 인증·장바구니·쿠폰 API, 의도적 결함 B01·B02 심기, curl 검증 10항목 통과 | 26.5 |
| 11-05 01:02 ~ 13:21 | 시장조사·쇼핑몰 1차 디자인 (`sess_2d641df0`) | 시장조사 v2·추가분·전체본·v3·v4, 출처 조사(웹 검색 30·페치 24), Unsplash 사진 적용, PR #2 | 452.7 |
| 11-05 08:45 ~ 13:44 | AWS 서버 구축 (`sess_26d0d576`) | EC2 배포(systemd·PostgreSQL), Bedrock 호출 확인, GitHub Actions CD, PR #3·Metaphor-back #29 | 68.5 |
| 11-05 14:09 ~ 22:30 | 쇼핑몰 디자인 2차 + Codex 검토 (`sess_2f6ef1a1`, 현재) | 11번가형 개편 → AI 티 제거 개편 → 쿠폰 카드, Orca로 Codex 검토 2회, PR #4, 재현 영상 가능성 조사 | 153.9 |
| 11-05 15:20 ~ 15:51 | 데모 결함 분류 상담 (`sess_b5d96b12`) | 재현 가능(B03·N01) / 정보 부족(B01·B02) 분할안 제안. 파일 변경 없음 | 1.3 |
| 11-05 20:23 ~ 21:16 | SDK 연결 (`sess_f2ed564a`) | SDK 태그 추가 후 제거(PR #7), EC2 운영 env의 메타포 키 교체, 신고 미표시 원인 진단 | 13.2 |
| 11-04 13:16 ~ 13:20 | (무관) Momentlit 영상 수정 (`sess_995a1553`) | Remotion 프로젝트 분석만 함 | 3.7 |

## 3. AWS 활용

### 3.1 사용한 서비스

| 서비스 | 리소스 | 용도 | 확인 상태 |
|---|---|---|---|
| Amazon EC2 | Ubuntu 24.04, 13.197.7.82, ap-northeast-1(도쿄), `ip-10-31-1-214` | API·워커·데모 쇼핑몰·DB를 한 대에서 실행 | 실제 사용 |
| IAM 역할 | `hackathon-e3-t01-ec2-role` (인스턴스 부착) | 액세스 키 없이 Bedrock 호출 | 부착 확인 |
| Amazon Bedrock | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | `converse()` 스모크 테스트. 응답 `BEDROCK_OK`(입력 16·출력 8토큰) | 호출 성공 |
| Amazon Bedrock (엔진 비판자) | 팀 엔진의 비판자 단계 | 사용자가 "베드락으로 비판자를 추가했다"고 언급, 그 결과로 혼동행렬 작성 | 세부 구성 (불확실) |
| 보안그룹 | `sg-00d9b642740a0a1e1` | 필요한 포트가 이미 열린 범위라 수정 안 함 | 미수정 |
| Amazon S3 | `hackathon-e3-t01-data` | pg_dump 백업 용도로 제안만 함 | 미사용 |

### 3.2 EC2 위 구성

| 구성 요소 | 실행 방식 | 주소 |
|---|---|---|
| Metaphor-back API | systemd `metaphor-back.service` (uvicorn) | http://13.197.7.82:8000, 이후 `https://api.13-197-7-82.sslip.io` |
| BugLab 운영 | systemd `buglab-prod` | http://13.197.7.82:3200, 이후 `https://shop.13-197-7-82.sslip.io` |
| BugLab dev (엔진 재현 대상) | systemd `buglab-dev` | 127.0.0.1:3100 (외부 비공개) |
| PostgreSQL 16 | apt 설치 | 127.0.0.1:5432 (외부 비공개) |
| HTTPS | Caddy + sslip.io | 서버 구축 세션에서는 보류. 이후 세션에 sslip.io 주소가 등장하고 Metaphor-back에 `deploy/Caddyfile.demo`가 있음. Kiro 기록에는 설치 과정이 없음 (불확실) |
| 배포 | GitHub Actions: CI 통과 → rsync → 서버에서 설치·빌드 → 재시작 → health check | Secrets `DEPLOY_SSH_HOST/USER/KEY` |

### 3.3 권한 확인과 설계 결정
- aws CLI로 확인: ECR·ECS·RDS 호출은 모두 AccessDenied. 역할 권한은 Bedrock과 S3뿐이었다.
- 그래서 EC2 한 대에 systemd로 직접 실행하고, DB는 EC2에 PostgreSQL을 설치했다(RDS 불가).
- 데모는 단일 박스로 두고, 운영 환경의 워커 격리는 발표에서 설계로 설명하기로 했다.
- Bedrock 엔진 연동은 vendor wheel을 고치지 않고 Metaphor-back에 `JsonModel` 구현체를 추가하는 방향으로 설계만 했다.

### 3.4 보안 원칙
- AWS 액세스 키를 만들지 않고 EC2 IAM 역할만 사용했다. 코드·.env에도 넣지 않았다.
- SSH 키(.pem)는 경로로만 쓰고 내용을 읽거나 출력하지 않았다. GitHub Secret 등록도 파일 리다이렉트로 했다.
- 서버에 GitHub 인증 정보를 두지 않는 push 방식 배포를 골랐다.
- DB와 dev 사이트는 localhost에만 열었다. sudoers는 특정 서비스 재시작만 허용했다.
- 서버 `.env`는 서버에서 직접 만들고 배포 rsync에서 제외했다.

## 4. Kiro 활용

### 4.1 기능별 정리

| 기능 | 어디에 썼나 |
|---|---|
| Kiro CLI 에이전트(Vibe 세션) | 9개 세션 전부. 코드 작성, 서버 배포, 문서 작성, 검증 |
| 도구: 셸·파일 편집 | execute_bash, fs_write, str_replace, read_file 등. 해커톤 세션 합계 약 1,000회 (세션별 표는 4.2) |
| 웹 검색·웹 페치 | 시장조사 출처(Springer·arXiv·Sentry·BLS 등), 참고 쇼핑몰 조사, Figma 템플릿 검색 |
| 서브에이전트 | context-gatherer: 엔진·백엔드·시장조사 대조(서버 세션), 엔진·백엔드·프론트 영상 기능 조사(현재 세션). general-task-execution: 이 기록을 만들 때 세션 요약 4건을 병렬 처리 |
| Orca 오케스트레이션 (코디네이터) | Kiro가 Orca CLI로 다른 에이전트에게 작업을 맡기고 결과를 받음. 아래 4.3 |
| Orca 워커 | Kiro가 Orca가 배정한 워커로 백엔드를 구현하고 `worker_done`으로 보고 |
| 훅 | Orca가 설치한 `~/.kiro/hooks/orca-agent-status.json`(SessionStart·UserPromptSubmit·PostToolUse). 에이전트 상태를 Orca에 알림 |
| 세션 상태 표시 | update_session_information으로 작업 제목·진행 상황 갱신 |
| 스킬 | Remotion 스킬(해커톤 무관 영상 세션만) |
| 슬래시 명령 | `/model`, `/effort`, `/permissions`, `/agent`, `/tools trust-all`, `/usage` |
| 브라우저 검증 | Kiro가 Playwright 스크립트를 직접 작성·실행해 B01·B02·B03·N01 계약 검사, 화면 캡처, 반응형·접근성 검사 |
| GitHub 연동 | `gh`로 브랜치·커밋·push·PR 생성, Secrets 등록 |

### 4.2 세션별 도구 사용 횟수

| 세션 | 주요 도구 호출 |
|---|---|
| BugLab Shop 구축 | execute_bash 69, fs_write 40, str_replace 28, read_file 20 |
| Orca 워커(백엔드) | fs_write 21, execute_bash 17, str_replace 5, read_file 4 |
| 시장조사 | execute_bash 119, read_file 35, str_replace 34, remote_web_search 30, fs_write 30, web_fetch 24 (합계 281) |
| AWS 서버 구축 | execute_bash 68, read_file 28, fs_write 14, remote_web_search 8, web_fetch 3, 서브에이전트 1 (합계 141) |
| SDK 연결 | execute_bash 36, read_file 13, str_replace 3, grep_search 3 |
| 쇼핑몰 디자인 2차(현재) | execute_bash·fs_write·str_replace·read_file 다수, 서브에이전트 5, Orca 워커 2 |

### 4.3 Orca로 다른 에이전트와 협업한 기록

| 시각(KST) | Kiro 역할 | 상대 | 맡긴 일 | 결과 |
|---|---|---|---|---|
| 11-04 23:31 | 코디네이터 | Kiro CLI 워커 | BugLab 백엔드 구현 | 완료 보고 2회, curl 10항목 통과 |
| 11-04 23:51 | 코디네이터 | Codex | 쇼핑몰 계획 적합성 독립 검증(실제 Core_engine 실행 포함) | 쇼핑몰은 통과. 엔진이 dev 사이트를 못 돌리는 원인 4가지 발견 → `PLAYWRIGHT_CONTRACT.md` 4.2절 |
| 11-05 01:28 | 코디네이터 | Codex | 시장조사 독립 검토·팩트체크 | "73%" 출처(Soltani 2020) 확인, 정정 12개 등 |
| 11-05 09:01 | 코디네이터 | Codex | 1차 디자인 "실제 쇼핑몰 같은지" 검토 | 지적 9개 → 3개 → 0개 |
| 11-05 10:46 | 코디네이터 | Codex | 시장조사 v3·v4 검토 | 지적 반영 |
| 11-05 14:57 | 코디네이터 | Codex | 11번가형 디자인 검토 | 7.4/10, 차단 3·중요 6건 → 반영 |
| 11-05 15:28 | 코디네이터 | Codex | "AI 티" 검토 | AI 티 3/10, 품질 7.5/10, 반응형 결함 3건 → 반영 |

시각은 작업을 맡긴 시점이다. Codex 결과는 보통 5~20분 뒤 돌아왔다.

## 5. 주요 결과물

| 분류 | 결과물 |
|---|---|
| 데모 쇼핑몰 | Vue 3 프론트, Express 5 + SQLite 백엔드, 운영(3200)·dev(3100) 분리, 테스트 계정·초기화 API |
| 의도적 결함 | B01 쿠폰 중복 적용, B02 수량 감소 후 합계 유지, B03 빈 검색 결과에 이전 카드 잔존, N01 품절 버튼(정상 동작) |
| 명세 | `docs/FUNCTIONAL_SPEC.md`, `API_SPEC.md`, `PLAYWRIGHT_CONTRACT.md`, `INJECTED_DEFECTS.md` |
| 배포 | EC2 systemd 서비스 4개, PostgreSQL, GitHub Actions CI/CD (BugLab PR #3, Metaphor-back PR #29) |
| 시장조사 | `docs/market-research/SPEAR_시장조사_v3·v4` (.md/.html). 핵심: 재현 절차 누락 문제, 경쟁(Sentry·FixFirstly), 차별점 "수정 후 재검증 + 해결까지 상태 추적", 혼동행렬 57/60 |
| 디자인 | PR #2(Unsplash 사진 적용), PR #4(에디토리얼 개편, AI 티 3/10) |
| SDK | 운영 전용 SDK 주입·CSP 설정, EC2 운영 env 키 교체, 신고 미표시 원인 진단(위젯 설정 꺼짐 → 프로그램 비활성 422) |

## 6. 남은 일과 주의

- 엔진: POST·본문·쿠키 전달, 예상된 4xx 허용, 요청 한도 확대가 있어야 B01·B02를 끝까지 재현할 수 있다.
- SDK: 프로그램 상태를 active로 바꾼 뒤 신고가 대시보드에 뜨는지 다시 확인해야 한다.
- 재현 영상: 엔진·백엔드에 녹화 기능이 이미 있다. 워커 `QA_VIDEO_ENABLED`를 켜고 프론트에 `<video>` 카드를 추가하면 된다.
- Bedrock: 엔진 비판자 측정 수치는 gpt-5.4-mini·Groq 기준이라, Bedrock 기준으로 다시 측정해야 발표에 쓸 수 있다.
- 보안: `sess_f2ed564a` 대화 기록에 소유 확인(verify) 토큰 원문이 평문으로 남아 있다. 공유 전에 지우거나 토큰을 새로 발급하는 편이 안전하다.
