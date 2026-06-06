import { useMemo, useState } from 'react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { computeProgress } from './MandalartView';
import type { Cell } from './MandalartBoardMobile';
import type { Notify } from '../culture/CultureToast';

interface Props {
  boardId: string;
  boardTitle: string;
  cells: Cell[];
  onMutate: () => void;
  onNotify: Notify;
  onRenameBoard: (next: string) => void;
}

// 블록 내부 grid index 0..8 중 4=중앙, 둘레 8칸은 ring index 0..7
const RING = [0, 1, 2, 3, 5, 6, 7, 8] as const;
const positionForGridIdx = (gridIdx: number): number | null => {
  if (gridIdx === 4) return null;
  const r = RING.indexOf(gridIdx as 0 | 1 | 2 | 3 | 5 | 6 | 7 | 8);
  return r;
};

// 외곽 3×3 블록(br,bc) → 세부 index (가운데 블록 br=1,bc=1 제외)
// 둘레 8블록 = 세부 0..7 (mockup bring 순서)
const BRING: [number, number][] = [
  [0, 0], [0, 1], [0, 2],
  [1, 0],         [1, 2],
  [2, 0], [2, 1], [2, 2],
];
const subIndexForBlock = (br: number, bc: number): number | null => {
  if (br === 1 && bc === 1) return null;
  return BRING.findIndex(([r, c]) => r === br && c === bc);
};

type EditTarget =
  | { kind: 'core' }
  | { kind: 'sub'; position: number; cell: Cell | null }
  | { kind: 'action'; parentId: string; position: number; cell: Cell | null };

export function MandalartBoardPC({ boardId, boardTitle, cells, onMutate, onNotify, onRenameBoard }: Props) {
  const { t } = useTheme();

  const subs = useMemo(
    () => cells.filter(c => c.parent_id === null).sort((a, b) => a.position - b.position),
    [cells],
  );
  const subByPos = useMemo(() => {
    const m = new Map<number, Cell>();
    subs.forEach(s => m.set(s.position, s));
    return m;
  }, [subs]);

  const progress = useMemo(() => computeProgress(cells), [cells]);

  const actionsBySub = useMemo(() => {
    const m = new Map<string, Cell[]>();
    cells.filter(c => c.parent_id !== null).forEach(c => {
      const list = m.get(c.parent_id!) ?? [];
      list.push(c);
      m.set(c.parent_id!, list);
    });
    return m;
  }, [cells]);

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const openEdit = (target: EditTarget) => {
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
      closeEdit(); return;
    }
    const parentId = editing.kind === 'sub' ? null : editing.parentId;
    if (editing.cell) {
      if (!next) { await db.mandalartCells.delete(editing.cell.id); onNotify('삭제되었습니다', 'success'); }
      else if (next !== editing.cell.content) { await db.mandalartCells.update(editing.cell.id, { content: next }); onNotify('저장되었습니다', 'success'); }
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

  return (
    <>
      {/* 상단 툴바: 전체 진행률 */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-3" style={{ minWidth: 260 }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>전체 진행률</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub, minWidth: 140 }}>
            <div className="h-full" style={{ width: `${progress.overall}%`, backgroundColor: t.success }} />
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: t.text }}>
            {progress.overall}%
          </span>
        </div>
      </div>

      {/* 9×9 보드: 3×3 블록 grid, 각 블록 내부 3×3 grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          maxWidth: 780,
          margin: '0 auto',
        }}
      >
        {Array.from({ length: 9 }).map((_, blockIdx) => {
          const br = Math.floor(blockIdx / 3);
          const bc = blockIdx % 3;
          const isCenterBlock = br === 1 && bc === 1;
          const subIdx = subIndexForBlock(br, bc);

          // 둘레 블록인데 그 위치의 세부 셀이 없으면 → 빈 블록 placeholder
          const subCell = subIdx !== null ? subByPos.get(subIdx) ?? null : null;
          const isExpanded = subCell ? progress.subHasActions(subCell.id) : false;

          // 둘레 블록 자유도: 세부 없음 → 전체 +, 세부 leaf → "펼치기" 큰 버튼.
          if (!isCenterBlock && subIdx !== null && !isExpanded) {
            return (
              <button
                key={blockIdx}
                onClick={() => {
                  if (!subCell) openEdit({ kind: 'sub', position: subIdx, cell: null });
                  else openEdit({ kind: 'action', parentId: subCell.id, position: 0, cell: null });
                }}
                style={{
                  padding: 5,
                  borderRadius: 12,
                  backgroundColor: 'transparent',
                  border: `1.5px dashed ${t.border}`,
                  minWidth: 0,
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  color: t.accent,
                  opacity: subCell ? 0.9 : 0.45,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 300 }}>+</span>
                <span style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 11, color: t.accent }}>
                  {subCell ? `${subCell.content || '세부'} 펼치기` : '세부 추가'}
                </span>
              </button>
            );
          }

          return (
            <div
              key={blockIdx}
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                padding: 5,
                borderRadius: 12,
                backgroundColor: isCenterBlock ? t.accentLight : t.bgSub,
                boxShadow: isCenterBlock ? `0 0 0 1.5px ${t.accent}33` : 'none',
                minWidth: 0,
              }}
            >
              {Array.from({ length: 9 }).map((_, gridIdx) => {
                // ── 중앙 블록(핵심 + 세부 8) ──
                if (isCenterBlock) {
                  if (gridIdx === 4) {
                    return (
                      <CorePCCell
                        key={gridIdx}
                        title={boardTitle || '핵심 목표'}
                        pct={progress.overall}
                        t={t}
                        onClick={() => openEdit({ kind: 'core' })}
                      />
                    );
                  }
                  const pos = positionForGridIdx(gridIdx)!;
                  const sub = subByPos.get(pos) ?? null;
                  const subHasActions = sub ? progress.subHasActions(sub.id) : false;
                  return (
                    <SubPCCell
                      key={gridIdx}
                      cell={sub}
                      pct={sub ? progress.subPct(sub.id) : 0}
                      hasActions={subHasActions}
                      t={t}
                      onClick={() => {
                        if (sub && !subHasActions) {
                          // leaf — 좌클릭 = 토글
                          toggleAction(sub);
                        } else {
                          openEdit({ kind: 'sub', position: pos, cell: sub });
                        }
                      }}
                      onEdit={() => openEdit({ kind: 'sub', position: pos, cell: sub })}
                    />
                  );
                }
                // ── 둘레 블록 ──
                if (gridIdx === 4) {
                  // 둘레 블록 중앙 = 세부 미러 (subc)
                  return (
                    <SubCenterPCCell
                      key={gridIdx}
                      name={subCell?.content ?? '미정'}
                      pct={subCell ? progress.subPct(subCell.id) : 0}
                      t={t}
                      onClick={() => {
                        if (subIdx !== null) {
                          openEdit({ kind: 'sub', position: subIdx, cell: subCell });
                        }
                      }}
                    />
                  );
                }
                // 위에서 subCell 없음 / leaf 는 단일 버튼 블록으로 처리했으므로 여기는 펼침 상태.
                const pos = positionForGridIdx(gridIdx)!;
                const action = (actionsBySub.get(subCell!.id) ?? []).find(a => a.position === pos) ?? null;
                return (
                  <ActionPCCell
                    key={gridIdx}
                    cell={action}
                    t={t}
                    onTap={() => {
                      if (!action) openEdit({ kind: 'action', parentId: subCell!.id, position: pos, cell: null });
                      else toggleAction(action);
                    }}
                    onEdit={() => openEdit({ kind: 'action', parentId: subCell!.id, position: pos, cell: action })}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-center mt-5" style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>
        가운데 9칸 = 핵심 + 세부 8 · 펼친 세부만 둘레 판으로 확장 · 빈 둘레 판의 + 를 눌러 펼치기 · 행동 좌클릭 = 체크, 우클릭 = 편집
      </p>

      {editing && (
        <EditModalPC
          t={t}
          title={editing.kind === 'core' ? '핵심 목표' : editing.kind === 'sub' ? '세부 목표' : '행동'}
          draft={editDraft}
          onChange={setEditDraft}
          onSubmit={submitEdit}
          onClose={closeEdit}
          allowEmpty={(editing.kind === 'sub' || editing.kind === 'action') && !!editing.cell}
          placeholder={editing.kind === 'core' ? '핵심 목표' : editing.kind === 'sub' ? '세부 목표' : '행동'}
        />
      )}
    </>
  );
}

// ─── 셀 컴포넌트 (PC 크기, padding 작고 폰트 작음) ───
const cellBase = {
  aspectRatio: '1',
  borderRadius: 9,
  padding: '5px 4px',
  minWidth: 0,
  textAlign: 'center' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

const clamp2 = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  wordBreak: 'break-word' as const,
};

function CorePCCell({ title, pct, t, onClick }: {
  title: string; pct: number; t: ReturnType<typeof useTheme>['t']; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ ...cellBase, backgroundColor: t.accent, color: '#fff', border: `1px solid ${t.accent}` }}
    >
      <span style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 12, lineHeight: 1.15, ...clamp2 }}>
        {title}
      </span>
      <b style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, fontWeight: 400 }}>{pct}%</b>
    </button>
  );
}

function SubPCCell({ cell, pct, hasActions, t, onClick, onEdit }: {
  cell: Cell | null; pct: number; hasActions: boolean;
  t: ReturnType<typeof useTheme>['t']; onClick: () => void; onEdit: () => void;
}) {
  if (!cell) {
    return (
      <button
        onClick={onClick}
        title="세부 목표 추가"
        style={{
          ...cellBase,
          backgroundColor: 'transparent',
          border: `1.5px dashed ${t.border}`,
          color: t.accent,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 8.5, color: t.textMuted }}>세부</span>
      </button>
    );
  }
  const done = !hasActions && cell.is_done;
  return (
    <button
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onEdit(); }}
      style={{
        ...cellBase,
        backgroundColor: done ? t.success + '22' : t.accentSoft,
        color: done ? t.textMuted : t.text,
        border: `1px solid ${done ? t.success + '66' : 'transparent'}`,
      }}
    >
      <span style={{
        fontWeight: 700, fontSize: 11.5, lineHeight: 1.15,
        textDecoration: done ? 'line-through' : 'none',
        ...clamp2,
      }}>
        {cell.content}
      </span>
      {hasActions ? (
        <span style={{ width: '74%', height: 4, borderRadius: 999, backgroundColor: '#ffffff80', overflow: 'hidden', display: 'block' }}>
          <b style={{ display: 'block', height: '100%', width: `${pct}%`, backgroundColor: t.success }} />
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 14, height: 14, borderRadius: 999,
            border: `1.5px solid ${done ? t.success : t.accent}`,
            backgroundColor: done ? t.success : 'transparent',
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{done ? '✓' : ''}</span>
      )}
    </button>
  );
}

function SubCenterPCCell({ name, pct, t, onClick }: {
  name: string; pct: number; t: ReturnType<typeof useTheme>['t']; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...cellBase,
        backgroundColor: t.accentLight,
        color: t.text,
        border: '1px solid transparent',
      }}
    >
      <span style={{ fontFamily: "'Gaegu', cursive", fontWeight: 700, fontSize: 12, lineHeight: 1.15, ...clamp2 }}>
        {name}
      </span>
      <b style={{ fontFamily: "'DM Serif Display', serif", fontSize: 13, fontWeight: 400, color: t.accent }}>
        {pct}%
      </b>
    </button>
  );
}

function ActionPCCell({ cell, t, onTap, onEdit }: {
  cell: Cell | null;
  t: ReturnType<typeof useTheme>['t'];
  onTap: () => void;
  onEdit: () => void;
}) {
  if (!cell) {
    return (
      <button
        onClick={onTap}
        title="행동 추가"
        style={{
          ...cellBase,
          backgroundColor: 'transparent',
          border: `1.5px dashed ${t.border}`,
          color: t.accent,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 8.5, color: t.textMuted }}>행동</span>
      </button>
    );
  }
  const done = cell.is_done;
  return (
    <button
      onClick={onTap}
      onContextMenu={e => { e.preventDefault(); onEdit(); }}
      style={{
        ...cellBase,
        backgroundColor: done ? t.success + '22' : t.card,
        border: `1px solid ${done ? t.success + '66' : t.borderLight}`,
        color: done ? t.textMuted : t.text,
        cursor: 'pointer',
      }}
    >
      <span style={{
        fontSize: 11, lineHeight: 1.15,
        textDecoration: done ? 'line-through' : 'none',
        ...clamp2,
      }}>
        {cell.content}
      </span>
    </button>
  );
}

// ─── PC 편집 모달 ─────────────────────────────────────────────
function EditModalPC({
  t, title, draft, onChange, onSubmit, onClose, allowEmpty, placeholder,
}: {
  t: ReturnType<typeof useTheme>['t'];
  title: string;
  draft: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  allowEmpty: boolean;
  placeholder: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl p-5"
        style={{ backgroundColor: t.card, maxWidth: 420 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 8 }}>{title}</div>
        <textarea
          autoFocus
          value={draft}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
          }}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none"
          style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
        />
        <div className="flex justify-end gap-2 mt-3">
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
        {allowEmpty && (
          <p className="mt-2 text-right" style={{ fontSize: 11, color: t.textMuted }}>
            내용을 비우고 저장하면 셀이 삭제됩니다
          </p>
        )}
      </div>
    </div>
  );
}
