# MoaMoa 할 일 화면

실제 App/Auth/PlannerProvider/DB 변환 코드를 사용하고 Supabase 전송만 기존 메모리 계층으로 교체한 Chromium 렌더링이다. 운영 데이터·실제 개인정보는 사용하지 않았다.

직접 시연: `TZ=Asia/Seoul MOA_REVIEW_PORT=5176 node scripts/test/serve-moa-today.mjs` → <http://localhost:5176/__moamoa-todos>. 배지에 격리 샘플·새로고침 초기화를 표시한다. 실제 제품 연결 경로는 설정된 개발 환경의 `/__moamoa-todos`이며 기존 로그인이 필요하다.

| 화면 | 모바일 390×844 | PC 1440×1024 |
| --- | --- | --- |
| 전체 목록 | [모바일](mobile-list.png) | [PC](desktop-list.png) |
| 할 일 추가 | [모바일](mobile-add.png) | [PC](desktop-add.png) |
| 할 일 수정 | [모바일](mobile-edit.png) | [PC](desktop-edit.png) |
| 대표 시간 카테고리 | [모바일](mobile-time-category.png) | [PC](desktop-time-category.png) |
| 보조 태그 선택 | [모바일](mobile-tag-picker.png) | [PC](desktop-tag-picker.png) |
| 태그 관리 | [모바일](mobile-tag-management.png) | [PC](desktop-tag-management.png) |
| 목표 연결 | [모바일](mobile-goal-picker.png) | [PC](desktop-goal-picker.png) |
| 실제 시간 기록 | [모바일](mobile-time-record.png) | [PC](desktop-time-record.png) |
| 저장 실패·재시도 | [모바일](mobile-save-failure.png) | [PC](desktop-save-failure.png) |
| 현재 날짜 격리 시연 | [모바일](mobile-review-live.png) | [PC](desktop-review-live.png) |

추가 상태: [빈 데이터](mobile-empty.png), [오프라인](mobile-offline.png), [긴 제목](mobile-long-title.png).

고정 fixture는 Asia/Seoul 2027-01-01의 ISO 연초 경계다. 실제 제품 날짜는 고정하지 않는다. 전체 화면·모달의 가로 넘침을 검사했고, 체크 표시는 25px/터치 영역은 44px 이상이다. 모달 저장·재시도는 본문 스크롤과 분리했다.

[수치·캡처 검증 자료](validation.json) · [구현·제약·검증 보고서](../../MOAMOA_STEP3B_TODO_TAGS.md).
