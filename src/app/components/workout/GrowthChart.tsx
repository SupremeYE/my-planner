import { useTheme } from '../../ThemeContext';

// 무게 추이 라인 그래프 (의존성 없는 인라인 SVG) — 모바일/PC 공유.
export function GrowthChart({ data }: { data: { date: string; weight: number }[] }) {
  const { t } = useTheme();
  if (data.length < 2) {
    return (
      <div style={{ fontSize: 12.5, color: t.textMuted, padding: '18px 0', textAlign: 'center' }}>
        데이터가 더 쌓이면 그래프가 나타나요.
      </div>
    );
  }
  const W = 300, H = 110, padX = 8, padY = 14;
  const weights = data.map(d => d.weight);
  const min = Math.min(...weights), max = Math.max(...weights);
  const range = max - min || 1;
  const stepX = (W - padX * 2) / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (d.weight - min) / range) * (H - padY * 2);
    return { x, y, w: d.weight };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="mt-2">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={t.success} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={`${line} L${pts[pts.length - 1].x},${H - padY} L${pts[0].x},${H - padY} Z`} fill={t.success} opacity={0.1} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={t.success} />
        ))}
      </svg>
      <div className="flex justify-between" style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
        <span>{min}kg</span>
        <span style={{ fontWeight: 700, color: t.success }}>최고 {max}kg</span>
      </div>
    </div>
  );
}
