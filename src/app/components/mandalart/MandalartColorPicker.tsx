import { useTheme } from '../../ThemeContext';
import { withAlpha } from '../../styles/haonStyles';
import {
  MANDALART_COLOR_ORDER, MANDALART_COLOR_LABELS, mandalartColor,
  type MandalartColorKey,
} from '../../styles/mandalartColors';

// 서브목표 색 선택 — 6색 스와치 + '없음'(null). 선택값은 팔레트 키(hex 아님)로 상위에 전달.
// 선택 표시 = 코랄 링(§3 선택 상태 전용색). 편집 모달 안에 인라인 배치(셀 편집 흐름의 일부).
export function MandalartColorPicker({
  value, onChange,
}: {
  value: string | null;
  onChange: (key: MandalartColorKey | null) => void;
}) {
  const { t } = useTheme();
  const ring = (selected: boolean) =>
    selected ? { outline: `2px solid ${t.accent}`, outlineOffset: 2 } : {};
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span style={{ fontSize: 12, color: t.textMuted, marginRight: 2 }}>색</span>
      {/* 없음(미지정) */}
      <button
        type="button"
        onClick={() => onChange(null)}
        title="색 없음"
        className="rounded-full flex items-center justify-center"
        style={{
          width: 24, height: 24,
          background: t.surfaceMuted,
          border: `1px solid ${t.border}`,
          color: t.textMuted, fontSize: 12, lineHeight: 1,
          ...ring(!value),
        }}
      >∅</button>
      {MANDALART_COLOR_ORDER.map(key => {
        const c = mandalartColor(t, key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={MANDALART_COLOR_LABELS[key]}
            className="rounded-full"
            style={{
              width: 24, height: 24,
              background: c.bar,
              border: `1px solid ${withAlpha(c.bar, 0.5)}`,
              ...ring(value === key),
            }}
          />
        );
      })}
    </div>
  );
}
