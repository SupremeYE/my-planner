import React, { useState } from 'react';
import { Bookmark, Plus, X } from 'lucide-react';
import { useTheme } from '../ThemeContext';

// Stage 0 — 스키마 + 라우트 + 빈 페이지 셸만.
// 실제 데이터 fetch / 추가 모달은 다음 단계에서 구현한다.
// 디자인 토큰만 사용(t.*), 하드코딩 hex 금지.
// 모바일(390px) 기준 + PC 분기는 Tailwind `lg:` 로만.

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ScrapView() {
  const { t } = useTheme();
  // Stage 0 placeholder — 추가 모달이 아직 없으므로 토스트 형태 안내만 띄움
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <div
      className="h-full overflow-y-auto relative"
      style={{ backgroundColor: t.bg }}
    >
      {/* ── 헤더 ── */}
      <header className="px-6 lg:px-14 pt-12 lg:pt-12 pb-2">
        <div className="flex items-center gap-2" style={{ color: t.accent }}>
          <Bookmark size={16} strokeWidth={2.2} />
          <span
            style={{
              fontFamily: 'var(--font-nanum-pen)',
              fontSize: 22,
              letterSpacing: 0.5,
              lineHeight: 1,
            }}
            className="lg:text-[26px]"
          >
            inspiration
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 40,
            lineHeight: 1,
            marginTop: 6,
            color: t.text,
          }}
          className="lg:text-[54px]"
        >
          스크랩
        </h1>
        <p
          style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5, marginTop: 8 }}
          className="lg:text-[14px]"
        >
          영감 보관함
        </p>
      </header>

      {/* ── 빈 그리드 영역(추후 메이슨리 자리) ── */}
      <div
        className="px-6 lg:px-14 mt-6"
        style={{ paddingBottom: 160 }}
      >
        <div
          style={{
            border: `1.5px dashed ${withAlpha(t.accentLight, 0.9)}`,
            borderRadius: 16,
            backgroundColor: withAlpha(t.card, 0.6),
            minHeight: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '32px 20px',
            textAlign: 'center',
          }}
        >
          <Bookmark size={32} strokeWidth={1.4} color={t.accent} />
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            아직 스크랩이 없어요
          </p>
          <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5, maxWidth: 260 }}>
            유튜브 · 인스타 · 스레드 · 웹에서 마음에 든 콘텐츠를
            <br />
            모아두는 보관함이에요.
          </p>
        </div>
      </div>

      {/* ── FAB (확장형 라벨 버튼) ── */}
      <div
        className="fixed left-0 right-0 flex z-30 pointer-events-none justify-center lg:justify-end lg:pr-10"
        style={{
          // 모바일: 하단 탭바(56px) + safe-area 위로 충분히 띄움
          bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
        }}
      >
        <button
          onClick={() => setHintOpen(true)}
          className="pointer-events-auto flex items-center gap-2 transition-transform active:scale-95"
          style={{
            backgroundColor: t.accent,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            padding: '15px 26px',
            borderRadius: 999,
            boxShadow: `0 8px 22px ${withAlpha(t.accent, 0.4)}`,
            border: 'none',
          }}
          aria-label="스크랩 추가"
        >
          <Plus size={18} strokeWidth={2.4} />
          스크랩 추가
        </button>
      </div>

      {/* Stage 0 안내 토스트 — 다음 단계에서 모달로 교체 */}
      {hintOpen && (
        <div
          className="fixed inset-x-0 z-40 flex justify-center pointer-events-none px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 160px)' }}
        >
          <div
            className="pointer-events-auto flex items-center gap-2"
            style={{
              backgroundColor: t.card,
              color: t.text,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              boxShadow: '0 8px 22px rgba(0,0,0,0.12)',
              maxWidth: 360,
            }}
          >
            <span>추가 화면은 다음 단계에서 열려요</span>
            <button
              onClick={() => setHintOpen(false)}
              className="ml-1"
              style={{ color: t.textMuted, lineHeight: 0 }}
              aria-label="닫기"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
