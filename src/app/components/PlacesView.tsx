// 가고싶은 곳 — 페이지 셸 + 상단 탭 4개(뽑기·보관함·지도·기억)
// Stage 2 는 '보관함'만 구현. 나머지는 골격 placeholder (라우팅/탭만).
import { useSearchParams } from 'react-router';
import { useTheme } from '../ThemeContext';
import { LibraryTab } from './places/LibraryTab';

type PlacesTab = 'draw' | 'library' | 'map' | 'memory';

const TABS: { key: PlacesTab; label: string }[] = [
  { key: 'draw',    label: '뽑기' },
  { key: 'library', label: '보관함' },
  { key: 'map',     label: '지도' },
  { key: 'memory',  label: '기억' },
];

function Placeholder({ title, desc }: { title: string; desc: string }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 320, textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontFamily: "'Nanum Pen Script', cursive", fontSize: 24, color: t.textSub }}>{title}</div>
      <div style={{ fontSize: 13, color: t.textMuted, marginTop: 6 }}>{desc}</div>
    </div>
  );
}

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
        {activeTab === 'draw' && <Placeholder title="여기서 오늘 갈 곳을 뽑아요" desc="곧 만들어질 기능이에요 (Stage 4)" />}
        {activeTab === 'map' && <Placeholder title="지도에 핀이 모일 자리" desc="곧 만들어질 기능이에요 (Stage 3)" />}
        {activeTab === 'memory' && <Placeholder title="다녀온 자리가 쌓일 곳" desc="곧 만들어질 기능이에요 (Stage 5)" />}
      </div>
    </div>
  );
}
