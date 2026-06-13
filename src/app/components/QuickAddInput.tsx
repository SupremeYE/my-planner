import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarClock, Inbox, Plus, RefreshCw, Star } from 'lucide-react';
import { usePlanner, Event, Todo } from '../store';
import { useTheme } from '../ThemeContext';
import { parseQuickEntry } from '../../lib/quickParse';
import { pickNewTagColor } from '../../lib/tagPalette';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';

interface QuickAddInputProps {
  /** 호출 맥락의 기본 날짜. Inbox 에서는 null(=미지정). 파싱에 날짜가 없을 때 폴백으로 쓰인다. */
  defaultDate?: string | null;
  /** 저장 직후 콜백 (입력창은 컴포넌트 내부에서 초기화한다) */
  onSubmitted?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

/** EventModal 신규 일정 기본 색과 동일하게 맞춘다(데이터 기본값, 테마 토큰 아님) */
const EVENT_DEFAULT_COLOR = '#7B9ED9';

/** 파서의 'weekday' → Todo 모델 'weekdays' 매핑 (weekly 는 시작 날짜의 요일로 확장됨) */
function toTodoRecurrence(rule: ReturnType<typeof parseQuickEntry>['recurrenceRule']): Todo['recurrenceRule'] {
  if (rule === 'weekday') return 'weekdays';
  if (rule === 'daily') return 'daily';
  if (rule === 'weekly') return 'weekly';
  return undefined;
}

/** 파서 반복 → Event.repeatType (평일은 일정 반복에 없어 none 처리) */
function toEventRepeat(rule: ReturnType<typeof parseQuickEntry>['recurrenceRule']): Event['repeatType'] {
  if (rule === 'daily') return 'daily';
  if (rule === 'weekly') return 'weekly';
  return 'none';
}

/** 'HH:MM' 에 1시간 더한 종료 시간 (일정 종료 기본값) */
function plusOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hh = Math.min(h + 1, 23);
  return `${hh.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
}

export function QuickAddInput({ defaultDate = null, onSubmitted, autoFocus, placeholder }: QuickAddInputProps) {
  const { addTodo, addEvent, addTag, tags: allTags, projects } = usePlanner();
  const { t } = useTheme();

  const [text, setText] = useState('');
  const [asEvent, setAsEvent] = useState(false);
  const [detailModal, setDetailModal] = useState<'todo' | 'event' | null>(null);

  const parsed = useMemo(() => parseQuickEntry(text), [text]);
  const hasInput = text.trim().length > 0;

  // 날짜 토큰이 없으면 호출 맥락의 기본 날짜로 폴백 (Inbox 면 null)
  const effectiveDate = parsed.date ?? defaultDate ?? null;

  // 프로젝트 이름 매칭 (성공 시 projectId, 실패 시 @토큰을 제목에 되돌림)
  const matchedProject = useMemo(() => {
    if (!parsed.projectName) return null;
    const key = parsed.projectName.trim().toLowerCase();
    return projects.find(p => p.name.trim().toLowerCase() === key) ?? null;
  }, [parsed.projectName, projects]);

  const finalTitle = useMemo(() => {
    if (parsed.projectName && !matchedProject) {
      return `${parsed.title} @${parsed.projectName}`.trim();
    }
    return parsed.title;
  }, [parsed.title, parsed.projectName, matchedProject]);

  // 시간이 사라지면 일정 모드 해제
  useEffect(() => {
    if (!parsed.hasTime && asEvent) setAsEvent(false);
  }, [parsed.hasTime, asEvent]);

  /** 파싱된 태그 이름들을 기존 태그에 매칭하고, 없으면 새로 만들어 id 배열로 변환 */
  const resolveTagIds = (): string[] => {
    const ids: string[] = [];
    const usedColors = allTags.map(tg => tg.color);
    for (const name of parsed.tags) {
      const key = name.trim().toLowerCase();
      const existing = allTags.find(tg => tg.name.trim().toLowerCase() === key);
      if (existing) {
        ids.push(existing.id);
      } else {
        const color = pickNewTagColor(usedColors);
        usedColors.push(color);
        const created = addTag(name.trim(), color);
        ids.push(created.id);
      }
    }
    return ids;
  };

  const reset = () => {
    setText('');
    setAsEvent(false);
  };

  const submit = () => {
    if (!hasInput) return;
    const tagIds = resolveTagIds();

    if (asEvent) {
      const eDate = effectiveDate ?? format(new Date(), 'yyyy-MM-dd');
      const start = parsed.startTime ?? '09:00';
      const end = parsed.endTime ?? plusOneHour(start);
      const payload: Omit<Event, 'id'> = {
        title: finalTitle,
        date: eDate,
        startDate: eDate,
        endDate: eDate,
        startTime: start,
        endTime: end,
        isAllDay: false,
        repeatType: toEventRepeat(parsed.recurrenceRule),
        projectId: matchedProject?.id || undefined,
        color: EVENT_DEFAULT_COLOR,
        tags: tagIds,
      };
      addEvent(payload);
    } else {
      addTodo({
        text: finalTitle,
        date: effectiveDate,
        planStart: parsed.startTime || undefined,
        planEnd: parsed.endTime || undefined,
        isTop3: parsed.isTop3,
        tags: tagIds,
        projectId: matchedProject?.id || undefined,
        recurrenceRule: toTodoRecurrence(parsed.recurrenceRule),
        status: 'active',
      });
    }
    reset();
    onSubmitted?.();
  };

  // ── 미리보기 칩 ──────────────────────────────────────────────────────────
  const chip = (key: string, label: string, color: string, icon?: React.ReactNode) => (
    <span
      key={key}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        backgroundColor: `${color}1A`,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </span>
  );

  const dateLabel = effectiveDate
    ? format(parseISO(effectiveDate), 'M월 d일 (EEE)', { locale: ko })
    : 'Inbox';

  const recurrenceLabel = parsed.recurrenceRule === 'daily' ? '매일'
    : parsed.recurrenceRule === 'weekday' ? '평일'
    : parsed.recurrenceRule === 'weekly' ? `매주 ${parsed.recurrenceDays[0] ?? ''}`
    : null;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
      >
        <input
          autoFocus={autoFocus}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={placeholder ?? '빠른 입력: 내일 3시 치과 #케어 @프로젝트 !'}
          className="flex-1 bg-transparent outline-none"
          style={{ color: t.text, fontSize: 14 }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!hasInput}
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{
            width: 32, height: 32,
            backgroundColor: hasInput ? t.accent : t.border,
            color: '#fff',
            opacity: hasInput ? 1 : 0.6,
            cursor: hasInput ? 'pointer' : 'not-allowed',
          }}
          aria-label="추가"
        >
          <Plus size={18} />
        </button>
      </div>

      {hasInput && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 px-1">
          {/* 타입: 할일=그린 / 일정=블루 */}
          {chip('type', asEvent ? '일정' : '할일', asEvent ? t.info : t.success)}
          {/* 날짜 or Inbox */}
          {chip(
            'date',
            dateLabel,
            effectiveDate ? t.accent : t.textMuted,
            effectiveDate ? <CalendarClock size={11} /> : <Inbox size={11} />,
          )}
          {/* 시간 */}
          {parsed.hasTime && chip(
            'time',
            parsed.endTime ? `${parsed.startTime}~${parsed.endTime}` : parsed.startTime!,
            t.accent,
          )}
          {/* 반복 */}
          {recurrenceLabel && chip('rec', recurrenceLabel, t.accent, <RefreshCw size={11} />)}
          {/* 태그 (코랄) */}
          {parsed.tags.map(name => chip(`tag-${name}`, `#${name}`, t.danger))}
          {/* 프로젝트 (매칭 성공 시에만) */}
          {matchedProject && chip('proj', `@${matchedProject.name}`, t.accent)}
          {/* Top3 */}
          {parsed.isTop3 && chip('top3', '중요', t.accent, <Star size={11} fill={t.accent} />)}

          {/* 일정 전환 토글 (시간 감지 시) */}
          {parsed.hasTime && (
            <button
              type="button"
              onClick={() => setAsEvent(v => !v)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: asEvent ? t.success : t.info,
                backgroundColor: 'transparent',
                border: `1px dashed ${asEvent ? t.success : t.info}`,
              }}
            >
              {asEvent ? '할일로?' : '일정으로?'}
            </button>
          )}

          {/* 자세히 → 기존 모달 열기 */}
          <button
            type="button"
            onClick={() => setDetailModal(asEvent ? 'event' : 'todo')}
            className="ml-auto"
            style={{ fontSize: 11, fontWeight: 600, color: t.textSub, textDecoration: 'underline' }}
          >
            자세히
          </button>
        </div>
      )}

      {detailModal === 'todo' && (
        <TodoModal
          date={effectiveDate ?? undefined}
          initialPlanStart={parsed.startTime}
          initialPlanEnd={parsed.endTime}
          initialProjectId={matchedProject?.id}
          onClose={() => { setDetailModal(null); reset(); onSubmitted?.(); }}
        />
      )}
      {detailModal === 'event' && (
        <EventModal
          date={effectiveDate ?? undefined}
          onClose={() => { setDetailModal(null); reset(); onSubmitted?.(); }}
        />
      )}
    </div>
  );
}
