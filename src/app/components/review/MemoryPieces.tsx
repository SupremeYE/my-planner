import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlanner, CultureRecord, MusicRecord } from '../../store';
import { db, type WalkSession } from '../../../lib/db';
import { useTheme } from '../../ThemeContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

// ─── 조각(그 기간을 떠올리게 하는 기록) — 주간·월간 공용 ───
// 주간 탭에 인라인이던 '이번 주의 조각'을 기간(startStr~endStr)만 받는 재사용 컴포넌트로 추출.
// foodRecords 는 store 에서 읽고, culture/music/walk 는 여기서 직접 fetch(소비처는 기간만 넘긴다).
// 썸네일이 없으면 제목만으로도 카드가 성립한다.

interface Piece { key: string; kind: string; title: string; thumb?: string | null }

export function MemoryPieces({ startStr, endStr, title }: { startStr: string; endStr: string; title: string }) {
  const { foodRecords } = usePlanner();
  const { t } = useTheme();
  const [data, setData] = useState<{ culture: CultureRecord[]; music: MusicRecord[]; walks: WalkSession[] }>(
    { culture: [], music: [], walks: [] },
  );
  const refresh = useCallback(() => {
    Promise.all([db.cultureRecords.fetchAll(), db.musicRecords.fetchAll(), db.walkSessions.fetchAll()])
      .then(([culture, music, walks]) => setData({ culture, music, walks }))
      .catch(() => { /* 빈 상태 유지 */ });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('culture_records', refresh);
  useRealtimeSync('music_records', refresh);
  useRealtimeSync('walk_sessions', refresh);

  const pieces = useMemo<Piece[]>(() => {
    const dOf = (s?: string | null) => (s ? s.slice(0, 10) : '');
    const inRange = (d: string) => !!d && d >= startStr && d <= endStr;
    const out: Piece[] = [];
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
          아직 남긴 기록이 없어요 · 맛있었던 것·영상·음악·산책이 여기 모여요.
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
