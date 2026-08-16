import { useEffect, useMemo, useRef, useState } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, RefreshCw, Star, X } from 'lucide-react';
import { usePlanner, Todo, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { TimeField, DurationChips } from './TimeField';
import { DateField } from './DateField';
import { RecurrenceBranchModal } from './RecurrenceBranchModal';
import { TagSelector } from './TagSelector';
import { isVirtualTodoId, parseVirtualTodoId, DOW_LABELS } from '../../lib/recurrenceExpansion';
import { totalElapsedForTodo } from '../../lib/timeBlocks';
import { formatTotalDoKo } from '../../lib/todoDoDuration';
import { PROJECT_COLORS } from './ProjectView';
import { inputBg, dangerText } from '../styles/haonStyles';

interface TodoModalProps {
  /** date prop은 기본 날짜로 사용되며, 모달 안에서 변경/해제할 수 있다. */
  date?: string;
  todo?: Todo;
  initialPlanStart?: string;
  initialPlanEnd?: string;
  /** 새 할일 생성 시 자동으로 연결할 주간 목표 id (Phase 4: 기간별 주간 카드 inline 추가) */
  initialWeeklyGoalId?: string;
  /** 새 할일 생성 시 자동 지정할 프로젝트 id (프로젝트 상세 내부에서 추가 시) */
  initialProjectId?: string;
  /** 새 할일 생성 시 자동 지정할 마일스톤 id (마일스톤 카드 내부에서 추가 시) */
  initialMilestoneId?: string;
  /** 새 할일 생성 시 본문 기본값 (통합 빠른 입력 "자세히") */
  initialText?: string;
  /** 새 할일 생성 시 태그 id 기본값 (통합 빠른 입력 "자세히") */
  initialTags?: string[];
  /** 새 할일 생성 시 Top3 기본값 (통합 빠른 입력 "자세히") */
  initialIsTop3?: boolean;
  /** 새 할일 생성 시 반복 기본값 (통합 빠른 입력 "자세히") */
  initialRecurrenceRule?: Todo['recurrenceRule'];
  initialRecurrenceDays?: number[];
  onClose: () => void;
}

export function TodoModal({ date, todo, initialPlanStart, initialPlanEnd, initialWeeklyGoalId, initialProjectId, initialMilestoneId, initialText, initialTags, initialIsTop3, initialRecurrenceRule, initialRecurrenceDays, onClose }: TodoModalProps) {
  const { addTodo, updateTodo, deleteTodo, deleteRecurringTodo, updateRecurringTodo, projects, milestones, addProject, timeBlocks } = usePlanner();
  const { t } = useTheme();

  // ── 반복 관련 ───────────────────────────────────────────────────────────────
  const isVirtual = todo ? isVirtualTodoId(todo.id) : false;
  const virtualInfo = isVirtual && todo ? parseVirtualTodoId(todo.id) : null;
  // 반복 편집/삭제 로직 분기 트리거 (부모 포함)
  const isRecurringInstance = !!(isVirtual || (todo?.recurrenceRule && !todo?.isException) || todo?.recurrenceParentId);
  // 반복에서 분리된 단일 예외 레코드(이 날짜만의 일정) — 반복 주기 설정이 의미 없으므로 안내 배너만 표시
  const isDetachedException = !!todo?.recurrenceParentId;

  const [modalDate, setModalDateRaw] = useState<string>(
    date ?? todo?.date ?? '',
  );
  const setModalDate = (v: string) => {
    setModalDateRaw(v);
    if (!v) setEndDate('');
    else if (endDate && v > endDate) setEndDate('');
  };

  const effectiveDate = modalDate;
  const dateLabel = effectiveDate
    ? format(new Date(`${effectiveDate}T12:00:00`), 'M월 d일 (EEEE)', { locale: ko })
    : '미지정';

  // 폼 fields
  const [text, setText] = useState(todo?.text ?? initialText ?? '');
  const [planStart, setPlanStart] = useState(todo?.planStart ?? initialPlanStart ?? '');
  const [planEnd, setPlanEnd] = useState(todo?.planEnd ?? initialPlanEnd ?? '');
  // 계획 시작 확정 → 종료로 포커스 이동 (TimeField, PC 콤보박스). 非-H는 TimePicker라 미사용.
  const planEndRef = useRef<HTMLInputElement>(null);
  // 실제(DO) 시간 — 타임라인/타이머가 관리. 모달은 읽기전용 표시만(편집·생성 안 함). 소스 = todo.do_*.
  const doStart = todo?.doStart ?? '';
  const doEnd = todo?.doEnd ?? '';
  // 이 할일이 DO(실제) 시간을 가진 항목인지 — 읽기전용 요약 노출 여부(값 없으면 영역 자체 없음)
  const hasDoTime = !!(todo?.doStart || todo?.doEnd);
  const [isTop3, setIsTop3] = useState(todo?.isTop3 ?? initialIsTop3 ?? false);
  const [selectedTags, setSelectedTags] = useState<string[]>(todo?.tags ?? initialTags ?? []);
  const [projectId, setProjectId] = useState(todo?.projectId ?? initialProjectId ?? '');
  const [milestoneId, setMilestoneId] = useState(todo?.milestoneId ?? initialMilestoneId ?? '');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 기간(멀티데이) 종료일 — 기본은 단일 날짜. 실제 기간(종료 > 시작)일 때만 값/펼침 유지.
  // (마이그레이션으로 단일 날짜는 end_date=date 라 endDate===date 는 "기간 아님"으로 접는다.)
  const [endDate, setEndDate] = useState<string>(
    todo?.endDate && todo?.date && todo.endDate > todo.date ? todo.endDate : '',
  );

  // 반복 일정 state
  const [recurrenceRule, setRecurrenceRule] = useState<Todo['recurrenceRule']>(todo?.recurrenceRule ?? initialRecurrenceRule ?? undefined);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(todo?.recurrenceDays ?? initialRecurrenceDays ?? []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(todo?.recurrenceEndDate ?? '');
  const [recurrenceBranchFor, setRecurrenceBranchFor] = useState<'save' | 'delete' | null>(null);

  // "매주" 선택 시 기준 요일 (편집 중인 todo의 날짜, 또는 선택한 날짜)
  const baseDow = useMemo(() => {
    const d = todo?.date ?? effectiveDate;
    return d ? getDay(parseISO(d)) : getDay(new Date());
  }, [todo?.date, effectiveDate]);

  // 누적 시간 (Stage 3): 시간 블록 합(없으면 do_* 폴백). 세션 수도 함께 표기.
  const accumulated = useMemo(() => {
    if (!todo) return null;
    const sec = totalElapsedForTodo(timeBlocks, todo);
    if (sec <= 0) return null;
    return { sec, sessions: timeBlocks.filter(b => b.todoId === todo.id).length };
  }, [todo, timeBlocks]);

  // 실제(DO) 요약 소요 — 단일 소스 do_start~do_end 만 사용(do_elapsed_sec 안 섞음, DESIGN.md §5 읽기전용 요약).
  const doDurationLabel = useMemo(() => {
    if (!doStart || !doEnd) return null;
    const [sh, sm] = doStart.split(':').map(Number);
    const [eh, em] = doEnd.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return null;
    return formatTotalDoKo(mins * 60);
  }, [doStart, doEnd]);


  // 할일 만들다가 새 프로젝트를 이름만으로 즉석 생성 → 방금 만든 프로젝트 자동 선택.
  // 색은 기존 PROJECT_COLORS 팔레트 기본값. 세부(설명·기간·목표연결)는 프로젝트 페이지에서 이어서 설정.
  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const id = addProject({ name, color: PROJECT_COLORS[0], status: 'active' });
    setProjectId(id);
    setMilestoneId('');
    setNewProjectName('');
    setShowNewProject(false);
  };


  const buildChanges = () => ({
    text: text.trim(),
    date: effectiveDate || null,
    // 기간 종료: 날짜 있고 비반복이면 항상 채운다(단일 날짜=시작과 동일 → 기간 파생이 일관).
    // 실제 기간이면 endDate, 아니면 시작일. 미지정/반복이면 없음.
    endDate: effectiveDate && !recurrenceRule
      ? (endDate && endDate > effectiveDate ? endDate : effectiveDate)
      : undefined,
    planStart: planStart || undefined,
    planEnd: planEnd || undefined,
    // do_* 는 모달에서 쓰지 않는다(읽기전용 요약). 실제 시각 생성·조정은 타임라인/타이머 전담 → desync 유발 경로 차단.
    isTop3,
    tags: selectedTags,
    projectId: projectId || undefined,
    // 기존 weeklyGoalId 보존(편집), 신규 생성 시 initialWeeklyGoalId 자동 적용
    weeklyGoalId: todo?.weeklyGoalId ?? initialWeeklyGoalId ?? undefined,
    // 마일스톤 연결 — 폼 state 우선 (해제·재선택 모두 반영)
    milestoneId: (projectId && milestoneId) ? milestoneId : undefined,
    recurrenceRule: recurrenceRule ?? undefined,
    recurrenceDays: recurrenceRule === 'custom' ? recurrenceDays : undefined,
    recurrenceEndDate: recurrenceEndDate || undefined,
  });

  const executeSubmit = (scope?: 'this' | 'future' | 'all') => {
    const changes = buildChanges();
    if (isVirtual && virtualInfo && scope) {
      updateRecurringTodo(virtualInfo.parentId, virtualInfo.instanceDate, changes, scope);
    } else if (todo?.recurrenceParentId) {
      // 예외 레코드 - 직접 수정
      updateTodo(todo.id, changes);
    } else if (isRecurringInstance && todo && scope) {
      // 부모 반복 일정 수정
      const instanceDate = todo.date ?? getLogicalToday();
      updateRecurringTodo(todo.id, instanceDate, changes, scope);
    } else if (todo) {
      updateTodo(todo.id, changes);
    } else {
      addTodo({ ...changes, status: 'active' });
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (isRecurringInstance && todo && !todo.recurrenceParentId) {
      setRecurrenceBranchFor('save');
      return;
    }
    executeSubmit();
  };

  const executeDelete = (scope?: 'this' | 'future' | 'all') => {
    if (!todo) return;
    if (isVirtual && virtualInfo && scope) {
      deleteRecurringTodo(virtualInfo.parentId, virtualInfo.instanceDate, scope);
    } else if (todo.recurrenceParentId) {
      deleteTodo(todo.id);
    } else if (isRecurringInstance && scope) {
      const instanceDate = todo.date ?? getLogicalToday();
      deleteRecurringTodo(todo.id, instanceDate, scope);
    } else {
      deleteTodo(todo.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (isRecurringInstance && todo && !todo.recurrenceParentId) {
      setRecurrenceBranchFor('delete');
      return;
    }
    setShowDeleteConfirm(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-[420px] max-w-[95vw] max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: t.card,
          border: `1px solid ${t.border}`,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            {todo ? '할일 수정' : '할일 추가'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="pb-4 space-y-2" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} color={t.accent} />
              <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>날짜</span>
              <span style={{ fontSize: 11, color: t.textMuted }}>{dateLabel}</span>
            </div>
            {/* 날짜 — 필드 하나로 단일/기간 모두 처리(DESIGN §5). 빠른선택(오늘/내일/주말/없음)과
                "기간으로" 토글은 팝오버 안(PC)·조건부 종료 필드(모바일)로. 반복과 상호배타. */}
            <DateField
              value={effectiveDate}
              onChange={setModalDate}
              range={!recurrenceRule}
              endValue={endDate}
              onEndChange={v => { setEndDate(v); if (v) setRecurrenceRule(undefined); }}
              size="md"
              ariaLabel="날짜"
              placeholder="날짜 선택"
            />
          </div>

          {/* 할일 텍스트 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>할일</label>
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="할 일을 입력하세요"
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{
                border: `1px solid ${t.border}`,
                backgroundColor: inputBg(t),
                color: t.text,
                fontSize: 13,
              }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* 시작/종료 시간 (계획) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>계획 시작</label>
              <div className="mt-1">
                <TimeField value={planStart} onChange={setPlanStart} role="start" placeholder="시작 시간"
                  onCommitFocusNext={() => planEndRef.current?.focus()} />
              </div>
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>계획 종료</label>
              <div className="mt-1">
                <TimeField value={planEnd} onChange={setPlanEnd} role="end" rangeStart={planStart}
                  placeholder="종료 시간" inputRef={planEndRef} />
              </div>
            </div>
          </div>

          {/* 모바일 duration chip — 계획 시작 기준 종료 자동설정, 폼 전체 폭 한 줄.
              PC(lg)는 종료 콤보박스 목록의 duration 병기로 대체하므로 숨김(lg:hidden). */}
          <DurationChips start={planStart} end={planEnd} onPick={setPlanEnd} className="lg:hidden" />

          {/* 실제(DO) 시간 — 읽기전용 요약 (DESIGN.md §5 「읽기전용 값 요약」).
              생성·조정은 타임라인/타이머가 관리. 표시 소스 = do_start~do_end 단일(do_elapsed_sec 안 섞음).
              값 없으면(hasDoTime false) 영역 자체를 렌더하지 않는다. */}
          {hasDoTime && (
            <div>
              <div className="flex items-baseline gap-2" style={{ flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: t.success, fontWeight: 600 }}>실제</span>
                <span style={{ fontSize: 13, color: t.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {doStart || '--:--'} ~ {doEnd || '--:--'}
                </span>
                {doDurationLabel && (
                  <span style={{ fontSize: 12, color: t.textMuted }}>· {doDurationLabel}</span>
                )}
              </div>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>타임라인에서 조정</p>
            </div>
          )}

          {/* 누적 시간 (Stage 3) — 여러 날 타이머 세션이 쌓인 총합 */}
          {accumulated && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: inputBg(t), border: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>누적 시간</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{formatTotalDoKo(accumulated.sec)}</span>
              {accumulated.sessions > 0 && (
                <span style={{ fontSize: 11, color: t.textMuted }}>· {accumulated.sessions}개 세션</span>
              )}
            </div>
          )}

          {/* 반복 일정 — 신규/일반/부모 반복/반복 인스턴스 모두 현재 값으로 채워 편집 가능;
              반복에서 분리된 단일 예외 레코드만 설정 UI 숨김 */}
          {!isDetachedException && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <RefreshCw size={13} color={t.accent} />
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>반복</label>
              </div>
              {/* 반복 옵션 칩 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {([
                  { value: undefined,   label: '반복 없음' },
                  { value: 'daily',     label: '매일' },
                  { value: 'weekly',    label: `매주 ${DOW_LABELS[baseDow]}요일` },
                  { value: 'weekdays',  label: '평일 (월~금)' },
                  { value: 'custom',    label: '직접 설정' },
                ] as const).map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setRecurrenceRule(opt.value);
                      if (opt.value) setEndDate('');
                    }}
                    className="px-3 py-1 rounded-full"
                    style={{
                      fontSize: 11, fontWeight: recurrenceRule === opt.value ? 700 : 500,
                      // 단일 선택 토글 → duration chip 3단계와 동일: H 는 선택만 라일락(accentSoft)+딥인디고,
                      // 비선택 흰색+중립 hairline(§3 라일락 규칙·코랄 제거). 非-H 는 기존(코랄/bgSub) 유지 → 회귀 0.
                      backgroundColor: recurrenceRule === opt.value ? t.lavenderTint : t.card,
                      color: recurrenceRule === opt.value ? t.text : t.textMuted,
                      border: `1.5px solid ${t.border}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* custom 요일 선택 */}
              {recurrenceRule === 'custom' && (
                <div className="flex gap-1.5 mb-2">
                  {DOW_LABELS.map((label, dow) => (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => setRecurrenceDays(prev =>
                        prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow]
                      )}
                      className="w-8 h-8 rounded-full"
                      style={{
                        fontSize: 11, fontWeight: 700,
                        // 요일 다중 선택 → 반복 칩과 동일 3단계(선택만 라일락, 비선택 흰색). 非-H 유지.
                        backgroundColor: recurrenceDays.includes(dow) ? t.lavenderTint : t.card,
                        color: recurrenceDays.includes(dow) ? t.text : t.textMuted,
                        border: `1.5px solid ${t.border}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {/* 종료일 */}
              {recurrenceRule && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap' }}>종료일</span>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={e => setRecurrenceEndDate(e.target.value)}
                    placeholder="없으면 무기한"
                    className="flex-1 rounded-lg px-3 py-1.5 outline-none"
                    style={{ border: `1px solid ${t.border}`, backgroundColor: inputBg(t), color: t.text, fontSize: 12 }}
                  />
                  {recurrenceEndDate && (
                    <button type="button" onClick={() => setRecurrenceEndDate('')}
                      style={{ fontSize: 11, color: t.textMuted }}>지우기</button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* 반복에서 분리된 단일 예외 레코드임을 표시 */}
          {isDetachedException && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ backgroundColor: '#EEF6FF', border: '1px solid #C0D8F8' }}>
              <RefreshCw size={12} color="#5B8FD8" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#5B8FD8' }}>이 날짜만 분리된 일정입니다</span>
            </div>
          )}

          {/* Top3 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button onClick={() => setIsTop3(!isTop3)} className="p-0.5">
              <Star
                size={16}
                fill={isTop3 ? t.accent : 'none'}
                color={isTop3 ? t.accent : t.textMuted}
              />
            </button>
            <span style={{ fontSize: 12, color: t.text }}>Top 3 중요 할일</span>
          </label>

          {/* 프로젝트 */}
          <div>
            <div className="flex items-center justify-between">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>프로젝트</label>
              {!showNewProject && (
                <button
                  type="button"
                  onClick={() => { setShowNewProject(true); setNewProjectName(''); }}
                  style={{ fontSize: 11, color: t.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  + 새 프로젝트
                </button>
              )}
            </div>
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); setMilestoneId(''); }}
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{
                border: `1px solid ${t.border}`,
                backgroundColor: inputBg(t),
                color: t.text,
                fontSize: 13,
              }}
            >
              <option value="">없음</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {/* 인라인 새 프로젝트 생성 — 이름만 입력. 세부 설정은 프로젝트 페이지에서 이어감(단일 소스). */}
            {showNewProject && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateProject(); }
                    if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName(''); }
                  }}
                  placeholder="새 프로젝트 이름"
                  maxLength={60}
                  className="flex-1 min-w-0 rounded-lg px-3 py-2 outline-none"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: inputBg(t), color: t.text, fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                  style={{
                    flexShrink: 0,
                    // disabled 배경을 라일락(bgSub)으로 두지 않는다 — H 는 accent+opacity(§5 disabled, 태그 '추가' 버튼과 통일).
                    // 非-H 는 기존(bgSub/textMuted) 유지 → 회귀 0.
                    backgroundColor: newProjectName.trim() ? t.accent : t.accent,
                    color: newProjectName.trim() ? '#fff' : '#fff',
                    ...(!newProjectName.trim() ? { opacity: 0.5 } : null),
                    fontSize: 13, fontWeight: 700, padding: '0 14px', borderRadius: 10, border: 'none',
                  }}
                >
                  만들기
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewProject(false); setNewProjectName(''); }}
                  style={{ flexShrink: 0, backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600, padding: '0 12px', borderRadius: 10, border: 'none' }}
                >
                  취소
                </button>
              </div>
            )}
          </div>

          {/* 마일스톤 (프로젝트 선택 시) */}
          {projectId && milestones.some(m => m.projectId === projectId) && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>🚩 마일스톤</label>
              <select
                value={milestoneId}
                onChange={e => setMilestoneId(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{
                  border: `1px solid ${t.border}`,
                  backgroundColor: inputBg(t),
                  color: t.text,
                  fontSize: 13,
                }}
              >
                <option value="">없음 (미지정)</option>
                {milestones
                  .filter(m => m.projectId === projectId)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
              </select>
            </div>
          )}

          {/* 태그 — 공용 TagSelector (할일·일정 모달 동일 UI) */}
          <TagSelector value={selectedTags} onChange={setSelectedTags} />
        </div>

        {/* 푸터 */}
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderTop: `1px solid ${t.border}` }}
        >
          {todo && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl transition-colors"
              style={{ fontSize: 12, color: dangerText(t), backgroundColor: 'transparent' }}
            >
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: inputBg(t), boxShadow: `inset 0 0 0 1px ${t.border}` }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}
          >
            {todo ? '저장' : '추가'}
          </button>
        </div>
      </div>
      {showDeleteConfirm && todo && (
        <ConfirmModal
          message="할일을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            executeDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {recurrenceBranchFor && (
        <RecurrenceBranchModal
          mode={recurrenceBranchFor === 'save' ? 'edit' : 'delete'}
          onConfirm={scope => {
            if (recurrenceBranchFor === 'save') executeSubmit(scope);
            else executeDelete(scope);
            setRecurrenceBranchFor(null);
          }}
          onCancel={() => setRecurrenceBranchFor(null)}
        />
      )}
    </div>
  );
}
