// ─────────────────────────────────────────────────────────────
// 하온 브랜드 마크 전용 폰트 상수 — 테마 독립 고정.
//
// 로고 워드마크·스플래시·로그인/비밀번호 재설정 타이틀 등 '브랜드 정체성'
// 표면에만 사용한다. 이들은 앱 UI 가 아니라 브랜드 마크이므로 DESIGN.md §4
// "Pretendard for all app UI" 규정 대상이 아니며, 테마(A/B/C/D/H)와 무관하게
// 항상 동일한 폰트로 렌더되어야 한다(테마 H 에서도 Gowun Batang 유지).
//
// 컴포넌트는 폰트명을 하드코딩하지 말고 반드시 이 상수를 경유한다.
// (scripts/check-fonts.mjs 는 이 파일만 스캔 제외하며, 다른 파일에서
//  'Gowun Batang' 등 브랜드 폰트명 하드코딩은 여전히 위반으로 잡는다.)
// ─────────────────────────────────────────────────────────────

/** 브랜드 세리프 — 스플래시·로그인·재설정 타이틀 "하온" (Gowun Batang) */
export const BRAND_FONT_SERIF = "'Gowun Batang', serif";

/** 로고 워드마크 전용 — Gowun Batang + Dodum 폴백 (HaonLogo 글자) */
export const BRAND_FONT_WORDMARK = "'Gowun Batang', 'Gowun Dodum', serif";

/** 브랜드 서브텍스트 — 로고 태그라인 (Gowun Dodum) */
export const BRAND_FONT_SUBTEXT = "'Gowun Dodum', sans-serif";

/** 스플래시 컨테이너 기본 폰트 — Gowun Dodum + Pretendard 폴백 */
export const BRAND_FONT_SOFT = "'Gowun Dodum', 'Pretendard', sans-serif";
