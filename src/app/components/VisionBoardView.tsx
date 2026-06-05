import React from 'react';
import { useTheme } from '../ThemeContext';

// ── /vision — 비전보드 (Phase 1: 페이지 골격) ─────────────────────────
// 컨셉: 되고 싶은 나·살고 싶은 하루를 이미지로 걸어두는 스크랩북.
// Phase 1은 헤더만. 보드/카테고리/추가 등은 Phase 2~ 에서 구현.
export function VisionBoardView() {
  const { t } = useTheme();

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        backgroundColor: t.bg,
        // 종이 질감(노이즈)을 토큰 색 위에 아주 옅게 — 색은 디자인 토큰만 사용.
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      {/* 헤더 — 모바일: 세로 스택 / PC: 좌우 분리 + 우측 sub 정렬 */}
      <header className="px-6 lg:px-14 pt-12 lg:pt-12 pb-2 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2 lg:gap-4">
        <div className="flex flex-col">
          <span
            style={{
              fontFamily: 'var(--font-nanum-pen)',
              fontSize: 22,
              color: t.accent,           // 코랄 토큰 (테마 B: 선라이즈 코랄)
              letterSpacing: 0.5,
              lineHeight: 1,
            }}
            className="lg:text-[26px]"
          >
            becoming…
          </span>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 40,
              lineHeight: 1,
              marginTop: 2,
              color: t.text,
            }}
            className="lg:text-[54px]"
          >
            비전보드
          </h1>
        </div>
        <p
          style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}
          className="lg:text-right lg:max-w-[280px] lg:mt-0 mt-2"
        >
          되고 싶은 나, 살고 싶은 하루를<br />
          눈에 보이게 걸어둬요
        </p>
      </header>

      {/* Phase 2~ 자리: 카테고리 칩 + 메이슨리 보드 + FAB */}
    </div>
  );
}
