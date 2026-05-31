import { useTheme } from '../ThemeContext';

export function HealthView() {
  const { t } = useTheme();

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      {/* 페이지 헤더 */}
      <div className="px-4 pt-5 pb-3 lg:px-6 lg:pt-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text }}>건강</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
          수면, 컨디션, 몸무게, 생리 등 신체 상태를 기록하세요
        </p>
      </div>

      {/* 본문 — 준비 중 placeholder */}
      <div className="px-4 lg:px-6">
        <div
          className="rounded-2xl py-16 flex flex-col items-center justify-center"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
        >
          <span style={{ fontSize: 32 }}>💛</span>
          <p style={{ fontSize: 14, color: t.textMuted, marginTop: 12 }}>준비 중이에요</p>
        </div>
      </div>
    </div>
  );
}
