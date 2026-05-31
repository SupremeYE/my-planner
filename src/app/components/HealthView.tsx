import { useSearchParams } from 'react-router';
import { useTheme } from '../ThemeContext';
import { SleepSection, PeriodSection } from './SelfCareView';

type HealthTab = 'sleep' | 'condition' | 'weight' | 'period';

const TABS: { key: HealthTab; label: string }[] = [
  { key: 'sleep',     label: '수면' },
  { key: 'condition', label: '컨디션' },
  { key: 'weight',    label: '몸무게' },
  { key: 'period',    label: '생리' },
];

function ComingSoon({ label }: { label: string }) {
  const { t } = useTheme();
  return (
    <div
      className="rounded-2xl py-16 flex flex-col items-center justify-center"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
    >
      <span style={{ fontSize: 32 }}>🛠️</span>
      <p style={{ fontSize: 14, color: t.textMuted, marginTop: 12 }}>
        {label} 기능은 준비 중입니다
      </p>
    </div>
  );
}

export function HealthView() {
  const { t } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as HealthTab | null;
  const activeTab: HealthTab = TABS.some(tb => tb.key === tabParam) ? (tabParam as HealthTab) : 'sleep';

  const selectTab = (key: HealthTab) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      {/* 페이지 헤더 */}
      <div className="px-4 pt-5 pb-3 lg:px-6 lg:pt-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text }}>건강</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
          수면, 컨디션, 몸무게, 생리 등 신체 상태를 기록하세요
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div
        className="px-4 lg:px-6"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <div className="grid grid-cols-4 lg:flex lg:gap-6">
          {TABS.map(tb => {
            const active = activeTab === tb.key;
            return (
              <button
                key={tb.key}
                onClick={() => selectTab(tb.key)}
                className="relative py-3 lg:py-2.5 transition-colors"
                style={{
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? t.accent : t.textSub,
                }}
              >
                {tb.label}
                <span
                  className="absolute left-0 right-0 bottom-0"
                  style={{
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: active ? t.accent : 'transparent',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="px-4 pt-4 pb-8 lg:px-6">
        {activeTab === 'sleep' && <SleepSection />}
        {activeTab === 'condition' && <ComingSoon label="컨디션" />}
        {activeTab === 'weight' && <ComingSoon label="몸무게" />}
        {activeTab === 'period' && <PeriodSection />}
      </div>
    </div>
  );
}
