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
