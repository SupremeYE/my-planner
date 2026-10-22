# 오늘 홈 렌더링

모든 화면은 실제 App/Auth/PlannerProvider/DB 변환 코드를 사용하며, Supabase 전송 계층만 STEP 2 메모리 계층으로 바꿨다. 개인정보·운영 DB를 사용하지 않았다.

직접 시연: `TZ=Asia/Seoul node scripts/test/serve-moa-today.mjs` 실행 후 <http://localhost:5175/__moamoa-today>. 상단에 격리 시연 배지가 보이며 새로고침 시 샘플이 초기화된다. 제품 연결 경로는 설정된 Supabase/Auth가 있는 일반 개발 서버의 `/__moamoa-today`이다.

| 화면 | 링크 |
| --- | --- |
| 현재 날짜 모바일 390×844 / 격리 배지 | [모바일 시연](mobile-review-live.png) |
| 현재 날짜 PC 1440×1024 / 격리 배지 | [PC 시연](desktop-review-live.png) |
| 모바일 홈 / ISO 경계 fixture | [오늘](mobile-today.png) |
| PC 홈 / ISO 경계 fixture | [오늘](desktop-today.png) |
| 일정·실제 시간·회고 | [모바일 하단](mobile-time-and-review.png) |
| 제목만 기록 | [빠른 TODO](mobile-quick-todo.png) |
| 응답 유실·초안 보존·재시도 | [빠른 기록 실패](mobile-quick-failure.png) |
| 완료 실패·기존 상태 보존 | [완료 실패](mobile-completion-failure.png) |
| 빈 데이터 | [빈 상태](mobile-empty.png) |
| Provider 초기 로딩 | [로딩](mobile-loading.png) |
| 연결 끊김 안내 | [오프라인](mobile-offline.png) |
| 긴 목표 제목을 자세히 펼친 상태 | [긴 제목](mobile-long-titles.png) |

고정 경계 fixture는 Asia/Seoul `2027-01-01`이며 제품 날짜를 고정한 것이 아니다. 새벽 2시의 논리적 날짜 변경은 별도 자동 검증했다. 긴 목표는 기본 요약 상태에서 두 줄과 펼치기를 제공한다.

[자동 검증 수치](validation.json). 기존 앱의 별도 렌더 검사 결과는 `scripts/render/output/report.json`(gitignore)에 있다. 재현 명령과 검증 한계는 [작업 보고서](../../MOAMOA_STEP3B_TODAY.md)에 기재했다.

추가 요청 반영: 응원 문구 `오늘도, 힘내자!` / `작은 일부터 하나씩.`, 모바일 하단과 PC 사이드바의 `오늘 / 캘린더 / 할 일 / 기록 / 나의 정원` 명칭을 반영한 최신 캡처다. 390px 제목 한 줄과 캐릭터 비겹침은 브라우저에서 검증했다.
