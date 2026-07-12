import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Palette, ExternalLink, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { MusicRecord } from '../../store';
import { LpDisc } from './LpDisc';
import { useStickerEditor, StickerLayer, StickerPalette } from './StickerEditor';

interface MusicDetailSheetProps {
  record: MusicRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
}

// 제목+아티스트로 음악 서비스 자동 검색 링크 생성
function ytMusicSearch(r: MusicRecord) {
  return `https://music.youtube.com/search?q=${encodeURIComponent(`${r.trackTitle} ${r.artist}`)}`;
}
function spotifySearch(r: MusicRecord) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${r.trackTitle} ${r.artist}`)}`;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 곡 상세 바텀시트.
 *  - 큰 LP(라벨=앨범아트) + ▶/⏸ 재생(preview_url <audio>) + 🎨 꾸미기(Stage 3, 비활성)
 *  - 재생 중에만 LP 회전. preview_url 이 없으면 회전만 토글.
 *  - 듣기 버튼: listen_url 있으면 직접 링크, 없으면 유튜브뮤직·스포티파이 자동 검색.
 *  - 닫기: X / 핸들 / 바깥 영역.
 */
export function MusicDetailSheet({ record, onClose, onDelete }: MusicDetailSheetProps) {
  const { t } = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // 색 역할 매핑(하드코딩 금지 — 토큰만): 골드=accent, 코랄=danger, 그린=success
  const gold = t.accent, coral = t.danger, green = t.success;

  // 스티커 꾸미기 (모바일·PC 공용 훅)
  const { stickers, decorating, addSticker, moveSticker, removeSticker, toggleDecorate } = useStickerEditor(record);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 언마운트(닫힘) 시 오디오 정지
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (record.previewUrl && audio) {
      if (playing) { audio.pause(); setPlaying(false); }
      else { audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
    } else {
      // 미리듣기 없으면 회전만 토글
      setPlaying(p => !p);
    }
  };

  const hasListen = !!record.listenUrl;

  // 꾸미기 모드 진입 시 LP 회전/재생 정지 후 토글
  const onDecorateClick = () => {
    if (!decorating) { audioRef.current?.pause(); setPlaying(false); }
    toggleDecorate();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="rounded-t-3xl flex flex-col relative"
        style={{ backgroundColor: t.bg, maxHeight: '92vh', animation: 'musicSheetUp 0.28s ease' }}
        onClick={e => e.stopPropagation()}>

        {/* 핸들(탭 시 닫힘) */}
        <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>
        {/* 닫기 X */}
        <button onClick={onClose} aria-label="닫기"
          className="absolute top-3 right-3 flex items-center justify-center rounded-full z-10"
          style={{ width: 34, height: 34, backgroundColor: t.bgSub, color: t.textSub }}>
          <X size={18} />
        </button>

        <div className="px-5 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* 큰 LP (+ 스티커 레이어) */}
          <div className="mx-auto mt-2 mb-4" style={{ width: 'min(64vw, 240px)' }}>
            <LpDisc artworkUrl={record.artworkUrl} spinning={playing && !decorating}>
              <StickerLayer stickers={stickers} decorating={decorating}
                onMove={moveSticker} onRemove={removeSticker} />
            </LpDisc>
          </div>

          {/* 재생 / 꾸미기 컨트롤 */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={togglePlay}
              className="flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 active:scale-95 transition-transform"
              style={{ backgroundColor: gold, color: '#fff', fontSize: 14, fontWeight: 700, minWidth: 120 }}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
              {playing ? '멈춤' : '재생'}
            </button>
            <button onClick={onDecorateClick}
              className="flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 active:scale-95 transition-transform"
              style={decorating
                ? { backgroundColor: gold, color: '#fff', fontSize: 14, fontWeight: 700 }
                : { backgroundColor: t.bgSub, color: t.text, fontSize: 14, fontWeight: 600, border: `1px solid ${t.border}` }}>
              <Palette size={18} /> {decorating ? '완료' : '꾸미기'}
            </button>
          </div>

          {/* 스티커 팔레트 (꾸미기 모드에서만) */}
          {decorating && <StickerPalette onPick={addSticker} />}

          {/* 숨은 audio */}
          {record.previewUrl && (
            <audio ref={audioRef} src={record.previewUrl}
              onEnded={() => setPlaying(false)} preload="none" />
          )}

          {/* 제목 / 아티스트 / 앨범·연도 */}
          <h2 className="text-center" style={{ fontFamily: t.fontPageTitle, fontSize: 24,
            color: t.text, lineHeight: 1.25 }}> {/* 시트 최상위 제목 */}
            {record.trackTitle}
          </h2>
          <p className="text-center mt-1" style={{ fontSize: 14, color: t.textSub, fontWeight: 600 }}>
            {record.artist}
          </p>
          {(record.album || record.releaseYear) && (
            <p className="text-center mt-0.5" style={{ fontSize: 12, color: t.textMuted }}>
              {[record.album, record.releaseYear].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* 무드(coral) + 장르(green) 태그 */}
          {((record.mood?.length ?? 0) > 0 || record.genre) && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {(record.mood ?? []).map(m => (
                <span key={m} className="rounded-full px-3 py-1" style={{ fontSize: 12, fontWeight: 600,
                  color: coral, backgroundColor: t.dangerLight, border: `1px solid ${coral}` }}>
                  {m}
                </span>
              ))}
              {record.genre && (
                <span className="rounded-full px-3 py-1" style={{ fontSize: 12, fontWeight: 600,
                  color: green, backgroundColor: t.bgSub, border: `1px solid ${green}` }}>
                  {record.genre}
                </span>
              )}
            </div>
          )}

          {/* 듣기 버튼 */}
          <div className="mt-5 space-y-2">
            {hasListen && (
              <a href={record.listenUrl!} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl w-full py-3"
                style={{ backgroundColor: gold, color: '#fff', fontSize: 14, fontWeight: 700 }}>
                <ExternalLink size={16} /> 듣기 링크 열기
              </a>
            )}
            <div className="grid grid-cols-2 gap-2">
              <a href={ytMusicSearch(record)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl py-3"
                style={{ backgroundColor: t.bgSub, color: t.text, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${t.border}` }}>
                <ExternalLink size={15} /> 유튜브 뮤직
              </a>
              <a href={spotifySearch(record)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl py-3"
                style={{ backgroundColor: t.bgSub, color: t.text, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${t.border}` }}>
                <ExternalLink size={15} /> 스포티파이
              </a>
            </div>
          </div>

          {/* 내 메모 — card 배경 + 골드 왼쪽 라인 */}
          {record.memo && (
            <div className="mt-5 rounded-xl p-4"
              style={{ backgroundColor: t.card, borderLeft: `3px solid ${gold}`, border: `1px solid ${t.border}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: '0.04em',
                textTransform: 'uppercase', marginBottom: 6 }}>내 메모</p>
              <p style={{ fontSize: 14, color: t.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{record.memo}</p>
              {record.createdAt && (
                <p className="text-right mt-2" style={{ fontSize: 11, color: t.textMuted }}>
                  {formatDate(record.createdAt)} 저장
                </p>
              )}
            </div>
          )}

          {/* 삭제 */}
          <button onClick={() => onDelete(record.id)}
            className="flex items-center justify-center gap-1.5 w-full mt-5 py-2.5 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight,
              border: `1px solid ${t.danger}` }}>
            <Trash2 size={15} /> 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
