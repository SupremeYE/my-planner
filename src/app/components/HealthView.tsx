import { useSearchParams } from 'react-router';
import { useTheme } from '../ThemeContext';
import { isHaon, canvasStyle } from '../styles/haonStyles';
import { SleepSection, PeriodSection } from './SelfCareView';
import { WeightTab } from './WeightTab';
import { ConditionTab } from './ConditionTab';
import { WorkoutTab } from './workout/WorkoutTab';

type HealthTab = 'sleep' | 'condition' | 'weight' | 'period' | 'workout';

const TABS: { key: HealthTab; label: string }[] = [
  { key: 'sleep',     label: '수면' },
  { key: 'condition', label: '컨디션' },
  { key: 'weight',    label: '몸무게' },
  { key: 'period',    label: '생리' },
  { key: 'workout',   label: '운동' },
];

export function HealthView() {
  const { t } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as HealthTab | null;
  const activeTab: HealthTab = TABS.some(tb => tb.key === tabParam) ? (tabParam as HealthTab) : 'sleep';

  const selectTab = (key: HealthTab) => {
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <div className="h-full overflow-y-auto" style={isHaon(t) ? canvasStyle(t) : { backgroundColor: t.bg }}>
      {/* 페이지 헤더 */}
      <div className="px-4 pt-5 pb-3 lg:px-6 lg:pt-6">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: t.fontPageTitle }}>건강</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
          수면, 컨디션, 몸무게, 생리, 운동 등 신체 상태를 기록하세요
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div
        className="px-4 lg:px-6"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <div className="grid grid-cols-5 lg:flex lg:gap-6">
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
        {activeTab === 'condition' && <ConditionTab />}
        {activeTab === 'weight' && <WeightTab />}
        {activeTab === 'period' && <PeriodSection />}
        {activeTab === 'workout' && <WorkoutTab />}
      </div>
    </div>
  );
}
