// 산책 — 페이지 셸 + 상단 탭(자유·코스·내 코스 다시·기록).
// Phase 0(스캐폴딩): 메뉴/라우팅/데이터 골격만. 각 탭 내용은 후속 단계에서 채운다.
//  - 자유 산책 + 완료 카드 → Phase 1
//  - 코스 산책            → Phase 2
//  - 내 코스 다시          → Phase 3
import { useSearchParams } from 'react-router';
import { Footprints } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useWalkData } from './walk/useWalkData';
import { formatDistance, formatDuration, formatPace } from './walk/walkUtils';

type WalkTab = 'free' | 'course' | 'repeat' | 'records';

const TABS: { key: WalkTab; label: string }[] = [
  { key: 'free',    label: '자유' },
  { key: 'course',  label: '코스' },
  { key: 'repeat',  label: '내 코스 다시' },
  { key: 'records', label: '기록' },
];

// Phase 0 placeholder — 단계별 구현 예정 안내. 데이터 골격(useWalkData)은 이미 살아 있다.
function ComingSoon({ title, desc }: { title: string; desc: string }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: 320 }}>
      <div
        className="flex items-center justify-center mb-3"
        style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.accentLight }}
      >
        <Footprints size={26} style={{ color: t.accent }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{title}</p>
      <p style={{ fontSize: 13, color: t.textSub, marginTop: 6, maxWidth: 300, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

// 완료 기록 탭 — Phase 0 에선 walk_sessions 를 단순 리스트로만 보여준다(카드 디자인은 Phase 1).
function RecordsTab() {
  const { t } = useTheme();
  const { sessions, loading } = useWalkData();

  if (loading) {
    return <p className="px-4 py-6 lg:px-6" style={{ fontSize: 13, color: t.textSub }}>불러오는 중…</p>;
  }
  if (sessions.length === 0) {
    return (
      <ComingSoon
        title="아직 산책 기록이 없어요"
        desc="자유 산책을 시작하면 여기에 걸은 길과 완료 기록 카드가 쌓여요."
      />
    );
  }
  return (
    <div className="px-4 py-4 lg:px-6 flex flex-col gap-2">
      {sessions.map(s => (
        <div
          key={s.id}
          className="flex items-center justify-between"
          style={{ padding: '12px 14px', borderRadius: 14, backgroundColor: t.card, border: `1px solid ${t.border}` }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
              {s.routeName ?? (s.startedAt ? new Date(s.startedAt).toLocaleDateString('ko-KR') : '산책')}
            </p>
            <p style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
              {formatDistance(s.distanceM)} · {formatDuration(s.durationS)} · {formatPace(s.avgPaceSPerKm)}
            </p>
          </div>
          <span style={{ fontSize: 11, color: t.textSub }}>
            {{ free: '자유', course: '코스', repeat: '내 코스' }[s.mode]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WalkView() {
  const { t } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as WalkTab | null;
  const activeTab: WalkTab = TABS.some(tb => tb.key === tabParam) ? (tabParam as WalkTab) : 'free';

  const selectTab = (key: WalkTab) => setSearchParams({ tab: key }, { replace: true });

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: t.bg }}>
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3 lg:px-6 lg:pt-6" style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text }}>산책</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
          걸은 길을 기록하고, 끝낼 때 사진·경로·손글씨로 기록 카드를 남겨요
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
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'free' && (
          <ComingSoon
            title="자유 산책 — 곧 만나요"
            desc="화면을 켜둔 채 걸으면 GPS 로 경로를 그리고, 끝낼 때 사진·손글씨 메모로 기록 카드를 남길 수 있어요. (Phase 1)"
          />
        )}
        {activeTab === 'course' && (
          <ComingSoon
            title="코스 산책 — 준비 중"
            desc="저장한 장소들을 잇는 추천 코스를 따라 걷는 모드예요. (Phase 2)"
          />
        )}
        {activeTab === 'repeat' && (
          <ComingSoon
            title="내 코스 다시 — 준비 중"
            desc="마음에 들었던 산책 경로를 저장해두고 다시 걸을 수 있어요. (Phase 3)"
          />
        )}
        {activeTab === 'records' && <RecordsTab />}
      </div>
    </div>
  );
}
