# Preview 사이드바 햄버거 최종 개선

기준: `9b623b9f6e9088a3b304bf0927c6d8c2e7e6be67` / 브랜치: `codex/moamoa-review-preview`.

- `ReviewShell.tsx`: 별도 행의 큰 접기 버튼과 PanelLeft 아이콘을 제거했다. 로고 옆에 Lucide Menu만 표시한다. 접힘 상태에서는 로고를 숨기고 같은 Menu 버튼을 중앙에 표시한다.
- `review.css`: 펼침 216px / 접힘 76px 유지. 버튼은 44×44px, 기본 테두리·배경 없음. hover 및 키보드 focus 표시 제공. 모바일 헤더·하단 5개 메뉴는 변경하지 않았다.
- 기존 접근성 라벨, title, aria-controls, aria-expanded와 native button의 Enter/Space 동작 유지. 현재 페이지와 선택 상태를 유지한다.
- 새 `moa-review-sidebar.test.mjs`: 1440/768/390px 전후 캡처, 아이콘 크기와 로고 겹침, 테두리·텍스트 제거, 216/76px 폭, Enter/Space, 메뉴 이동, 모바일 메뉴 5개, 외부 요청·JS 오류·가로 넘침 검증.

Production 빌드 출력 19개 파일 SHA-256이 수정 전과 모두 동일하다. 폰트·색상 린트 통과. 기존 `render:check -- --route=todos`는 FAIL 0 / WARN 4 (기존 화면의 라벤더 7건씩)이다.

회귀 명령: `node --test --test-concurrency=1 scripts/test/moa-review*.test.mjs`.
사진·저장 동작은 기존 메모리 샘플을 사용하며 실제 Supabase·Storage·API를 호출하지 않는다. 주간 회고·문화·음악·독서·캘린더 코드를 수정하지 않았다.

## 전후 화면

| 화면 | 수정 전 | 수정 후 |
| --- | --- | --- |
| PC 펼침 | [전](screenshots/moamoa-sidebar/before/desktop-expanded.png) | [후](screenshots/moamoa-sidebar/after/desktop-expanded.png) |
| PC 접힘 | [전](screenshots/moamoa-sidebar/before/desktop-collapsed.png) | [후](screenshots/moamoa-sidebar/after/desktop-collapsed.png) |
| 태블릿 펼침 | [전](screenshots/moamoa-sidebar/before/tablet-expanded.png) | [후](screenshots/moamoa-sidebar/after/tablet-expanded.png) |
| 태블릿 접힘 | [전](screenshots/moamoa-sidebar/before/tablet-collapsed.png) | [후](screenshots/moamoa-sidebar/after/tablet-collapsed.png) |
| 모바일 | [전](screenshots/moamoa-sidebar/before/mobile-expanded.png) | [후](screenshots/moamoa-sidebar/after/mobile-expanded.png) |

전체 실행 로그는 `/workspace/sidebar-validation`에 보관한다. 기존 회귀 테스트가 재생성한 캡처는 저장소 외부로 보관하고 기존 커밋의 파일을 유지한다. 신규 사이드바 전후 캡처만 이번 커밋에 포함한다.

검증 결과: Preview 전체 22개 시나리오 실행. 주간 회고의 이전 아이콘 고정 조건에서 상위/하위 2건 실패가 발생하여 새 요구사항에 맞게 갱신했다. 영향받은 사이드바·주간 회고 11개를 재실행해 모두 통과했다. 나머지 문화·음악·독서·캘린더·기본 Preview 검사는 최초 실행에서 통과했다. 최종 미해결 실패는 없다.
