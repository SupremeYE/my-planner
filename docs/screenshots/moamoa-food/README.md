# MoaMoa 음식 기록 / 시간 UI 캡처

**개인정보 없는 메모리 샘플**이다. 기존/신규 사진은 직접 만든 테스트 식사 이미지다. 실제 App/Auth/Provider/codec을 렌더하되 DB·Storage는 메모리, AI는 mock으로 대체하며 운영 서비스에는 요청하지 않는다. 이미지 상단에도 격리 검증 표시가 있다.

모바일 390×844 / PC 1440×1024, Chromium. 회귀 시각은 Asia/Seoul 2027-01-01이고 review-live만 실제 현재 날짜다. 제품 날짜를 고정하지 않는다. 기존 캡처 40장과 촬영 선택 2장: 주요 18화면×2, 빈 상태/로딩 각 1, 현재 날짜 시연×2.

| 화면 | 모바일 | PC |
| --- | --- | --- |
| 날짜·끼니별 목록 | [보기](mobile-list.png) | [보기](desktop-list.png) |
| 기존 사진·영양·맛 메모 상세 | [보기](mobile-detail.png) | [보기](desktop-detail.png) |
| 제목 중심 추가 | [보기](mobile-add.png) | [보기](desktop-add.png) |
| 기존 데이터 수정 | [보기](mobile-edit.png) | [보기](desktop-edit.png) |
| 사진 선택과 선택 정보 | [보기](mobile-photo-selected.png) | [보기](desktop-photo-selected.png) |
| 업로드 진행 중 | [보기](mobile-uploading.png) | [보기](desktop-uploading.png) |
| 업로드 실패·초안·재시도 | [보기](mobile-upload-failure.png) | [보기](desktop-upload-failure.png) |
| DB 응답 유실·재시도 | [보기](mobile-save-failure.png) | [보기](desktop-save-failure.png) |
| 월별 날짜 그룹 갤러리 | [보기](mobile-gallery.png) | [보기](desktop-gallery.png) |
| 기록 삭제·사진 보존 안내 | [보기](mobile-delete.png) | [보기](desktop-delete.png) |
| AI 실패·수동 입력 | [보기](mobile-ai-failure.png) | [보기](desktop-ai-failure.png) |
| 제안값과 입력값 분리 | [보기](mobile-ai-proposal.png) | [보기](desktop-ai-proposal.png) |
| 기존 사진 불러오기 실패 | [보기](mobile-broken-photo.png) | [보기](desktop-broken-photo.png) |
| 긴 음식명 | [보기](mobile-long-name.png) | [보기](desktop-long-name.png) |
| 오프라인 미저장 | [보기](mobile-offline.png) | [보기](desktop-offline.png) |
| 간소화한 시간 일간 UI | [보기](mobile-time-daily.png) | [보기](desktop-time-daily.png) |
| 시간 주간 UI | [보기](mobile-time-weekly.png) | [보기](desktop-time-weekly.png) |
| 시간 월간 UI | [보기](mobile-time-monthly.png) | [보기](desktop-time-monthly.png) |
| 현재 날짜의 로컬 격리 시연 | [보기](mobile-review-live.png) | [보기](desktop-review-live.png) |

[빈 상태](mobile-empty.png) · [로딩](mobile-loading.png) · [자동 검사](validation.json). 의도된 메뉴 한 줄 가로 스크롤 외에는 페이지·카드·폼의 가로 넘침이 없음을 확인했다. 콘텐츠 viewport가 빠른 기록 버튼 위에서 끝나는지도 확인했다.

격리 시연: `TZ=Asia/Seoul MOA_REVIEW_PORT=5177 node scripts/test/serve-moa-today.mjs` → `http://localhost:5177/__moamoa-food`. 새로고침하면 시연 행은 초기화되고 사진도 서버 종료 시 사라지는 로컬 메모리다. AI는 시연에서 외부 호출 없이 오류를 반환하며 기본 저장은 가능하다. 실제 Supabase 영구 저장 검증이 아니다.

[구현·사진 보존·검증·운영 전 제한](../../MOAMOA_STEP3B4A_FOOD_RECORDS.md)

## 카메라 보완

[모바일 촬영/앨범 버튼](mobile-camera-options.png) · [PC 촬영/앨범 버튼](desktop-camera-options.png). Chromium filechooser를 검증한 것으로, 실제 iPhone 카메라 동작을 검증한 사진이 아니다. [실기기 미검증 항목과 HTTPS 구성안](../../MOAMOA_FOOD_CAMERA_SUPPLEMENT.md)을 참고한다.
