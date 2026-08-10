import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlanner, CultureRecord, MusicRecord } from '../../store';
import { db, type WalkSession } from '../../../lib/db';
import { useTheme } from '../../ThemeContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

// ─── 조각(그 기간을 떠올리게 하는 기록) — 주간·월간 공용 ───
// 주간 탭에 인라인이던 '이번 주의 조각'을 기간(startStr~endStr)만 받는 재사용 컴포넌트로 추출.
// foodRecords 는 store 에서 읽고, moment/culture/music/walk 는 여기서 직접 fetch(소비처는 기간만 넘긴다).
// 모먼트가 조각에 가장 잘 맞는 소스(사진 보유율↑ · "기억하고 싶은 순간")라 스트립 맨 앞에 오고,
// 하이라이트(별표)된 모먼트를 우선 노출한다. 썸네일이 없으면 제목(본문)만으로도 카드가 성립한다.

type MomentRow = Awaited<ReturnType<typeof db.moments.fetchAll>>[number];
interface Piece { key: string; kind: string; title: string; thumb?: string | null; highlight?: boolean }

export function MemoryPieces({ startStr, endStr, title }: { startStr: string; endStr: string; title: string }) {
  const { foodRecords } = usePlanner();
  const { t } = useTheme();
  const [data, setData] = useState<{ moments: MomentRow[]; culture: CultureRecord[]; music: MusicRecord[]; walks: WalkSession[] }>(
    { moments: [], culture: [], music: [], walks: [] },
  );
  const refresh = useCallback(() => {
    Promise.all([db.moments.fetchAll(), db.cultureRecords.fetchAll(), db.musicRecords.fetchAll(), db.walkSessions.fetchAll()])
      .then(([moments, culture, music, walks]) => setData({ moments, culture, music, walks }))
      .catch(() => { /* 빈 상태 유지 */ });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('moments', refresh);
  useRealtimeSync('culture_records', refresh);
  useRealtimeSync('music_records', refresh);
  useRealtimeSync('walk_sessions', refresh);

  const pieces = useMemo<Piece[]>(() => {
    const dOf = (s?: string | null) => (s ? s.slice(0, 10) : '');
    const inRange = (d: string) => !!d && d >= startStr && d <= endStr;
    const out: Piece[] = [];
    // 모먼트 — 조각의 핵심 소스. 하이라이트(별표) → 최신 순으로 우선 노출. 사진 없으면 본문만.
    data.moments
      .filter(m => inRange(dOf(m.created_at)))
      .sort((a, b) => Number(b.is_highlight) - Number(a.is_highlight) || b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .forEach(m => out.push({
        key: `moment-${m.id}`, kind: '모먼트',
        title: m.content?.trim() || '모먼트', thumb: m.photos?.[0] ?? null, highlight: m.is_highlight,
      }));
    // 맛있었던 것 — taste 'good' 상위 1~2개만(끼니 전부 아님)
    foodRecords
      .filter(f => inRange(f.date) && f.tasteRating === 'good')
      .slice(0, 2)
      .forEach(f => out.push({ key: `food-${f.id}`, kind: '맛있었던 것', title: f.foodName, thumb: f.photoUrl }));
    data.culture
      .filter(c => inRange(c.watchedDate ?? dOf(c.createdAt)))
      .slice(0, 4)
      .forEach(c => out.push({ key: `culture-${c.id}`, kind: '영상', title: c.title, thumb: c.thumbnailUrl }));
    data.music
      .filter(m => inRange(dOf(m.createdAt)))
      .slice(0, 4)
      .forEach(m => out.push({ key: `music-${m.id}`, kind: '음악', title: m.trackTitle, thumb: m.artworkUrl }));
    data.walks
      .filter(w => inRange(dOf(w.startedAt ?? w.createdAt)))
      .slice(0, 3)
      .forEach(w => out.push({ key: `walk-${w.id}`, kind: '산책', title: w.routeName || '산책', thumb: w.photoUrl }));
    return out;
  }, [foodRecords, data, startStr, endStr]);

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🧩 {title}</h3>
      {pieces.length === 0 ? (
        <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5 }}>
          아직 남긴 기록이 없어요 · 모먼트·맛있었던 것·영상·음악·산책이 여기 모여요.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {pieces.map(p => (
            <div key={p.key} style={{ width: 112, flexShrink: 0 }}>
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3 / 4', backgroundColor: t.surfaceMuted, border: `1px solid ${t.borderLight}` }}>
                {p.thumb ? (
                  <img src={p.thumb} alt={p.title} className="w-full h-full" style={{ objectFit: 'cover' }} loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center px-2 text-center"
                    style={{ fontSize: 12, color: t.textSub, fontWeight: 600, lineHeight: 1.35, overflow: 'hidden' }}>
                    {p.title}
                  </div>
                )}
                <span className="absolute" style={{ top: 6, left: 6, fontSize: 9, fontWeight: 700, color: t.text, backgroundColor: t.card, borderRadius: 999, padding: '2px 6px', boxShadow: '0 1px 3px rgba(120,90,160,0.16)' }}>
                  {p.kind}
                </span>
                {p.highlight && (
                  <span className="absolute" title="하이라이트" style={{ top: 6, right: 6, fontSize: 10, lineHeight: 1, borderRadius: 999, padding: '2px 4px', backgroundColor: t.card, boxShadow: '0 1px 3px rgba(120,90,160,0.16)' }}>
                    ⭐
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: t.textSub, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                {p.title}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
