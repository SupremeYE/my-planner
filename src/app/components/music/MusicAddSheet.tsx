import React, { useEffect, useState } from 'react';
import { Search, Loader2, Check, Music, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { searchMusic, type MusicSearchResult } from '../../../lib/itunes';
import { MOOD_OPTIONS } from './musicMoods';
import type { Notify } from '../culture/CultureToast';

interface MusicAddSheetProps {
  onClose: () => void;
  onAdded: () => void;
  notify: Notify;
}

/**
 * 곡 추가 바텀시트 — iTunes 검색 → 곡 선택 → 무드·장르·메모·듣기링크 입력 → 저장.
 * (Stage 1 의 검색·추가 흐름을 정식 시트 UI 로 이동)
 */
export function MusicAddSheet({ onClose, onAdded, notify }: MusicAddSheetProps) {
  const { t } = useTheme();

  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MusicSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<MusicSearchResult | null>(null);
  const [mood, setMood] = useState<string[]>([]);
  const [genre, setGenre] = useState('');
  const [memo, setMemo] = useState('');
  const [listenUrl, setListenUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      setResults(await searchMusic(q));
    } catch (err) {
      notify((err as Error).message, 'error');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectTrack = (r: MusicSearchResult) => {
    setSelected(r);
    setMood([]); setGenre(''); setMemo(''); setListenUrl('');
  };

  const toggleMood = (m: string) =>
    setMood(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (selected.itunesTrackId != null) {
        const dup = await db.musicRecords.existsByItunesId(selected.itunesTrackId);
        if (dup) { notify('이미 추가한 곡이에요.', 'info'); setSaving(false); return; }
      }
      const inserted = await db.musicRecords.insert({
        trackTitle: selected.trackTitle,
        artist: selected.artist,
        album: selected.album,
        artworkUrl: selected.artworkUrl,
        releaseYear: selected.releaseYear,
        itunesTrackId: selected.itunesTrackId,
        previewUrl: selected.previewUrl,
        mood,
        genre: genre.trim() || null,
        memo: memo.trim() || null,
        listenUrl: listenUrl.trim() || null,
        stickers: [],
      });
      if (!inserted) { notify('저장에 실패했어요. 다시 시도해 주세요.', 'error'); setSaving(false); return; }
      notify('음악 기록을 추가했어요.', 'success');
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: t.bg, border: `1px solid ${t.border}`, color: t.text,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-t-3xl flex flex-col"
        style={{ backgroundColor: t.bg, maxHeight: '90vh', animation: 'musicSheetUp 0.28s ease' }}
        onClick={e => e.stopPropagation()}>
        {/* 핸들 + 헤더 */}
        <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-2">
          <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>곡 추가</p>
          <button onClick={onClose} aria-label="닫기"
            className="flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, color: t.textSub }}>
            <X size={20} />
          </button>
        </div>

        <div className="px-5 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          {/* 검색창 */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={16} color={t.textMuted} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={term} onChange={e => setTerm(e.target.value)}
                placeholder="곡 제목이나 아티스트 검색"
                className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </div>
            <button type="submit" disabled={searching}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
              style={{ backgroundColor: t.accent, color: '#fff' }}>
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              검색
            </button>
          </form>

          {/* 검색 결과 */}
          {searched && !searching && results.length === 0 && (
            <p style={{ fontSize: 13, color: t.textMuted }} className="py-4 text-center">검색 결과가 없어요.</p>
          )}
          {results.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-4"
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.card }}>
              {results.map((r, i) => {
                const isSel = selected?.itunesTrackId === r.itunesTrackId;
                return (
                  <button key={`${r.itunesTrackId}-${i}`} type="button" onClick={() => selectTrack(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
                      backgroundColor: isSel ? t.accentLight : 'transparent' }}>
                    {r.artworkUrl
                      ? <img src={r.artworkUrl} alt="" className="rounded-md flex-shrink-0 object-cover"
                          style={{ width: 44, height: 44 }} />
                      : <div className="rounded-md flex-shrink-0 flex items-center justify-center"
                          style={{ width: 44, height: 44, backgroundColor: t.bgSub }}>
                          <Music size={18} color={t.textMuted} />
                        </div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{r.trackTitle}</div>
                      <div className="truncate" style={{ fontSize: 12, color: t.textSub }}>
                        {r.artist}{r.album ? ` · ${r.album}` : ''}
                      </div>
                    </div>
                    {isSel && <Check size={18} color={t.accent} className="flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* 선택한 곡 + 폼 */}
          {selected && (
            <div className="rounded-xl p-4 mb-4"
              style={{ border: `1px solid ${t.accent}`, backgroundColor: t.card }}>
              <div className="flex items-center gap-3 mb-4">
                {selected.artworkUrl
                  ? <img src={selected.artworkUrl} alt="" className="rounded-lg object-cover" style={{ width: 56, height: 56 }} />
                  : <div className="rounded-lg flex items-center justify-center"
                      style={{ width: 56, height: 56, backgroundColor: t.bgSub }}>
                      <Music size={22} color={t.textMuted} />
                    </div>}
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{selected.trackTitle}</div>
                  <div className="truncate" style={{ fontSize: 12, color: t.textSub }}>
                    {selected.artist}{selected.releaseYear ? ` · ${selected.releaseYear}` : ''}
                  </div>
                </div>
              </div>

              {/* 무드·상황 (복수) */}
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>무드·상황</label>
              <div className="flex flex-wrap gap-2 mt-1.5 mb-4">
                {MOOD_OPTIONS.map(m => {
                  const on = mood.includes(m);
                  return (
                    <button key={m} type="button" onClick={() => toggleMood(m)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{ backgroundColor: on ? t.accent : t.bgSub, color: on ? '#fff' : t.textSub,
                        border: `1px solid ${on ? t.accent : t.border}` }}>
                      {m}
                    </button>
                  );
                })}
              </div>

              {/* 장르 */}
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>장르 (선택)</label>
              <input value={genre} onChange={e => setGenre(e.target.value)} placeholder="예: 발라드, 시티팝"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-1.5 mb-4" style={inputStyle} />

              {/* 메모 */}
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>메모 (선택)</label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
                placeholder="이 곡에 대한 메모를 남겨보세요"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-1.5 mb-4 resize-none" style={inputStyle} />

              {/* 듣기 링크 */}
              <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
                듣기 링크 (선택 · 비우면 나중에 제목으로 자동 검색)
              </label>
              <input value={listenUrl} onChange={e => setListenUrl(e.target.value)} placeholder="유튜브·멜론 등 링크"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-1.5 mb-4" style={inputStyle} />

              <button type="button" onClick={handleSave} disabled={saving}
                className="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                저장
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
