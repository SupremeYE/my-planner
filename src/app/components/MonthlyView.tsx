import { useState, useEffect, useRef, useMemo } from 'react';
import {
  format, addMonths, subMonths,
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  getISOWeek, getYear,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  ChevronDown, ChevronUp, BarChart2, Sparkles,
} from 'lucide-react';
import {
  usePlanner, getWeekKey, AnnualGoal, QuarterlyGoal,
  getAnnualProfileForYear,
} from '../store';
import { useTheme } from '../ThemeContext';
import { WeeklyGoalsSection } from './WeeklyView';

type GoalTab = 'annual' | 'quarterly' | 'monthly' | 'weekly';

// ── 현재 분기 계산 ──
const currentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);
const currentYear = () => new Date().getFullYear();

export function MonthlyView() {
  const { t } = useTheme();
  const { appSettings } = usePlanner();
  const [activeTab, setActiveTab] = useState<GoalTab>('annual');

  // 탭별 독립적인 날짜 state
  const [weeklyViewDate, setWeeklyViewDate] = useState(new Date());
  const [monthlyViewDate, setMonthlyViewDate] = useState(new Date());
  const [annualYear, setAnnualYear] = useState(currentYear());

  const weekStart = startOfWeek(weeklyViewDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weeklyViewDate, { weekStartsOn: 1 });
  const weekKey = getWeekKey(weeklyViewDate);

  // 탭 목록 (분기 탭은 설정에 따라 조건부)
  const tabs: { key: GoalTab; label: string }[] = [
    { key: 'annual', label: '연간 목표' },
    ...(appSettings.showQuarterlyGoals ? [{ key: 'quarterly' as GoalTab, label: '분기 목표' }] : []),
    { key: 'monthly', label: '월간 목표' },
    { key: 'weekly', label: '주간 목표' },
  ];

  // 분기 탭이 꺼지고 현재 탭이 quarterly면 annual로 이동
  const safeTab = (!appSettings.showQuarterlyGoals && activeTab === 'quarterly') ? 'annual' : activeTab;

  const handlePrev = () => {
    if (safeTab === 'weekly') setWeeklyViewDate(subWeeks(weeklyViewDate, 1));
    else if (safeTab === 'monthly') setMonthlyViewDate(subMonths(monthlyViewDate, 1));
    else if (safeTab === 'annual' || safeTab === 'quarterly') setAnnualYear(y => y - 1);
  };
  const handleNext = () => {
    if (safeTab === 'weekly') setWeeklyViewDate(addWeeks(weeklyViewDate, 1));
    else if (safeTab === 'monthly') setMonthlyViewDate(addMonths(monthlyViewDate, 1));
    else if (safeTab === 'annual' || safeTab === 'quarterly') setAnnualYear(y => y + 1);
  };

  return (
    <div style={{ minHeight: '100%', backgroundColor: t.bg }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4"
        style={{ backgroundColor: t.sidebar, borderBottom: `1px solid ${t.border}` }}
      >
        {/* 날짜 네비게이션 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={handlePrev} className="p-2 rounded-xl" style={{ color: t.textMuted }}>
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            {safeTab === 'weekly' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
                  {getYear(weeklyViewDate)}년 {getISOWeek(weeklyViewDate)}주차
                </div>
                <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
                  {format(weekStart, 'M월 d일')} – {format(weekEnd, 'M월 d일', { locale: ko })}
                </div>
              </>
            ) : safeTab === 'monthly' ? (
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
                  {format(monthlyViewDate, 'yyyy년 M월')}
                </div>
                <div style={{ fontSize: 11, color: t.textSub, marginTop: 4 }}>
                  {getYear(monthlyViewDate)}년 연간 목표와 연결해 작성합니다
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
                {annualYear}년
              </div>
            )}
          </div>

          <button onClick={handleNext} className="p-2 rounded-xl" style={{ color: t.textMuted }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex rounded-xl overflow-hidden gap-0.5" style={{ backgroundColor: t.bgSub }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 py-2 text-center transition-all"
              style={{
                fontSize: 12,
                fontWeight: safeTab === key ? 700 : 400,
                backgroundColor: safeTab === key ? t.accent : 'transparent',
                color: safeTab === key ? '#fff' : t.textSub,
                borderRadius: 10,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {safeTab === 'annual' && (
        <AnnualGoalsContent key={annualYear} year={annualYear} />
      )}
      {safeTab === 'quarterly' && appSettings.showQuarterlyGoals && (
        <QuarterlyGoalsContent year={annualYear} />
      )}
      {safeTab === 'monthly' && (
        <MonthlyGoalsContent viewDate={monthlyViewDate} />
      )}
      {safeTab === 'weekly' && (
        <div className="p-4">
          <WeeklyGoalsSection weekKey={weekKey} viewDate={weeklyViewDate} />
        </div>
      )}
    </div>
  );
}

// ── 연간 목표 탭 ──────────────────────────────────────────────────────────────
function AnnualGoalsContent({ year }: { year: number }) {
  const { t } = useTheme();
  const { annualGoals, addAnnualGoal, toggleAnnualGoal, deleteAnnualGoal, appSettings, updateAppSettings } = usePlanner();

  const yk = String(year);
  const savedIdentity = appSettings.annualProfiles[yk]?.identity ?? '';
  const yearValues = getAnnualProfileForYear(appSettings.annualProfiles, year).values;

  const [newText, setNewText] = useState('');
  const [identityDraft, setIdentityDraft] = useState(savedIdentity);
  const [valueDraft, setValueDraft] = useState('');
  const identityTouchedRef = useRef(false);
  const profilesRef = useRef(appSettings.annualProfiles);
  profilesRef.current = appSettings.annualProfiles;

  useEffect(() => {
    if (identityTouchedRef.current) return;
    setIdentityDraft(savedIdentity);
  }, [savedIdentity]);

  const thisYearGoals = annualGoals.filter(g => g.year === year);
  const doneCount = thisYearGoals.filter(g => g.done).length;
  const pct = thisYearGoals.length ? Math.round((doneCount / thisYearGoals.length) * 100) : 0;

  useEffect(() => {
    const saved = profilesRef.current[yk]?.identity ?? '';
    if (identityDraft === saved) return;
    const id = window.setTimeout(() => {
      const all = profilesRef.current;
      const p = getAnnualProfileForYear(all, year);
      updateAppSettings({
        annualProfiles: {
          ...all,
          [yk]: { identity: identityDraft.trim(), values: p.values },
        },
      });
    }, 600);
    return () => window.clearTimeout(id);
  }, [identityDraft, year, yk, updateAppSettings]);

  const handleAdd = () => {
    if (!newText.trim()) return;
    addAnnualGoal(newText.trim(), year);
    setNewText('');
  };

  const handleAddValue = () => {
    const trimmed = valueDraft.trim();
    if (!trimmed) return;
    const p = getAnnualProfileForYear(appSettings.annualProfiles, year);
    if (p.values.length >= 3 || p.values.includes(trimmed)) return;
    updateAppSettings({
      annualProfiles: {
        ...appSettings.annualProfiles,
        [yk]: { identity: p.identity, values: [...p.values, trimmed] },
      },
    });
    setValueDraft('');
  };

  const handleRemoveValue = (v: string) => {
    const p = getAnnualProfileForYear(appSettings.annualProfiles, year);
    updateAppSettings({
      annualProfiles: {
        ...appSettings.annualProfiles,
        [yk]: { identity: p.identity, values: p.values.filter(x => x !== v) },
      },
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* 정체성 카드 */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={13} color={t.accent} />
          <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            나는 {year}년에 어떤 사람이 되고 싶은가
          </span>
        </div>
        <textarea
          value={identityDraft}
          onChange={e => {
            identityTouchedRef.current = true;
            setIdentityDraft(e.target.value);
          }}
          placeholder="한 문장으로 적어보세요..."
          rows={2}
          className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none"
          style={{
            fontSize: 14, borderColor: t.border, backgroundColor: t.bgSub, color: t.text,
            lineHeight: 1.6,
          }}
        />
        <p className="mt-2" style={{ fontSize: 11, color: t.textMuted }}>
          입력 내용은 잠시 후 자동으로 저장됩니다
        </p>
      </div>

      {/* 핵심 가치 */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          핵심 가치 (최대 3개)
        </span>
        <div className="flex flex-wrap gap-2 mt-3">
          {yearValues.map(v => (
            <span key={v} className="flex items-center gap-1 px-3 py-1 rounded-full"
              style={{ fontSize: 12, backgroundColor: t.accentLight, color: t.accent, border: `1px solid ${t.border}` }}>
              {v}
              <button type="button" onClick={() => handleRemoveValue(v)} style={{ color: t.textMuted, lineHeight: 1 }}>×</button>
            </span>
          ))}
          {yearValues.length < 3 && (
            <div className="flex items-center gap-1">
              <input
                value={valueDraft}
                onChange={e => setValueDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddValue()}
                placeholder="가치 입력..."
                className="px-2.5 py-1 rounded-full border outline-none"
                style={{ fontSize: 12, borderColor: t.border, backgroundColor: t.bgSub, color: t.text, width: 100 }}
              />
              <button type="button" onClick={handleAddValue} className="p-1 rounded-full"
                style={{ backgroundColor: t.accent, color: '#fff' }}>
                <Plus size={11} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 연간 목표 목록 */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={13} color={t.accent} />
            <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {year}년 목표
            </span>
          </div>
          {thisYearGoals.length > 0 && (
            <span style={{ fontSize: 11, color: t.textSub }}>{doneCount}/{thisYearGoals.length} · {pct}%</span>
          )}
        </div>

        {/* 프로그레스 바 */}
        {thisYearGoals.length > 0 && (
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ backgroundColor: t.bgSub }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: t.accent }} />
          </div>
        )}

        {/* 목표 아이템 */}
        <div className="space-y-2">
          {thisYearGoals.map(goal => (
            <AnnualGoalItem key={goal.id} goal={goal} onToggle={toggleAnnualGoal} onDelete={deleteAnnualGoal} />
          ))}
          {thisYearGoals.length === 0 && (
            <p style={{ fontSize: 13, color: t.textMuted }}>올해 이루고 싶은 목표를 추가해보세요</p>
          )}
        </div>

        {/* 추가 인풋 */}
        <div className="flex gap-2 mt-4">
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="새 연간 목표 추가..."
            className="flex-1 px-3 py-2 rounded-xl outline-none"
            style={{ fontSize: 13, backgroundColor: t.bgSub, color: t.text }}
          />
          <button onClick={handleAdd} className="px-3 py-2 rounded-xl"
            style={{ backgroundColor: t.accent, color: '#fff' }}>
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AnnualGoalItem({ goal, onToggle, onDelete }: {
  goal: AnnualGoal;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl"
      style={{ backgroundColor: t.bgSub }}>
      <button onClick={() => onToggle(goal.id)} className="flex-shrink-0">
        <span style={{ fontSize: 16, color: goal.done ? t.accent : t.borderLight }}>
          {goal.done ? '✓' : '○'}
        </span>
      </button>
      <span className="flex-1" style={{
        fontSize: 13, color: goal.done ? t.textSub : t.text,
        textDecoration: goal.done ? 'line-through' : 'none',
      }}>
        {goal.text}
      </span>
      <button onClick={() => onDelete(goal.id)} className="p-1 rounded-lg flex-shrink-0"
        style={{ color: t.textMuted }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── 분기 목표 탭 ──────────────────────────────────────────────────────────────
function QuarterlyGoalsContent({ year }: { year: number }) {
  const { t } = useTheme();
  const { quarterlyGoals, addQuarterlyGoal, toggleQuarterlyGoal, deleteQuarterlyGoal } = usePlanner();

  const thisYear = currentYear();
  const thisQ = currentQuarter();

  const QUARTERS = [
    { q: 1, label: '1분기', months: '1–3월' },
    { q: 2, label: '2분기', months: '4–6월' },
    { q: 3, label: '3분기', months: '7–9월' },
    { q: 4, label: '4분기', months: '10–12월' },
  ];

  const [expanded, setExpanded] = useState<number[]>([thisQ]);
  const [inputs, setInputs] = useState<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '' });

  const isCurrentQ = (q: number) => year === thisYear && q === thisQ;

  const handleAdd = (q: number) => {
    const text = inputs[q]?.trim();
    if (!text) return;
    addQuarterlyGoal(text, year, q);
    setInputs(prev => ({ ...prev, [q]: '' }));
  };

  const toggle = (q: number) => {
    setExpanded(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]);
  };

  return (
    <div className="p-4 space-y-3">
      {QUARTERS.map(({ q, label, months }) => {
        const qGoals = quarterlyGoals.filter(g => g.year === year && g.quarter === q);
        const doneCount = qGoals.filter(g => g.done).length;
        const isOpen = expanded.includes(q);
        const isCurrent = isCurrentQ(q);

        return (
          <div key={q} className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: t.card,
              border: `1px solid ${isCurrent ? t.accent : t.borderLight}`,
            }}>
            {/* 분기 헤더 */}
            <button
              onClick={() => toggle(q)}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: isCurrent ? t.accentLight : 'transparent' }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? t.accent : t.text }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: t.textMuted }}>{months}</span>
                {isCurrent && (
                  <span className="px-1.5 py-0.5 rounded-full"
                    style={{ fontSize: 9, fontWeight: 700, backgroundColor: t.accent, color: '#fff' }}>
                    현재
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {qGoals.length > 0 && (
                  <span style={{ fontSize: 11, color: t.textSub }}>{doneCount}/{qGoals.length}</span>
                )}
                {isOpen ? <ChevronUp size={14} color={t.textMuted} /> : <ChevronDown size={14} color={t.textMuted} />}
              </div>
            </button>

            {/* 분기 내용 */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 space-y-2">
                {qGoals.map(goal => (
                  <div key={goal.id} className="flex items-center gap-2.5 p-2.5 rounded-xl"
                    style={{ backgroundColor: t.bgSub }}>
                    <button onClick={() => toggleQuarterlyGoal(goal.id)} className="flex-shrink-0">
                      <span style={{ fontSize: 16, color: goal.done ? t.accent : t.borderLight }}>
                        {goal.done ? '✓' : '○'}
                      </span>
                    </button>
                    <span className="flex-1" style={{
                      fontSize: 13, color: goal.done ? t.textSub : t.text,
                      textDecoration: goal.done ? 'line-through' : 'none',
                    }}>
                      {goal.text}
                    </span>
                    <button onClick={() => deleteQuarterlyGoal(goal.id)} className="p-1 rounded-lg"
                      style={{ color: t.textMuted }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {qGoals.length === 0 && (
                  <p style={{ fontSize: 12, color: t.textMuted }}>{label} 목표를 추가해보세요</p>
                )}
                <div className="flex gap-2 mt-1">
                  <input
                    value={inputs[q] ?? ''}
                    onChange={e => setInputs(prev => ({ ...prev, [q]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAdd(q)}
                    placeholder={`${label} 목표 추가...`}
                    className="flex-1 px-3 py-2 rounded-xl outline-none"
                    style={{ fontSize: 12, backgroundColor: t.bgSub, color: t.text }}
                  />
                  <button onClick={() => handleAdd(q)} className="px-3 py-2 rounded-xl"
                    style={{ backgroundColor: t.accent, color: '#fff' }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 월간 목표 탭 ──────────────────────────────────────────────────────────────
function MonthlyGoalsContent({ viewDate }: { viewDate: Date }) {
  const {
    monthlyGoals, weeklyGoals, todos, annualGoals,
    addMonthlyGoal, updateMonthlyGoal, deleteMonthlyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
  } = usePlanner();
  const { t } = useTheme();
  const [newGoalText, setNewGoalText] = useState('');
  const [selectedAnnualId, setSelectedAnnualId] = useState('');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const currentMonth = format(viewDate, 'yyyy-MM');
  const monthYear = getYear(viewDate);
  const thisMonthGoals = monthlyGoals.filter(g => g.month === currentMonth);
  const yearAnnualGoals = useMemo(
    () => annualGoals.filter(g => g.year === monthYear),
    [annualGoals, monthYear],
  );

  useEffect(() => {
    if (yearAnnualGoals.length === 0) {
      setSelectedAnnualId('');
      return;
    }
    if (!yearAnnualGoals.some(g => g.id === selectedAnnualId)) {
      setSelectedAnnualId(yearAnnualGoals[0].id);
    }
  }, [yearAnnualGoals, selectedAnnualId]);

  const monthTodos = todos.filter(td => td.date && td.date.startsWith(currentMonth));
  const doneTodos = monthTodos.filter(td => td.status === 'done');
  const totalTodos = monthTodos.filter(td => td.status !== 'backlog' && td.status !== 'cancelled');

  const handleAddGoal = () => {
    if (!newGoalText.trim() || !selectedAnnualId) return;
    addMonthlyGoal(newGoalText.trim(), selectedAnnualId, currentMonth);
    setNewGoalText('');
  };

  return (
    <div className="p-4 space-y-4">
      {yearAnnualGoals.length === 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-2xl"
          style={{ backgroundColor: t.accentLight, border: `1px solid ${t.border}` }}>
          <Sparkles size={12} color={t.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: t.text }}>
            {monthYear}년 연간 목표가 없습니다. <strong>연간 목표</strong> 탭에서 먼저 추가한 뒤 월간 목표를 연결해 주세요.
          </p>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.accent }}>{doneTodos.length}</div>
          <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>완료한 할일</div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.text }}>
            {totalTodos.length ? Math.round((doneTodos.length / totalTodos.length) * 100) : 0}%
          </div>
          <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>달성률</div>
        </div>
      </div>

      {/* 이달의 목표 */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={14} color={t.accent} />
          <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            이달의 목표
          </span>
        </div>

        <div className="space-y-4">
          {thisMonthGoals.map(goal => {
            const subGoals = weeklyGoals.filter(g => g.monthlyGoalId === goal.id);
            const done = subGoals.filter(g => g.done).length;
            const total = subGoals.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const isExpanded = expandedGoal === goal.id;
            return (
              <div key={goal.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.borderLight}` }}>
                <div className="p-3" style={{ backgroundColor: t.bgSub }}>
                  {yearAnnualGoals.length > 0 && (
                    <div className="mb-2">
                      <label className="block mb-1" style={{ fontSize: 10, color: t.accent, fontWeight: 700 }}>
                        연간 목표 연결
                      </label>
                      <select
                        value={goal.annualGoalId && yearAnnualGoals.some(a => a.id === goal.annualGoalId)
                          ? goal.annualGoalId
                          : ''}
                        onChange={e => {
                          const v = e.target.value;
                          if (v) updateMonthlyGoal(goal.id, { annualGoalId: v });
                        }}
                        className="w-full px-2 py-1.5 rounded-lg outline-none"
                        style={{ fontSize: 12, backgroundColor: t.card, color: t.text, border: `1px solid ${t.border}` }}
                      >
                        {!goal.annualGoalId && <option value="">선택…</option>}
                        {yearAnnualGoals.map(ag => (
                          <option key={ag.id} value={ag.id}>{ag.text}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.text, flex: 1 }}>{goal.text}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>{pct}%</span>
                      <button type="button" onClick={() => deleteMonthlyGoal(goal.id)} className="p-1 rounded-lg">
                        <Trash2 size={12} color={t.textMuted} />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: t.bg }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: t.accent }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 10, color: t.textMuted }}>
                      {total === 0 ? '주간 목표를 연결하세요' : `주간 목표 ${done}/${total} 달성`}
                    </span>
                    {subGoals.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                        className="flex items-center gap-1"
                        style={{ fontSize: 11, color: t.textMuted }}
                      >
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {isExpanded ? '접기' : '보기'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && subGoals.length > 0 && (
                  <div className="p-3 space-y-2" style={{ backgroundColor: t.bg, borderTop: `1px solid ${t.borderLight}` }}>
                    {subGoals.map(sg => (
                      <div key={sg.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: t.card }}>
                        <button type="button" onClick={() => toggleWeeklyGoal(sg.id)}>
                          <span style={{ fontSize: 14, color: sg.done ? t.accent : t.borderLight }}>
                            {sg.done ? '✓' : '○'}
                          </span>
                        </button>
                        <span style={{
                          flex: 1, fontSize: 13,
                          color: sg.done ? t.textSub : t.text,
                          textDecoration: sg.done ? 'line-through' : 'none',
                        }}>
                          {sg.text}
                        </span>
                        <span style={{ fontSize: 10, color: t.textMuted }}>{sg.weekKey}</span>
                        <button type="button" onClick={() => deleteWeeklyGoal(sg.id)} className="p-1 rounded-lg">
                          <Trash2 size={11} color={t.textMuted} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {thisMonthGoals.length === 0 && (
            <p style={{ fontSize: 13, color: t.textMuted }}>이달의 목표를 추가해보세요</p>
          )}
        </div>

        <div className="space-y-2 mt-4">
          <label className="block" style={{ fontSize: 10, color: t.accent, fontWeight: 700 }}>
            연결할 연간 목표
          </label>
          <select
            value={selectedAnnualId}
            onChange={e => setSelectedAnnualId(e.target.value)}
            disabled={yearAnnualGoals.length === 0}
            className="w-full px-3 py-2 rounded-xl outline-none"
            style={{
              fontSize: 12,
              backgroundColor: t.bgSub,
              color: t.text,
              border: `1px solid ${t.border}`,
              opacity: yearAnnualGoals.length === 0 ? 0.5 : 1,
            }}
          >
            {yearAnnualGoals.length === 0 ? (
              <option value="">연간 목표를 먼저 추가하세요</option>
            ) : (
              yearAnnualGoals.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.text}</option>
              ))
            )}
          </select>
          <div className="flex gap-2">
            <input
              value={newGoalText}
              onChange={e => setNewGoalText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
              placeholder="새 월간 목표 추가..."
              className="flex-1 px-3 py-2 rounded-xl outline-none"
              style={{ fontSize: 13, backgroundColor: t.bgSub, color: t.text }}
            />
            <button
              type="button"
              onClick={handleAddGoal}
              disabled={!selectedAnnualId || !newGoalText.trim()}
              className="px-3 py-2 rounded-xl"
              style={{
                backgroundColor: t.accent,
                color: '#fff',
                opacity: !selectedAnnualId || !newGoalText.trim() ? 0.45 : 1,
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
