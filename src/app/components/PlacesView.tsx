// 가고싶은 곳 — 페이지 셸 + 상단 탭 4개(뽑기·보관함·지도·기억). v1 4탭 전부 구현.
import { useSearchParams } from 'react-router';
import { useTheme } from '../ThemeContext';
import { LibraryTab } from './places/LibraryTab';
import { MapTab } from './places/MapTab';
import { DrawTab } from './places/DrawTab';
import { MemoryTab } from './places/MemoryTab';

type PlacesTab = 'draw' | 'library' | 'map' | 'memory';

const TABS: { key: PlacesTab; label: string }[] = [
  { key: 'draw',    label: '뽑기' },
  { key: 'library', label: '보관함' },
  { key: 'map',     label: '지도' },
  { key: 'memory',  label: '기억' },
];

export function PlacesView() {
  const { t } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as PlacesTab | null;
  const activeTab: PlacesTab = TABS.some(tb => tb.key === tabParam) ? (tabParam as PlacesTab) : 'library';

  const selectTab = (key: PlacesTab) => setSearchParams({ tab: key }, { replace: true });

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: t.bg }}>
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3 lg:px-6 lg:pt-6" style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text }}>가고싶은 곳</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
          마음에 담아둔 장소를 모으고, 폴더(테마)로 정리해요
        </p>
      </div>

      {/* 탭 */}
      <div className="px-4 lg:px-6" style={{ borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
        <div className="grid grid-cols-4 lg:flex lg:gap-6">
          {TABS.map(tb => {
            const active = activeTab === tb.key;
            return (
              <button
                key={tb.key}
                onClick={() => selectTab(tb.key)}
                className="relative py-3 lg:py-2.5 transition-colors"
                style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? t.accent : t.textSub }}
              >
                {tb.label}
                <span className="absolute left-0 right-0 bottom-0" style={{ height: 2, borderRadius: 2, backgroundColor: active ? t.accent : 'transparent' }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        {activeTab === 'library' && <LibraryTab />}
        {activeTab === 'map' && <MapTab />}
        {activeTab === 'draw' && <DrawTab />}
        {activeTab === 'memory' && <MemoryTab />}
      </div>
    </div>
  );
}
