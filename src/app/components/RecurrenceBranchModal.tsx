import { useTheme } from '../ThemeContext';

type RecurrenceScope = 'this' | 'future' | 'all';

interface Props {
  mode: 'delete' | 'edit';
  onConfirm: (scope: RecurrenceScope) => void;
  onCancel: () => void;
}

export function RecurrenceBranchModal({ mode, onConfirm, onCancel }: Props) {
  const { t } = useTheme();

  const options: { scope: RecurrenceScope; label: string; desc: string }[] = [
    { scope: 'this',   label: '이 일정만',                  desc: '선택한 날짜의 반복만 영향을 받습니다.' },
    { scope: 'future', label: '이 일정 및 이후 모든 일정', desc: '이 날짜부터 반복이 종료됩니다.' },
    { scope: 'all',    label: '모든 반복 일정',             desc: '반복 설정 전체가 삭제·수정됩니다.' },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: t.card, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3">
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>
            🔁 반복 일정 {mode === 'delete' ? '삭제' : '수정'}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            어떤 범위에서 {mode === 'delete' ? '삭제' : '수정'}할까요?
          </div>
        </div>

        {/* 옵션 */}
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {options.map(({ scope, label, desc }) => (
            <button
              key={scope}
              onClick={() => onConfirm(scope)}
              className="w-full text-left rounded-xl px-4 py-3 transition-colors"
              style={{
                backgroundColor: '#F8F4EE',
                border: `1.5px solid ${t.border}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.accentLight ?? '#FDF6EC')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#F8F4EE')}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: scope === 'all' && mode === 'delete' ? '#D4735A' : t.text }}>
                {label}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{desc}</div>
            </button>
          ))}
        </div>

        {/* 취소 */}
        <div className="px-3 pb-4">
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, backgroundColor: 'transparent', border: `1px solid ${t.border}` }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
