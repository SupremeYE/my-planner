import { type CSSProperties } from 'react';
import { type ThemeTokens } from '../ThemeContext';
import { type RetroStatus } from '../store';

// ─── Haon Soft Pastel — Solid Elevation helpers (DESIGN.md v1.1) ───
// 앱은 테마 H 단일이다. 헬퍼는 파스텔 솔리드 표면 recipe 를 반환한다.
// v1.1 핵심: 본문 표면은 글래스가 아니라 불투명 흰색 + 하이라인 + 소프트 그림자.
//   글래스(반투명+blur)는 오버레이(떠 있는 상단 날짜 바·모달·팝오버)에만 사용한다.
//
// 공용 모듈: 각 페이지는 이 헬퍼를 import 해서 동일 recipe를 재사용한다.
// (테마 H 단일화로 구 `isHaon(t)` 게이팅 헬퍼는 제거됨 — 모든 헬퍼가 H recipe 를 반환한다.)

// 페이지 캔버스: 파스텔 방사형 blob (없으면 배경 미지정 → 기존 레이아웃 배경 유지)
export function canvasStyle(t: ThemeTokens): CSSProperties {
  return t.appGradient ? { background: t.appGradient } : {};
}

// 솔리드 카드 (본문 표면) — 불투명 흰색 + 1px 하이라인 + 소프트 그림자, backdrop-filter 없음.
export function solidCardStyle(t: ThemeTokens): CSSProperties {
  return {
    background: t.solidCardBg ?? '#FFFFFF',
    border: t.solidCardBorder ?? '1px solid rgba(122,92,162,0.12)',
    borderRadius: t.solidCardRadius ?? 20,
    boxShadow: t.solidCardShadow ?? '0 8px 20px rgba(120,90,160,0.12)',
  };
}

// 솔리드 항목 행(할일·일정 카드) — 진한 하이라인 + 이중 그림자로 배경과 분리, 입체감.
export function solidRowStyle(t: ThemeTokens): CSSProperties {
  return {
    background: t.solidRowBg ?? '#FFFFFF',
    border: t.solidRowBorder ?? '1px solid rgba(122,92,162,0.20)',
    borderRadius: t.solidRowRadius ?? 14,
    boxShadow: t.solidRowShadow ?? '0 2px 4px rgba(120,90,160,0.12), 0 10px 22px rgba(120,90,160,0.16)',
  };
}

// ─── 입력 필드 배경 (DESIGN.md §5 Input — solid-card fill + hairline) ───
// §5 Input = solid-card(불투명 흰색) 채움 + hairline 테두리. H 에서 입력 배경을 흰색(solidCard)으로,
// 비-H(A/B/C/D)는 기존 bgSub 를 그대로 반환 → 회귀 0. 새 규칙 창작이 아니라 §5 Input 의 코드화.
// (테두리·color·fontSize 는 호출부가 유지 — 이 헬퍼는 배경만 게이팅한다.)
export function inputBg(t: ThemeTokens): string {
  return t.solidCardBg ?? '#FFFFFF';
}

// ─── danger 계열 회수 (DESIGN.md §5 — danger: t.danger 텍스트/아이콘 on t.dangerLight 채움) ───
// off-palette 하드코딩(#DC2626/#FEE2E2/#FEF2F2/#FCA5A5)을 H 에서 토큰으로 회수한다.
// 비-H 는 각 호출부의 원래 하드코딩 값을 fallback 으로 그대로 반환 → 픽셀 보존.
export function dangerText(t: ThemeTokens, _fallback = '#DC2626'): string {
  return t.danger;
}
export function dangerFill(t: ThemeTokens, _fallback?: string): string {
  return t.dangerLight;
}

// ─── 세그먼트 컨트롤 (DESIGN.md §5 — 인라인 게이트 스타일) ───
// §5: 활성 = 불투명 흰 pill + 소프트 그림자 + deep-indigo 600 라벨 + 3px 코랄 언더라인,
//     비활성 = 투명 + 뮤트 라벨, 트랙 = near-neutral 저채도(borderLight). **풀필 금지.**
// 코랄 언더라인은 DOM 추가 없이 inset box-shadow 로 구현(SegmentedControl.tsx <span> 의 등가 표현).
// H 전용. 비-H 는 legacyFill(기존 풀필 색)을 그대로 반환 → 픽셀 보존.
export function segmentTrackStyle(t: ThemeTokens): CSSProperties {
  return { background: t.borderLight, padding: 3, gap: 3 };
}
export function segmentItemStyle(t: ThemeTokens, active: boolean, _legacyFill?: string): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    borderRadius: 8,
    background: active ? t.card : 'transparent',
    color: active ? t.text : t.textMuted,
    boxShadow: active ? `0 2px 8px rgba(120,90,160,0.14), inset 0 -3px 0 ${t.accent}` : 'none',
    transition: 'all 0.15s',
  };
}

// ─── hex 색 mix (태그 칩: 채도 있는 파스텔 채움 + 어두운 텍스트 시블링) ───
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// hex('#RRGGBB'/'#RGB') 또는 rgb()/rgba() 문자열을 {r,g,b}로. (mixHex 결과를 다시 mixHex 하는 체인 지원)
function toRgb(color: string): { r: number; g: number; b: number } | null {
  const hex = hexToRgb(color);
  if (hex) return hex;
  const m = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const [r, g, b] = m[1].split(',').map(s => parseFloat(s.trim()));
    if ([r, g, b].every(v => Number.isFinite(v))) return { r, g, b };
  }
  return null;
}
// target: 255=흰색 쪽, 0=검정 쪽. amt: 0~1 섞는 정도. hex/rgb() 입력 모두 허용(파생색 재믹스 안전).
export function mixHex(hex: string, target: number, amt: number): string {
  const rgb = toRgb(hex);
  if (!rgb) return hex;
  const m = (c: number) => Math.round(c + (target - c) * amt);
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
}

// 색 토큰에 알파를 안전하게 입힌다. hex('#RRGGBB')는 8자리 hex 알파로, 그 외(rgb/rgba/named)는
// rgba()로 변환한다. `${color}60` 처럼 hex 알파 접미사를 그냥 붙이면 토큰이 rgba()일 때
// (예: 테마 H 의 t.border='rgba(46,42,91,0.10)') 'rgba(...)60' 같은 잘못된 CSS 가 되어
// 테두리/배경이 통째로 사라진다. 이 헬퍼는 토큰 형태와 무관하게 항상 유효한 색을 반환한다.
// alpha01: 0~1.
export function withAlpha(color: string, alpha01: number): string {
  const a = Math.max(0, Math.min(1, alpha01));
  const rgb = hexToRgb(color);
  if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  const m = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(s => s.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color; // named/unknown — 알파 미적용(원색 유지)
}

// 반투명 프로스티드 바(떠 있는 상단 날짜 바·탭바) — 오버레이 글래스 (DESIGN v1.1 허용)
export function glassBarStyle(t: ThemeTokens): CSSProperties {
  return {
    background: 'rgba(255,255,255,0.45)',
    backdropFilter: t.glassBlur,
    WebkitBackdropFilter: t.glassBlur,
    borderBottom: `1px solid rgba(255,255,255,0.55)`,
  };
}

// ─── 다중 선택 패턴 (DESIGN.md §5 — Selection mode & bulk-action bar) ───
// 선택된 행: 기존 행 표면(solidRowStyle/카드) 위에 코랄 링만 덧댄다(배경·그림자 불변).
// outline 은 boxShadow/border 와 독립이라 기존 rowStyle 과 충돌 없이 스프레드 가능.
export function selectedRowStyle(t: ThemeTokens): CSSProperties {
  return { outline: `2px solid ${t.accent}`, outlineOffset: -2 };
}

// 일괄 액션 바(리스트 하단 floating) — 오버레이라 H 에서 글래스 허용(§1), 그 외 테마는 솔리드 카드.
export function actionBarStyle(t: ThemeTokens): CSSProperties {
  return {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: t.glassBlur,
    WebkitBackdropFilter: t.glassBlur,
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(120,90,160,0.18)',
  };
}

// ─── 버튼 recipe (DESIGN.md §5 — 공통 buttonStyle) ───
// §5 버튼 스펙을 그대로 구현하는 정적 스타일 객체. 버튼은 색 토큰 기반이라 전 테마 공통
// (A/B/C/D/H) — isHaon 게이팅 없음. 각 variant 는 t.accent / t.danger / t.accentLight 등
// 토큰만 참조하므로 테마별 정체성이 자동 보존된다.
//
// ⚠️ 범위: 이 recipe 는 "정적 스타일"만 제공한다. 상호작용 상태(hover/pressed/focus)는
// style 객체로 표현 불가 → 다음 단계의 얇은 <Button> + haon.css 가 담당(§5 Interaction states).
// primary 그라데이션은 recipe 기본이 아니다 — 필요 시 소비처가 `t.primaryGradient ?? t.accent`
// 관용구(§3/§5)를 쓴다(recipe 기본은 솔리드).
//
// 소비처는 아직 없다(정의만; 페이지 치환은 다음 단계).
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid';

export function buttonStyle(
  t: ThemeTokens,
  variant: ButtonVariant = 'primary',
  disabled = false,
): CSSProperties {
  // 공통: radius 12–16px, weight 600, disabled 시 opacity 0.5 (헬퍼로 포함 — 소비처 생략 가능)
  const base: CSSProperties = {
    borderRadius: 14,
    fontWeight: 600,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...(disabled ? { opacity: 0.5 } : null),
  };
  switch (variant) {
    // 채움 t.accent + 흰 텍스트 (솔리드 — 그라데이션 아님)
    case 'primary':
      return { ...base, background: t.accent, color: '#FFFFFF' };
    // t.accentLight 채움 + t.accent 텍스트 + t.border 테두리 (취소·보조)
    case 'secondary':
      return { ...base, background: t.accentLight, color: t.accent, border: `1px solid ${t.border}` };
    // tint 만 (t.accentLight), 테두리 없음, t.accent 텍스트 (인라인·저강조)
    case 'ghost':
      return { ...base, background: t.accentLight, color: t.accent };
    // 연한 위험 액션 — t.dangerLight 배경 + t.danger 텍스트
    case 'danger':
      return { ...base, background: t.dangerLight, color: t.danger };
    // 파괴적 확정 — t.danger 채움 + 흰 텍스트
    case 'dangerSolid':
      return { ...base, background: t.danger, color: '#FFFFFF' };
  }
}

// ─── 추가 액션 패턴 (Context add-action — DESIGN.md §5 "Context add-action") ───
// "한 매핑, 두 렌더링": 페이지→주 추가 액션은 단일 소스, 렌더는 모바일 FAB / PC 헤더 "+ 추가" 두 갈래.
// 아래는 "성격 다른 다종 기록"을 고르는 chooser 표면 recipe(정적 스타일만) — 모바일 바텀시트 /
// PC 팝오버 / 딤 배경. 시트·팝오버는 오버레이라 글래스 허용(§1); 비-H(A/B/C/D)는 솔리드 폴백.
// ⚠️ 소비처는 아직 없다(정의만; 배치는 Stage 2, 페이지별 분기 연결은 Stage 3).
// 헤더 "+ 추가" 버튼은 buttonStyle(t, 'ghost')(accentLight/accent pill)을 재사용 — 새 버튼 헬퍼 없음.

// 모바일 바텀시트/팝오버 뒤 딤 배경 — 오버레이 뒤 콘텐츠를 어둡게. 전 테마 공통(색 토큰 무관).
export function sheetBackdropStyle(): CSSProperties {
  return { background: 'rgba(46,42,91,0.32)' };
}

// 모바일 바텀시트 컨테이너 — 상단만 라운드 + 드래그 핸들 영역, 하단 고정. 오버레이 글래스(§1).
export function bottomSheetStyle(t: ThemeTokens): CSSProperties {
  return {
    background: t.cardFrosted ?? 'rgba(255,255,255,0.92)',
    backdropFilter: t.glassBlur,
    WebkitBackdropFilter: t.glassBlur,
    borderTop: '1px solid rgba(255,255,255,0.6)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0 -8px 24px rgba(120,90,160,0.16)',
  };
}

// PC "+ 추가" 팝오버(다종 항목 chooser) — 헤더 버튼 아래 앵커, 오버레이 글래스(§1).
export function addPopoverStyle(t: ThemeTokens): CSSProperties {
  return {
    background: t.cardFrosted ?? 'rgba(255,255,255,0.92)',
    backdropFilter: t.glassBlur,
    WebkitBackdropFilter: t.glassBlur,
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(120,90,160,0.14)',
  };
}

// ─── 기간 네비게이터 (Period navigator — DESIGN.md §5 "Period navigator") ───
// "달력 고정" 기간 이동 공용 패턴: [주/월/년 세그먼트] + [‹ 기간 라벨 › 스테퍼].
// 세그먼트 시각은 기존 <SegmentedControl>(§5)을 재사용한다 — 신규 세그먼트 헬퍼 없음(조합만).
// 여기서 등록하는 건 스테퍼 화살표(‹ ›) 아이콘 버튼 표면뿐. 라벨/집계/미래차단은 컴포넌트 로직.
//
// 공용 컴포넌트 계약(Stage 3 구현): props =
//   unit('주'|'월'|'년'), offset(0=현재), onOffsetChange, weekStartsOn(0|1).
//   · 미래 차단: offset >= 0 이면 다음(›) disabled — 오늘 이후 기간으로 못 감.
//   · 뒤로는 항상 허용: 이전(‹)은 비활성 없음 — 과거를 달력처럼 자유 탐색(하한 클램프 없음).
//   · 단위 전환 시 offset=0 으로 리셋(현재 기간).
//   · 라벨: 주 "이번 주 M.DD–M.DD" / 월 "YYYY년 M월" / 년 "YYYY".
// 수면·몸무게 공용(수면 인라인 스테퍼를 이 패턴으로 수렴 — Stage 3, 결정2).
// ⚠️ 소비처는 아직 없다(정의만; 컴포넌트/치환은 Stage 3).
//
// 스테퍼 ‹ › 아이콘 버튼 표면 — 네비 버튼은 "면 구분"일 뿐(선택/활성 아님)이라 중립 surfaceMuted 를 쓴다.
// (라일락 accentSoft 를 passive nav 표면에 쓰면 라일락이 화면에 번진다 — §5 List row/§3 accentSoft restraint.)
// 비-H는 bgSub 폴백(ConditionTab 관례; 비-H bgSub 은 중립).
export function periodStepperStyle(t: ThemeTokens, disabled = false): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    ...(disabled ? { opacity: 0.4 } : null),
  };
  return { ...base, background: t.surfaceMuted, color: t.textSub, borderRadius: 999 };
}

// ─── 눈바디 갤러리 (Photo gallery — DESIGN.md §5 "Photo gallery") ───
// 몸 사진 타임라인 그리드. 민감 사진 = 비공개 저장·서명 URL 표시(취급 규칙은 CLAUDE.md).
// 아래는 표면 recipe(정적 스타일)만. 선택 링은 selectedRowStyle, 비교 카드는 solidCardStyle 재사용.
// ⚠️ 소비처는 아직 없다(정의만; 그리드/비교 뷰는 Stage 3~4).

// 썸네일 타일 — 1:1 정사각, 라운드 + overflow hidden. 로딩/빈 상태의 중립 표면도 이 recipe.
export function photoTileStyle(t: ThemeTokens): CSSProperties {
  const base: CSSProperties = { position: 'relative', overflow: 'hidden' };
  return {
    ...base,
    background: t.solidCardBg ?? '#FFFFFF',
    border: t.solidCardBorder ?? '1px solid rgba(122,92,162,0.12)',
    borderRadius: 14,
    boxShadow: t.solidCardShadow ?? '0 8px 20px rgba(120,90,160,0.12)',
  };
}

// ─── 월말 회고 슬롯 상태 칩 (DESIGN.md §5 "월말 회고 슬롯") ───
// 월간 목표 카드 안의 회고 3버튼(달성/부분/미달). 시맨틱 색(§3)을 tint 로만 쓰고 텍스트는 딥 인디고
// (t.text)로 대비 확보 — "붉은 위 붉은" 회피(§5 duration chip 관례와 동일 정신).
//   · 달성(done)   → success (녹색)
//   · 부분(partial) → warning (앰버·주의)
//   · 미달(missed)  → danger  (§3: danger=위험·삭제·실패, "미달"=실패로 정렬)
// 비선택 = 흰색(t.card) + hairline + muted 라벨. 선택 = 시맨틱 tint(mixHex 파생) + 시맨틱 테두리 + 딥 인디고 라벨.
// 전 테마 공통(토큰 기반) — isHaon 게이팅 없음. 신규 색 토큰 없음(mixHex 로 Light tint 파생).
export function retroStatusColor(t: ThemeTokens, s: RetroStatus): string {
  return s === 'done' ? t.success : s === 'partial' ? t.warning : t.danger;
}
export function retroStatusStyle(t: ThemeTokens, s: RetroStatus, selected: boolean): CSSProperties {
  const base = retroStatusColor(t, s);
  if (!selected) {
    return {
      background: t.card,
      border: `1px solid ${t.border}`,
      color: t.textMuted,
      borderRadius: 10,
    };
  }
  return {
    background: mixHex(base, 255, 0.82),
    border: `1.5px solid ${base}`,
    color: t.text,
    borderRadius: 10,
  };
}

// ─── 컨디션 4단계 선택칩 (몸 상태 — 스트레스와 다른 축) ───
// 월말 회고 슬롯(retroStatus)과 동일 정신: 시맨틱 색을 tint 로만 쓰고 라벨은 딥 인디고(t.text)로 대비 확보.
// 이모지 대신 '색 단계'로 표현 — 폼의 형제 컨트롤(스트레스 그리드)·앱의 다단계 선택칩(retroStatus)과 일관.
// 4색 램프(나쁨→아주좋음)는 토큰만으로 구성(danger/warning/success + mixHex) → 색 하드코딩·라일락 우회 없음.
//   · 1 나쁨     → danger  (코랄)
//   · 2 보통     → warning (앰버)
//   · 3 좋음     → success (세이지)
//   · 4 아주 좋음 → success 를 더 진하게(mixHex) — 좋음과 구분되는 딥 그린(순서상 진할수록 좋음)
// 전 테마 공통(토큰 기반) — 신규 색 토큰 없음.
export function conditionLevelColor(t: ThemeTokens, value: number): string {
  if (value <= 1) return t.danger;
  if (value === 2) return t.warning;
  if (value === 3) return t.success;
  return mixHex(t.success, 0, 0.28); // 4 아주 좋음 — 딥 그린
}
export function conditionLevelStyle(t: ThemeTokens, value: number, selected: boolean): CSSProperties {
  const base = conditionLevelColor(t, value);
  if (!selected) {
    return { background: t.card, border: `1px solid ${t.border}`, color: t.textMuted, borderRadius: 12 };
  }
  return { background: mixHex(base, 255, 0.82), border: `1.5px solid ${base}`, color: t.text, borderRadius: 12 };
}

// 뱃지 pill(날짜·체중·slot) — 사진 위 가독을 위해 스크림 없이 '불투명 토큰 표면'. 하드코딩 색 없음.
export function photoBadgeStyle(t: ThemeTokens): CSSProperties {
  const base: CSSProperties = {
    background: t.card,
    color: t.text,
    borderRadius: 8,
  };
  return { ...base, boxShadow: '0 2px 6px rgba(120,90,160,0.16)' };
}
