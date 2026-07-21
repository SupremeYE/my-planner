import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import ConfirmModal from '../ConfirmModal';
import { MandalartBoardMobile } from './MandalartBoardMobile';
import { MandalartBoardPC } from './MandalartBoardPC';
import { useToasts, ToastHost } from '../culture/CultureToast';

type Board = { id: string; title: string; sort_order: number; created_at: string };
type Cell = {
  id: string; board_id: string; parent_id: string | null;
  position: number; content: string; is_done: boolean;
  color: string | null;   // 팔레트 키('lilac'|…) | null(미지정=lilac). 소비는 Stage 3~5.
  created_at: string;
};

export interface MandalartProgress {
  overall: number;
  subPct: (subId: string) => number;
  subHasActions: (subId: string) => boolean;
}

export function computeProgress(cells: Cell[]): MandalartProgress {
  const subs = cells.filter(c => c.parent_id === null);
  let total = 0;
  let done = 0;
  // 자식 있는 세부 = 자식 행동의 (done,total). 자식 없는 leaf 세부 = (is_done?1:0, 1).
  const perSub = new Map<string, { done: number; total: number; hasActions: boolean }>();
  for (const sub of subs) {
    const actions = cells.filter(c => c.parent_id === sub.id);
    if (actions.length > 0) {
      const t = actions.length;
      const d = actions.filter(a => a.is_done).length;
      perSub.set(sub.id, { done: d, total: t, hasActions: true });
      total += t; done += d;
    } else {
      const d = sub.is_done ? 1 : 0;
      perSub.set(sub.id, { done: d, total: 1, hasActions: false });
      total += 1; done += d;
    }
  }
  return {
    overall: total ? Math.round((done / total) * 100) : 0,
    subPct: (subId) => {
      const e = perSub.get(subId);
      if (!e || e.total === 0) return 0;
      return Math.round((e.done / e.total) * 100);
    },
    subHasActions: (subId) => perSub.get(subId)?.hasActions ?? false,
  };
}

export function MandalartView() {
  const { t } = useTheme();
  const { toasts, notify } = useToasts();

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refreshBoards = useCallback(async () => {
    const list = await db.mandalartBoards.fetchAll();
    setBoards(list);
    setActiveBoardId(prev => {
      if (prev && list.some(b => b.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, []);

  const refreshCells = useCallback(async () => {
    if (!activeBoardId) { setCells([]); return; }
    const list = await db.mandalartCells.fetchByBoard(activeBoardId);
    setCells(list);
  }, [activeBoardId]);

  useEffect(() => { refreshBoards(); }, [refreshBoards]);
  useEffect(() => { refreshCells(); }, [refreshCells]);
  useRealtimeSync('mandalart_boards', refreshBoards);
  useRealtimeSync('mandalart_cells', refreshCells);

  const activeBoard = useMemo(
    () => boards.find(b => b.id === activeBoardId) ?? null,
    [boards, activeBoardId],
  );

  // 새 보드 만들기 — 인라인 입력 진입 (window.prompt 미사용: 임베드 환경에서 차단될 수 있음)
  const startCreate = () => {
    setTitleDraft('새 만다라트');
    setCreating(true);
    setRenaming(false);
    setShowBoardMenu(false);
  };

  const commitCreate = async () => {
    const title = titleDraft.trim() || '새 만다라트';
    const created = await db.mandalartBoards.create(title, boards.length);
    setCreating(false);
    if (created) {
      setActiveBoardId(created.id);
      await refreshBoards();
      notify('보드가 추가되었습니다', 'success');
    } else {
      notify('보드 추가에 실패했습니다', 'error');
    }
  };

  const startRename = () => {
    if (!activeBoard) return;
    setTitleDraft(activeBoard.title);
    setRenaming(true);
    setCreating(false);
    setShowBoardMenu(false);
  };

  const commitRename = async () => {
    if (!activeBoard) return;
    const next = titleDraft.trim();
    if (next && next !== activeBoard.title) {
      await db.mandalartBoards.rename(activeBoard.id, next);
      await refreshBoards();
      notify('이름이 변경되었습니다', 'success');
    }
    setRenaming(false);
  };

  const handleDelete = async () => {
    if (!activeBoard) return;
    await db.mandalartBoards.delete(activeBoard.id);
    setDeleteOpen(false);
    setActiveBoardId(null);
    // refreshBoards 는 realtime 으로 트리거됨, 즉시 fallback:
    await refreshBoards();
    notify('보드가 삭제되었습니다', 'success');
  };

  return (
    <div className="px-4 lg:px-8 pt-4 pb-10" style={{ backgroundColor: t.bg, minHeight: '100%' }}>
      {/* 보드 선택 + 액션 */}
      <div className="flex items-center gap-2 mb-4 relative">
        {(renaming || creating) ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') creating ? commitCreate() : commitRename();
                if (e.key === 'Escape') { setRenaming(false); setCreating(false); }
              }}
              placeholder={creating ? '새 보드 이름' : '보드 이름'}
              className="flex-1 px-3 py-2 rounded-xl outline-none border"
              style={{
                fontFamily: t.fontBody,
                fontSize: 16, fontWeight: 600,
                backgroundColor: t.card, color: t.text, borderColor: t.accent,
              }}
            />
            <button onClick={() => creating ? commitCreate() : commitRename()} className="p-2 rounded-xl" style={{ backgroundColor: t.accent, color: '#fff' }}>
              <Check size={16} />
            </button>
            <button onClick={() => { setRenaming(false); setCreating(false); }} className="p-2 rounded-xl" style={{ backgroundColor: t.bgSub, color: t.textMuted }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowBoardMenu(s => !s)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                fontFamily: t.fontLabel,
                fontSize: 16, fontWeight: 600, color: t.text,
                backgroundColor: t.card, border: `1px solid ${t.borderLight}`,
                maxWidth: '100%',
              }}
            >
              <span className="truncate" style={{ maxWidth: 240 }}>
                {activeBoard ? activeBoard.title : '보드 없음'}
              </span>
              <ChevronDown size={14} style={{ color: t.textMuted }} />
            </button>

            {activeBoard && (
              <button onClick={startRename} className="p-2 rounded-xl" style={{ color: t.textMuted }} title="이름 변경">
                <Pencil size={14} />
              </button>
            )}
            <button onClick={startCreate} className="p-2 rounded-xl ml-auto"
              style={{ backgroundColor: t.accent, color: '#fff' }} title="새 보드">
              <Plus size={14} />
            </button>
            {activeBoard && (
              <button onClick={() => setDeleteOpen(true)} className="p-2 rounded-xl" style={{ color: t.danger }} title="보드 삭제">
                <Trash2 size={14} />
              </button>
            )}
          </>
        )}

        {showBoardMenu && !renaming && (
          <div
            className="absolute left-0 top-full mt-1 rounded-xl overflow-hidden z-20"
            style={{
              backgroundColor: t.card,
              border: `1px solid ${t.borderLight}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              minWidth: 220,
            }}
          >
            {boards.map(b => (
              <button
                key={b.id}
                onClick={() => { setActiveBoardId(b.id); setShowBoardMenu(false); }}
                className="w-full text-left px-3 py-2 flex items-center justify-between"
                style={{
                  fontSize: 14,
                  color: b.id === activeBoardId ? t.accent : t.text,
                  backgroundColor: b.id === activeBoardId ? t.accentLight : 'transparent',
                }}
              >
                <span className="truncate">{b.title || '제목 없음'}</span>
                {b.id === activeBoardId && <Check size={14} />}
              </button>
            ))}
            <button
              onClick={startCreate}
              className="w-full text-left px-3 py-2 flex items-center gap-2"
              style={{ fontSize: 13, color: t.accent, borderTop: `1px solid ${t.borderLight}` }}
            >
              <Plus size={12} /> 새 보드 추가
            </button>
          </div>
        )}
      </div>

      {/* 모바일: 드릴다운 3×3 */}
      {activeBoard ? (
        <>
          <div className="lg:hidden">
            <MandalartBoardMobile
              boardId={activeBoard.id}
              boardTitle={activeBoard.title}
              cells={cells}
              onMutate={refreshCells}
              onNotify={notify}
              onRenameBoard={(next) => db.mandalartBoards.rename(activeBoard.id, next).then(refreshBoards)}
            />
          </div>
          {/* PC: 9×9 클래식 */}
          <div className="hidden lg:block">
            <MandalartBoardPC
              boardId={activeBoard.id}
              boardTitle={activeBoard.title}
              cells={cells}
              onMutate={refreshCells}
              onNotify={notify}
              onRenameBoard={(next) => db.mandalartBoards.rename(activeBoard.id, next).then(refreshBoards)}
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          <p style={{ fontSize: 13, color: t.textMuted }}>보드를 추가해 시작하세요</p>
        </div>
      )}

      {deleteOpen && (
        <ConfirmModal
          message="보드 삭제"
          description={`"${activeBoard?.title ?? ''}" 보드와 모든 셀이 삭제됩니다. 계속할까요?`}
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}

      <ToastHost toasts={toasts} />
    </div>
  );
}
