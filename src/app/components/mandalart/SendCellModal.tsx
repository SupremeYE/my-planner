import { useMemo, useState } from 'react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { usePlanner } from '../../store';
import type { Notify } from '../culture/CultureToast';
import type { Todo, WeeklyGoal, MonthlyGoal, AnnualGoal } from '../../store';

interface Props {
  cellId: string;
  defaultText: string;
  /** 행동 셀 = true, 세부 셀 = false. 라벨 보정용. */
  isAction: boolean;
  onClose: () => void;
  onNotify: Notify;
}

type Target = 'annual' | 'monthly' | 'weekly' | 'todo';

// 짧은 random id — 기존 store.newId() 와 동일 패턴
const newId = () => Math.random().toString(36).slice(2, 9);

// ISO 8601 주차 키 (예: 2026-W23)
function isoWeekKey(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekKeyToMonday(weekKey: string): string | undefined {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekKey);
  if (!m) return undefined;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const y = target.getUTCFullYear();
  const mo = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

export function SendCellModal({ cellId, defaultText, isAction, onClose, onNotify }: Props) {
  const { t } = useTheme();
  const { annualGoals, monthlyGoals, weeklyGoals, todos } = usePlanner();

  // 기본 선택 — 행동 칸은 할일, 세부 칸은 주간 목표 추천
  const [target, setTarget] = useState<Target>(isAction ? 'todo' : 'weekly');
  const [text, setText] = useState(defaultText);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentWeek = useMemo(() => isoWeekKey(now), [now]);
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }, [now]);

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<string>(currentMonth);
  const [weekKey, setWeekKey] = useState<string>(currentWeek);
  const [todoDate, setTodoDate] = useState<string>(todayStr);
  const [todoWeeklyGoalId, setTodoWeeklyGoalId] = useState<string>('');
  const [monthlyAnnualId, setMonthlyAnnualId] = useState<string>('');
  const [weeklyMonthlyId, setWeeklyMonthlyId] = useState<string>('');

  // 이미 이 셀에서 보낸 적 있는지 (각 종류별)
  const sentMap = useMemo(() => ({
    annual: annualGoals.some(g => g.mandalartCellId === cellId),
    monthly: monthlyGoals.some(g => g.mandalartCellId === cellId),
    weekly: weeklyGoals.some(g => g.mandalartCellId === cellId),
    todo: todos.some(td => td.mandalartCellId === cellId),
  }), [annualGoals, monthlyGoals, weeklyGoals, todos, cellId]);

  const annualOptionsForYear = useMemo(
    () => annualGoals.filter(g => g.year === year),
    [annualGoals, year],
  );
  const monthlyOptionsForMonth = useMemo(
    () => monthlyGoals.filter(g => g.month === month),
    [monthlyGoals, month],
  );
  const weeklyOptionsForKey = useMemo(
    () => weeklyGoals.filter(g => g.weekKey === weekKey),
    [weeklyGoals, weekKey],
  );

  // 행동 → 할일 전송 시: 같은 셀의 부모 세부에서 이미 만든 주간 목표가 있다면 자동 제안 (Phase 3에서 정교화)
  const sendDisabled = !text.trim() || sentMap[target];

  const submit = async () => {
    const txt = text.trim();
    if (!txt) return;

    if (target === 'annual') {
      const goal: AnnualGoal = {
        id: newId(), year, text: txt, done: false, mandalartCellId: cellId,
      };
      await db.annualGoals.upsert(goal);
      onNotify(`연간 ${year} 목표로 보냈어요`, 'success');
    } else if (target === 'monthly') {
      const goal: MonthlyGoal = {
        id: newId(), text: txt, month,
        annualGoalId: monthlyAnnualId || undefined,
        mandalartCellId: cellId,
      };
      await db.monthlyGoals.upsert(goal);
      onNotify(`월간 ${month} 목표로 보냈어요`, 'success');
    } else if (target === 'weekly') {
      const goal: WeeklyGoal = {
        id: newId(), text: txt, done: false, weekKey,
        monthlyGoalId: weeklyMonthlyId || undefined,
        mandalartCellId: cellId,
      };
      await db.weeklyGoals.upsert(goal);
      onNotify(`주간 ${weekKey} 목표로 보냈어요`, 'success');
    } else {
      const todo: Todo = {
        id: newId(), text: txt,
        date: todoDate || null,
        status: 'active', isTop3: false,
        weeklyGoalId: todoWeeklyGoalId || undefined,
        mandalartCellId: cellId,
      };
      await db.todos.upsert(todo);
      onNotify('할일로 보냈어요', 'success');
    }
    onClose();
  };

  // 주간 선택 옵션 — 현재 주를 포함한 연중 모든 주 (간단히 12주: 전후 ±6주)
  const weekChoices = useMemo(() => {
    const arr: string[] = [];
    const base = new Date(now);
    for (let i = -6; i <= 12; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i * 7);
      arr.push(isoWeekKey(d));
    }
    return Array.from(new Set(arr));
  }, [now]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl lg:rounded-2xl p-5"
        style={{ backgroundColor: t.card, maxWidth: 440, maxHeight: '88vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, fontFamily: t.fontLabel }}>
              만다라트 칸 보내기
            </div>
            <div style={{
              fontFamily: t.fontPageTitle, // 모달 최상위 제목
              fontSize: 20, color: t.text, marginTop: 2,
            }}>
              어디로 보낼까요?
            </div>
          </div>
        </div>

        {/* 텍스트 (편집 가능) */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          placeholder="보낼 내용"
          className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none mb-3"
          style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
        />

        {/* 종류 탭 */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(['annual', 'monthly', 'weekly', 'todo'] as const).map(k => {
            const active = target === k;
            const sent = sentMap[k];
            const label = k === 'annual' ? '연간' : k === 'monthly' ? '월간' : k === 'weekly' ? '주간' : '할일';
            return (
              <button
                key={k}
                onClick={() => setTarget(k)}
                className="py-2 rounded-xl flex items-center justify-center gap-1"
                style={{
                  fontSize: 12, fontWeight: 700,
                  color: active ? '#fff' : (sent ? t.textMuted : t.text),
                  backgroundColor: active ? t.accent : t.bgSub,
                  border: `1px solid ${active ? t.accent : t.borderLight}`,
                }}
              >
                {label}
                {sent && <span style={{ fontSize: 10 }}>✦</span>}
              </button>
            );
          })}
        </div>

        {/* 종류별 옵션 */}
        {target === 'annual' && (
          <Field label="연도">
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value || `${currentYear}`, 10))}
              min={2020} max={2099}
              className="w-full rounded-xl px-3 py-2 border outline-none"
              style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
            />
          </Field>
        )}

        {target === 'monthly' && (
          <>
            <Field label="월 (yyyy-MM)">
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value || currentMonth)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
              />
            </Field>
            <Field label={`연결할 연간 목표 (선택, ${month.slice(0, 4)})`}>
              <select
                value={monthlyAnnualId}
                onChange={e => setMonthlyAnnualId(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
              >
                <option value="">연결 없음</option>
                {annualOptionsForYear
                  .filter(g => g.year === parseInt(month.slice(0, 4), 10))
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.text}</option>
                  ))}
              </select>
            </Field>
          </>
        )}

        {target === 'weekly' && (
          <>
            <Field label="주차 (ISO)">
              <select
                value={weekKey}
                onChange={e => setWeekKey(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
              >
                {weekChoices.map(wk => (
                  <option key={wk} value={wk}>
                    {wk}{wk === currentWeek ? ' (이번 주)' : ''}
                  </option>
                ))}
              </select>
              {weekKeyToMonday(weekKey) && (
                <p className="mt-1" style={{ fontSize: 11, color: t.textMuted }}>
                  시작일: {weekKeyToMonday(weekKey)}
                </p>
              )}
            </Field>
            <Field label="연결할 월간 목표 (선택)">
              <select
                value={weeklyMonthlyId}
                onChange={e => setWeeklyMonthlyId(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
              >
                <option value="">연결 없음</option>
                {monthlyGoals.map(g => (
                  <option key={g.id} value={g.id}>[{g.month}] {g.text}</option>
                ))}
              </select>
            </Field>
          </>
        )}

        {target === 'todo' && (
          <>
            <Field label="날짜 (선택)">
              <input
                type="date"
                value={todoDate}
                onChange={e => setTodoDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
              />
              <button
                type="button"
                onClick={() => setTodoDate('')}
                className="mt-1"
                style={{ fontSize: 11, color: t.textMuted }}
              >날짜 없이 (미지정 할일로)</button>
            </Field>
            <Field label="연결할 주간 목표 (선택)">
              <select
                value={todoWeeklyGoalId}
                onChange={e => setTodoWeeklyGoalId(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text }}
              >
                <option value="">연결 없음</option>
                {weeklyOptionsForKey.length > 0 && (
                  <optgroup label={`이번 주 (${currentWeek})`}>
                    {weeklyOptionsForKey.map(g => (
                      <option key={g.id} value={g.id}>{g.text}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="전체">
                  {weeklyGoals.map(g => (
                    <option key={g.id} value={g.id}>[{g.weekKey}] {g.text}</option>
                  ))}
                </optgroup>
              </select>
            </Field>
          </>
        )}

        {sentMap[target] && (
          <p className="mt-2 rounded-xl px-3 py-2" style={{
            fontSize: 12, color: t.accent, backgroundColor: t.accentLight,
            border: `1px solid ${t.accent}33`,
          }}>
            이미 이 칸을 {target === 'annual' ? '연간' : target === 'monthly' ? '월간' : target === 'weekly' ? '주간' : '할일'}로 보냈어요. 다른 종류로 보낼 수 있어요.
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl"
            style={{ fontSize: 13, color: t.textMuted, backgroundColor: t.bgSub }}
          >취소</button>
          <button
            onClick={submit}
            disabled={sendDisabled}
            className="px-4 py-2 rounded-xl"
            style={{
              fontSize: 13, color: '#fff', backgroundColor: t.accent,
              opacity: sendDisabled ? 0.4 : 1,
            }}
          >보내기</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="mb-2.5">
      <div className="mb-1" style={{ fontSize: 11, color: t.textMuted }}>{label}</div>
      {children}
    </div>
  );
}
