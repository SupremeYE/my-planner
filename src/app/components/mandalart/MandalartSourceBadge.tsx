import { useTheme } from '../../ThemeContext';

interface Props {
  /** 부모 텍스트 행 옆 작은 칩 형태 */
  size?: 'sm' | 'md';
}

/**
 * 만다라트에서 보내져 만들어진 목표/할일 옆에 붙는 출처 배지.
 * `mandalartCellId` 가 있는 항목에서 렌더한다 (호출부에서 조건 분기).
 */
export function MandalartSourceBadge({ size = 'sm' }: Props) {
  const { t } = useTheme();
  const px = size === 'sm' ? '2px 6px' : '3px 8px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span
      title="만다라트에서 보낸 항목"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: px,
        borderRadius: 999,
        fontSize: fs,
        fontWeight: 700,
        color: t.accent,
        backgroundColor: t.accentLight,
        border: `1px solid ${t.accent}33`,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: fs - 1 }}>✦</span>
      <span>만다라트</span>
    </span>
  );
}
