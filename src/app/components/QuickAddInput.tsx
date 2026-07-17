import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarClock, ChevronDown, Inbox, Plus, RefreshCw, Star } from 'lucide-react';
import { usePlanner, Event, Todo, getLogicalToday, TOP3_LIMIT } from '../store';
import { useTheme } from '../ThemeContext';
import { parseQuickEntry } from '../../lib/quickParse';
import { pickNewTagColor } from '../../lib/tagPalette';
import { hexToRgb } from '../styles/haonStyles';
import { TodoModal } from './TodoModal';
import { EventModal } from './EventModal';

interface QuickAddInputProps {
  /** 호출 맥락의 기본 날짜. Inbox 에서는 null(=미지정). 파싱에 날짜가 없을 때 폴백으로 쓰인다. */
  defaultDate?: string | null;
  /** 저장 직후 콜백 (입력창은 컴포넌트 내부에서 초기화한다) */
  onSubmitted?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** DESIGN v1.1 솔리드 표면(불투명 흰색 카드 + 코랄 그라데이션 + 버튼). 파스텔(H) 테마에서만 적용. */
  solid?: boolean;
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

export function QuickAddInput({ defaultDate = null, onSubmitted, autoFocus, placeholder, solid }: QuickAddInputProps) {
  const { addTodo, addEvent, addTag, top3CountForDate, tags: allTags, projects } = usePlanner();
  const { t } = useTheme();

  // 솔리드 표면: solid prop + 파스텔(H) 테마(cardFrosted 존재)에서만. 그 외에는 기존 모양 유지.
  const solidBox = !!solid && !!t.cardFrosted;

  const [text, setText] = useState('');
  // 사용자가 타입 칩을 직접 탭해 명시한 타입(수동 선택). null = 미선택.
  const [manualType, setManualType] = useState<'event' | 'todo' | null>(null);
  const [detailModal, setDetailModal] = useState<'todo' | 'event' | null>(null);

  const parsed = useMemo(() => parseQuickEntry(text), [text]);
  const hasInput = text.trim().length > 0;

  // 타입 결정 우선순위: 수동 탭 > 프리픽스(typeHint) > 기본(할일).
  // 파생값으로 두면 "시간 사라지면 해제"가 수동/프리픽스 선택을 덮어쓰지 않는다
  // (asEvent=true 가 되는 경로는 오직 manualType/typeHint 뿐 → 시간 유무와 무관하게 보존).
  const asEvent = useMemo(() => {
    if (manualType) return manualType === 'event';
    if (parsed.typeHint) return parsed.typeHint === 'event';
    return false;
  }, [manualType, parsed.typeHint]);

  // 스마트 강조 펄스: 시간 감지 AND 최종 타입 == 할일 AND 수동 탭 없음 AND 프리픽스 없음.
  const pulseTypeChip = parsed.hasTime && !asEvent && !manualType && !parsed.typeHint;
  // 펄스 링 색은 accent 토큰에서 파생(하드코딩 금지). CSS 변수로 주입한다.
  const accentRgb = hexToRgb(t.accent);
  const pulseRing = accentRgb ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.30)` : t.accent;

  // 날짜 토큰이 없으면 호출 맥락의 기본 날짜로 폴백 (Inbox 면 null)
  const effectiveDate = parsed.date ?? defaultDate ?? null;

  // Top3 3개 제한 — 이 날 이미 3개면 "중요"는 저장 시 store 에서 클램프된다(무음 아님: 칩으로 사전 안내).
  const top3Full = top3CountForDate(effectiveDate) >= TOP3_LIMIT;

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
    setManualType(null);
  };

  // "자세히" 로 모달을 열 때 파싱 값을 함께 넘기기 위해 한 번 계산한다.
  // 태그는 제출과 동일하게 id 로 해석(없으면 생성)해 모달에 prefill 한다.
  const [detailSeed, setDetailSeed] = useState<{ tagIds: string[] } | null>(null);
  const openDetail = (mode: 'todo' | 'event') => {
    setDetailSeed({ tagIds: resolveTagIds() });
    setDetailModal(mode);
  };

  const submit = () => {
    if (!hasInput) return;
    const tagIds = resolveTagIds();

    if (asEvent) {
      const eDate = effectiveDate ?? getLogicalToday();
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
        style={solidBox
          ? {
              backgroundColor: t.solidCardBg ?? '#FFFFFF',
              border: t.solidCardBorder ?? '1px solid rgba(122,92,162,0.12)',
              boxShadow: t.solidCardShadow ?? '0 8px 20px rgba(120,90,160,0.12)',
            }
          : { backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
      >
        <input
          autoFocus={autoFocus}
          value={text}
          onChange={e => {
            const v = e.target.value;
            setText(v);
            if (!v.trim()) setManualType(null); // 입력 클리어 시 수동 선택 리셋
          }}
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
            // 솔리드 표면일 때 활성 버튼은 코랄→핑크 그라데이션 유지
            background: solidBox && hasInput ? (t.primaryGradient ?? t.accent) : undefined,
            backgroundColor: solidBox && hasInput ? undefined : (hasInput ? t.accent : t.border),
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
          {/* 타입 칩: 할일=그린 / 일정=블루. 탭하면 토글(수동 선택 기록).
              시간 감지 & 기본 할일 & 수동/프리픽스 미선택이면 코랄 링이 은은히 맥동해 전환 어포던스 제공. */}
          <button
            type="button"
            onClick={() => setManualType(asEvent ? 'todo' : 'event')}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5${pulseTypeChip ? ' haon-type-pulse' : ''}`}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: asEvent ? t.info : t.success,
              backgroundColor: `${asEvent ? t.info : t.success}1A`,
              border: `1px solid ${asEvent ? t.info : t.success}33`,
              whiteSpace: 'nowrap',
              ...(pulseTypeChip ? { ['--haon-type-pulse-ring']: pulseRing } : {}),
            } as React.CSSProperties}
            aria-label={asEvent ? '타입: 일정 (탭하여 할일로 전환)' : '타입: 할일 (탭하여 일정으로 전환)'}
          >
            {asEvent ? '일정' : '할일'}
            <ChevronDown size={11} />
          </button>
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
          {/* Top3 — 이 날 3개가 차면 저장 시 제외되므로 뮤트 처리 + 사유 노출 */}
          {parsed.isTop3 && (top3Full
            ? chip('top3', `중요 (하루 ${TOP3_LIMIT}개 초과)`, t.textMuted, <Star size={11} fill={t.textMuted} />)
            : chip('top3', '중요', t.accent, <Star size={11} fill={t.accent} />))}

          {/* 자세히 → 기존 모달 열기 */}
          <button
            type="button"
            onClick={() => openDetail(asEvent ? 'event' : 'todo')}
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
          initialText={finalTitle}
          initialPlanStart={parsed.startTime}
          initialPlanEnd={parsed.endTime}
          initialProjectId={matchedProject?.id}
          initialTags={detailSeed?.tagIds}
          initialIsTop3={parsed.isTop3}
          initialRecurrenceRule={toTodoRecurrence(parsed.recurrenceRule)}
          onClose={() => { setDetailModal(null); setDetailSeed(null); reset(); onSubmitted?.(); }}
        />
      )}
      {detailModal === 'event' && (
        <EventModal
          date={effectiveDate ?? undefined}
          initialTitle={finalTitle}
          initialStartTime={parsed.startTime}
          initialEndTime={parsed.endTime}
          initialTags={detailSeed?.tagIds}
          onClose={() => { setDetailModal(null); setDetailSeed(null); reset(); onSubmitted?.(); }}
        />
      )}
    </div>
  );
}
