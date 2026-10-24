# MoaMoa 시간 기록·분석 렌더

**실제 개인정보가 아닌 격리 메모리 샘플**이다. 실제 App/Auth/Provider/codec을 렌더하며 운영 Supabase 요청을 차단한다. 이미지 상단에도 격리 검증 표시를 넣었다. 제품 코드는 샘플 데이터를 가져오지 않는다.

모바일 390×844 / PC 1440×1024, Chromium, Asia/Seoul 2027-01-01 고정 테스트 시각. 제품 날짜는 실제 사용자 로컬/논리적 날짜를 사용한다. 새 화면 31장과 `validation.json`을 보존한다. 가로 넘침·본문/모달 잘림을 자동 검사하고 주요 이미지를 직접 검토했다.

| 화면 | 모바일 | PC |
| --- | --- | --- |
| 일간 분석 | [보기](mobile-daily.png) | [보기](desktop-daily.png) |
| 주간 분석 | [보기](mobile-weekly.png) | [보기](desktop-weekly.png) |
| 월간 분석 | [보기](mobile-monthly.png) | [보기](desktop-monthly.png) |
| 이전 기간 카테고리 비교 | [보기](mobile-comparison.png) | [보기](desktop-comparison.png) |
| 활동별 상세 목록 | [보기](mobile-history.png) | [보기](desktop-history.png) |
| 독립 활동 입력 | [보기](mobile-new-activity.png) | [보기](desktop-new-activity.png) |
| 활동 수정 | [보기](mobile-edit-activity.png) | [보기](desktop-edit-activity.png) |
| 기존 할 일에 연결 | [보기](mobile-todo-linked.png) | [보기](desktop-todo-linked.png) |
| 선택적 메모·실제 시각 | [보기](mobile-actual-times.png) | [보기](desktop-actual-times.png) |
| 응답 유실·입력 보존·명시적 재시도 | [보기](mobile-save-failure.png) | [보기](desktop-save-failure.png) |
| 미분류 포함 집계 | [보기](mobile-unclassified.png) | [보기](desktop-unclassified.png) |
| 긴 활동명 상세 목록 | [보기](mobile-long-activity.png) | [보기](desktop-long-activity.png) |
| 알려진 실제 구간의 겹침 후보 | [보기](mobile-overlap.png) | [보기](desktop-overlap.png) |
| 오프라인 미저장·초안 유지 | [보기](mobile-offline.png) | [보기](desktop-offline.png) |
| 스키마 미적용·저장 차단 | [보기](mobile-schema-unavailable.png) | [보기](desktop-schema-unavailable.png) |

[모바일 빈 상태](mobile-empty.png). `validation.json`에는 28개 주요 캡처의 viewport/overflow 결과를 기록하고, 스키마 미적용 2장·빈 상태 1장은 별도 캡처했다.

시연: `TZ=Asia/Seoul MOA_REVIEW_PORT=5176 node scripts/test/serve-moa-today.mjs` → `http://localhost:5176/__moamoa-records`. 새로고침하면 시연의 메모리 데이터는 초기화된다. 실제 서버 저장/복수 기기 검증은 아니다.

[구현·검증·DB 적용 전 제약](../../MOAMOA_STEP3B_TIME_ANALYSIS.md)
