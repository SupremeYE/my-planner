# 모아모아 v0.1 시안 갤러리

디자인 검토용 샘플이다. 실제 사용자의 기록이 아니다.
[UX 명세](../../MOAMOA_V01_UX_SPEC.md) · [렌더 검증](validation.json)

기존 저장소에서 `npm run dev -- --host 0.0.0.0 --port 5174 --strictPort`로 실행하고
그 개발 서버의 `/__moamoa/` 경로를 연다. 현재 환경에서는 이 서버를 실행한 상태다.
다음 작업 환경에서 프로세스가 유지된다고 가정하지 말고 필요한 경우 다시 시작한다.
운영 로그인이나 Supabase 자격증명이 필요하지 않다.

## 필수 7개 시안

| 시안 | 화면 | 크기 | 경로/동작 |
| --- | --- | --- | --- |
| 1 | [모바일 오늘 홈](mobile-today.png) | 390×844 | `/__moamoa/` |
| 2 | [PC 오늘 홈](desktop-today.png) | 1440×1140 | `/__moamoa/` |
| 3 | [PC 주간 일정](desktop-week-schedule.png) | 1440×1140 | `?screen=calendar&period=week&view=schedule` |
| 4 | [PC 주간 플래너](desktop-week-planner.png) | 1440×1140 | `?screen=calendar&period=week&view=planner` |
| 5 | [모바일 주간 플래너](mobile-week-planner.png) | 390×844 | 위와 같은 경로 |
| 6 | [모바일 퀘스트](mobile-quests.png) | 390×844 | `?screen=quests` |
| 7 | [모바일 빠른 시간 기록](mobile-quick-record.png) | 390×844 | 기록 버튼 → 시간 |

## 보조 화면과 인터랙션 상태

| 화면 | 이미지 |
| --- | --- |
| 모바일 빠른 TODO | [mobile-quick-todo.png](mobile-quick-todo.png) |
| 반영 실패·초안 유지·재시도 | [mobile-save-failure.png](mobile-save-failure.png) |
| 모바일 주간 습관과 날짜 미정 | [mobile-week-planner-habits.png](mobile-week-planner-habits.png) |
| 모바일 주간 일정 | [mobile-week-schedule.png](mobile-week-schedule.png) |
| 모바일 월간 | [mobile-month.png](mobile-month.png) |
| 모바일 일간 | [mobile-day.png](mobile-day.png) |
| 모바일 기록 | [mobile-records.png](mobile-records.png) |
| PC 기록 | [desktop-records.png](desktop-records.png) |
| PC 퀘스트 | [desktop-quests.png](desktop-quests.png) |
| 모바일 나의 정원 | [mobile-garden.png](mobile-garden.png) |
| PC 나의 정원 | [desktop-garden.png](desktop-garden.png) |

스크린샷은 화면 상단 또는 표시된 스크롤 위치의 실제 렌더다. 아래 내용은 앱 안에서 세로로 스크롤한다.
시간 시트의 기본 반영 버튼은 필드가 스크롤되더라도 보인다. 독립 활동은 후속 설계로 표시하고 비활성화했다.

검토 순서는 모바일 오늘 → 빠른 기록 → 모바일 퀘스트 → PC 주간 일정/플래너를 권장한다.
같은 샘플 TODO를 체크하고 메뉴를 이동하면 다른 화면에도 같은 상태와 목표 진행률을 표시한다.
시안 옵션의 “다음 반영 실패 시연”으로 실패/재시도 UI를 확인할 수 있다.

단독 검증과 재캡처:

```bash
node --test scripts/test/moamoa-prototype.test.mjs
```
