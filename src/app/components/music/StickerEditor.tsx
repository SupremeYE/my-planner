import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { MusicRecord } from '../../store';
import {
  STICKER_EMOJIS,
  clampCoord,
  createSticker,
  normalizeStickers,
  serializeStickers,
  type Sticker,
} from './musicStickers';

/**
 * 스티커 꾸미기 상태/저장 훅 (모바일 바텀시트·PC 패널 공용).
 *  - record.stickers(jsonb) 를 화면용 Sticker[] 로 복원.
 *  - 추가/이동/삭제 → 로컬 state 갱신 + dirty 표시.
 *  - 저장: 꾸미기 모드를 끌 때 + 상세 닫힘/곡 전환(언마운트) 시 한 번. (잦은 쓰기 방지)
 */
export function useStickerEditor(record: MusicRecord) {
  const [stickers, setStickers] = useState<Sticker[]>(() => normalizeStickers(record.stickers));
  const [decorating, setDecorating] = useState(false);
  const stickersRef = useRef<Sticker[]>(stickers);
  stickersRef.current = stickers;
  const dirtyRef = useRef(false);

  // 곡 진입/전환 시 초기화 + 이탈(언마운트/전환) 시 변경분 저장
  useEffect(() => {
    setStickers(normalizeStickers(record.stickers));
    setDecorating(false);
    dirtyRef.current = false;
    const id = record.id;
    return () => {
      if (dirtyRef.current) {
        db.musicRecords.updateStickers(id, serializeStickers(stickersRef.current));
        dirtyRef.current = false;
      }
    };
    // record.stickers 가 아닌 id 기준 — 같은 곡 내 realtime 갱신으로 편집 중 초기화되지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  const flush = useCallback(() => {
    if (!dirtyRef.current) return;
    db.musicRecords.updateStickers(record.id, serializeStickers(stickersRef.current));
    dirtyRef.current = false;
  }, [record.id]);

  const addSticker = useCallback((emoji: string) => {
    // LP 중앙 근처에 살짝 흩뿌려 추가 (겹침 완화)
    const jitter = () => clampCoord(50 + (Math.random() * 16 - 8));
    setStickers(prev => [...prev, createSticker(emoji, jitter(), jitter())]);
    dirtyRef.current = true;
  }, []);

  const moveSticker = useCallback((id: string, x: number, y: number) => {
    setStickers(prev => prev.map(s => (s.id === id ? { ...s, x, y } : s)));
    dirtyRef.current = true;
  }, []);

  const removeSticker = useCallback((id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
    dirtyRef.current = true;
  }, []);

  const toggleDecorate = useCallback(() => {
    setDecorating(d => {
      const next = !d;
      if (!next) flush(); // 끌 때 저장
      return next;
    });
  }, [flush]);

  return { stickers, decorating, addSticker, moveSticker, removeSticker, toggleDecorate };
}

/**
 * LP 위 스티커 레이어 — LpDisc 의 children 으로 들어가 회전 컨테이너 내부에 위치한다.
 *  - 재생(회전) 중에는 LP와 함께 회전, pointer-events 비활성(드래그 불가).
 *  - 꾸미기 모드(정지)에서는 드래그로 이동, 두 번 탭/더블클릭으로 삭제.
 */
export function StickerLayer({ stickers, decorating, onMove, onRemove }: {
  stickers: Sticker[];
  decorating: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const handleDown = (e: React.PointerEvent, id: string) => {
    if (!decorating) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { id, moved: false };
  };

  const handleMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !decorating) return;
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    drag.moved = true;
    onMove(drag.id, clampCoord(x), clampCoord(y));
  };

  const handleUp = (e: React.PointerEvent, id: string) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!decorating || !drag || drag.moved) return;
    // 드래그 없이 탭만 → 더블탭 판정(삭제)
    e.stopPropagation();
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === id && now - last.time < 320) {
      lastTapRef.current = null;
      onRemove(id);
    } else {
      lastTapRef.current = { id, time: now };
    }
  };

  return (
    <div ref={layerRef}
      style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        pointerEvents: decorating ? 'auto' : 'none', zIndex: 6 }}>
      {stickers.map(s => (
        <span key={s.id}
          onPointerDown={(e) => handleDown(e, s.id)}
          onPointerMove={handleMove}
          onPointerUp={(e) => handleUp(e, s.id)}
          onDoubleClick={(e) => { e.stopPropagation(); if (decorating) onRemove(s.id); }}
          style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
            transform: 'translate(-50%, -50%)', fontSize: 26, lineHeight: 1,
            cursor: decorating ? 'grab' : 'default', touchAction: 'none', userSelect: 'none',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
          {s.emoji}
        </span>
      ))}
    </div>
  );
}

/** 스티커 팔레트 — 후보 이모지 탭 시 onPick. 꾸미기 모드에서만 노출. */
export function StickerPalette({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTheme();
  return (
    <div className="rounded-2xl p-3 mb-4"
      style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
      <p className="text-center mb-2" style={{ fontSize: 11, fontWeight: 700, color: t.textMuted,
        letterSpacing: '0.04em' }}>스티커를 탭해 붙이고, 드래그로 옮기고, 두 번 탭하면 지워져요</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {STICKER_EMOJIS.map(emoji => (
          <button key={emoji} type="button" onClick={() => onPick(emoji)}
            className="flex items-center justify-center rounded-xl active:scale-90 transition-transform"
            style={{ width: 40, height: 40, fontSize: 22, backgroundColor: t.card,
              border: `1px solid ${t.border}` }}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
