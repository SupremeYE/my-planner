import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Check, X, Link2, ZoomIn, ZoomOut, Locate,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { MindmapTreeNode, MindmapDir, Scrap } from '../../store';
import { layoutMindmap, type LaidOutNode } from './mindmapLayout';
import ConfirmModal from '../ConfirmModal';
import ScrapLinkSheet from './ScrapLinkSheet';

// 루트 직속 가지에 새 가지를 더할 때 방향을 균형 있게 분배(오른→왼→아래→위 순환).
const ROOT_DIR_CYCLE: MindmapDir[] = ['right', 'left', 'down', 'up'];

// 줌 한계
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.4;
const ZOOM_STEP = 1.25;
const DEFAULT_SCALE = 0.85;

const DIR_BUTTONS: { dir: MindmapDir; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { dir: 'left',  Icon: ArrowLeft },
  { dir: 'up',    Icon: ArrowUp },
  { dir: 'down',  Icon: ArrowDown },
  { dir: 'right', Icon: ArrowRight },
];

interface Props {
  scrapId: string;
  // 칩 탭 → 해당 스크랩 상세로 이동(부모가 여는 스크랩 교체).
  onNavigateScrap?: (scrapId: string) => void;
}

interface Transform { tx: number; ty: number; scale: number; }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 긴 라벨은 노드 폭에 맞춰 말줄임(SVG text 오버플로 방지).
function clampLabel(text: string, w: number): string {
  const maxChars = Math.max(4, Math.floor((w - 20) / 11));
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}
function clampChip(text: string, max = 9): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export default function MindmapTab({ scrapId, onNavigateScrap }: Props) {
  const { t } = useTheme();

  const [tree, setTree] = useState<MindmapTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 노드↔스크랩 연결: nodeId → scrapId[]
  const [links, setLinks] = useState<Map<string, string[]>>(new Map());
  // 연결 시트용 전체 스크랩
  const [allScraps, setAllScraps] = useState<Scrap[]>([]);
  const [linkSheetFor, setLinkSheetFor] = useState<string | null>(null);

  // 라벨 편집
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 삭제 확인
  const [pendingDelete, setPendingDelete] = useState<LaidOutNode | null>(null);

  // ── 팬/줌 ───────────────────────────────────────────────────────────────
  const [tf, setTf] = useState<Transform>({ tx: 0, ty: 0, scale: DEFAULT_SCALE });
  const tfRef = useRef(tf);
  const applyTf = useCallback((next: Transform) => { tfRef.current = next; setTf(next); }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const centeredRef = useRef(false);

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panRef = useRef<{ lastX: number; lastY: number; startX: number; startY: number } | null>(null);
  const pinchRef = useRef<{ prevDist: number } | null>(null);
  const movedRef = useRef(false);

  // ── 로드 ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const [root, linkRows] = await Promise.all([
      db.mindmap.listTree(scrapId),
      db.mindmap.listLinks(scrapId),
    ]);
    setTree(root);
    const m = new Map<string, string[]>();
    linkRows.forEach(({ nodeId, scrapId: sid }) => {
      const arr = m.get(nodeId) ?? [];
      arr.push(sid);
      m.set(nodeId, arr);
    });
    setLinks(m);
  }, [scrapId]);

  // 최초 진입: 루트 보장 후 트리 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await db.mindmap.ensureRoot(scrapId);
      await refresh();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [scrapId, refresh]);

  // 연결 시트용 스크랩 목록 (1회 로드)
  useEffect(() => { db.scraps.listByUser().then(setAllScraps); }, []);
  const scrapById = useMemo(() => new Map(allScraps.map(s => [s.id, s])), [allScraps]);

  // Realtime — 마인드맵 탭 열려 있는 동안만 두 테이블 구독
  useRealtimeSync('mindmap_nodes', refresh);
  useRealtimeSync('mindmap_node_scraps', refresh);

  // ── 컨테이너 크기 측정 ──────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth, h = el.clientHeight;
      sizeRef.current = { w, h };
      setSize({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const recenter = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w === 0) return;
    applyTf({ tx: w / 2, ty: h / 2, scale: DEFAULT_SCALE }); // 루트는 월드 (0,0)에 위치
  }, [applyTf]);

  // 최초 트리 로드 + 크기 확보 시 1회 자동 가운데 정렬
  useEffect(() => {
    if (!centeredRef.current && size.w > 0 && tree) {
      centeredRef.current = true;
      recenter();
    }
  }, [size.w, tree, recenter]);

  // ── 줌 헬퍼 (screen 좌표 기준) ─────────────────────────────────────────
  const zoomAround = useCallback((factor: number, sx: number, sy: number) => {
    const cur = tfRef.current;
    const newScale = clamp(cur.scale * factor, MIN_SCALE, MAX_SCALE);
    const wx = (sx - cur.tx) / cur.scale;
    const wy = (sy - cur.ty) / cur.scale;
    applyTf({ tx: sx - wx * newScale, ty: sy - wy * newScale, scale: newScale });
  }, [applyTf]);

  const zoomButton = (factor: number) => {
    const { w, h } = sizeRef.current;
    zoomAround(factor, w / 2, h / 2);
  };

  // ── 포인터: 팬 + 핀치 줌 ────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    containerRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;
    if (pointers.current.size === 1) {
      panRef.current = { lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY };
      pinchRef.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { prevDist: dist(a, b) };
      panRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = containerRef.current?.getBoundingClientRect();

    if (pointers.current.size >= 2 && pinchRef.current && rect) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      if (pinchRef.current.prevDist > 0) zoomAround(d / pinchRef.current.prevDist, mid.x, mid.y);
      pinchRef.current.prevDist = d;
      movedRef.current = true;
    } else if (panRef.current) {
      const dx = e.clientX - panRef.current.lastX;
      const dy = e.clientY - panRef.current.lastY;
      panRef.current.lastX = e.clientX;
      panRef.current.lastY = e.clientY;
      const cur = tfRef.current;
      applyTf({ ...cur, tx: cur.tx + dx, ty: cur.ty + dy });
      if (Math.hypot(e.clientX - panRef.current.startX, e.clientY - panRef.current.startY) > 5) {
        movedRef.current = true;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      panRef.current = { lastX: p.x, lastY: p.y, startX: p.x, startY: p.y };
    } else if (pointers.current.size === 0) {
      panRef.current = null;
    }
  };

  // ── 레이아웃 계산 ──────────────────────────────────────────────────────
  const layout = useMemo(() => layoutMindmap(tree), [tree]);
  const nodeById = useMemo(() => {
    const m = new Map<string, LaidOutNode>();
    layout.nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [layout]);

  // 트리 메타: nodeId → { parentId, dir } (방향 토글·루트 직속 판별용)
  const nodeMeta = useMemo(() => {
    const m = new Map<string, { parentId: string | null; dir: MindmapDir | null }>();
    const walk = (n: MindmapTreeNode, parentId: string | null) => {
      m.set(n.id, { parentId, dir: n.dir });
      n.children.forEach(c => walk(c, n.id));
    };
    if (tree) walk(tree, null);
    return m;
  }, [tree]);

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;
  const selectedMeta = selectedId ? nodeMeta.get(selectedId) ?? null : null;
  const isRootChild = !!(tree && selectedMeta && selectedMeta.parentId === tree.id);

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

  const handleSetDir = useCallback(async (dir: MindmapDir) => {
    if (!selectedId) return;
    await db.mindmap.updateNode(selectedId, { dir });
    await refresh();
  }, [selectedId, refresh]);

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

  return (
    <div>
      {/* 안내 */}
      <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
        노드를 눌러 선택하고, 빈 곳을 끌어 이동·두 손가락으로 확대하세요.
      </p>

      {/* 캔버스 — 드래그 팬 / 핀치 줌 */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => { if (!movedRef.current) setSelectedId(null); }}
        style={{
          position: 'relative',
          width: '100%',
          height: 380,
          overflow: 'hidden',
          borderRadius: 14,
          border: `1px solid ${t.borderLight}`,
          backgroundColor: t.bgSub,
          backgroundImage: `radial-gradient(${t.borderLight} 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'grab',
        }}
      >
        <svg width={size.w} height={size.h} style={{ display: 'block' }}>
          <g transform={`translate(${tf.tx}, ${tf.ty}) scale(${tf.scale})`}>
            {/* 커넥터(곡선 가지) */}
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

            {/* 노드 + 칩 */}
            {layout.nodes.map(n => {
              const isSel = n.id === selectedId;
              const fill = n.isRoot ? t.accent : t.card;
              const textColor = n.isRoot ? '#fff' : t.text;
              const chips = links.get(n.id) ?? [];
              return (
                <g key={n.id}>
                  {/* 노드 칩 */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); if (!movedRef.current) setSelectedId(n.id); }}
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

                  {/* 🔗 연결 스크랩 칩 — 노드 아래 세로 스택 */}
                  {chips.map((sid, i) => {
                    const title = scrapById.get(sid)?.title || '스크랩';
                    const label = clampChip(title);
                    const cw = Math.min(150, label.length * 9 + 34);
                    const cx = n.x + n.w / 2;
                    const cyTop = n.y + n.h + 6 + i * 22;
                    return (
                      <g
                        key={sid}
                        style={{ cursor: 'pointer' }}
                        onClick={e => {
                          e.stopPropagation();
                          if (!movedRef.current) onNavigateScrap?.(sid);
                        }}
                      >
                        <rect
                          x={cx - cw / 2} y={cyTop} width={cw} height={18}
                          rx={9}
                          fill={t.accentLight}
                          stroke={t.accent}
                          strokeWidth={1}
                          opacity={0.95}
                        />
                        <text
                          x={cx} y={cyTop + 9}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={10}
                          fontWeight={600}
                          fill={t.accent}
                        >
                          🔗 {label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>

        {/* 줌/정렬 컨트롤 */}
        <div
          className="absolute"
          style={{ right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {[
            { key: 'in', Icon: ZoomIn, onClick: () => zoomButton(ZOOM_STEP), label: '확대' },
            { key: 'out', Icon: ZoomOut, onClick: () => zoomButton(1 / ZOOM_STEP), label: '축소' },
            { key: 'center', Icon: Locate, onClick: recenter, label: '가운데' },
          ].map(({ key, Icon, onClick, label }) => (
            <button
              key={key}
              onClick={e => { e.stopPropagation(); onClick(); }}
              onPointerDown={e => e.stopPropagation()}
              aria-label={label}
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: t.card, border: `1px solid ${t.borderLight}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon size={16} color={t.textSub} />
            </button>
          ))}
        </div>
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

      {/* 루트 직속 가지 — 방향 4방 변경 */}
      {selected && !editingId && isRootChild && (
        <div className="flex items-center gap-2 mt-3">
          <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, flex: '0 0 auto' }}>
            이 가지 방향
          </span>
          <div className="flex gap-1.5">
            {DIR_BUTTONS.map(({ dir, Icon }) => {
              const active = selectedMeta?.dir === dir;
              return (
                <button
                  key={dir}
                  onClick={() => handleSetDir(dir)}
                  aria-label={`방향 ${dir}`}
                  style={{
                    width: 36, height: 32, borderRadius: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? t.accent : t.bgSub,
                    border: `1px solid ${active ? t.accent : t.borderLight}`,
                  }}
                >
                  <Icon size={16} color={active ? '#fff' : t.textSub} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 선택 노드 액션 바 */}
      {selected && !editingId && (
        <div className="flex items-center gap-2 mt-3">
          <span
            style={{ fontSize: 12, color: t.textSub, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {selected.isRoot ? '루트' : '선택'}: {selected.text || '…'}
          </span>
          <button
            onClick={handleAddChild}
            aria-label="가지 추가"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 700, color: t.accent,
              backgroundColor: t.accentLight, border: 'none',
              padding: '8px 10px', borderRadius: 999,
            }}
          >
            <Plus size={13} /> 가지
          </button>
          <button
            onClick={() => handleStartEdit(selected)}
            aria-label="이름 수정"
            style={{
              display: 'inline-flex', alignItems: 'center',
              color: t.textSub,
              backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`,
              padding: 8, borderRadius: 999,
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setLinkSheetFor(selected.id)}
            aria-label="스크랩 연결"
            style={{
              display: 'inline-flex', alignItems: 'center',
              color: t.textSub,
              backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`,
              padding: 8, borderRadius: 999,
            }}
          >
            <Link2 size={14} />
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
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 12 }}>
          가운데 루트 노드를 눌러 첫 가지를 더해보세요.
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

      {/* 스크랩 복수 연결 바텀 시트 */}
      {linkSheetFor && (
        <ScrapLinkSheet
          nodeId={linkSheetFor}
          nodeLabel={nodeById.get(linkSheetFor)?.text ?? ''}
          scraps={allScraps}
          initialSelectedIds={links.get(linkSheetFor) ?? []}
          onClose={() => setLinkSheetFor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
