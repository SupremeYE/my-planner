import { type CSSProperties } from 'react';
import { type ThemeTokens } from '../ThemeContext';

// ─── Haon Soft Pastel — Solid Elevation helpers (DESIGN.md v1.1) ───
// 확장 토큰(solidCard* 등)이 있는 테마(H)에서만 파스텔 솔리드 표면으로 렌더하고,
// 없는 기존 테마(A/B/C/D)에서는 원래의 모양(bgSub 카드)을 그대로 유지한다.
// v1.1 핵심: 본문 표면은 글래스가 아니라 불투명 흰색 + 하이라인 + 소프트 그림자.
//   글래스(반투명+blur)는 오버레이(떠 있는 상단 날짜 바·모달·팝오버)에만 사용한다.
//
// 페이지 마이그레이션 공용 모듈: 각 페이지는 이 헬퍼를 import 해서 동일 recipe를 재사용한다.
export const isHaon = (t: ThemeTokens) => !!t.cardFrosted;

// 페이지 캔버스: 파스텔 방사형 blob (없으면 배경 미지정 → 기존 레이아웃 배경 유지)
export function canvasStyle(t: ThemeTokens): CSSProperties {
  return t.appGradient ? { background: t.appGradient } : {};
}

// 솔리드 카드 (본문 표면) — 불투명 흰색 + 1px 하이라인 + 소프트 그림자, backdrop-filter 없음.
export function solidCardStyle(t: ThemeTokens): CSSProperties {
  if (isHaon(t)) {
    return {
      background: t.solidCardBg ?? '#FFFFFF',
      border: t.solidCardBorder ?? '1px solid rgba(122,92,162,0.12)',
      borderRadius: t.solidCardRadius ?? 20,
      boxShadow: t.solidCardShadow ?? '0 8px 20px rgba(120,90,160,0.12)',
    };
  }
  return { backgroundColor: t.bgSub, border: `1px solid ${t.border}` };
}

// 솔리드 항목 행(할일·일정 카드) — 진한 하이라인 + 이중 그림자로 배경과 분리, 입체감.
export function solidRowStyle(t: ThemeTokens): CSSProperties {
  if (isHaon(t)) {
    return {
      background: t.solidRowBg ?? '#FFFFFF',
      border: t.solidRowBorder ?? '1px solid rgba(122,92,162,0.20)',
      borderRadius: t.solidRowRadius ?? 14,
      boxShadow: t.solidRowShadow ?? '0 2px 4px rgba(120,90,160,0.12), 0 10px 22px rgba(120,90,160,0.16)',
    };
  }
  return {};
}

// ─── hex 색 mix (태그 칩: 채도 있는 파스텔 채움 + 어두운 텍스트 시블링) ───
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// target: 255=흰색 쪽, 0=검정 쪽. amt: 0~1 섞는 정도.
export function mixHex(hex: string, target: number, amt: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = (c: number) => Math.round(c + (target - c) * amt);
  return `rgb(${m(rgb.r)}, ${m(rgb.g)}, ${m(rgb.b)})`;
}

// 반투명 프로스티드 바(떠 있는 상단 날짜 바·탭바) — 오버레이 글래스 (DESIGN v1.1 허용)
export function glassBarStyle(t: ThemeTokens): CSSProperties {
  if (isHaon(t)) {
    return {
      background: 'rgba(255,255,255,0.45)',
      backdropFilter: t.glassBlur,
      WebkitBackdropFilter: t.glassBlur,
      borderBottom: `1px solid rgba(255,255,255,0.55)`,
    };
  }
  return { borderBottom: `1px solid ${t.border}` };
}

// ─── 다중 선택 패턴 (DESIGN.md §5 — Selection mode & bulk-action bar) ───
// 선택된 행: 기존 행 표면(solidRowStyle/카드) 위에 코랄 링만 덧댄다(배경·그림자 불변).
// outline 은 boxShadow/border 와 독립이라 기존 rowStyle 과 충돌 없이 스프레드 가능.
export function selectedRowStyle(t: ThemeTokens): CSSProperties {
  return { outline: `2px solid ${t.accent}`, outlineOffset: -2 };
}

// 일괄 액션 바(리스트 하단 floating) — 오버레이라 H 에서 글래스 허용(§1), 그 외 테마는 솔리드 카드.
export function actionBarStyle(t: ThemeTokens): CSSProperties {
  if (isHaon(t)) {
    return {
      background: 'rgba(255,255,255,0.75)',
      backdropFilter: t.glassBlur,
      WebkitBackdropFilter: t.glassBlur,
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 16,
      boxShadow: '0 8px 24px rgba(120,90,160,0.18)',
    };
  }
  return {
    backgroundColor: t.card,
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
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
  if (isHaon(t)) {
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
  return {
    backgroundColor: t.bgSub,
    borderTop: `1px solid ${t.border}`,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  };
}

// PC "+ 추가" 팝오버(다종 항목 chooser) — 헤더 버튼 아래 앵커, 오버레이 글래스(§1).
export function addPopoverStyle(t: ThemeTokens): CSSProperties {
  if (isHaon(t)) {
    return {
      background: t.cardFrosted ?? 'rgba(255,255,255,0.92)',
      backdropFilter: t.glassBlur,
      WebkitBackdropFilter: t.glassBlur,
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 16,
      boxShadow: '0 8px 24px rgba(120,90,160,0.14)',
    };
  }
  return {
    backgroundColor: t.bgSub,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  };
}

// ─── 진행중 상태 + 자동 캐리오버 패턴 (DESIGN.md §5 — "In-progress state & auto carry-over") ───
// 축1(상태): 안시작(active)→진행중(inProgress)→완료(done) 3값 status. 진행중 시맨틱색 = t.success(민트).
// 축2(이월): 미완 진행중을 다음 날 "이어서 하기" 섹션으로 자동 캐리오버(밀림/overdue 아님).
// 전 축 토큰만: 진행중=t.success, 완료=t.checkDone, 안시작=t.accent/중립, DO 채움=blockDefault* hue.
// 기존 STATUS_CONFIG 하드코딩(#059669/#D1FAE5)은 이 recipe 로 회수 대상.
// ⚠️ 소비처는 아직 없다(정의만). 상태 배관은 Stage 2, 이월 배관은 Stage 3.
export type TodoProgressState = 'active' | 'inProgress' | 'done';

// 3상태 체크박스(원형 표면) — 안시작=빈 원(accent 링) / 진행중=success 링+틴트 / 완료=solid 채움.
// 아이콘(Play/Check)은 소비처가 렌더한다 — 여기선 원형 컨테이너의 border/background 만 제공.
// accentColor 미전달 시 t.accent 사용(핵심 행 등에서 코랄 링을 주고 싶으면 넘긴다).
export function progressCheckboxStyle(
  t: ThemeTokens,
  state: TodoProgressState,
  accentColor: string = t.accent,
): CSSProperties {
  if (state === 'done') {
    return { border: 'none', backgroundColor: t.checkDone };
  }
  if (state === 'inProgress') {
    return { border: `2px solid ${t.success}60`, backgroundColor: `${t.success}12` };
  }
  return { border: `2px solid ${accentColor}60`, backgroundColor: 'transparent' };
}

// "진행중" 뱃지 — 작은 pill. success 옅은 틴트 배경 + 진한 success 텍스트(민트 시블링).
// 상태 pill(예정/완료)과 같은 크기·톤 계열. 폰트 크기·패딩은 소비처(§5 status pill)에서.
export function progressBadgeStyle(t: ThemeTokens): CSSProperties {
  return {
    backgroundColor: mixHex(t.success, 255, 0.84),
    color: mixHex(t.success, 0, 0.28),
  };
}

// "N일째" 카운터 — 조용한 표시. 1~2일=무강조(textMuted), 3일 이상=슬쩍 강조(success 텍스트).
// 반환은 색·굵기만; "N일째" 문구 조립과 접기(collapse)는 소비처(Stage 3).
export function daysInProgressStyle(t: ThemeTokens, days: number): CSSProperties {
  const emphasize = days >= 3;
  return {
    color: emphasize ? mixHex(t.success, 0, 0.28) : t.textMuted,
    fontWeight: emphasize ? 600 : 500,
  };
}

// "이어서 하기" 섹션 컨테이너 — 어제 이전 미완 진행중을 모으는 별도 섹션.
// 진행중 톤(민트) 옅은 배경+테두리로 KEY 행(코랄)·overdue(밀림)와 구분. 방치 아님·진행중 신호.
export function carryoverSectionStyle(t: ThemeTokens): CSSProperties {
  if (isHaon(t)) {
    return {
      background: mixHex(t.success, 255, 0.9),
      border: `1px solid ${t.success}59`,
      borderRadius: t.solidCardRadius ?? 20,
    };
  }
  return { backgroundColor: t.bgSub, border: `1px solid ${t.border}` };
}

// DO 타임블록 채움 — 진행중(타이머 추적)=연한 채움(hue 를 투명과 ~45% 섞음), 완료=꽉 참(hue 풀 채움).
// baseColor: 태그색(hex) 또는 blockDefaultBg(rgba) 등 블록 hue. color-mix 로 포맷(hex/rgba) 무관 처리.
// 시간 없는 수동 진행중은 애초에 DO 에 넣지 않으므로(소비처가 doStart/doEnd 로 게이팅) 여기 대상 아님.
export function doBlockFillStyle(
  t: ThemeTokens,
  opts: { done: boolean; baseColor: string },
): CSSProperties {
  const { done, baseColor } = opts;
  if (done) {
    return { background: baseColor };
  }
  // 연한 채움: 진행중 블록은 절반 정도의 투명 채움으로 "아직 진행 중" 느낌. 테두리는 hue 유지.
  return {
    background: `color-mix(in srgb, ${baseColor} 45%, transparent)`,
    border: `1px solid ${baseColor}`,
  };
}
