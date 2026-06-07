import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Music, Loader2, Check, Trash2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { searchMusic, type MusicSearchResult } from '../../lib/itunes';
import type { MusicRecord } from '../store';
import { useToasts, ToastHost } from './culture/CultureToast';

// 무드·상황 태그 (복수 선택)
const MOOD_OPTIONS = ['집중', '위로', '신날 때', '드라이브', '잠들기 전'];

export function MusicRecordView() {
  const { t } = useTheme();
  const { toasts, notify } = useToasts();

  // 저장된 음악 기록 (확인용 임시 리스트)
  const [records, setRecords] = useState<MusicRecord[]>([]);

  // 검색 상태
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<MusicSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  // 선택한 곡 + 추가 폼 입력값
  const [selected, setSelected] = useState<MusicSearchResult | null>(null);
  const [mood, setMood] = useState<string[]>([]);
  const [genre, setGenre] = useState('');
  const [memo, setMemo] = useState('');
  const [listenUrl, setListenUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // ── 데이터 로드 + Realtime 동기화 ──
  const refresh = useCallback(() => {
    db.musicRecords.fetchAll().then(setRecords);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('music_records', refresh);

  // ── 곡 검색 ──
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const rs = await searchMusic(q);
      setResults(rs);
    } catch (err) {
      notify((err as Error).message, 'error');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── 곡 선택 → 폼 초기화 ──
  const selectTrack = (r: MusicSearchResult) => {
    setSelected(r);
    setMood([]);
    setGenre('');
    setMemo('');
    setListenUrl('');
  };

  const toggleMood = (m: string) =>
    setMood(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  // ── 저장 (중복 확인 후 insert) ──
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (selected.itunesTrackId != null) {
        const dup = await db.musicRecords.existsByItunesId(selected.itunesTrackId);
        if (dup) {
          notify('이미 추가한 곡이에요.', 'info');
          setSaving(false);
          return;
        }
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
      if (!inserted) {
        notify('저장에 실패했어요. 다시 시도해 주세요.', 'error');
        setSaving(false);
        return;
      }
      notify('음악 기록을 추가했어요.', 'success');
      // 선택/검색 상태 정리 (Realtime 으로 리스트는 자동 갱신되지만 즉시성 위해 refresh)
      setSelected(null);
      setResults([]);
      setSearched(false);
      setTerm('');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await db.musicRecords.delete(id);
    refresh();
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: t.bg,
    border: `1px solid ${t.border}`,
    color: t.text,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
      {/* 헤더 */}
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Music size={22} color={t.accent} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text }}>음악 기록</h1>
        </div>
        <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
          곡을 검색해 무드·메모와 함께 기록해요. (Stage 1 — 확인용 임시 화면)
        </p>
      </header>

      {/* 검색창 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} color={t.textMuted}
            className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={term}
            onChange={e => setTerm(e.target.value)}
            placeholder="곡 제목이나 아티스트를 검색하세요"
            className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={searching}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
          style={{ backgroundColor: t.accent, color: '#fff' }}>
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          검색
        </button>
      </form>

      {/* 검색 결과 리스트 */}
      {searched && !searching && results.length === 0 && (
        <p style={{ fontSize: 13, color: t.textMuted }} className="py-4 text-center">
          검색 결과가 없어요.
        </p>
      )}
      {results.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-6"
          style={{ border: `1px solid ${t.border}`, backgroundColor: t.card }}>
          {results.map((r, i) => {
            const isSel = selected?.itunesTrackId === r.itunesTrackId;
            return (
              <button key={`${r.itunesTrackId}-${i}`} type="button"
                onClick={() => selectTrack(r)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{
                  borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
                  backgroundColor: isSel ? t.accentLight : 'transparent',
                }}>
                {r.artworkUrl
                  ? <img src={r.artworkUrl} alt="" width={44} height={44}
                      className="rounded-md flex-shrink-0 object-cover" style={{ width: 44, height: 44 }} />
                  : <div className="rounded-md flex-shrink-0 flex items-center justify-center"
                      style={{ width: 44, height: 44, backgroundColor: t.bgSub }}>
                      <Music size={18} color={t.textMuted} />
                    </div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {r.trackTitle}
                  </div>
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

      {/* 선택한 곡 + 추가 폼 */}
      {selected && (
        <div className="rounded-xl p-4 mb-6"
          style={{ border: `1px solid ${t.accent}`, backgroundColor: t.card }}>
          <div className="flex items-center gap-3 mb-4">
            {selected.artworkUrl
              ? <img src={selected.artworkUrl} alt="" className="rounded-lg object-cover"
                  style={{ width: 56, height: 56 }} />
              : <div className="rounded-lg flex items-center justify-center"
                  style={{ width: 56, height: 56, backgroundColor: t.bgSub }}>
                  <Music size={22} color={t.textMuted} />
                </div>}
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                {selected.trackTitle}
              </div>
              <div className="truncate" style={{ fontSize: 12, color: t.textSub }}>
                {selected.artist}{selected.releaseYear ? ` · ${selected.releaseYear}` : ''}
              </div>
            </div>
          </div>

          {/* 무드·상황 태그 */}
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>무드·상황</label>
          <div className="flex flex-wrap gap-2 mt-1.5 mb-4">
            {MOOD_OPTIONS.map(m => {
              const on = mood.includes(m);
              return (
                <button key={m} type="button" onClick={() => toggleMood(m)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: on ? t.accent : t.bgSub,
                    color: on ? '#fff' : t.textSub,
                    border: `1px solid ${on ? t.accent : t.border}`,
                  }}>
                  {m}
                </button>
              );
            })}
          </div>

          {/* 장르 */}
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>장르 (선택)</label>
          <input value={genre} onChange={e => setGenre(e.target.value)}
            placeholder="예: 발라드, 시티팝"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-1.5 mb-4"
            style={inputStyle} />

          {/* 메모 */}
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>메모 (선택)</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            rows={3} placeholder="이 곡에 대한 메모를 남겨보세요"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-1.5 mb-4 resize-none"
            style={inputStyle} />

          {/* 듣기 링크 */}
          <label style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>
            듣기 링크 (선택 · 비우면 나중에 제목으로 자동 검색)
          </label>
          <input value={listenUrl} onChange={e => setListenUrl(e.target.value)}
            placeholder="유튜브·멜론 등 링크"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mt-1.5 mb-4"
            style={inputStyle} />

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setSelected(null)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{ backgroundColor: t.bgSub, color: t.textSub }}>
              취소
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
              style={{ backgroundColor: t.accent, color: '#fff' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              저장
            </button>
          </div>
        </div>
      )}

      {/* 확인용 임시 리스트 (정식 LP 그리드는 Stage 2) */}
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text }} className="mb-2">
          저장된 곡 ({records.length})
        </h2>
        {records.length === 0
          ? <p style={{ fontSize: 13, color: t.textMuted }}>아직 기록한 곡이 없어요.</p>
          : <ul className="flex flex-col gap-1.5">
              {records.map(r => (
                <li key={r.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                  <div className="min-w-0 flex-1">
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{r.trackTitle}</span>
                    <span style={{ fontSize: 13, color: t.textSub }}> · {r.artist}</span>
                    {r.mood.length > 0 && (
                      <span style={{ fontSize: 12, color: t.textMuted }}> · {r.mood.join(', ')}</span>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDelete(r.id)}
                    className="flex-shrink-0 p-1.5 rounded-md" aria-label="삭제">
                    <Trash2 size={15} color={t.textMuted} />
                  </button>
                </li>
              ))}
            </ul>}
      </section>

      <ToastHost toasts={toasts} />
    </div>
  );
}
