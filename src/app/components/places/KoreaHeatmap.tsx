// 한국 시도 초이플레스(choropleth) — 방문 횟수 색 농도 + 핀치/팬/탭 + 시도 줌.
// 카카오 SDK 아님. KR_PATHS(SVG)만 렌더하고 viewBox 로 줌/팬. 외부 API 0.
import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../ThemeContext';
import { KR_VIEWBOX, KR_PATHS } from './krMap';
import { withAlpha } from './placeHelpers';

interface Props {
  counts: Record<string, number>;
  colorFor: (n: number) => string;
  selected: string | null;
  onSelect: (regionId: string) => void;
}

export function KoreaHeatmap({ counts, colorFor, selected, onSelect }: Props) {
  const { t } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const base = useRef<number[]>(KR_VIEWBOX.split(' ').map(Number));
  const vb = useRef<number[]>(base.current.slice());
  const anim = useRef<number | null>(null);

  const apply = () => svgRef.current?.setAttribute('viewBox', vb.current.join(' '));

  const clamp = () => {
    const b = base.current;
    const r = b[3] / b[2];
    vb.current[2] = Math.max(b[2] / 6, Math.min(b[2], vb.current[2]));
    vb.current[3] = vb.current[2] * r;
    const ox = b[2] * 0.22, oy = b[3] * 0.22;
    vb.current[0] = Math.max(b[0] - ox, Math.min(b[0] + b[2] - vb.current[2] + ox, vb.current[0]));
    vb.current[1] = Math.max(b[1] - oy, Math.min(b[1] + b[3] - vb.current[3] + oy, vb.current[1]));
  };

  const animateTo = (target: number[]) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const start = vb.current.slice();
    const t0 = performance.now();
    const dur = 460;
    const step = (now: number) => {
      let k = Math.min(1, (now - t0) / dur);
      k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
      vb.current = start.map((s, i) => s + (target[i] - s) * k);
      apply();
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };

  // 선택 시도로 줌 / 해제 시 전체보기
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (!selected) { animateTo(base.current.slice()); return; }
    const path = svg.querySelector<SVGPathElement>(`[data-r="${selected}"]`);
    if (!path) return;
    const bb = path.getBBox();
    const pad = Math.max(bb.width, bb.height) * 0.45;
    animateTo([bb.x - pad, bb.y - pad, bb.width + pad * 2, bb.height + pad * 2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // 핀치/팬/탭
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let lastDist = 0, moved = false, downAt = 0;

    const down = (e: PointerEvent) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; downAt = Date.now(); };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const rect = el.getBoundingClientRect();
      const prev = pts.get(e.pointerId)!;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (anim.current) { cancelAnimationFrame(anim.current); anim.current = null; }
      if (pts.size === 1) {
        if (Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y) > 2) moved = true;
        vb.current[0] -= (e.clientX - prev.x) * vb.current[2] / rect.width;
        vb.current[1] -= (e.clientY - prev.y) * vb.current[3] / rect.height;
        clamp(); apply();
      } else if (pts.size >= 2) {
        const a = [...pts.values()];
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        const mx = (a[0].x + a[1].x) / 2 - rect.left, my = (a[0].y + a[1].y) / 2 - rect.top;
        if (lastDist) {
          const f = lastDist / d;
          const mxs = vb.current[0] + mx / rect.width * vb.current[2];
          const mys = vb.current[1] + my / rect.height * vb.current[3];
          vb.current[2] *= f; clamp();
          vb.current[0] = mxs - mx / rect.width * vb.current[2];
          vb.current[1] = mys - my / rect.height * vb.current[3];
          clamp(); apply();
        }
        lastDist = d; moved = true;
      }
    };
    const up = (e: PointerEvent) => {
      const wasQuick = !moved && Date.now() - downAt < 400;
      pts.delete(e.pointerId);
      if (pts.size < 2) lastDist = 0;
      if (pts.size === 0 && wasQuick) {
        const target = (e.target as Element)?.closest?.('path');
        const id = target?.getAttribute('data-r');
        if (id) onSelect(id);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const f = e.deltaY > 0 ? 1.12 : 0.89;
      const mxs = vb.current[0] + mx / rect.width * vb.current[2];
      const mys = vb.current[1] + my / rect.height * vb.current[3];
      vb.current[2] *= f; clamp();
      vb.current[0] = mxs - mx / rect.width * vb.current[2];
      vb.current[1] = mys - my / rect.height * vb.current[3];
      clamp(); apply();
    };

    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg ref={svgRef} viewBox={KR_VIEWBOX} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}>
      {Object.entries(KR_PATHS).map(([id, d]) => {
        const isSel = selected === id;
        const dim = selected && !isSel;
        return (
          <path
            key={id}
            data-r={id}
            d={d}
            fill={colorFor(counts[id] ?? 0)}
            stroke={isSel ? t.text : withAlpha(t.text, 0.18)}
            strokeWidth={isSel ? 1.4 : 0.6}
            style={{ opacity: dim ? 0.4 : 1, transition: 'fill .3s, opacity .2s', cursor: 'pointer' }}
          />
        );
      })}
    </svg>
  );
}
