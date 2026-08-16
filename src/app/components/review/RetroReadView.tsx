import React from 'react';
import { useTheme } from '../../ThemeContext';

// ─── 회고 읽기 블록 (감사·좋았던 순간·KPT·데일리) — 아카이브 타임라인 + 일간 탭 공용 ───
// "두 화면이 같은 데이터를 다르게 보여주면 안 된다" (DESIGN 원칙) → 아카이브 renderDailyCard 의
// 읽기 표현을 이 컴포넌트로 추출해 일간 탭 회고 카드와 **같은 표현**을 쓴다.
// · 감사: 줄 단위 번호 목록(Sora 숫자) — 배열 그대로, 쉼표 연결 아님
// · 좋았던 순간: 목록(시각 있으면 앞에 표기)
// · KPT: Keep / Problem / Try 구분 셀(PC 3열 / 모바일 세로)
// · 데일리(레거시): 요약 + 잘한 점/개선할 점
// 색은 아카이브 kindMeta 와 동일(감사=success / 좋았던순간=danger / KPT=info / 데일리=muted).
// renderText: 검색 하이라이트 등 텍스트 래핑 훅(기본 = 그대로). 편집·삭제 없음(읽기 전용).

export interface RetroReadViewProps {
  gratitude?: string[];
  happy?: { id: string; content: string; time?: string }[];
  kpt?: { keep?: string; problem?: string; try?: string };
  daily?: { summary?: string; good?: string; improve?: string };
  /** 검색어 하이라이트 등 텍스트 래핑(선택). 기본은 원문 그대로. */
  renderText?: (s: string) => React.ReactNode;
}

/** 렌더할 블록이 하나라도 있는지 — 카드 래퍼(버튼)의 빈 상태 판정에 재사용 */
export function hasRetroContent(p: Pick<RetroReadViewProps, 'gratitude' | 'happy' | 'kpt' | 'daily'>): boolean {
  const g = (p.gratitude ?? []).some(s => s?.trim());
  const h = (p.happy ?? []).some(x => x.content?.trim());
  const k = !!(p.kpt && (p.kpt.keep?.trim() || p.kpt.problem?.trim() || p.kpt.try?.trim()));
  const d = !!(p.daily && (p.daily.summary?.trim() || p.daily.good?.trim() || p.daily.improve?.trim()));
  return g || h || k || d;
}

export function RetroReadView({ gratitude, happy, kpt, daily, renderText }: RetroReadViewProps) {
  const { t } = useTheme();
  const hl = renderText ?? ((s: string) => s);

  const color = {
    gratitude: t.success,
    happy: t.danger,
    kpt: t.info,
    daily: t.textMuted,
  };

  const blockHead = (c: string, emoji: string, label: string) => (
    <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub }}>{emoji} {label}</span>
    </div>
  );

  // 라벨 + 값 한 줄(데일리 필드)
  const field = (label: string, value?: string) => value?.trim() ? (
    <div style={{ fontSize: 13, lineHeight: 1.55, color: t.text, whiteSpace: 'pre-wrap' }}>
      <span style={{ fontWeight: 600, color: t.textSub, marginRight: 6 }}>{label}</span>{hl(value)}
    </div>
  ) : null;

  const blocks: React.ReactNode[] = [];

  const gList = (gratitude ?? []).filter(g => g?.trim());
  if (gList.length) {
    blocks.push(
      <div key="g">
        {blockHead(color.gratitude, '🙏', '감사한 것')}
        <ol className="space-y-1.5">
          {gList.map((g, i) => (
            <li key={i} className="flex gap-2" style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>
              <span style={{ fontFamily: t.fontNumeric, fontSize: 11, fontWeight: 700, color: color.gratitude, flexShrink: 0, paddingTop: 2 }}>{i + 1}</span>
              <span>{hl(g)}</span>
            </li>
          ))}
        </ol>
      </div>,
    );
  }

  const hList = (happy ?? []).filter(h => h.content?.trim());
  if (hList.length) {
    blocks.push(
      <div key="h">
        {blockHead(color.happy, '✨', '좋았던 순간')}
        <ul className="space-y-1.5">
          {hList.map(h => (
            <li key={h.id} style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>
              {h.time && <span style={{ fontSize: 11, fontWeight: 600, color: color.happy, marginRight: 6 }}>{h.time}</span>}
              {hl(h.content)}
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  if (kpt) {
    const cells: [string, string | undefined][] = [['Keep', kpt.keep], ['Problem', kpt.problem], ['Try', kpt.try]];
    const shown = cells.filter(([, v]) => v?.trim());
    if (shown.length) {
      blocks.push(
        <div key="k">
          {blockHead(color.kpt, '🔄', 'KPT 회고')}
          <div className="grid gap-2 lg:grid-cols-3">
            {shown.map(([k, v]) => (
              <div key={k} className="rounded-lg" style={{ backgroundColor: t.surfaceMuted, padding: '9px 11px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textSub, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: t.text, whiteSpace: 'pre-wrap' }}>{hl(v!)}</div>
              </div>
            ))}
          </div>
        </div>,
      );
    }
  }

  if (daily && (daily.summary?.trim() || daily.good?.trim() || daily.improve?.trim())) {
    blocks.push(
      <div key="d">
        {blockHead(color.daily, '📔', '데일리 리뷰')}
        <div className="space-y-1">
          {daily.summary?.trim() && <div style={{ fontSize: 13, lineHeight: 1.55, color: t.text, whiteSpace: 'pre-wrap' }}>{hl(daily.summary)}</div>}
          {field('잘한 점', daily.good)}
          {field('개선할 점', daily.improve)}
        </div>
      </div>,
    );
  }

  if (!blocks.length) return null;

  return (
    <>
      {blocks.map((b, i) => (
        <div key={i} style={{
          paddingTop: i === 0 ? 0 : 11,
          paddingBottom: i === blocks.length - 1 ? 0 : 11,
          borderTop: i === 0 ? 'none' : `1px dashed ${t.borderLight}`,
        }}>{b}</div>
      ))}
    </>
  );
}
