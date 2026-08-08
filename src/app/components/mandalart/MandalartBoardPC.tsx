import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { usePlanner } from '../../store';
import { computeProgress } from './MandalartView';
import { SendCellModal } from './SendCellModal';
import { inputBg, withAlpha } from '../../styles/haonStyles';
import { mandalartColor, type MandalartColorKey } from '../../styles/mandalartColors';
import { MandalartColorPicker } from './MandalartColorPicker';
import type { Cell } from './MandalartBoardMobile';
import type { Notify } from '../culture/CultureToast';

// 채워진 셀이 캔버스 위로 떠오르는 소프트 리프트 그림자(빈 셀은 투명 → 명암 역전).
const CELL_LIFT = '0 2px 8px rgba(120,90,160,0.10)';
// 8칸 점 인디케이터 (세부 완료 수). done 개가 채워짐.
function ActionDots({ done, t }: { done: number; t: ReturnType<typeof useTheme>['t'] }) {
  return (
    <span style={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 4, height: 4, borderRadius: 999,
            backgroundColor: i < done ? t.success : withAlpha(t.textMuted, 0.35),
          }}
        />
      ))}
    </span>
  );
}

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
  const { annualGoals, monthlyGoals, weeklyGoals, todos } = usePlanner();
  const sentCellIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of annualGoals) if (g.mandalartCellId) s.add(g.mandalartCellId);
    for (const g of monthlyGoals) if (g.mandalartCellId) s.add(g.mandalartCellId);
    for (const g of weeklyGoals) if (g.mandalartCellId) s.add(g.mandalartCellId);
    for (const td of todos) if (td.mandalartCellId) s.add(td.mandalartCellId);
    return s;
  }, [annualGoals, monthlyGoals, weeklyGoals, todos]);

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
  const [editColor, setEditColor] = useState<string | null>(null);
  const [sending, setSending] = useState<{ cell: Cell; isAction: boolean } | null>(null);

  const openEdit = (target: EditTarget) => {
    setEditing(target);
    if (target.kind === 'core') setEditDraft(boardTitle);
    else setEditDraft(target.cell?.content ?? '');
    setEditColor(target.kind === 'sub' ? (target.cell?.color ?? null) : null);
  };
  const closeEdit = () => { setEditing(null); setEditDraft(''); setEditColor(null); };

  const submitEdit = async () => {
    if (!editing) return;
    const next = editDraft.trim();
    if (editing.kind === 'core') {
      if (next && next !== boardTitle) { onRenameBoard(next); onNotify('저장되었습니다', 'success'); }
      closeEdit(); return;
    }
    const parentId = editing.kind === 'sub' ? null : editing.parentId;
    const isSub = editing.kind === 'sub';
    if (editing.cell) {
      if (!next) { await db.mandalartCells.delete(editing.cell.id); onNotify('삭제되었습니다', 'success'); }
      else {
        const patch: { content?: string; color?: string | null } = {};
        if (next !== editing.cell.content) patch.content = next;
        if (isSub && editColor !== (editing.cell.color ?? null)) patch.color = editColor;
        if (Object.keys(patch).length) { await db.mandalartCells.update(editing.cell.id, patch); onNotify('저장되었습니다', 'success'); }
      }
    } else if (next) {
      await db.mandalartCells.upsert({ boardId, parentId, position: editing.position, content: next, color: isSub ? editColor : null });
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
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.surfaceMuted, minWidth: 140 }}>
            <div className="h-full" style={{ width: `${progress.overall}%`, backgroundColor: t.success }} />
          </div>
          <span style={{ fontFamily: t.fontSection, fontSize: 22, color: t.text }}> {/* 툴바 진행률 수치, 섹션 헤더급 */}
            {progress.overall}%
          </span>
        </div>
      </div>

      {/* 9×9 보드: 3×3 블록 grid, 각 블록 내부 3×3 grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, // 블록 간 간격 > 셀 간격(4) — 3×3 블록 계층이 드러나게
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
            const ghostColor = subCell ? mandalartColor(t, subCell.color) : null;
            return (
              <button
                key={blockIdx}
                className="mandalart-ghost"
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
                  color: t.textMuted,
                  // 채워진 leaf 세부는 자기 색을 좌측 바로 살짝 드러내 정체성 유지(빈 셀은 완전 중립)
                  ...(ghostColor ? { boxShadow: `inset 3px 0 0 ${ghostColor.bar}` } : null),
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 300 }}>+</span>
                <span style={{ fontFamily: t.fontDecorative, fontWeight: 700, fontSize: 11, color: t.textMuted }}>
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
                // 블록 배경은 투명 — 라벤더 wash 제거(명암 역전의 핵심). 중심 블록만 은은한 코랄 링.
                backgroundColor: 'transparent',
                boxShadow: isCenterBlock ? `0 0 0 2px ${withAlpha(t.accent, 0.33)}` : 'none',
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
                      sent={sub ? sentCellIds.has(sub.id) : false}
                      doneCount={sub ? progress.subCounts(sub.id).done : 0}
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
                      colorKey={subCell?.color ?? null}
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
                    sent={action ? sentCellIds.has(action.id) : false}
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
          color={editing.kind === 'sub' ? editColor : undefined}
          onColorChange={editing.kind === 'sub' ? setEditColor : undefined}
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
      style={{
        ...cellBase,
        background: t.primaryGradient ?? t.accent,
        color: '#fff',
        border: 'none',
        boxShadow: t.shadowButton,
      }}
    >
      <span style={{ fontFamily: t.fontDecorative, fontWeight: 700, fontSize: 12, lineHeight: 1.15, ...clamp2 }}>
        {title}
      </span>
      <b style={{ fontFamily: t.fontNumeric, fontSize: 15, fontWeight: 400 }}>{pct}%</b>
    </button>
  );
}

function SubPCCell({ cell, sent, doneCount, hasActions, t, onClick, onEdit }: {
  cell: Cell | null; sent: boolean; doneCount: number; hasActions: boolean;
  t: ReturnType<typeof useTheme>['t']; onClick: () => void; onEdit: () => void;
}) {
  if (!cell) {
    // 빈 셀(ghost) — 투명 + 중립 점선 + 뮤트 +. 배경으로 물러남(hover 시에만 살짝 드러남).
    return (
      <button
        onClick={onClick}
        title="세부 목표 추가"
        className="mandalart-ghost"
        style={{
          ...cellBase,
          backgroundColor: 'transparent',
          border: `1.5px dashed ${t.border}`,
          color: t.textMuted,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1 }}>+</span>
        <span style={{ fontSize: 8.5, color: t.textMuted }}>세부</span>
      </button>
    );
  }
  const done = !hasActions && cell.is_done;
  const c = mandalartColor(t, cell.color);
  return (
    <button
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onEdit(); }}
      style={{
        ...cellBase,
        // 채운 셀 = 흰 솔리드 카드 + 좌측 3px 컬러 액센트 바(inset) + 리프트 그림자. 완료라도 배경 불변.
        backgroundColor: t.card,
        color: done ? t.textMuted : t.text,
        border: `1px solid ${t.border}`,
        boxShadow: `inset 3px 0 0 ${c.bar}, ${CELL_LIFT}`,
        position: 'relative',
      }}
    >
      {sent && (
        <span
          title="이 칸에서 보낸 항목이 있어요"
          style={{ position: 'absolute', top: 2, left: 6, fontSize: 10, fontWeight: 700, color: t.accent, lineHeight: 1 }}
        >✦</span>
      )}
      <span style={{
        fontWeight: 700, fontSize: 11.5, lineHeight: 1.15,
        textDecoration: done ? 'line-through' : 'none',
        ...clamp2,
      }}>
        {cell.content}
      </span>
      {hasActions ? (
        <ActionDots done={doneCount} t={t} />
      ) : (
        <span
          aria-hidden
          style={{
            width: 14, height: 14, borderRadius: 999,
            border: `1.5px solid ${done ? t.success : t.border}`,
            backgroundColor: done ? t.success : 'transparent',
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{done ? '✓' : ''}</span>
      )}
    </button>
  );
}

function SubCenterPCCell({ name, pct, colorKey, t, onClick }: {
  name: string; pct: number; colorKey: string | null; t: ReturnType<typeof useTheme>['t']; onClick: () => void;
}) {
  const c = mandalartColor(t, colorKey);
  return (
    <button
      onClick={onClick}
      style={{
        ...cellBase,
        // 미러 셀 = 이 세부의 색으로 채움(중앙 블록의 세부가 외곽 블록에서 반복되는 자리임을 표현).
        backgroundColor: c.mid,
        color: t.text,
        border: `1px solid ${withAlpha(c.bar, 0.35)}`,
        boxShadow: CELL_LIFT,
      }}
    >
      <span style={{ fontFamily: t.fontDecorative, fontWeight: 700, fontSize: 12, lineHeight: 1.15, ...clamp2 }}>
        {name}
      </span>
      <b style={{ fontFamily: t.fontNumeric, fontSize: 13, fontWeight: 400, color: t.text }}>
        {pct}%
      </b>
    </button>
  );
}

function ActionPCCell({ cell, sent, t, onTap, onEdit }: {
  cell: Cell | null; sent: boolean;
  t: ReturnType<typeof useTheme>['t'];
  onTap: () => void;
  onEdit: () => void;
}) {
  if (!cell) {
    // 빈 셀(ghost) — 투명 + 중립 점선 + 뮤트.
    return (
      <button
        onClick={onTap}
        title="행동 추가"
        className="mandalart-ghost"
        style={{
          ...cellBase,
          backgroundColor: 'transparent',
          border: `1.5px dashed ${t.border}`,
          color: t.textMuted,
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
        // 세부 셀 = 흰 솔리드 카드. 완료라도 배경 불변(리스트 행 규칙) — 체크+취소선+뮤트로만 표현.
        backgroundColor: t.card,
        border: `1px solid ${t.border}`,
        boxShadow: CELL_LIFT,
        color: done ? t.textMuted : t.text,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {sent && (
        <span
          title="이 칸에서 보낸 항목이 있어요"
          style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, fontWeight: 700, color: t.accent, lineHeight: 1 }}
        >✦</span>
      )}
      {done && (
        <span
          aria-hidden
          style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, fontWeight: 700, color: t.success, lineHeight: 1 }}
        >✓</span>
      )}
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
  t, title, draft, onChange, onSubmit, onClose, allowEmpty, placeholder, onSend, color, onColorChange,
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
  color?: string | null;
  onColorChange?: (key: MandalartColorKey | null) => void;
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
          style={{ fontSize: 14, borderColor: t.border, backgroundColor: inputBg(t), color: t.text }}
        />
        {onColorChange && (
          <div className="mt-3">
            <MandalartColorPicker value={color ?? null} onChange={onColorChange} />
          </div>
        )}
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
