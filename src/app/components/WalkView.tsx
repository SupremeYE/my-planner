// 산책 — 페이지 셸 + 탭(자유·코스·내 코스 다시·기록).
// Phase 1: 자유 산책(실시간 추적) + 완료 기록 카드 + 지난 산책 목록/상세.
//  - 코스(Phase 2) / 내 코스 다시(Phase 3) 는 아직 placeholder.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Footprints, Play, ChevronRight } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useWalkData } from './walk/useWalkData';
import { FreeWalkSession, type WalkDraft } from './walk/FreeWalkSession';
import { CourseSetup, type CoursePoint } from './walk/CourseSetup';
import { CourseWalkSession } from './walk/CourseWalkSession';
import { CompletionCard } from './walk/CompletionCard';
import { WalkRecordDetail } from './walk/WalkRecordDetail';
import { RouteGlyph } from './walk/RouteGlyph';
import { formatDistance, formatDuration } from './walk/walkUtils';
import { withAlpha } from './places/placeHelpers';
import type { WalkSession } from '../../lib/db';

type WalkTab = 'free' | 'course' | 'repeat' | 'records';

const TABS: { key: WalkTab; label: string }[] = [
  { key: 'free',    label: '자유' },
  { key: 'course',  label: '코스' },
  { key: 'repeat',  label: '내 코스 다시' },
  { key: 'records', label: '기록' },
];

type Overlay =
  | { kind: 'tracking' }
  | { kind: 'courseTracking'; start: CoursePoint; dest: CoursePoint }
  | { kind: 'completion'; draft: WalkDraft }
  | { kind: 'detail'; session: WalkSession }
  | null;

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: 320 }}>
      <div className="flex items-center justify-center mb-3" style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.accentLight }}>
        <Footprints size={26} style={{ color: t.accent }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{title}</p>
      <p style={{ fontSize: 13, color: t.textSub, marginTop: 6, maxWidth: 300, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

// 지난 산책 한 건 (날짜·거리·시간·미니맵 글리프·사진 썸네일)
function SessionRow({ s, onClick }: { s: WalkSession; onClick: () => void }) {
  const { t } = useTheme();
  const date = s.startedAt ? new Date(s.startedAt) : new Date(s.createdAt);
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full text-left"
      style={{ padding: 10, borderRadius: 14, backgroundColor: t.card, border: `1px solid ${t.border}`, cursor: 'pointer' }}>
      {/* 썸네일 또는 글리프 */}
      {s.photoUrl ? (
        <img src={s.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ flexShrink: 0 }}><RouteGlyph path={s.path} size={56} stroke={t.accent} bg={t.bgSub} strokeWidth={4} /></div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
          {s.routeName ?? date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
        <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 2 }}>
          {formatDistance(s.distanceM)} · {formatDuration(s.durationS)}
          {s.memo ? <span style={{ color: t.textMuted }}> · {s.memo.length > 14 ? s.memo.slice(0, 14) + '…' : s.memo}</span> : null}
        </p>
      </div>
      <ChevronRight size={18} style={{ color: t.textMuted, flexShrink: 0 }} />
    </button>
  );
}

export function WalkView() {
  const { t } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sessions, loading, refresh } = useWalkData();
  const [overlay, setOverlay] = useState<Overlay>(null);

  const tabParam = searchParams.get('tab') as WalkTab | null;
  const activeTab: WalkTab = TABS.some(tb => tb.key === tabParam) ? (tabParam as WalkTab) : 'free';
  const selectTab = (key: WalkTab) => setSearchParams({ tab: key }, { replace: true });

  const recent = sessions.slice(0, 3);

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
              <button key={tb.key} onClick={() => selectTab(tb.key)} className="relative py-3 lg:py-2.5 transition-colors"
                style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? t.accent : t.textSub }}>
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
          <div className="px-4 py-5 lg:px-6 mx-auto" style={{ maxWidth: 560 }}>
            {/* 산책 시작 CTA */}
            <button onClick={() => setOverlay({ kind: 'tracking' })}
              className="flex items-center gap-3 w-full"
              style={{ padding: '18px 20px', borderRadius: 18, border: 'none', backgroundColor: t.accent, color: '#fff', cursor: 'pointer', boxShadow: `0 10px 24px -10px ${withAlpha(t.accent, 0.8)}` }}>
              <span className="flex items-center justify-center" style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: withAlpha('#fff', 0.22), flexShrink: 0 }}>
                <Play size={22} fill="#fff" />
              </span>
              <span style={{ textAlign: 'left' }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 800 }}>자유 산책 시작</span>
                <span style={{ display: 'block', fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>화면을 켜둔 채 걸으면 경로가 그려져요</span>
              </span>
            </button>

            {/* 최근 산책 미리보기 */}
            {recent.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>최근 산책</span>
                  <button onClick={() => selectTab('records')} style={{ fontSize: 12, color: t.accent, background: 'none', border: 'none', cursor: 'pointer' }}>전체 보기</button>
                </div>
                <div className="flex flex-col gap-2">
                  {recent.map(s => <SessionRow key={s.id} s={s} onClick={() => setOverlay({ kind: 'detail', session: s })} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'course' && (
          <CourseSetup onStart={(start, dest) => setOverlay({ kind: 'courseTracking', start, dest })} />
        )}
        {activeTab === 'repeat' && (
          <ComingSoon title="내 코스 다시 — 준비 중" desc="마음에 들었던 산책 경로를 저장해두고 다시 걸을 수 있어요. (Phase 3)" />
        )}

        {activeTab === 'records' && (
          loading ? (
            <p className="px-4 py-6 lg:px-6" style={{ fontSize: 13, color: t.textSub }}>불러오는 중…</p>
          ) : sessions.length === 0 ? (
            <ComingSoon title="아직 산책 기록이 없어요" desc="자유 산책을 시작하면 여기에 걸은 길과 완료 기록 카드가 쌓여요." />
          ) : (
            <div className="px-4 py-4 lg:px-6 mx-auto flex flex-col gap-2" style={{ maxWidth: 560 }}>
              {sessions.map(s => <SessionRow key={s.id} s={s} onClick={() => setOverlay({ kind: 'detail', session: s })} />)}
            </div>
          )
        )}
      </div>

      {/* 오버레이: 추적 → 완료 → 상세 */}
      {overlay?.kind === 'tracking' && (
        <FreeWalkSession
          onCancel={() => setOverlay(null)}
          onFinish={draft => setOverlay({ kind: 'completion', draft })}
        />
      )}
      {overlay?.kind === 'courseTracking' && (
        <CourseWalkSession
          start={overlay.start}
          dest={overlay.dest}
          onCancel={() => setOverlay(null)}
          onFinish={draft => setOverlay({ kind: 'completion', draft })}
        />
      )}
      {overlay?.kind === 'completion' && (
        <CompletionCard
          draft={overlay.draft}
          onDiscard={() => setOverlay(null)}
          onSaved={async () => { setOverlay(null); await refresh(); selectTab('records'); }}
        />
      )}
      {overlay?.kind === 'detail' && (
        <WalkRecordDetail
          session={sessions.find(s => s.id === overlay.session.id) ?? overlay.session}
          onClose={() => setOverlay(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
