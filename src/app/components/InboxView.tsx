import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import {
  CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronDown, ChevronRight,
  RefreshCw, Star, Trash2,
} from 'lucide-react';
import { usePlanner, Todo } from '../store';
import { useTheme } from '../ThemeContext';
import { isVirtualTodoId } from '../../lib/recurrenceExpansion';
import { QuickAddInput } from './QuickAddInput';
import ConfirmModal from './ConfirmModal';

/** Inbox 표시 대상: 날짜 미지정 + backlog/cancelled 제외(backlog 는 BacklogView 소관) */
const isInboxCandidate = (t: Todo) =>
  t.date === null && t.status !== 'backlog' && t.status !== 'cancelled' && !isVirtualTodoId(t.id);

const RECURRENCE_LABEL: Record<NonNullable<Todo['recurrenceRule']>, string> = {
  daily: '매일', weekdays: '평일', weekly: '매주', custom: '요일 반복',
};

export function InboxView() {
  const { todos, tags: allTags, projects, updateTodo, deleteTodo } = usePlanner();
  const { t } = useTheme();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const [showDone, setShowDone] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // created_at ASC 로 적재되므로 reverse = 최근 추가가 위 (추후 정렬 토글 여지)
  const { active, done } = useMemo(() => {
    const candidates = todos.filter(isInboxCandidate);
    const activeList = candidates.filter(td => td.status !== 'done').slice().reverse();
    const doneList = candidates.filter(td => td.status === 'done').slice().reverse();
    return { active: activeList, done: doneList };
  }, [todos]);

  const assignDate = (id: string, date: string) => updateTodo(id, { date, status: 'active' });
  const markDone = (id: string) => updateTodo(id, { status: 'done' });
  const markActive = (id: string) => updateTodo(id, { status: 'active' });

  // ── 메타 칩 ──────────────────────────────────────────────────────────────
  const metaChip = (key: string, label: string, color: string, icon?: React.ReactNode) => (
    <span
      key={key}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ fontSize: 11, fontWeight: 600, color, backgroundColor: `${color}1A`, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}
    >
      {icon}{label}
    </span>
  );

  const renderMeta = (td: Todo) => {
    const chips: React.ReactNode[] = [];
    if (td.isTop3) chips.push(metaChip('top3', '중요', t.accent, <Star size={11} fill={t.accent} />));
    if (td.planStart) {
      chips.push(metaChip('time', td.planEnd ? `${td.planStart}~${td.planEnd}` : td.planStart, t.accent));
    }
    if (td.recurrenceRule) {
      chips.push(metaChip('rec', RECURRENCE_LABEL[td.recurrenceRule], t.accent, <RefreshCw size={11} />));
    }
    if (td.projectId) {
      const p = projects.find(pr => pr.id === td.projectId);
      if (p) chips.push(metaChip('proj', p.name, t.accent));
    }
    (td.tags ?? []).forEach(tagId => {
      const tag = allTags.find(tg => tg.id === tagId);
      if (tag) chips.push(metaChip(`tag-${tagId}`, `#${tag.name}`, tag.color));
    });
    return chips;
  };

  // ── triage 액션 버튼 ──────────────────────────────────────────────────────
  const actionBtn = (
    key: string,
    label: React.ReactNode,
    onClick: () => void,
    variant: 'neutral' | 'success' | 'danger' = 'neutral',
  ) => {
    const palette = variant === 'success'
      ? { color: t.success, bg: `${t.success}1A`, border: `${t.success}40` }
      : variant === 'danger'
      ? { color: t.danger, bg: `${t.danger}1A`, border: `${t.danger}40` }
      : { color: t.textSub, bg: t.bgSub, border: t.border };
    return (
      <button
        key={key}
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center gap-1 rounded-lg px-3 min-h-[44px] lg:min-h-0 lg:h-8"
        style={{ fontSize: 12, fontWeight: 600, color: palette.color, backgroundColor: palette.bg, border: `1px solid ${palette.border}` }}
      >
        {label}
      </button>
    );
  };

  const renderCard = (td: Todo, isDone: boolean) => (
    <div
      key={td.id}
      className="rounded-xl p-3 lg:p-3.5 flex flex-col gap-2.5"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-start gap-2.5">
        {/* 체크 동그라미 */}
        <button
          type="button"
          onClick={() => (isDone ? markActive(td.id) : markDone(td.id))}
          className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
          style={{
            width: 22, height: 22,
            border: `2px solid ${isDone ? t.success : t.border}`,
            backgroundColor: isDone ? t.success : 'transparent',
          }}
          aria-label={isDone ? '완료 취소' : '완료'}
        >
          {isDone && <Check size={13} color="#fff" />}
        </button>

        <div className="flex-1 min-w-0">
          <p
            style={{
              fontSize: 14, color: isDone ? t.textMuted : t.text,
              textDecoration: isDone ? 'line-through' : 'none', wordBreak: 'break-word',
            }}
          >
            {td.text}
          </p>
          {renderMeta(td).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{renderMeta(td)}</div>
          )}
        </div>
      </div>

      {/* triage 액션 */}
      {!isDone && (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {actionBtn('today', '오늘', () => assignDate(td.id, todayStr))}
          {actionBtn('tomorrow', '내일', () => assignDate(td.id, tomorrowStr))}
          {/* 날짜 — 네이티브 picker 오버레이 */}
          <label
            className="relative inline-flex items-center justify-center gap-1 rounded-lg px-3 min-h-[44px] lg:min-h-0 lg:h-8 cursor-pointer"
            style={{ fontSize: 12, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
          >
            <CalendarPlus size={13} />날짜
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e => { if (e.target.value) assignDate(td.id, e.target.value); }}
            />
          </label>
          {actionBtn('done', <><Check size={13} />완료</>, () => markDone(td.id), 'success')}
          {actionBtn('del', <Trash2 size={13} />, () => setDeletingId(td.id), 'danger')}
        </div>
      )}
      {isDone && (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {actionBtn('del', <Trash2 size={13} />, () => setDeletingId(td.id), 'danger')}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full mx-auto px-4 lg:px-8 py-5 lg:py-8" style={{ maxWidth: 760 }}>
      {/* 헤더 + 빠른 입력 — 모바일에서 상단 sticky */}
      <div
        className="sticky top-0 z-10 lg:static -mx-4 px-4 lg:mx-0 lg:px-0 pb-3"
        style={{ backgroundColor: t.bg }}
      >
        <header className="pt-1 pb-3">
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text }}>Inbox</h1>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>막 던지고, 한가할 때 비우기</p>
        </header>
        <QuickAddInput defaultDate={null} placeholder="여기에 던지기: 장보기, 보고서 정리 #업무 …" />
      </div>

      {/* 리스트 */}
      <div className="mt-4 space-y-2.5">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div
              className="flex items-center justify-center rounded-full mb-3"
              style={{ width: 56, height: 56, backgroundColor: `${t.success}1A` }}
            >
              <CheckCircle2 size={30} color={t.success} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Inbox를 다 비웠어요</p>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>떠오르는 건 위에 바로 던져 두세요.</p>
          </div>
        ) : (
          active.map(td => renderCard(td, false))
        )}
      </div>

      {/* 완료 (접기/펼치기) */}
      {done.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-1.5"
            style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}
          >
            {showDone ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            완료 {done.length}
          </button>
          {showDone && <div className="mt-2.5 space-y-2.5">{done.map(td => renderCard(td, true))}</div>}
        </div>
      )}

      {deletingId && (
        <ConfirmModal
          message="이 할일을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { deleteTodo(deletingId); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
