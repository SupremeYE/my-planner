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
