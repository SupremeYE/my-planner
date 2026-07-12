// 마인드맵 레이아웃 엔진 — Phase 5-0
// 순수 util. 트리 입력 → 각 노드 {x,y,w,h} 좌표 + 부모→자식 cubic bezier 커넥터 반환.
//
// 규칙(첨부 mindmap-mockup.html layout 로직 기준):
//  - 루트 중앙(0,0). 루트 직속 가지의 dir 별로 서브트리를 해당 방향으로 뻗게 한다.
//  - 자식은 부모 dir 을 상속. 좌우=가로 트리(형제는 세로로 stack),
//    상하=세로 트리(형제는 가로로 stack). 간격 여유 있게(겹침 방지).
//  - 커넥터: dir 별 제어점으로 cubic bezier.
//  - 라이브러리 금지, 좌표만 산출(렌더는 커스텀 SVG 가 담당).

import type { MindmapDir, MindmapTreeNode } from '../../store';

export interface LaidOutNode {
  id: string;
  text: string;
  x: number;            // 좌상단
  y: number;
  w: number;
  h: number;
  dir: MindmapDir | null; // 루트는 null, 그 외엔 상속된 실제 방향
  depth: number;
  isRoot: boolean;
}

export interface Connector {
  id: string;           // 자식 노드 id
  dir: MindmapDir;
  path: string;         // SVG path 'M.. C..'
}

export interface LayoutResult {
  nodes: LaidOutNode[];
  connectors: Connector[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

// ── 튜닝 상수 ───────────────────────────────────────────────────────────
const NODE_H = 40;          // 노드 높이(고정)
const MIN_W = 64;           // 최소 폭
const MAX_W = 220;          // 최대 폭(긴 라벨은 말줄임 처리는 렌더 측)
const CHAR_W = 11;          // 글자당 대략 폭(px, 근사값)
const PAD_X = 24;           // 노드 좌우 패딩
const H_LEVEL = 72;         // 가로 트리: 부모→자식 수평 간격
const V_SIBLING = 18;       // 가로 트리: 형제 세로 간격
const V_LEVEL = 64;         // 세로 트리: 부모→자식 수직 간격
const H_SIBLING = 24;       // 세로 트리: 형제 가로 간격
const PADDING = 40;         // viewBox 여백

function isHorizontal(dir: MindmapDir): boolean {
  return dir === 'right' || dir === 'left';
}

function measureWidth(text: string): number {
  const raw = (text || '').length * CHAR_W + PAD_X * 2;
  return Math.max(MIN_W, Math.min(MAX_W, raw));
}

// 서브트리의 "교차 방향" 크기.
//  - 가로(dir left/right): 세로 높이(자식들이 세로로 쌓임).
//  - 세로(dir up/down): 가로 폭(자식들이 가로로 쌓임).
function subtreeExtent(node: MindmapTreeNode, dir: MindmapDir): number {
  const self = isHorizontal(dir) ? NODE_H : measureWidth(node.text);
  if (node.children.length === 0) return self;
  const gap = isHorizontal(dir) ? V_SIBLING : H_SIBLING;
  const childrenTotal =
    node.children.reduce((sum, c) => sum + subtreeExtent(c, dir), 0) +
    gap * (node.children.length - 1);
  return Math.max(self, childrenTotal);
}

// dir 별 부모→자식 cubic bezier path.
function connectorPath(
  parent: LaidOutNode,
  child: LaidOutNode,
  dir: MindmapDir,
): string {
  const pcx = parent.x + parent.w / 2;
  const pcy = parent.y + parent.h / 2;
  const ccx = child.x + child.w / 2;
  const ccy = child.y + child.h / 2;

  if (dir === 'right') {
    const sx = parent.x + parent.w, sy = pcy;
    const ex = child.x, ey = ccy;
    const dx = (ex - sx) * 0.5;
    return `M ${sx} ${sy} C ${sx + dx} ${sy} ${ex - dx} ${ey} ${ex} ${ey}`;
  }
  if (dir === 'left') {
    const sx = parent.x, sy = pcy;
    const ex = child.x + child.w, ey = ccy;
    const dx = (sx - ex) * 0.5;
    return `M ${sx} ${sy} C ${sx - dx} ${sy} ${ex + dx} ${ey} ${ex} ${ey}`;
  }
  if (dir === 'down') {
    const sx = pcx, sy = parent.y + parent.h;
    const ex = ccx, ey = child.y;
    const dy = (ey - sy) * 0.5;
    return `M ${sx} ${sy} C ${sx} ${sy + dy} ${ex} ${ey - dy} ${ex} ${ey}`;
  }
  // up
  const sx = pcx, sy = parent.y;
  const ex = ccx, ey = child.y + child.h;
  const dy = (sy - ey) * 0.5;
  return `M ${sx} ${sy} C ${sx} ${sy - dy} ${ex} ${ey + dy} ${ex} ${ey}`;
}

// 한 노드를 (cx,cy = 노드 중심)에 배치하고, 그 자식들을 dir 방향으로 재귀 배치.
function place(
  node: MindmapTreeNode,
  dir: MindmapDir,
  cx: number,
  cy: number,
  depth: number,
  out: { nodes: LaidOutNode[]; connectors: Connector[] },
): LaidOutNode {
  const w = measureWidth(node.text);
  const laid: LaidOutNode = {
    id: node.id, text: node.text,
    x: cx - w / 2, y: cy - NODE_H / 2, w, h: NODE_H,
    dir, depth, isRoot: false,
  };
  out.nodes.push(laid);
  placeChildren(laid, node.children, dir, depth, out);
  return laid;
}

// 이미 배치된 parent 기준으로 children 을 dir 방향으로 stack 배치.
function placeChildren(
  parent: LaidOutNode,
  children: MindmapTreeNode[],
  dir: MindmapDir,
  depth: number,
  out: { nodes: LaidOutNode[]; connectors: Connector[] },
): void {
  if (children.length === 0) return;
  const pcx = parent.x + parent.w / 2;
  const pcy = parent.y + parent.h / 2;

  if (isHorizontal(dir)) {
    const gap = V_SIBLING;
    const total =
      children.reduce((s, c) => s + subtreeExtent(c, dir), 0) + gap * (children.length - 1);
    let cursor = pcy - total / 2;
    for (const child of children) {
      const ext = subtreeExtent(child, dir);
      const childCy = cursor + ext / 2;
      const childW = measureWidth(child.text);
      const childCx = dir === 'right'
        ? parent.x + parent.w + H_LEVEL + childW / 2
        : parent.x - H_LEVEL - childW / 2;
      const laidChild = place(child, dir, childCx, childCy, depth + 1, out);
      out.connectors.push({ id: child.id, dir, path: connectorPath(parent, laidChild, dir) });
      cursor += ext + gap;
    }
  } else {
    const gap = H_SIBLING;
    const total =
      children.reduce((s, c) => s + subtreeExtent(c, dir), 0) + gap * (children.length - 1);
    let cursor = pcx - total / 2;
    for (const child of children) {
      const ext = subtreeExtent(child, dir);
      const childCx = cursor + ext / 2;
      const childCy = dir === 'down'
        ? parent.y + parent.h + V_LEVEL + NODE_H / 2
        : parent.y - V_LEVEL - NODE_H / 2;
      const laidChild = place(child, dir, childCx, childCy, depth + 1, out);
      out.connectors.push({ id: child.id, dir, path: connectorPath(parent, laidChild, dir) });
      cursor += ext + gap;
    }
  }
}

const DIR_ORDER: MindmapDir[] = ['right', 'left', 'down', 'up'];

// 루트 직속 가지에 dir 이 비어 있으면 균형 있게 자동 분배(right/left 교대 등).
function resolveRootChildDir(child: MindmapTreeNode, index: number): MindmapDir {
  if (child.dir) return child.dir;
  // 기본: 오른쪽/왼쪽 교대 배치(가장 흔한 마인드맵 형태)
  return index % 2 === 0 ? 'right' : 'left';
}

export function layoutMindmap(root: MindmapTreeNode | null): LayoutResult {
  const out: { nodes: LaidOutNode[]; connectors: Connector[] } = { nodes: [], connectors: [] };
  if (!root) {
    return { nodes: [], connectors: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 } };
  }

  // 루트 중앙(0,0)
  const rootW = measureWidth(root.text);
  const rootLaid: LaidOutNode = {
    id: root.id, text: root.text,
    x: -rootW / 2, y: -NODE_H / 2, w: rootW, h: NODE_H,
    dir: null, depth: 0, isRoot: true,
  };
  out.nodes.push(rootLaid);

  // 루트 직속 자식을 dir 그룹으로 묶어 각 방향으로 뻗게 한다.
  const groups: Record<MindmapDir, MindmapTreeNode[]> = { right: [], left: [], up: [], down: [] };
  root.children.forEach((child, i) => {
    groups[resolveRootChildDir(child, i)].push(child);
  });
  for (const dir of DIR_ORDER) {
    placeChildren(rootLaid, groups[dir], dir, 1, out);
  }

  // bounds 산출
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of out.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  minX -= PADDING; minY -= PADDING; maxX += PADDING; maxY += PADDING;

  return {
    nodes: out.nodes,
    connectors: out.connectors,
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}
