import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Send } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { computeProgress } from './MandalartView';
import { SendCellModal } from './SendCellModal';
import type { Notify } from '../culture/CultureToast';

export type Cell = {
  id: string; board_id: string; parent_id: string | null;
  position: number; content: string; is_done: boolean; created_at: string;
};

interface Props {
  boardId: string;
  boardTitle: string;
  cells: Cell[];
  onMutate: () => void;
  onNotify: Notify;
  onRenameBoard: (next: string) => void;
}

// 9칸 grid 의 index → 의미. 4번은 중앙.
// slots = [pos0, pos1, pos2, pos3, CENTER, pos4, pos5, pos6, pos7]
const RING_INDEXES = [0, 1, 2, 3, 5, 6, 7, 8] as const;
const positionForGridIdx = (gridIdx: number): number | null => {
  if (gridIdx === 4) return null;
  const ringIdx = RING_INDEXES.indexOf(gridIdx as 0 | 1 | 2 | 3 | 5 | 6 | 7 | 8);
  return ringIdx;
};

type EditTarget =
  | { kind: 'core' }
  | { kind: 'sub'; position: number; cell: Cell | null }
  | { kind: 'action'; parentId: string; position: number; cell: Cell | null };

export function MandalartBoardMobile({ boardId, boardTitle, cells, onMutate, onNotify, onRenameBoard }: Props) {
  const { t } = useTheme();
  const [drillSubId, setDrillSubId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [sending, setSending] = useState<{ cell: Cell; isAction: boolean } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const subs = useMemo(
    () => cells.filter(c => c.parent_id === null).sort((a, b) => a.position - b.position),
    [cells],
  );

  const progress = useMemo(() => computeProgress(cells), [cells]);

  const drillSub = drillSubId ? subs.find(s => s.id === drillSubId) ?? null : null;
  const drillActions = useMemo(
    () => drillSub
      ? cells.filter(c => c.parent_id === drillSub.id).sort((a, b) => a.position - b.position)
      : [],
    [cells, drillSub],
  );

  const startLongPress = (run: () => void) => {
    longPressed.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      run();
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openEditFor = (target: EditTarget) => {
    setEditing(target);
    if (target.kind === 'core') setEditDraft(boardTitle);
    else setEditDraft(target.cell?.content ?? '');
  };

  const closeEdit = () => { setEditing(null); setEditDraft(''); };

  const submitEdit = async () => {
    if (!editing) return;
    const next = editDraft.trim();
    if (editing.kind === 'core') {
      if (next && next !== boardTitle) { onRenameBoard(next); onNotify('저장되었습니다', 'success'); }
      closeEdit();
      return;
    }
    const parentId = editing.kind === 'sub' ? null : editing.parentId;
    if (editing.cell) {
      if (!next) {
        // 내용 비우면 셀 삭제 (자식 행동도 CASCADE)
        await db.mandalartCells.delete(editing.cell.id);
        onNotify('삭제되었습니다', 'success');
      } else if (next !== editing.cell.content) {
        await db.mandalartCells.update(editing.cell.id, { content: next });
        onNotify('저장되었습니다', 'success');
      }
    } else if (next) {
      await db.mandalartCells.upsert({ boardId, parentId, position: editing.position, content: next });
      onNotify('추가되었습니다', 'success');
    }
    onMutate();
    closeEdit();
  };

  const toggleAction = async (cell: Cell) => {
    await db.mandalartCells.update(cell.id, { isDone: !cell.is_done });
    onMutate();
  };

  // ─── 렌더링 ─────────────────────────────────────────────
  if (drillSub) {
    const subPct = progress.subPct(drillSub.id);
    return (
      <>
        {/* breadcrumb */}
        <div className="flex items-center gap-2 mb-3" style={{ fontSize: 14, fontWeight: 700 }}>
          <button onClick={() => setDrillSubId(null)} style={{ color: t.accent }}>
            ← 핵심
          </button>
          <span style={{ color: t.textMuted }}>·</span>
          <span style={{ color: t.text }}>{drillSub.content || '세부'}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, gridIdx) => {
            if (gridIdx === 4) {
              // 중앙 = 세부 (subc)
              return (
                <SubCenterCell
                  key="center"
                  name={drillSub.content || '세부'}
                  pct={subPct}
                  onClick={() => openEditFor({ kind: 'sub', position: drillSub.position, cell: drillSub })}
                />
              );
            }
            const pos = positionForGridIdx(gridIdx)!;
            const cell = drillActions.find(a => a.position === pos) ?? null;
            return (
              <ActionCell
                key={gridIdx}
                cell={cell}
                onTap={() => {
                  if (longPressed.current) return;
                  if (!cell) {
                    openEditFor({ kind: 'action', parentId: drillSub.id, position: pos, cell: null });
                  } else {
                    toggleAction(cell);
                  }
                }}
                onLongPress={() => openEditFor({ kind: 'action', parentId: drillSub.id, position: pos, cell })}
                startLongPress={startLongPress}
                cancelLongPress={cancelLongPress}
              />
            );
          })}
        </div>
        <p className="text-center mt-4" style={{ fontSize: 11, color: t.textMuted }}>
          행동을 체크하면 위 목표 진행률이 자동으로 차올라요 (길게 눌러 편집)
        </p>

        {editing && (
          <EditModal
            t={t}
            title={editing.kind === 'core' ? '핵심 목표' : editing.kind === 'sub' ? '세부 목표' : '행동'}
            draft={editDraft}
            onChange={setEditDraft}
            onSubmit={submitEdit}
            onClose={closeEdit}
            allowEmpty={(editing.kind === 'sub' || editing.kind === 'action') && !!editing.cell}
            placeholder={editing.kind === 'action' ? '행동을 적어보세요' : '세부 목표'}
            onSend={
              editing.kind !== 'core' && editing.cell && (editDraft.trim() || editing.cell.content)
                ? () => {
                    const cell = editing.cell!;
                    setSending({ cell, isAction: editing.kind === 'action' });
                    closeEdit();
                  }
                : undefined
            }
          />
        )}

        {sending && (
          <SendCellModal
            cellId={sending.cell.id}
            defaultText={sending.cell.content}
            isAction={sending.isAction}
            onClose={() => setSending(null)}
            onNotify={onNotify}
          />
        )}
      </>
    );
  }

  // ─── center view ────────────────────────────────────────
  return (
    <>
      {/* core header */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}
        onClick={() => openEditFor({ kind: 'core' })}
      >
        <div style={{ fontSize: 11, color: t.textMuted }}>핵심 목표</div>
        <div style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 20, marginTop: 2, color: t.text }}>
          {boardTitle || '제목을 적어주세요'}
        </div>
        <div className="h-2 rounded-full overflow-hidden mt-3" style={{ backgroundColor: t.bgSub }}>
          <div className="h-full" style={{ width: `${progress.overall}%`, backgroundColor: t.success }} />
        </div>
        <div className="flex justify-between mt-1.5" style={{ fontSize: 11, color: t.textMuted }}>
          <span>전체 진행률</span>
          <span>{progress.overall}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, gridIdx) => {
          if (gridIdx === 4) {
            return (
              <CoreCell
                key="center"
                title={boardTitle || '핵심 목표'}
                pct={progress.overall}
                t={t}
                onClick={() => openEditFor({ kind: 'core' })}
              />
            );
          }
          const pos = positionForGridIdx(gridIdx)!;
          const sub = subs.find(s => s.position === pos) ?? null;
          return (
            <SubCell
              key={gridIdx}
              cell={sub}
              pct={sub ? progress.subPct(sub.id) : 0}
              hasActions={sub ? progress.subHasActions(sub.id) : false}
              onTap={() => {
                if (longPressed.current) return;
                if (!sub) {
                  openEditFor({ kind: 'sub', position: pos, cell: null });
                } else if (progress.subHasActions(sub.id)) {
                  setDrillSubId(sub.id);
                } else {
                  // leaf — 자체 체크 토글
                  db.mandalartCells.update(sub.id, { isDone: !sub.is_done }).then(onMutate);
                }
              }}
              onExpand={sub && !progress.subHasActions(sub.id) ? () => setDrillSubId(sub.id) : undefined}
              onLongPress={() => openEditFor({ kind: 'sub', position: pos, cell: sub })}
              startLongPress={startLongPress}
              cancelLongPress={cancelLongPress}
            />
          );
        })}
      </div>
      <p className="text-center mt-4" style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        세부 칸을 탭하면 체크 / 행동이 있으면 펼쳐져요 · 길게 눌러 편집
      </p>

      {editing && (
        <EditModal
          t={t}
          title={editing.kind === 'core' ? '핵심 목표' : '세부 목표'}
          draft={editDraft}
          onChange={setEditDraft}
          onSubmit={submitEdit}
          onClose={closeEdit}
          allowEmpty={editing.kind === 'sub' && !!editing.cell}
          placeholder={editing.kind === 'core' ? '핵심 목표 (예: 2026 최고의 나)' : '세부 목표'}
          onSend={
            editing.kind === 'sub' && editing.cell && (editDraft.trim() || editing.cell.content)
              ? () => {
                  const cell = editing.cell!;
                  setSending({ cell, isAction: false });
                  closeEdit();
                }
              : undefined
          }
        />
      )}

      {sending && (
        <SendCellModal
          cellId={sending.cell.id}
          defaultText={sending.cell.content}
          isAction={sending.isAction}
          onClose={() => setSending(null)}
          onNotify={onNotify}
        />
      )}
    </>
  );
}

// ─── 셀 컴포넌트들 ────────────────────────────────────────────
function CoreCell({ title, pct, t, onClick }: {
  title: string; pct: number; t: ReturnType<typeof useTheme>['t']; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 px-2 text-center"
      style={{ backgroundColor: t.accent, color: '#fff', minWidth: 0 }}
    >
      <span style={{
        fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 14,
        lineHeight: 1.15,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>
        {title}
      </span>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>{pct}%</span>
    </button>
  );
}

function SubCell({
  cell, pct, hasActions, onTap, onExpand, onLongPress, startLongPress, cancelLongPress,
}: {
  cell: Cell | null; pct: number; hasActions: boolean;
  onTap: () => void; onExpand?: () => void; onLongPress: () => void;
  startLongPress: (run: () => void) => void; cancelLongPress: () => void;
}) {
  const { t } = useTheme();
  if (!cell) {
    return (
      <button
        onClick={onTap}
        className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5"
        style={{
          backgroundColor: 'transparent',
          border: `1.5px dashed ${t.border}`,
          color: t.accent, minWidth: 0,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 300, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 10, color: t.textMuted }}>세부 추가</span>
      </button>
    );
  }
  const done = !hasActions && cell.is_done;
  return (
    <div
      role="button"
      onClick={onTap}
      onTouchStart={() => startLongPress(onLongPress)}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={e => { e.preventDefault(); onLongPress(); }}
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 px-2 relative text-center cursor-pointer"
      style={{
        backgroundColor: done ? t.success + '22' : t.bgSub,
        border: `1px solid ${done ? t.success + '66' : t.borderLight}`,
        color: t.text, minWidth: 0,
      }}
    >
      {!hasActions && (
        <span
          className="rounded-full flex items-center justify-center"
          style={{
            width: 18, height: 18,
            border: `1.5px solid ${done ? t.success : t.accent}`,
            backgroundColor: done ? t.success : 'transparent',
            color: done ? '#fff' : 'transparent',
            fontSize: 10, fontWeight: 700,
          }}
        >✓</span>
      )}
      <span style={{
        fontSize: 12.5, fontWeight: 500, lineHeight: 1.2,
        color: done ? t.textMuted : t.text,
        textDecoration: done ? 'line-through' : 'none',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>
        {cell.content}
      </span>
      {hasActions && (
        <>
          <div className="h-1 rounded-full overflow-hidden" style={{ width: '70%', backgroundColor: t.border + '55' }}>
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: t.success }} />
          </div>
          <ChevronRight size={10} style={{ position: 'absolute', bottom: 6, right: 6, color: t.accent }} />
        </>
      )}
      {!hasActions && onExpand && (
        <span
          role="button"
          onClick={e => { e.stopPropagation(); onExpand(); }}
          style={{
            position: 'absolute', bottom: 4, right: 6,
            fontSize: 9, fontWeight: 700, color: t.accent,
            padding: '2px 5px', borderRadius: 8,
            backgroundColor: t.accentLight,
          }}
        >+ 펼치기</span>
      )}
    </div>
  );
}

function SubCenterCell({ name, pct, onClick }: { name: string; pct: number; onClick: () => void }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 px-2 text-center"
      style={{ backgroundColor: t.accentLight, color: t.text, minWidth: 0 }}
    >
      <span style={{
        fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 14, lineHeight: 1.15,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>
        {name}
      </span>
      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: t.accent }}>
        {pct}%
      </span>
    </button>
  );
}

function ActionCell({
  cell, onTap, onLongPress, startLongPress, cancelLongPress,
}: {
  cell: Cell | null;
  onTap: () => void; onLongPress: () => void;
  startLongPress: (run: () => void) => void; cancelLongPress: () => void;
}) {
  const { t } = useTheme();
  if (!cell) {
    return (
      <button
        onClick={onTap}
        className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5"
        style={{ backgroundColor: 'transparent', border: `1.5px dashed ${t.border}`, color: t.accent, minWidth: 0 }}
      >
        <span style={{ fontSize: 22, fontWeight: 300, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 10, color: t.textMuted }}>행동 추가</span>
      </button>
    );
  }
  const done = cell.is_done;
  return (
    <button
      onClick={onTap}
      onTouchStart={() => startLongPress(onLongPress)}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={e => { e.preventDefault(); onLongPress(); }}
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 px-2 text-center"
      style={{
        backgroundColor: done ? t.success + '22' : t.card,
        border: `1px solid ${done ? t.success + '66' : t.borderLight}`,
        color: t.text, minWidth: 0,
      }}
    >
      <span
        className="rounded-full flex items-center justify-center"
        style={{
          width: 22, height: 22,
          border: `1.5px solid ${done ? t.success : t.accent}`,
          backgroundColor: done ? t.success : 'transparent',
          color: done ? '#fff' : 'transparent',
          fontSize: 12, fontWeight: 700,
        }}
      >✓</span>
      <span style={{
        fontSize: 11.5, lineHeight: 1.2,
        color: done ? t.textMuted : t.text,
        textDecoration: done ? 'line-through' : 'none',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>{cell.content}</span>
    </button>
  );
}

// ─── 편집 모달 ────────────────────────────────────────────────
function EditModal({
  t, title, draft, onChange, onSubmit, onClose, allowEmpty, placeholder, onSend,
}: {
  t: ReturnType<typeof useTheme>['t'];
  title: string;
  draft: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  allowEmpty: boolean;
  placeholder: string;
  onSend?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl p-5"
        style={{ backgroundColor: t.card, maxWidth: 360 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>{title}</div>
        <textarea
          autoFocus
          value={draft}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none"
          style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
        />
        <div className="flex justify-between items-center gap-2 mt-3">
          {onSend ? (
            <button
              onClick={onSend}
              className="px-3 py-1.5 rounded-xl flex items-center gap-1.5"
              style={{
                fontSize: 13, color: t.accent, backgroundColor: t.accentLight,
                border: `1px solid ${t.accent}55`,
              }}
            ><Send size={12} /> 보내기</button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl"
              style={{ fontSize: 13, color: t.textMuted, backgroundColor: t.bgSub }}
            >취소</button>
            <button
              onClick={onSubmit}
              disabled={!allowEmpty && !draft.trim()}
              className="px-3 py-1.5 rounded-xl"
              style={{
                fontSize: 13, color: '#fff', backgroundColor: t.accent,
                opacity: (!allowEmpty && !draft.trim()) ? 0.4 : 1,
              }}
            >저장</button>
          </div>
        </div>
        {allowEmpty && (
          <p className="mt-2 text-right" style={{ fontSize: 11, color: t.textMuted }}>
            내용을 비우고 저장하면 셀이 삭제됩니다
          </p>
        )}
      </div>
    </div>
  );
}
