import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Send, Plus } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { usePlanner } from '../../store';
import { computeProgress } from './MandalartView';
import { SendCellModal } from './SendCellModal';
import { inputBg, solidCardStyle, withAlpha } from '../../styles/haonStyles';
import { mandalartColor } from '../../styles/mandalartColors';
import type { Notify } from '../culture/CultureToast';

export type Cell = {
  id: string; board_id: string; parent_id: string | null;
  position: number; content: string; is_done: boolean; color: string | null; created_at: string;
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
  const { annualGoals, monthlyGoals, weeklyGoals, todos } = usePlanner();
  const sentCellIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of annualGoals) if (g.mandalartCellId) s.add(g.mandalartCellId);
    for (const g of monthlyGoals) if (g.mandalartCellId) s.add(g.mandalartCellId);
    for (const g of weeklyGoals) if (g.mandalartCellId) s.add(g.mandalartCellId);
    for (const td of todos) if (td.mandalartCellId) s.add(td.mandalartCellId);
    return s;
  }, [annualGoals, monthlyGoals, weeklyGoals, todos]);
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

  const actionsBySub = useMemo(() => {
    const m = new Map<string, Cell[]>();
    cells.filter(c => c.parent_id !== null).forEach(c => {
      const list = m.get(c.parent_id!) ?? [];
      list.push(c);
      m.set(c.parent_id!, list);
    });
    return m;
  }, [cells]);

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
                  colorKey={drillSub.color}
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
                sent={cell ? sentCellIds.has(cell.id) : false}
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

  // ─── 오버뷰 (2단 구조 상단) — 중심 목표 카드 + 서브목표 8개 카드 리스트 ──────────
  return (
    <>
      {/* core header */}
      <div
        className="p-4 mb-3"
        style={{ ...solidCardStyle(t) }}
        onClick={() => openEditFor({ kind: 'core' })}
      >
        <div style={{ fontSize: 11, color: t.textMuted }}>핵심 목표</div>
        <div style={{ fontFamily: t.fontDecorative, fontWeight: 700, fontSize: 20, marginTop: 2, color: t.text }}>
          {boardTitle || '제목을 적어주세요'}
        </div>
        <div className="h-2 rounded-full overflow-hidden mt-3" style={{ backgroundColor: t.surfaceMuted }}>
          <div className="h-full" style={{ width: `${progress.overall}%`, backgroundColor: t.success }} />
        </div>
        <div className="flex justify-between mt-1.5" style={{ fontSize: 11, color: t.textMuted }}>
          <span>전체 진행률</span>
          <span style={{ fontFamily: t.fontNumeric, color: t.textSub }}>{progress.overall}%</span>
        </div>
      </div>

      {/* 서브목표 8개 카드 리스트 (position 0..7) */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, pos) => {
          const sub = subs.find(s => s.position === pos) ?? null;
          if (!sub) {
            return (
              <button
                key={pos}
                onClick={() => openEditFor({ kind: 'sub', position: pos, cell: null })}
                className="mandalart-ghost w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl"
                style={{ backgroundColor: 'transparent', border: `1.5px dashed ${t.border}`, color: t.textMuted }}
              >
                <Plus size={14} />
                <span style={{ fontSize: 13 }}>세부 목표 추가</span>
              </button>
            );
          }
          const counts = progress.subCounts(sub.id);
          const hasActions = progress.subHasActions(sub.id);
          return (
            <SubOverviewCard
              key={pos}
              cell={sub}
              sent={sentCellIds.has(sub.id)}
              counts={counts}
              hasActions={hasActions}
              actions={actionsBySub.get(sub.id) ?? []}
              onTap={() => {
                if (longPressed.current) return;
                if (hasActions) setDrillSubId(sub.id);
                else db.mandalartCells.update(sub.id, { isDone: !sub.is_done }).then(onMutate);
              }}
              onDrill={() => setDrillSubId(sub.id)}
              onLongPress={() => openEditFor({ kind: 'sub', position: pos, cell: sub })}
              startLongPress={startLongPress}
              cancelLongPress={cancelLongPress}
            />
          );
        })}
      </div>
      <p className="text-center mt-4" style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
        카드를 탭하면 세부 3×3 으로 들어가요 · 길게 눌러 편집
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

// 미니 3×3 진행 그리드 — 중앙=세부 색, 둘레 8칸=행동 상태(완료=success, 미완료=중립, 없음=희미).
function MiniGrid({ cell, actions, t }: {
  cell: Cell; actions: Cell[]; t: ReturnType<typeof useTheme>['t'];
}) {
  const c = mandalartColor(t, cell.color);
  const byPos = new Map<number, Cell>();
  actions.forEach(a => byPos.set(a.position, a));
  return (
    <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, width: 34, height: 34, flexShrink: 0 }}>
      {Array.from({ length: 9 }).map((_, gridIdx) => {
        if (gridIdx === 4) {
          return <span key={gridIdx} style={{ borderRadius: 2, backgroundColor: c.bar }} />;
        }
        const pos = positionForGridIdx(gridIdx)!;
        const a = byPos.get(pos);
        const bg = !a ? withAlpha(t.textMuted, 0.15) : a.is_done ? t.success : withAlpha(t.textMuted, 0.4);
        return <span key={gridIdx} style={{ borderRadius: 2, backgroundColor: bg }} />;
      })}
    </span>
  );
}

// 오버뷰 서브목표 카드 — 흰 솔리드 카드 + 좌측 3px 컬러 바 + 제목/완료수 + 미니 3×3(행동) 또는 체크(leaf).
function SubOverviewCard({
  cell, sent, counts, hasActions, actions, onTap, onDrill, onLongPress, startLongPress, cancelLongPress,
}: {
  cell: Cell; sent: boolean; counts: { done: number; total: number }; hasActions: boolean;
  actions: Cell[]; onTap: () => void; onDrill: () => void; onLongPress: () => void;
  startLongPress: (run: () => void) => void; cancelLongPress: () => void;
}) {
  const { t } = useTheme();
  const c = mandalartColor(t, cell.color);
  const done = !hasActions && cell.is_done;
  return (
    <div
      role="button"
      onClick={onTap}
      onTouchStart={() => startLongPress(onLongPress)}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={e => { e.preventDefault(); onLongPress(); }}
      className="w-full flex items-center gap-3 px-3.5 py-3 relative cursor-pointer"
      style={{ ...solidCardStyle(t), boxShadow: `inset 3px 0 0 ${c.bar}, ${solidCardStyle(t).boxShadow}` }}
    >
      {sent && (
        <span title="이 칸에서 보낸 항목이 있어요"
          style={{ position: 'absolute', top: 6, right: 8, fontSize: 11, color: t.accent, fontWeight: 700, lineHeight: 1 }}>✦</span>
      )}
      <div className="flex-1 min-w-0">
        <div style={{
          fontSize: 14, fontWeight: 600, lineHeight: 1.25,
          color: done ? t.textMuted : t.text,
          textDecoration: done ? 'line-through' : 'none',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word',
        }}>
          {cell.content || '세부 목표'}
        </div>
        <div className="mt-1" style={{ fontSize: 11, color: t.textMuted, fontFamily: t.fontNumeric }}>
          {hasActions ? `${counts.done}/${counts.total} 완료` : done ? '완료됨' : '행동 없음 · 탭하여 체크'}
        </div>
      </div>
      {hasActions ? (
        <>
          <MiniGrid cell={cell} actions={actions} t={t} />
          <ChevronRight size={16} style={{ color: t.textMuted, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onDrill(); }} />
        </>
      ) : (
        <span
          className="rounded-full flex items-center justify-center"
          style={{
            width: 22, height: 22, flexShrink: 0,
            border: `1.5px solid ${done ? t.success : t.border}`,
            backgroundColor: done ? t.success : 'transparent',
            color: done ? '#fff' : 'transparent', fontSize: 12, fontWeight: 700,
          }}
        >✓</span>
      )}
    </div>
  );
}

function SubCenterCell({ name, pct, colorKey, onClick }: { name: string; pct: number; colorKey: string | null; onClick: () => void }) {
  const { t } = useTheme();
  const c = mandalartColor(t, colorKey);
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 px-2 text-center"
      style={{ backgroundColor: c.mid, color: t.text, minWidth: 0, border: `1px solid ${withAlpha(c.bar, 0.35)}` }}
    >
      <span style={{
        fontFamily: t.fontDecorative, fontWeight: 700, fontSize: 14, lineHeight: 1.15,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>
        {name}
      </span>
      <span style={{ fontFamily: t.fontNumeric, fontSize: 18, color: t.text }}>
        {pct}%
      </span>
    </button>
  );
}

function ActionCell({
  cell, sent, onTap, onLongPress, startLongPress, cancelLongPress,
}: {
  cell: Cell | null; sent: boolean;
  onTap: () => void; onLongPress: () => void;
  startLongPress: (run: () => void) => void; cancelLongPress: () => void;
}) {
  const { t } = useTheme();
  if (!cell) {
    // 빈 셀(ghost) — 투명 + 중립 점선 + 뮤트.
    return (
      <button
        onClick={onTap}
        className="mandalart-ghost aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5"
        style={{ backgroundColor: 'transparent', border: `1.5px dashed ${t.border}`, color: t.textMuted, minWidth: 0 }}
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
      className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 px-2 text-center relative"
      style={{
        // 완료라도 배경 불변(리스트 행 규칙) — 흰 카드 유지, 체크+취소선+뮤트로만 표현.
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: '0 2px 8px rgba(120,90,160,0.10)',
        color: t.text, minWidth: 0,
      }}
    >
      {sent && (
        <span
          title="이 칸에서 보낸 항목이 있어요"
          style={{
            position: 'absolute', top: 4, left: 6,
            fontSize: 11, color: t.accent, fontWeight: 700, lineHeight: 1,
          }}
        >✦</span>
      )}
      <span
        className="rounded-full flex items-center justify-center"
        style={{
          width: 22, height: 22,
          border: `1.5px solid ${done ? t.success : t.border}`,
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
          style={{ fontSize: 14, borderColor: t.border, backgroundColor: inputBg(t), color: t.text }}
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
              style={{ fontSize: 13, color: t.textSub, backgroundColor: t.surfaceMuted }}
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
