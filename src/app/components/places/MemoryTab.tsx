// 기억 탭 (Stage 5) — place_visits 를 한국 시도 초이플레스로 시각화. 새 쓰기·외부 API 0.
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Maximize2, MapPinned, ChevronLeft } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { Place } from '../../../lib/db';
import { REGION_LABELS } from '../../../constants/places';
import { withAlpha } from './placeHelpers';
import { usePlacesData } from './usePlacesData';
import { KoreaHeatmap } from './KoreaHeatmap';

export function MemoryTab() {
  const { t } = useTheme();
  const [, setSearchParams] = useSearchParams();
  const { visits, places, loading } = usePlacesData();
  const [selected, setSelected] = useState<string | null>(null);

  const placesById = useMemo(() => {
    const m = new Map<string, Place>();
    places.forEach(p => m.set(p.id, p));
    return m;
  }, [places]);

  // 시도별 카운트 (region_code 있는 방문만)
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    visits.forEach(v => { if (v.regionCode) c[v.regionCode] = (c[v.regionCode] ?? 0) + 1; });
    return c;
  }, [visits]);

  const unclassified = useMemo(() => visits.filter(v => !v.regionCode).length, [visits]);
  const steppedRegions = Object.keys(counts).length;
  const totalVisits = visits.length;
  const ranking = useMemo(() => Object.entries(counts).sort((a, b) => b[1] - a[1]), [counts]);
  const maxCount = ranking.length ? ranking[0][1] : 0;
  const recent = useMemo(() => visits.slice(0, 6), [visits]); // fetchAll 이 visited_on desc 정렬
  const regionVisits = useMemo(
    () => (selected ? visits.filter(v => v.regionCode === selected) : []),
    [selected, visits],
  );

  // 색 스케일 (토큰 기반 웜 농도): 0 / 1~2 / 3~5 / 6~9 / 10+
  const colorFor = (n: number): string => {
    if (n <= 0) return t.bgSub;
    if (n <= 2) return withAlpha(t.accent, 0.3);
    if (n <= 5) return withAlpha(t.accent, 0.58);
    if (n <= 9) return t.accent;
    return t.danger;
  };
  const legendColors = [t.bgSub, withAlpha(t.accent, 0.3), withAlpha(t.accent, 0.58), t.accent, t.danger];

  const empty = !loading && totalVisits === 0;

  // ── 조각들 ───────────────────────────────────────────────────────────────────
  const Legend = () => (
    <div className="flex items-center gap-1" style={{ fontSize: 10.5, color: t.textSub }}>
      <span>적게</span>
      {legendColors.map((c, i) => <span key={i} style={{ width: 16, height: 11, borderRadius: 3, backgroundColor: c, border: `1px solid ${withAlpha(t.text, 0.12)}` }} />)}
      <span>자주</span>
    </div>
  );

  const RegionList = ({ regionId }: { regionId: string }) => {
    const list = visits.filter(v => v.regionCode === regionId);
    return (
      <div>
        {list.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textSub, padding: '16px 0', textAlign: 'center' }}>아직 발자국이 없어요</div>
        ) : (
          <div className="flex flex-col">
            {list.map(v => {
              const p = v.placeId ? placesById.get(v.placeId) : null;
              return (
                <div key={v.id} className="flex items-center gap-3" style={{ padding: '9px 0', borderBottom: `1px solid ${t.borderLight}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: t.textSub }}>{[p?.category, v.visitedOn].filter(Boolean).join(' · ')}</div>
                  </div>
                  {p?.lat != null && (
                    <button onClick={() => setSearchParams({ tab: 'map' })} className="flex items-center gap-1" style={{ fontSize: 11, color: t.accent, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      <MapPinned size={13} /> 지도
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const ResetBtn = () => (
    <button onClick={() => setSelected(null)} className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: t.text, background: withAlpha(t.card, 0.95), border: `1px solid ${t.border}`, borderRadius: 10, padding: '6px 11px', cursor: 'pointer', boxShadow: `0 2px 6px ${withAlpha(t.text, 0.12)}` }}>
      <Maximize2 size={13} /> 전체보기
    </button>
  );

  const totalsLine = `17곳 중 ${steppedRegions}곳 · 총 ${totalVisits}번의 외출`;

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: t.bg }}>
      {/* 총계 한 줄 */}
      <div className="px-4 lg:px-6" style={{ paddingTop: 8, paddingBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, color: t.textSub }}>{totalsLine}{unclassified > 0 ? ` · 미분류 ${unclassified}건` : ''}</span>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* 지도 */}
        <div className="relative flex-1 min-h-0" style={{ padding: '4px 12px 12px' }}>
          <div className="relative h-full" style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.borderLight}`, backgroundColor: t.card }}>
            <KoreaHeatmap counts={counts} colorFor={colorFor} selected={selected} onSelect={setSelected} />
            {/* 범례 */}
            <div style={{ position: 'absolute', left: 12, bottom: 12, backgroundColor: withAlpha(t.card, 0.9), borderRadius: 9, padding: '6px 9px' }}><Legend /></div>
            {/* 전체보기 */}
            {selected && <div style={{ position: 'absolute', top: 12, right: 12 }}><ResetBtn /></div>}
            {/* 빈 상태 */}
            {empty && (
              <div className="flex flex-col items-center justify-center" style={{ position: 'absolute', inset: 0, textAlign: 'center', padding: '0 28px', pointerEvents: 'none' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>아직 발자국이 없어요</div>
                <div style={{ fontSize: 12.5, color: t.textSub, marginTop: 6, lineHeight: 1.5 }}>다녀온 곳을 기록하면 여기 색이 차올라요.<br />지도에서 '방문 완료'를 눌러보세요.</div>
              </div>
            )}
          </div>
        </div>

        {/* PC 사이드 패널 */}
        <div className="hidden lg:flex lg:flex-col" style={{ width: 290, borderLeft: `1px solid ${t.borderLight}`, flexShrink: 0, overflowY: 'auto', padding: '14px 16px' }}>
          {selected ? (
            <div>
              <button onClick={() => setSelected(null)} className="flex items-center gap-1" style={{ fontSize: 12.5, color: t.textSub, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px' }}>
                <ChevronLeft size={15} /> 전체
              </button>
              <div style={{ fontFamily: t.fontSection, fontSize: 20, color: t.text }}>{/* 사이드 패널 섹션 헤더 */}
                {REGION_LABELS[selected] ?? selected} <span style={{ fontSize: 13, color: t.danger, fontWeight: 700 }}>{counts[selected] ?? 0}번</span>
              </div>
              <div style={{ marginTop: 10 }}><RegionList regionId={selected} /></div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: t.textSub }}>{totalsLine}</div>
              {/* 랭킹 */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>많이 간 곳</div>
                {ranking.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: t.textMuted }}>아직 없어요</div>
                ) : ranking.slice(0, 8).map(([rid, n]) => (
                  <div key={rid} className="flex items-center gap-2" style={{ marginBottom: 7, cursor: 'pointer' }} onClick={() => setSelected(rid)}>
                    <span style={{ width: 34, fontSize: 12, fontWeight: 700, color: t.text, flexShrink: 0 }}>{REGION_LABELS[rid] ?? rid}</span>
                    <div style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: t.bgSub, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${maxCount ? (n / maxCount) * 100 : 0}%`, borderRadius: 6, backgroundColor: colorFor(n) }} />
                    </div>
                    <span style={{ width: 26, textAlign: 'right', fontSize: 11.5, color: t.textSub, flexShrink: 0 }}>{n}번</span>
                  </div>
                ))}
              </div>
              {/* 최근 발자국 */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>최근 발자국</div>
                {recent.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: t.textMuted }}>아직 없어요</div>
                ) : recent.map(v => (
                  <div key={v.id} className="flex items-center gap-2" style={{ padding: '7px 0', borderBottom: `1px solid ${t.borderLight}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: t.textSub }}>{(v.regionCode ? REGION_LABELS[v.regionCode] : '미분류')} · {v.visitedOn}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 모바일 하단 시트 (시도 선택 시) */}
      {selected && (
        <div className="lg:hidden" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8, backgroundColor: t.card, borderTop: `1px solid ${t.borderLight}`, borderRadius: '18px 18px 0 0', boxShadow: `0 -8px 24px -12px ${withAlpha(t.text, 0.4)}`, maxHeight: '52%', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between" style={{ padding: '12px 18px 8px', flexShrink: 0 }}>
            <div style={{ fontFamily: t.fontPageTitle, fontSize: 19, color: t.text }}>{/* 하단 시트 최상위 제목 */}
              {REGION_LABELS[selected] ?? selected} <span style={{ fontSize: 12.5, color: t.danger, fontWeight: 700 }}>{counts[selected] ?? 0}번</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ fontSize: 12.5, color: t.textSub, background: 'none', border: 'none', cursor: 'pointer' }}>전체보기</button>
          </div>
          <div style={{ overflowY: 'auto', padding: '0 18px 20px' }}><RegionList regionId={selected} /></div>
        </div>
      )}
    </div>
  );
}
