import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, CornerDownRight } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { MindmapTreeNode, MindmapDir } from '../../store';
import { layoutMindmap, type LaidOutNode } from './mindmapLayout';
import ConfirmModal from '../ConfirmModal';

// 루트 직속 가지에 새 가지를 더할 때 방향을 균형 있게 분배(오른→왼→아래→위 순환).
const ROOT_DIR_CYCLE: MindmapDir[] = ['right', 'left', 'down', 'up'];

interface Props {
  scrapId: string;
}

// 긴 라벨은 노드 폭에 맞춰 말줄임(SVG text 오버플로 방지).
function clampLabel(text: string, w: number): string {
  const maxChars = Math.max(4, Math.floor((w - 20) / 11));
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

export default function MindmapTab({ scrapId }: Props) {
  const { t } = useTheme();

  const [tree, setTree] = useState<MindmapTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 라벨 편집
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 삭제 확인
  const [pendingDelete, setPendingDelete] = useState<LaidOutNode | null>(null);

  // ── 로드 ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const root = await db.mindmap.listTree(scrapId);
    setTree(root);
  }, [scrapId]);

  // 최초 진입: 루트 보장 후 트리 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await db.mindmap.ensureRoot(scrapId);
      const root = await db.mindmap.listTree(scrapId);
      if (alive) { setTree(root); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [scrapId]);

  // Realtime — 마인드맵 탭 열려 있는 동안만 두 테이블 구독
  useRealtimeSync('mindmap_nodes', refresh);
  useRealtimeSync('mindmap_node_scraps', refresh);

  // ── 레이아웃 계산 ──────────────────────────────────────────────────────
  const layout = useMemo(() => layoutMindmap(tree), [tree]);
  const nodeById = useMemo(() => {
    const m = new Map<string, LaidOutNode>();
    layout.nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [layout]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;

  // 루트 직속 자식 수(다음 가지 방향 산출용)
  const rootChildCount = tree?.children.length ?? 0;

  // ── CRUD ───────────────────────────────────────────────────────────────
  const handleAddChild = useCallback(async () => {
    if (!selectedId || !tree) return;
    const isRoot = selectedId === tree.id;
    const dir = isRoot ? ROOT_DIR_CYCLE[rootChildCount % ROOT_DIR_CYCLE.length] : undefined;
    const created = await db.mindmap.createNode(selectedId, '새 가지', dir);
    await refresh();
    if (created) {
      // 새로 만든 가지를 바로 선택 + 편집 모드로
      setSelectedId(created.id);
      setEditingId(created.id);
      setEditText('새 가지');
    }
  }, [selectedId, tree, rootChildCount, refresh]);

  const handleStartEdit = useCallback((node: LaidOutNode) => {
    setEditingId(node.id);
    setEditText(node.text);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const next = editText.trim();
    if (next) await db.mindmap.updateNode(editingId, { text: next });
    setEditingId(null);
    await refresh();
  }, [editingId, editText, refresh]);

  const handleCancelEdit = useCallback(() => setEditingId(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await db.mindmap.deleteNode(pendingDelete.id);
    if (selectedId === pendingDelete.id) setSelectedId(null);
    setPendingDelete(null);
    await refresh();
  }, [pendingDelete, selectedId, refresh]);

  // 편집 진입 시 인풋 포커스
  useEffect(() => {
    if (editingId) requestAnimationFrame(() => editInputRef.current?.focus());
  }, [editingId]);

  // ── 렌더 ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: t.textMuted, fontSize: 12 }}>
        마인드맵 불러오는 중…
      </div>
    );
  }

  const { bounds } = layout;

  return (
    <div>
      {/* 안내 */}
      <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
        노드를 눌러 선택하고, 아래 도구로 가지를 더하거나 이름을 바꿔보세요.
      </p>

      {/* 캔버스 — 스크롤 가능 */}
      <div
        onClick={() => setSelectedId(null)}
        style={{
          position: 'relative',
          width: '100%',
          height: 360,
          overflow: 'auto',
          borderRadius: 14,
          border: `1px solid ${t.borderLight}`,
          backgroundColor: t.bgSub,
          backgroundImage: `radial-gradient(${t.borderLight} 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      >
        <svg
          width={Math.max(bounds.width, 1)}
          height={Math.max(bounds.height, 1)}
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          style={{ display: 'block', minWidth: '100%', minHeight: '100%' }}
        >
          {/* 커넥터 */}
          {layout.connectors.map(c => (
            <path
              key={c.id}
              d={c.path}
              fill="none"
              stroke={t.accent}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.55}
            />
          ))}

          {/* 노드 */}
          {layout.nodes.map(n => {
            const isSel = n.id === selectedId;
            const fill = n.isRoot ? t.accent : t.card;
            const textColor = n.isRoot ? '#fff' : t.text;
            return (
              <g
                key={n.id}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); setSelectedId(n.id); }}
                onDoubleClick={e => { e.stopPropagation(); setSelectedId(n.id); handleStartEdit(n); }}
              >
                <rect
                  x={n.x} y={n.y} width={n.w} height={n.h}
                  rx={n.isRoot ? 20 : 12}
                  fill={fill}
                  stroke={isSel ? t.text : (n.isRoot ? t.accent : t.borderLight)}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
                <text
                  x={n.x + n.w / 2}
                  y={n.y + n.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--font-nanum-pen)"
                  fontSize={n.isRoot ? 19 : 17}
                  fill={textColor}
                >
                  {clampLabel(n.text || '…', n.w)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 라벨 편집 바 */}
      {editingId && (
        <div className="flex items-center gap-2 mt-3">
          <input
            ref={editInputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
              if (e.key === 'Escape') handleCancelEdit();
            }}
            placeholder="노드 이름"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              backgroundColor: t.bgSub,
              color: t.text,
              fontSize: 16,
              fontFamily: 'var(--font-nanum-pen)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSaveEdit}
            style={{
              backgroundColor: t.success, color: '#fff', borderRadius: 10,
              padding: '0 14px', alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13, fontWeight: 700, border: 'none',
            }}
          >
            <Check size={14} /> 저장
          </button>
          <button
            onClick={handleCancelEdit}
            aria-label="편집 취소"
            style={{ color: t.textMuted, padding: 8, alignSelf: 'stretch' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 선택 노드 도구 모음 */}
      {selected && !editingId && (
        <div className="flex items-center gap-2 mt-3">
          <span
            style={{ fontSize: 12, color: t.textSub, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {selected.isRoot ? '루트' : '선택'}: {selected.text || '…'}
          </span>
          <button
            onClick={handleAddChild}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 700, color: t.accent,
              backgroundColor: t.accentLight, border: 'none',
              padding: '8px 12px', borderRadius: 999,
            }}
          >
            <Plus size={13} /> 가지 추가
          </button>
          <button
            onClick={() => handleStartEdit(selected)}
            aria-label="이름 수정"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 700, color: t.textSub,
              backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`,
              padding: '8px 12px', borderRadius: 999,
            }}
          >
            <Pencil size={13} /> 이름
          </button>
          {!selected.isRoot && (
            <button
              onClick={() => setPendingDelete(selected)}
              aria-label="가지 삭제"
              style={{
                display: 'inline-flex', alignItems: 'center',
                color: t.danger,
                backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`,
                padding: 8, borderRadius: 999,
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      {/* 선택 없을 때 힌트 */}
      {!selected && !editingId && (
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CornerDownRight size={12} /> 가운데 루트 노드를 눌러 첫 가지를 더해보세요.
        </p>
      )}

      {/* 삭제 확인 — 자식 가지까지 함께 삭제됨 안내 */}
      {pendingDelete && (
        <ConfirmModal
          message="가지를 삭제할까요?"
          description={`"${pendingDelete.text || '이 가지'}" 및 하위 가지가 모두 삭제됩니다.`}
          confirmText="삭제"
          confirmDanger
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
