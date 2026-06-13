// 경로 미니맵 글리프 — path 좌표를 바운딩박스로 정규화한 SVG 폴리라인.
// 지도 타일 없이 "걸은 모양"만 가볍게 그린다(아날로그 느낌). 카드/목록/실시간 폴백 공용.
import type { WalkPoint } from '../../../lib/db';

interface Props {
  path: WalkPoint[];
  size?: number;          // px (정사각 뷰포트)
  stroke: string;         // 토큰 색(코랄 등)
  bg?: string;            // 카드 톤 배경(없으면 투명)
  strokeWidth?: number;
  showEndpoints?: boolean; // 시작(채움)·끝(테두리) 점 표시
}

// 등거리 원통도법(작은 영역) — lng 는 위도에 따라 좁아지므로 cos(lat) 보정.
// 종횡비를 유지하며 viewBox(100×100) 안에 여백을 두고 가운데 맞춤.
function project(path: WalkPoint[]): { pts: { x: number; y: number }[]; ok: boolean } {
  const valid = path.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length < 2) return { pts: [], ok: false };
  const lat0 = (valid.reduce((s, p) => s + p.lat, 0) / valid.length) * (Math.PI / 180);
  const k = Math.cos(lat0) || 1;
  const raw = valid.map(p => ({ x: p.lng * k, y: -p.lat })); // y 반전: 북쪽이 위
  const xs = raw.map(p => p.x), ys = raw.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX, spanY = maxY - minY;
  const span = Math.max(spanX, spanY) || 1e-9;
  const pad = 14, inner = 100 - pad * 2;
  // 종횡비 유지: 큰 축 기준 스케일, 작은 축은 가운데 정렬
  const offX = (span - spanX) / 2, offY = (span - spanY) / 2;
  const pts = raw.map(p => ({
    x: pad + ((p.x - minX + offX) / span) * inner,
    y: pad + ((p.y - minY + offY) / span) * inner,
  }));
  return { pts, ok: true };
}

export function RouteGlyph({ path, size = 120, stroke, bg, strokeWidth = 3.2, showEndpoints = true }: Props) {
  const { pts, ok } = project(path);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', borderRadius: 12, background: bg ?? 'transparent' }}>
      {ok ? (
        <>
          <polyline
            points={pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {showEndpoints && (
            <>
              <circle cx={pts[0].x} cy={pts[0].y} r={strokeWidth * 1.3} fill={stroke} />
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={strokeWidth * 1.3} fill={bg ?? '#fff'} stroke={stroke} strokeWidth={strokeWidth * 0.7} />
            </>
          )}
        </>
      ) : (
        // 좌표가 부족하면 점 하나(혹은 빈 글리프)
        <circle cx="50" cy="50" r={strokeWidth * 1.6} fill={stroke} opacity={0.55} />
      )}
    </svg>
  );
}
