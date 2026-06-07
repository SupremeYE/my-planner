import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Palette, ExternalLink, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { MusicRecord } from '../../store';
import { LpDisc } from './LpDisc';

interface MusicDetailPanelProps {
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
 * PC(lg 이상) 곡 상세 패널.
 *  - 그리드 오른쪽에서 밀려 나오는(push) 패널. 내용은 모바일 상세(MusicDetailSheet)와 동일.
 *  - 내부 폭은 390px 고정 — 바깥 래퍼의 width 트랜지션으로 밀어내기 애니메이션을 준다.
 *  - 곡 전환(record.id 변경) 시 재생 상태/오디오 초기화.
 *  - 닫기: 우상단 X (바깥(그리드) 클릭 닫힘은 부모 그리드 영역에서 처리).
 *
 * ⚠️ 모바일 바텀시트(MusicDetailSheet)는 건드리지 않기 위해 PC 전용으로 별도 구현했다.
 */
export function MusicDetailPanel({ record, onClose, onDelete }: MusicDetailPanelProps) {
  const { t } = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // 색 역할 매핑(하드코딩 금지 — 토큰만): 골드=accent, 코랄=danger, 그린=success
  const gold = t.accent, coral = t.danger, green = t.success;

  // 다른 곡으로 바뀌면(클릭/셔플) 이전 오디오 정지 + 재생 상태 초기화
  useEffect(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, [record.id]);

  // 언마운트(닫힘) 시 오디오 정지
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // Esc 로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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

  return (
    <div className="flex flex-col h-full"
      style={{ width: 390, backgroundColor: t.card, borderLeft: `1px solid ${t.border}` }}>

      {/* 패널 헤더: 라벨 + 닫기 X */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${t.borderLight}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted,
          letterSpacing: '0.06em', textTransform: 'uppercase' }}>상세</span>
        <button onClick={onClose} aria-label="닫기"
          className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 32, height: 32, backgroundColor: t.bgSub, color: t.textSub }}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* 큰 LP */}
        <div className="mx-auto mb-4" style={{ width: 200 }}>
          <LpDisc artworkUrl={record.artworkUrl} spinning={playing} />
        </div>

        {/* 재생 / 꾸미기 컨트롤 */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <button onClick={togglePlay}
            className="flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 active:scale-95 transition-transform"
            style={{ backgroundColor: gold, color: '#fff', fontSize: 14, fontWeight: 700, minWidth: 110 }}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
            {playing ? '멈춤' : '재생'}
          </button>
          <button disabled aria-disabled title="다음 단계에서 제공돼요"
            className="flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5"
            style={{ backgroundColor: t.bgSub, color: t.textMuted, fontSize: 14, fontWeight: 600,
              border: `1px solid ${t.border}`, cursor: 'not-allowed' }}>
            <Palette size={18} /> 꾸미기
          </button>
        </div>

        {/* 숨은 audio */}
        {record.previewUrl && (
          <audio ref={audioRef} src={record.previewUrl}
            onEnded={() => setPlaying(false)} preload="none" />
        )}

        {/* 제목 / 아티스트 / 앨범·연도 */}
        <h2 className="text-center" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24,
          color: t.text, lineHeight: 1.25 }}>
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
            style={{ backgroundColor: t.bg, borderLeft: `3px solid ${gold}`, border: `1px solid ${t.border}` }}>
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
  );
}
