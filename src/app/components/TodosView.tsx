import { useState, useMemo, useRef, useEffect, type CSSProperties } from 'react';
import { format, isToday, isTomorrow, isPast, parseISO, addDays } from 'date-fns';
import {
  Trash2, ChevronDown, ChevronUp,
  Check, Star, ListTodo,
  AlertTriangle, ArrowDownToLine, Inbox, MoreHorizontal,
} from 'lucide-react';
import { usePlanner, Todo, TodoStatus, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { MandalartSourceBadge } from './mandalart/MandalartSourceBadge';
import { TodoModal } from './TodoModal';
import { FocusModal } from './FocusModal';
import { QuickAddInput } from './QuickAddInput';
import { isInboxCandidate } from '../../lib/inbox';
import { periodCoversDate, todoEndDate, deriveTodoPhase } from '../../lib/todoPeriod';
import { shiftedEndDate } from '../../lib/todoSnooze';
import { TodoActionMenu } from './todo/TodoActionMenu';
import { solidCardStyle, solidRowStyle, glassBarStyle, mixHex, selectedRowStyle, actionBarStyle, buttonStyle } from '../styles/haonStyles';

// ─── Constants ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active:     { label: '예정',   color: '#6B7280', bgColor: '#F3F4F6' },
  inProgress: { label: '진행중', color: '#059669', bgColor: '#D1FAE5' },
  done:       { label: '완료',   color: '#515f74', bgColor: '#d5e3fd' },
  snoozed:    { label: '미루기', color: '#D97706', bgColor: '#FEF3C7' },
  backlog:    { label: '보관',   color: '#9CA3AF', bgColor: '#F3F4F6' },
  cancelled:  { label: '취소',   color: '#DC2626', bgColor: '#FEE2E2' },
};

const STATUS_NEXT: Record<string, TodoStatus> = {
  active:     'done',
  inProgress: 'done',
  done:       'active',
  snoozed:    'active',
  backlog:    'active',
  cancelled:  'active',
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getDateLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    const dayName = DAYS[d.getDay()];
    const formatted = `${format(d, 'M월 d일')} (${dayName})`;
    if (isToday(d)) return `오늘 · ${format(d, 'M/d')} (${dayName})`;
    if (isTomorrow(d)) return `내일 · ${format(d, 'M/d')} (${dayName})`;
    if (isPast(d)) return `${formatted} · 지남`;
    return formatted;
  } catch {
    return dateStr;
  }
}

// ─── Todo Row ──────────────────────────────────────────────────
interface TodoRowProps {
  todo: Todo;
  onStatusToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTop3Toggle: () => void;
  /** 밀림 섹션에서 노출되는 '오늘로' 버튼 */
  onMoveToToday?: () => void;
  /** 다중 선택 모드 여부 — 켜지면 좌측 체크박스 + 행 탭=선택, 우측 액션 숨김 */
  selectMode?: boolean;
  /** 이 행이 선택되었는지 */
  selected?: boolean;
  /** 선택 토글 콜백 */
  onSelectToggle?: () => void;
}

function TodoRow({
  todo, onStatusToggle, onEdit, onDelete, onTop3Toggle, onMoveToToday,
  selectMode = false, selected = false, onSelectToggle,
}: TodoRowProps) {
  const { t } = useTheme();
  const { projects, weeklyGoals, milestones, tags, updateTodo, startTimer, activeTimer, stopTimer } = usePlanner();
  const weeklyGoal = todo.weeklyGoalId ? weeklyGoals.find(w => w.id === todo.weeklyGoalId) : null;
  const milestone = todo.milestoneId ? milestones.find(m => m.id === todo.milestoneId) : null;
  // '…' 공용 액션 메뉴 위치(뷰포트 좌표). 열리면 TodoActionMenu 를 포털로 렌더.
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  // 포커스 타이머 진입 — FocusModal 로 모드(포모/스톱워치)·시간을 고른 뒤 startTimer.
  const [focusOpen, setFocusOpen] = useState(false);

  // DailyView.handleTodoFocusAction 과 동일 규칙:
  // ① 이 할일이 이미 타이머면 정지(토글) ② 다른 할일이 점유 중이면 무시 ③ 그 외 모달 오픈.
  const handleTodoFocusAction = () => {
    if (activeTimer?.todoId === todo.id) { stopTimer(); return; }
    if (activeTimer && activeTimer.todoId !== todo.id) return;
    setFocusOpen(true);
  };

  // 완료 체크 시 즉시 사라지지 않고 부드럽게 슬라이드 아웃한 뒤 실제 상태를 커밋한다.
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);

  // 완료 경계를 넘어(할일↔완료함) 현재 목록에서 빠지는 토글일 때만 애니메이션, 그 외(예: 미루기→예정)는 즉시.
  const handleStatusToggle = () => {
    const next = STATUS_NEXT[todo.status];
    const wasDone = todo.status === 'done' || todo.status === 'cancelled';
    const willBeDone = next === 'done' || next === 'cancelled';
    if (wasDone !== willBeDone && !leaving) {
      setLeaving(true);
      leaveTimer.current = setTimeout(onStatusToggle, 300);
    } else {
      onStatusToggle();
    }
  };

  const isDone = todo.status === 'done';
  const isCancelled = todo.status === 'cancelled';
  const cfg = STATUS_CONFIG[todo.status] ?? STATUS_CONFIG.active;
  const isInProgress = deriveTodoPhase(todo, getLogicalToday()) === 'inProgress'; // 진행중은 기간 파생
  const duePast = todo.dueDate && todo.dueDate < getLogicalToday();
  const project = todo.projectId ? projects.find(p => p.id === todo.projectId) : null;

  // Haon(H): 배지(프로젝트·마일스톤)는 채도 파스텔 채움 + 어두운 텍스트 시블링. 그 외 테마는 기존 저채도 워시.
  const badgeBg = (c: string) => mixHex(c, 255, 0.78);
  const badgeText = (c: string) => mixHex(c, 0, 0.32);

  // Haon(H): 항목 행 = 솔리드 행 recipe. 핵심(KEY, isTop3) 행은 코랄 톤(keyRow 토큰 + 좌측 코랄 그라데이션 바).
  // 그 외 테마(A/B/C/D)는 기존 카드 모양 유지.
  const isKeyRow = todo.isTop3;
  let rowStyle: CSSProperties;
  if (isKeyRow) {
    rowStyle = {
      background: t.keyRowBg ?? '#FFF5F2',
      border: t.keyRowBorder ?? '1px solid rgba(255,111,145,0.35)',
      boxShadow: t.keyRowShadow ?? '0 2px 4px rgba(120,90,160,0.10), 0 10px 24px rgba(255,111,145,0.22)',
      borderRadius: t.solidRowRadius ?? 14,
      position: 'relative',
      opacity: isCancelled ? 0.6 : 1,
    };
  } else {
    rowStyle = { ...solidRowStyle(t), opacity: isCancelled ? 0.6 : 1 };
  }
  // 다중 선택: 기존 행 표면 위에 코랄 링만 덧댐(배경·그림자 불변) — DESIGN §5 Selection mode
  if (selected) rowStyle = { ...rowStyle, ...selectedRowStyle(t) };

  return (
    <>
      {/* 완료함으로 넘어갈 때 슬라이드 아웃 — 높이 collapse(grid 1fr→0fr) + 우측 슬라이드 + 페이드.
          overflow는 애니메이션 중(leaving)에만 hidden → 평상시 카드 그림자 클립 없음. */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: leaving ? '0fr' : '1fr',
          opacity: leaving ? 0 : 1,
          overflow: leaving ? 'hidden' : 'visible',
          marginTop: leaving ? 0 : undefined,
          pointerEvents: leaving ? 'none' : undefined,
          transition: 'grid-template-rows 300ms ease, opacity 260ms ease, margin-top 300ms ease',
        }}
      >
        <div
          style={{
            minHeight: 0,
            transform: leaving ? 'translateX(28px)' : 'translateX(0)',
            transition: 'transform 300ms ease',
          }}
        >
      <div
        className="rounded-2xl transition-all"
        style={rowStyle}
      >
        {/* 핵심(KEY) 좌측 코랄 그라데이션 바 — 자체 좌측 코너를 행 반경에 맞춰 라운딩(overflow 마스킹 없이) */}
        {isKeyRow && (
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: 4,
              background: t.primaryGradient ?? t.accent,
              borderTopLeftRadius: t.solidRowRadius ?? 14,
              borderBottomLeftRadius: t.solidRowRadius ?? 14,
            }}
          />
        )}
        <div className="flex items-start gap-3 px-3 py-3">
          {/* Leading — 선택모드: 체크박스 / 평상시: 상태 토글 */}
          {selectMode ? (
            <button
              onClick={onSelectToggle}
              aria-label={selected ? '선택 해제' : '선택'}
              className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: selected ? t.accent : t.border,
                backgroundColor: selected ? t.accent : 'transparent',
              }}
            >
              {selected && <Check size={10} color="#fff" strokeWidth={3} />}
            </button>
          ) : (
            <button
              onClick={handleStatusToggle}
              className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: isDone ? t.accent : (isInProgress ? t.success : cfg.color),
                backgroundColor: isDone ? t.accent : 'transparent',
              }}
            >
              {/* 왼쪽 원형 = 항상 완료 체크박스. 진행중은 테두리 톤으로만(Play 글리프 금지). */}
              {isDone && <Check size={10} color="#fff" strokeWidth={3} />}
            </button>
          )}

          {/* Content — 선택모드에서는 행 본문 탭도 선택 토글 */}
          <div
            className="flex-1 min-w-0"
            onClick={selectMode ? onSelectToggle : undefined}
            style={selectMode ? { cursor: 'pointer' } : undefined}
          >
            <div className="flex items-start gap-1.5">
              {todo.isTop3 && (
                <Star size={11} fill={t.accent} color={t.accent} className="flex-shrink-0 mt-0.5" />
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isKeyRow ? 700 : 500,
                  color: isDone || isCancelled ? t.textMuted : t.text,
                  textDecoration: isDone ? 'line-through' : 'none',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}
              >
                {todo.text}
              </span>
            </div>

            {/* Meta badges */}
            {(project || weeklyGoal || milestone || todo.mandalartCellId || (todo.tags && todo.tags.length > 0) || todo.planStart || todo.dueDate || (todo.status !== 'active' && todo.status !== 'backlog')) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {todo.mandalartCellId && <MandalartSourceBadge />}
                {/* 태그 칩 — 일간·할일이 동일한 todo.tags 단일 소스를 읽으므로 두 화면 태그 표시가 일치한다.
                    배지 헬퍼(badgeBg/badgeText) 공유로 H 테마 파스텔 채움 / 그 외 워시가 주변 배지와 일치. */}
                {(todo.tags ?? []).map(tagId => {
                  const tag = tags.find(tg => tg.id === tagId);
                  if (!tag) return null;
                  return (
                    <span
                      key={tagId}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-full"
                      style={{ fontSize: 10, backgroundColor: badgeBg(tag.color), color: badgeText(tag.color), lineHeight: '14px' }}
                    >
                      {tag.name}
                    </span>
                  );
                })}
                {milestone && project && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: badgeBg(project.color), color: badgeText(project.color), fontWeight: 600, lineHeight: '14px', maxWidth: 160 }}
                    title={milestone.title}
                  >
                    🚩 <span className="truncate" style={{ maxWidth: 130 }}>{milestone.title}</span>
                  </span>
                )}
                {project && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: badgeBg(project.color), color: badgeText(project.color), lineHeight: '14px' }}
                  >
                    {project.name}
                  </span>
                )}
                {weeklyGoal && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent, lineHeight: '14px', maxWidth: 160 }}
                    title={weeklyGoal.text}
                  >
                    🎯 <span className="truncate" style={{ maxWidth: 130 }}>{weeklyGoal.text}</span>
                  </span>
                )}
                {todo.planStart && (
                  <span style={{ fontSize: 10, color: t.textMuted }}>
                    {todo.planStart}{todo.planEnd ? ` - ${todo.planEnd}` : ''}
                  </span>
                )}
                {todo.dueDate && (
                  <span style={{ fontSize: 10, color: duePast ? '#9f403d' : t.textSub }}>
                    마감 {format(parseISO(todo.dueDate), 'M/d')}
                  </span>
                )}
                {todo.status !== 'active' && todo.status !== 'backlog' && (
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 10, backgroundColor: cfg.bgColor, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons — 선택모드에서는 오작동 방지 위해 숨김 */}
          {!selectMode && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onMoveToToday && (
              <button
                onClick={onMoveToToday}
                title="오늘로 이동"
                className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                style={{ fontSize: 11, fontWeight: 600, color: t.danger, backgroundColor: t.dangerLight }}
              >
                <ArrowDownToLine size={12} />
                오늘로
              </button>
            )}
            <button onClick={onTop3Toggle} className="p-1.5 rounded-lg hover:opacity-70">
              <Star
                size={13}
                fill={todo.isTop3 ? t.accent : 'none'}
                color={todo.isTop3 ? t.accent : t.textMuted}
              />
            </button>
            {/* 편집·예정·포커스·미루기·취소·삭제는 공용 '…' 메뉴로(일간과 동일 액션 집합). */}
            <button
              aria-label="할일 메뉴"
              onClick={(e) => { e.stopPropagation(); setMenuPos({ x: e.clientX, y: e.clientY }); }}
              className="p-1.5 rounded-lg hover:opacity-70"
            >
              <MoreHorizontal size={13} color={t.textMuted} />
            </button>
          </div>
          )}
        </div>
      </div>
        </div>
      </div>

      {menuPos && (
        <TodoActionMenu
          todo={todo}
          position={menuPos}
          onClose={() => setMenuPos(null)}
          onEdit={onEdit}
          onSnooze={() => {
            // 목록 미루기 = 다음날로 이동(일간은 날짜 선택 모달 — 노출 방식은 달라도 액션은 동일).
            const base = todo.date ?? getLogicalToday();
            const next = format(addDays(parseISO(base), 1), 'yyyy-MM-dd');
            updateTodo(todo.id, { date: next, endDate: shiftedEndDate(todo, next), status: 'active' });
          }}
          onFocus={!activeTimer || activeTimer.todoId === todo.id ? handleTodoFocusAction : undefined}
          onSetStatus={(st) => updateTodo(todo.id, { status: todo.status === st && st !== 'active' ? 'active' : st })}
          onDelete={onDelete}
        />
      )}

      {focusOpen && (
        <FocusModal
          todo={todo}
          onClose={() => setFocusOpen(false)}
          onStart={(mode, pomoDurationSec) => {
            startTimer(todo.id, { mode, pomoDurationSec });
            setFocusOpen(false);
          }}
        />
      )}
    </>
  );
}

// 다중 선택 공통 props (탭 → 행 전달)
interface TabSelectionProps {
  selectMode: boolean;
  selected: Set<string>;
  onSelectToggle: (id: string) => void;
}

// ─── Tab 1: 할 일 (미분류 → 밀림 → 오늘 → 예정) ─────────────────
function TodoListTab({ selectMode, selected, onSelectToggle }: TabSelectionProps) {
  const { todos, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const todayStr = getLogicalToday();

  // 미분류 (date=null·미완료) — 옛 인박스. 사이드바 배지 countInboxActive 와 동일 기준.
  // created_at ASC 적재라 reverse = 최근 추가가 위.
  const unassigned = useMemo(
    () => todos.filter(td => isInboxCandidate(td) && td.status !== 'done').slice().reverse(),
    [todos]
  );

  // 날짜 배정된 미완료 할일만 (done/cancelled/backlog 제외)
  const incompleteAssigned = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      td.status !== 'done' &&
      td.status !== 'cancelled' &&
      td.status !== 'backlog'
    ),
    [todos]
  );

  // 늦음: 기간 종료일(endDate ?? date)이 오늘보다 이전인 미완료. (기간 기반 — 옛 '밀림'+'진행중 이월' 통합)
  const overdue = useMemo(
    () => incompleteAssigned
      .filter(td => todoEndDate(td)! < todayStr)
      .sort((a, b) => a.date!.localeCompare(b.date!)),
    [incompleteAssigned, todayStr]
  );

  // 오늘: 기간이 오늘을 포함(시작 <= 오늘 <= 종료)
  const todayTodos = useMemo(
    () => incompleteAssigned.filter(td => periodCoversDate(td, todayStr)),
    [incompleteAssigned, todayStr]
  );

  // 예정: 시작일이 오늘 이후. 시작일별 그룹 오름차순
  const upcomingGrouped = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    incompleteAssigned
      .filter(td => td.date! > todayStr)
      .forEach(td => { (groups[td.date!] ??= []).push(td); });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [incompleteAssigned, todayStr]);

  const total = unassigned.length + overdue.length + todayTodos.length + upcomingGrouped.reduce((s, [, list]) => s + list.length, 0);

  return (
    <div className="space-y-5">
      {/* 던지기 입력창 — 통합 진입점 (옛 인박스) */}
      <div className="px-4">
        <QuickAddInput solid defaultDate={null} placeholder="여기에 던지기: 장보기, 내일 3시 회의 #업무 …" />
      </div>

      {total === 0 && (
        <div className="text-center py-12">
          <ListTodo size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>미완료 할일이 없어요</p>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>위 입력창에 떠오르는 걸 던져보세요</p>
        </div>
      )}

      {/* ── 미분류 (옛 인박스 · date=null) ── */}
      {unassigned.length > 0 && (
        <div className="px-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Inbox size={13} color={t.textSub} />
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: '0.02em' }}>
              미분류
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
            <span style={{ fontSize: 10, color: t.textMuted }}>{unassigned.length}개</span>
          </div>
          <div className="space-y-2">
            {unassigned.map(todo => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                onEdit={() => setEditingTodo(todo)}
                onDelete={() => deleteTodo(todo.id)}
                onTop3Toggle={() => toggleTop3(todo.id)}
                selectMode={selectMode}
                selected={selected.has(todo.id)}
                onSelectToggle={() => onSelectToggle(todo.id)}
                onMoveToToday={() => updateTodo(todo.id, { date: todayStr, endDate: shiftedEndDate(todo, todayStr), status: 'active' })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 밀림 (강조) ── */}
      {overdue.length > 0 && (
        <div className="px-4">
          <div
            className="rounded-2xl p-3"
            style={{ ...solidCardStyle(t), position: 'relative' }}
          >
            {/* 파스텔(H): 좌측 코랄 액센트 바 — 자체 좌측 코너를 카드 반경에 맞춰 라운딩(overflow 마스킹 없이) */}
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0"
              style={{
                width: 4,
                background: t.warning,
                borderTopLeftRadius: t.solidCardRadius ?? 20,
                borderBottomLeftRadius: t.solidCardRadius ?? 20,
              }}
            />
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle size={14} color={t.warning} />
              <span style={{ fontSize: 11, fontWeight: 700, color: t.warning, letterSpacing: '0.04em' }}>
                늦음 {overdue.length}개
              </span>
              <span style={{ fontSize: 10, color: t.warning, opacity: 0.85 }}>
                종료일이 지난 미완료예요. 계속 여기 떠 있어요 — '오늘로' 로 끌어오세요.
              </span>
            </div>
            <div className="space-y-2">
              {overdue.map(todo => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                  onEdit={() => setEditingTodo(todo)}
                  onDelete={() => deleteTodo(todo.id)}
                  onTop3Toggle={() => toggleTop3(todo.id)}
                selectMode={selectMode}
                selected={selected.has(todo.id)}
                onSelectToggle={() => onSelectToggle(todo.id)}
                  onMoveToToday={() => updateTodo(todo.id, { date: todayStr, endDate: shiftedEndDate(todo, todayStr) })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 오늘 ── */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '0.02em' }}>
            오늘 · {format(new Date(), 'M/d')} ({DAYS[new Date().getDay()]})
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
          <span style={{ fontSize: 10, color: t.textMuted }}>{todayTodos.length}개</span>
        </div>
        {todayTodos.length === 0 ? (
          <p style={{ fontSize: 12, color: t.textMuted }} className="py-3 text-center">
            오늘 할일이 없어요
          </p>
        ) : (
          <div className="space-y-2">
            {todayTodos.map(todo => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                onEdit={() => setEditingTodo(todo)}
                onDelete={() => deleteTodo(todo.id)}
                onTop3Toggle={() => toggleTop3(todo.id)}
                selectMode={selectMode}
                selected={selected.has(todo.id)}
                onSelectToggle={() => onSelectToggle(todo.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 예정 (날짜별 오름차순) ── */}
      {upcomingGrouped.length > 0 && (
        <div className="space-y-5">
          {upcomingGrouped.map(([date, dateTodos]) => (
            <div key={date} className="px-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: '0.02em' }}>
                  {getDateLabel(date)}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
                <span style={{ fontSize: 10, color: t.textMuted }}>{dateTodos.length}개</span>
              </div>
              <div className="space-y-2">
                {dateTodos.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onStatusToggle={() => updateTodo(todo.id, { status: STATUS_NEXT[todo.status] })}
                    onEdit={() => setEditingTodo(todo)}
                    onDelete={() => deleteTodo(todo.id)}
                    onTop3Toggle={() => toggleTop3(todo.id)}
                selectMode={selectMode}
                selected={selected.has(todo.id)}
                onSelectToggle={() => onSelectToggle(todo.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTodo && (
        <TodoModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </div>
  );
}

// ─── Tab 2: 완료함 (done + cancelled, 날짜별 최신 위) ─────────────
function DoneTodosTab({ selectMode, selected, onSelectToggle }: TabSelectionProps) {
  const { todos, updateTodo, deleteTodo, toggleTop3 } = usePlanner();
  const { t } = useTheme();
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // done + cancelled (미분류[date=null] 완료 항목도 포함 — 인박스 통합)
  const doneOrCancelled = useMemo(
    () => todos.filter(td =>
      (td.status === 'done' || td.status === 'cancelled')
    ),
    [todos]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, Todo[]> = {};
    doneOrCancelled.forEach(td => { (groups[td.date ?? ''] ??= []).push(td); });
    // 최신 날짜 위 (미분류[''] 는 가장 아래)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [doneOrCancelled]);

  const toggleGroup = (date: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {grouped.length === 0 && (
        <div className="text-center py-16">
          <Check size={36} color={t.borderLight} className="mx-auto mb-3" />
          <p style={{ fontSize: 13, color: t.textMuted }}>아직 완료한 할일이 없어요</p>
        </div>
      )}

      {grouped.map(([date, dateTodos]) => {
        const isHidden = collapsed.has(date);
        return (
          <div key={date} className="px-4">
            <button
              onClick={() => toggleGroup(date)}
              className="flex items-center gap-2 mb-2.5 w-full"
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: '0.02em' }}>
                {date ? getDateLabel(date) : '미분류'}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: t.borderLight }} />
              <span style={{ fontSize: 10, color: t.textMuted }}>{dateTodos.length}개</span>
              {isHidden ? <ChevronDown size={12} color={t.textMuted} /> : <ChevronUp size={12} color={t.textMuted} />}
            </button>
            {!isHidden && (
              <div className="space-y-2">
                {dateTodos.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onStatusToggle={() => updateTodo(todo.id, { status: 'active' })}
                    onEdit={() => setEditingTodo(todo)}
                    onDelete={() => deleteTodo(todo.id)}
                    onTop3Toggle={() => toggleTop3(todo.id)}
                selectMode={selectMode}
                selected={selected.has(todo.id)}
                onSelectToggle={() => onSelectToggle(todo.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editingTodo && (
        <TodoModal
          todo={editingTodo}
          onClose={() => setEditingTodo(null)}
        />
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────
type Tab = 'list' | 'done';

export function TodosView() {
  const { todos, deleteTodos } = usePlanner();
  const { t } = useTheme();
  const [tab, setTab] = useState<Tab>('list');

  // ── 다중 선택 ──
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const clearSelection = () => setSelected(new Set());
  const exitSelectMode = () => { setSelectMode(false); clearSelection(); };
  const onSelectToggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  // 탭 전환 시 선택 초기화(탭마다 대상 id가 다름)
  const changeTab = (next: Tab) => { setTab(next); exitSelectMode(); };
  const confirmBulkDelete = () => {
    deleteTodos([...selected]);
    clearSelection();
    setShowBulkDelete(false);
  };

  // 탭 카운트 뱃지 — 할 일(미완료) / 완료함(done+cancelled)
  const todayStr = getLogicalToday();
  const listCount = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      td.status !== 'done' &&
      td.status !== 'cancelled' &&
      td.status !== 'backlog'
    ).length,
    [todos]
  );
  const doneCount = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      (td.status === 'done' || td.status === 'cancelled')
    ).length,
    [todos]
  );
  // 밀림 카운트 — '할 일' 탭 카운트 뱃지 옆에 작게 표시할 강조 숫자
  const overdueCount = useMemo(
    () => todos.filter(td =>
      td.date !== null &&
      td.date < todayStr &&
      td.status === 'active'
    ).length,
    [todos, todayStr]
  );

  return (
    <div className="relative flex flex-col h-full" style={{ backgroundColor: t.bg }}>
      {/* Header — 스크롤 위에 떠 있는 오버레이라 파스텔(H)에서만 글래스(backdrop-filter는 여기에만) */}
      <div
        className="flex-shrink-0 sticky top-0 z-10"
        style={glassBarStyle(t)}
      >
        <div className="px-3 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo size={18} color={t.accent} />
              <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text }}>할일</h1>
            </div>
            {/* 다중 선택 진입/해제 토글 (DESIGN §5 Selection mode) */}
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className="px-3 py-1.5 rounded-lg transition-colors"
              style={
                selectMode
                  ? buttonStyle(t, 'secondary')
                  : { fontSize: 12, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }
              }
            >
              <span style={{ fontSize: 12, fontWeight: 600 }}>{selectMode ? '취소' : '선택'}</span>
            </button>
          </div>

          {/* 탭 — 파스텔(H): near-neutral 트랙(borderLight) + 가로 스트레치 제거(maxWidth, 좌측정렬). 그 외 테마 무변경 */}
          <div
            className="flex gap-1 mt-3 p-1 rounded-xl"
            style={{ backgroundColor: t.borderLight, border: `1px solid ${t.border}`, maxWidth: 460 }}
          >
            {([
              { value: 'list' as Tab, label: '할 일', count: listCount, badge: overdueCount },
              { value: 'done' as Tab, label: '완료함', count: doneCount, badge: 0 },
            ]).map(({ value, label, count, badge }) => {
              const isActive = tab === value;
              return (
                <button
                  key={value}
                  onClick={() => changeTab(value)}
                  className="flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? t.text : t.textMuted,
                    position: 'relative',
                    ...(isActive
                      ? { ...solidCardStyle(t), borderRadius: undefined }
                      : { backgroundColor: 'transparent' }),
                  }}
                >
                  {/* 파스텔(H) 활성 탭: 코랄 강조는 하단 중앙 3px 언더라인으로만 (그라데이션 풀 채움 제거) */}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{ bottom: 3, width: 26, height: 3, borderRadius: 9999, background: t.primaryGradient ?? t.accent }}
                    />
                  )}
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className="inline-flex items-center justify-center px-1.5 rounded-full"
                      style={{
                        fontSize: 10,
                        minWidth: 18,
                        height: 16,
                        fontWeight: 700,
                        backgroundColor: isActive ? mixHex(t.accent, 255, 0.80) : t.borderLight,
                        color: isActive ? mixHex(t.accent, 0, 0.30) : t.textMuted,
                      }}
                    >
                      {count}
                    </span>
                  )}
                  {badge > 0 && (
                    <span
                      className="inline-flex items-center justify-center px-1.5 rounded-full"
                      style={{
                        fontSize: 10,
                        minWidth: 18,
                        height: 16,
                        fontWeight: 700,
                        backgroundColor: t.danger,
                        color: '#fff',
                      }}
                      title="밀린 할일"
                    >
                      !{badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {tab === 'list'
          ? <TodoListTab selectMode={selectMode} selected={selected} onSelectToggle={onSelectToggle} />
          : <DoneTodosTab selectMode={selectMode} selected={selected} onSelectToggle={onSelectToggle} />}
      </div>

      {/* 일괄 액션 바 (floating) — 선택 1개 이상일 때만. 모바일 하단 네비(56px) 위로 띄움 */}
      {selectMode && selected.size > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 bottom-20 lg:bottom-6"
          style={actionBarStyle(t)}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>
            {selected.size}개 선택
          </span>
          <button
            onClick={() => setShowBulkDelete(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
            style={buttonStyle(t, 'danger')}
          >
            <Trash2 size={13} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>삭제</span>
          </button>
          <button
            onClick={exitSelectMode}
            className="px-3 py-1.5 rounded-xl"
            style={{ fontSize: 12, fontWeight: 600, color: t.textSub, backgroundColor: t.lavenderTint }}
          >
            취소
          </button>
        </div>
      )}

      {showBulkDelete && (
        <ConfirmModal
          message={`선택한 할일 ${selected.size}개를 삭제할까요?`}
          confirmText="삭제"
          confirmDanger
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}
    </div>
  );
}
