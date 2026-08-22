import { useEffect, useMemo, useState } from 'react';
import { format, addMonths, subMonths, getYear } from 'date-fns';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Trash2, Sparkles, ListChecks,
} from 'lucide-react';
import {
  usePlanner, getWeekKey, getAnnualProfileForYear,
  type MonthlyGoal, type WeeklyGoal, type RetroStatus, type Todo,
} from '../../store';
import { useTheme, type ThemeTokens } from '../../ThemeContext';
import {
  solidCardStyle, selectedRowStyle, periodStepperStyle, inputBg,
  retroStatusStyle, retroStatusColor, buttonStyle,
} from '../../styles/haonStyles';
import { monthlyRollup } from './periodProgress';
import { WeeklyTodosInline } from './WeeklyTodosInline';
import { MandalartSourceBadge } from '../mandalart/MandalartSourceBadge';

// ── 목표 페이지 "기간별" — 월간 중심 재구성 (DESIGN.md §5 "목표 페이지 — 기간별(월간 중심)") ──
// 캐스케이드 폐기: 연간 목표 없이도 월간 추가 가능. 월간이 주인공.
// PC = 2컬럼 master-detail / 모바일 = 세로 아코디언. 동일 컴포넌트 `lg:` 분기.
export function GoalsMonthlyBoard() {
  const { t } = useTheme();
  const {
    monthlyGoals, weeklyGoals, todos,
    addMonthlyGoal, deleteMonthlyGoal,
    appSettings, updateAppSettings,
  } = usePlanner();

  const [viewDate, setViewDate] = useState(() => new Date());
  const currentMonth = format(viewDate, 'yyyy-MM');
  const year = getYear(viewDate);

  const monthGoals = useMemo(
    () => monthlyGoals.filter(g => g.month === currentMonth),
    [monthlyGoals, currentMonth],
  );

  // PC 선택 상태 — 보드 변경(월 이동/삭제)에 안전하도록 effect 로 정합 보정
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (monthGoals.length === 0) { setSelectedId(null); return; }
    if (!monthGoals.some(g => g.id === selectedId)) setSelectedId(monthGoals[0].id);
  }, [monthGoals, selectedId]);

  // 모바일 아코디언 펼침 상태
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selectedGoal = monthGoals.find(g => g.id === selectedId) ?? null;

  const handleAddMonthly = (text: string) => {
    addMonthlyGoal(text, currentMonth);
  };

  return (
    <div style={{ minHeight: '100%', backgroundColor: t.bg }} className="pb-10">
      <div className="px-4 lg:px-8 pt-2">
        {/* 연간 배너 (얇게) — 비어 있어도 화면을 막지 않는다 */}
        <AnnualBanner year={year} appSettings={appSettings} updateAppSettings={updateAppSettings} t={t} />

        {/* 기간 네비 ‹ YYYY년 M월 › */}
        <div className="flex items-center justify-center gap-4 mt-4 mb-5">
          <button
            aria-label="이전 달"
            onClick={() => setViewDate(d => subMonths(d, 1))}
            style={{ ...periodStepperStyle(t), width: 34, height: 34 }}
          >
            <ChevronLeft size={17} />
          </button>
          <div style={{ fontFamily: t.fontBody, fontSize: 18, fontWeight: 700, color: t.text }}>
            {format(viewDate, 'yyyy년 M월')}
          </div>
          <button
            aria-label="다음 달"
            onClick={() => setViewDate(d => addMonths(d, 1))}
            style={{ ...periodStepperStyle(t), width: 34, height: 34 }}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {/* ── PC: 2컬럼 master-detail ───────────────────────────── */}
      <div className="hidden lg:grid px-8 gap-5" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start' }}>
        {/* 좌: 이번 달 월간 목표 리스트 */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1 mb-1">
            <span style={{ fontSize: 12, color: t.textSub, fontWeight: 700 }}>
              {format(viewDate, 'M월')} 목표
            </span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{monthGoals.length}</span>
          </div>

          {monthGoals.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className="text-left p-3.5 transition-all"
              style={{
                ...solidCardStyle(t),
                ...(selectedId === g.id ? selectedRowStyle(t) : null),
                cursor: 'pointer',
              }}
            >
              <MonthlyCardSummary goal={g} weeklyGoals={weeklyGoals} todos={todos} t={t} />
            </button>
          ))}

          {monthGoals.length === 0 && (
            <MonthlyEmpty t={t} onAdd={handleAddMonthly} />
          )}

          {monthGoals.length > 0 && (
            <AddMonthlyRow t={t} onAdd={handleAddMonthly} />
          )}
        </div>

        {/* 우: 선택된 월간 목표 상세 */}
        <div style={{ ...solidCardStyle(t), padding: 20, minHeight: 320 }}>
          {selectedGoal ? (
            <MonthlyGoalDetail key={selectedGoal.id} goal={selectedGoal} viewDate={viewDate} onDelete={() => deleteMonthlyGoal(selectedGoal.id)} t={t} />
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full py-16" style={{ minHeight: 260 }}>
              <ListChecks size={28} color={t.textMuted} style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: t.textSub, fontWeight: 600 }}>이번 달 목표를 추가해보세요</p>
              <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                연간 목표 없이도 바로 추가할 수 있어요
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 모바일: 세로 아코디언 ───────────────────────────── */}
      <div className="lg:hidden px-4 flex flex-col gap-3">
        {monthGoals.map(g => {
          const open = expandedId === g.id;
          return (
            <div key={g.id} style={{ ...solidCardStyle(t), overflow: 'hidden' }}>
              <button
                onClick={() => setExpandedId(open ? null : g.id)}
                className="w-full text-left p-3.5"
                style={{ cursor: 'pointer' }}
              >
                <MonthlyCardSummary goal={g} weeklyGoals={weeklyGoals} todos={todos} t={t} chevron={open ? 'up' : 'down'} />
              </button>
              {open && (
                <div className="px-3.5 pb-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
                  <div className="pt-3">
                    <MonthlyGoalDetail goal={g} viewDate={viewDate} onDelete={() => deleteMonthlyGoal(g.id)} t={t} compact />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {monthGoals.length === 0 && (
          <MonthlyEmpty t={t} onAdd={handleAddMonthly} />
        )}
        {monthGoals.length > 0 && (
          <AddMonthlyRow t={t} onAdd={handleAddMonthly} />
        )}
      </div>
    </div>
  );
}

// ─── 연간 배너 (얇게) ─────────────────────────────────────────
function AnnualBanner({ year, appSettings, updateAppSettings, t }: {
  year: number;
  appSettings: { annualProfiles: Record<string, { identity: string; values: string[] }> };
  updateAppSettings: (patch: { annualProfiles: Record<string, { identity: string; values: string[] }> }) => void;
  t: ThemeTokens;
}) {
  const yk = String(year);
  const profile = getAnnualProfileForYear(appSettings.annualProfiles, year);
  const [identityDraft, setIdentityDraft] = useState(profile.identity);
  const [valueDraft, setValueDraft] = useState('');
  const [editing, setEditing] = useState(false);

  // 외부 저장값 동기화 (연도 전환 시)
  useEffect(() => { setIdentityDraft(profile.identity); }, [profile.identity, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (identity: string, values: string[]) => {
    updateAppSettings({ annualProfiles: { ...appSettings.annualProfiles, [yk]: { identity: identity.trim(), values } } });
  };
  const commitIdentity = () => {
    if (identityDraft.trim() !== profile.identity) save(identityDraft, profile.values);
  };
  const addValue = () => {
    const v = valueDraft.trim();
    if (!v || profile.values.length >= 3 || profile.values.includes(v)) return;
    save(profile.identity, [...profile.values, v]);
    setValueDraft('');
  };
  const removeValue = (v: string) => save(profile.identity, profile.values.filter(x => x !== v));

  const hasContent = !!profile.identity || profile.values.length > 0;

  return (
    <div style={{ ...solidCardStyle(t), padding: '12px 16px' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={12} color={t.accent} />
        <span style={{ fontSize: 10.5, color: t.accent, fontWeight: 700, letterSpacing: '0.05em' }}>
          {year}년에 되고 싶은 나
        </span>
        {(hasContent && !editing) && (
          <button onClick={() => setEditing(true)} className="ml-auto" style={{ fontSize: 11, color: t.textMuted }}>
            편집
          </button>
        )}
      </div>

      {(editing || !profile.identity) ? (
        <input
          value={identityDraft}
          onChange={e => setIdentityDraft(e.target.value)}
          onBlur={commitIdentity}
          onKeyDown={e => { if (e.key === 'Enter') { commitIdentity(); (e.target as HTMLInputElement).blur(); } }}
          placeholder="한 문장으로 적어보세요 (비워둬도 괜찮아요)"
          className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
          style={{ fontSize: 13, backgroundColor: inputBg(t), borderColor: t.border, color: t.text }}
        />
      ) : (
        <p style={{ fontSize: 13.5, color: t.text, lineHeight: 1.5 }}>{profile.identity}</p>
      )}

      {/* 핵심 가치 칩 (최대 3) */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {profile.values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
            // 핵심 가치 = 정보성 칩(선택/활성 아님) → 중립 surfaceMuted. 라일락(accentSoft) 금지 (§3 restraint)
            style={{ fontSize: 11.5, backgroundColor: t.surfaceMuted, color: t.textSub, border: `1px solid ${t.border}` }}>
            {v}
            {(editing || !profile.identity) && (
              <button onClick={() => removeValue(v)} style={{ color: t.textMuted, lineHeight: 1 }}>×</button>
            )}
          </span>
        ))}
        {profile.values.length < 3 && (editing || !hasContent) && (
          <span className="inline-flex items-center gap-1">
            <input
              value={valueDraft}
              onChange={e => setValueDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addValue()}
              placeholder="핵심 가치"
              className="px-2 py-0.5 rounded-full border outline-none"
              style={{ fontSize: 11.5, width: 84, backgroundColor: inputBg(t), borderColor: t.border, color: t.text }}
            />
            <button onClick={addValue} className="p-0.5 rounded-full" style={{ backgroundColor: t.accent, color: '#fff' }}>
              <Plus size={10} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 월간 카드 요약 (제목 + 진행바 + 메타) — PC 리스트/모바일 헤더 공용 ───
function MonthlyCardSummary({ goal, weeklyGoals, todos, t, chevron }: {
  goal: MonthlyGoal; weeklyGoals: WeeklyGoal[]; todos: Todo[]; t: ThemeTokens;
  chevron?: 'up' | 'down';
}) {
  const r = monthlyRollup(goal, weeklyGoals, todos);
  const weekN = weeklyGoals.filter(w => w.monthlyGoalId === goal.id).length;
  return (
    <div>
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0" style={{ fontFamily: t.fontSection, fontSize: 14.5, fontWeight: 600, color: t.text, wordBreak: 'break-word' }}>
          {goal.text}
        </span>
        {goal.retroStatus && <RetroBadge status={goal.retroStatus} t={t} />}
        {chevron === 'up' ? <ChevronUp size={15} style={{ color: t.textMuted, marginTop: 2, flexShrink: 0 }} />
          : chevron === 'down' ? <ChevronDown size={15} style={{ color: t.textMuted, marginTop: 2, flexShrink: 0 }} /> : null}
      </div>
      {goal.mandalartCellId && <div className="mt-1"><MandalartSourceBadge /></div>}
      <ProgressBar pct={r.pct} t={t} />
      <div className="flex items-center justify-between mt-1" style={{ fontSize: 11, color: t.textMuted }}>
        <span>주간 {weekN}</span>
        <span style={{ fontFamily: t.fontNumeric }}>{r.total > 0 ? `${r.done}/${r.total} · ` : ''}{r.pct}%</span>
      </div>
    </div>
  );
}

// ─── 월간 목표 상세 (주간 목표 + 회고 슬롯) — PC 우측 / 모바일 펼침 공용 ───
function MonthlyGoalDetail({ goal, viewDate, onDelete, t, compact }: {
  goal: MonthlyGoal; viewDate: Date; onDelete: () => void; t: ThemeTokens; compact?: boolean;
}) {
  const {
    weeklyGoals, todos, annualGoals,
    addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
    updateMonthlyGoal,
  } = usePlanner();

  const subWeeks = useMemo(
    () => weeklyGoals.filter(w => w.monthlyGoalId === goal.id),
    [weeklyGoals, goal.id],
  );
  const weeks = useMemo(() => weeksOfMonth(viewDate), [viewDate]);
  const weekLabel = (weekKey: string) => weeks.find(w => w.weekKey === weekKey)?.label ?? weekKey;

  const year = getYear(viewDate);
  const yearAnnual = useMemo(() => annualGoals.filter(g => g.year === year), [annualGoals, year]);

  const r = monthlyRollup(goal, weeklyGoals, todos);

  return (
    <div>
      {/* 상세 헤더 (PC 전용 — 모바일은 카드 헤더가 이미 제목을 보여줌) */}
      {!compact && (
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div style={{ fontFamily: t.fontSection, fontSize: 18, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>
              {goal.text}
            </div>
            <ProgressBar pct={r.pct} t={t} wide />
            <div className="mt-1" style={{ fontSize: 11.5, color: t.textMuted, fontFamily: t.fontNumeric }}>
              {r.total > 0 ? `${r.done}/${r.total} · ` : ''}{r.pct}%
            </div>
          </div>
          <button onClick={onDelete} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: t.textMuted }}>
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* 연간 목표 연결 (있을 때만 — 없어도 화면을 막지 않음) */}
      {yearAnnual.length > 0 && (
        <div className="mb-4">
          <label className="block mb-1" style={{ fontSize: 10.5, color: t.textSub, fontWeight: 700 }}>연간 목표 연결</label>
          <select
            value={goal.annualGoalId && yearAnnual.some(a => a.id === goal.annualGoalId) ? goal.annualGoalId : ''}
            onChange={e => updateMonthlyGoal(goal.id, { annualGoalId: e.target.value || undefined })}
            className="w-full px-2.5 py-1.5 rounded-lg outline-none"
            style={{ fontSize: 12.5, backgroundColor: t.surfaceMuted, color: t.text, border: `1px solid ${t.border}` }}
          >
            <option value="">연결 안 함</option>
            {yearAnnual.map(a => <option key={a.id} value={a.id}>{a.text}</option>)}
          </select>
        </div>
      )}

      {/* 주간 목표 (자식으로 중첩) */}
      <div className="mb-1 flex items-center justify-between">
        <span style={{ fontSize: 11.5, color: t.textSub, fontWeight: 700 }}>주간 목표</span>
        <span style={{ fontSize: 11, color: t.textMuted }}>{subWeeks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {subWeeks.map(w => (
          <WeeklyGoalRow
            key={w.id}
            weekly={w}
            weekLabel={weekLabel(w.weekKey)}
            todos={todos}
            onToggle={() => toggleWeeklyGoal(w.id)}
            onDelete={() => deleteWeeklyGoal(w.id)}
            t={t}
          />
        ))}
        {subWeeks.length === 0 && (
          <p style={{ fontSize: 12, color: t.textMuted, padding: '4px 2px' }}>
            주간 목표를 추가해 이 달을 쪼개보세요
          </p>
        )}
      </div>

      <AddWeeklyRow
        t={t}
        weeks={weeks}
        defaultWeekKey={defaultWeekKeyForMonth(viewDate)}
        onAdd={(text, weekKey) => addWeeklyGoal(text, goal.id, weekKey)}
      />

      {/* 월말 회고 슬롯 */}
      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
        <RetroSlot goal={goal} onChange={changes => updateMonthlyGoal(goal.id, changes)} t={t} />
      </div>

      {/* 모바일 펼침에서 삭제 (compact) */}
      {compact && (
        <button onClick={onDelete} className="mt-4 inline-flex items-center gap-1" style={{ fontSize: 12, color: t.danger }}>
          <Trash2 size={12} /> 이 월간 목표 삭제
        </button>
      )}
    </div>
  );
}

// ─── 주간 목표 행 (연결된 할일 수 표시) ───
function WeeklyGoalRow({ weekly, weekLabel, todos, onToggle, onDelete, t }: {
  weekly: WeeklyGoal; weekLabel: string; todos: Todo[];
  onToggle: () => void; onDelete: () => void; t: ThemeTokens;
}) {
  const linked = todos.filter(td => td.weeklyGoalId === weekly.id && td.status !== 'backlog' && td.status !== 'cancelled');
  const doneN = linked.filter(td => td.status === 'done').length;
  return (
    <div style={{ ...solidCardStyle(t), padding: 12 }}>
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
          <span style={{ fontSize: 16, color: weekly.done ? t.success : t.borderLight }}>{weekly.done ? '✓' : '○'}</span>
        </button>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.04em' }}>{weekLabel}</div>
          <div style={{
            fontSize: 13, fontWeight: 600, marginTop: 1,
            color: weekly.done ? t.textMuted : t.text,
            textDecoration: weekly.done ? 'line-through' : 'none',
            wordBreak: 'break-word',
          }}>
            {weekly.text}
          </div>
          {weekly.mandalartCellId && <div className="mt-1"><MandalartSourceBadge /></div>}
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ fontSize: 10.5, color: t.textSub, backgroundColor: t.surfaceMuted, fontFamily: t.fontNumeric }}>
          <ListChecks size={10} /> {doneN}/{linked.length}
        </span>
        <button onClick={onDelete} className="p-1 flex-shrink-0" style={{ color: t.textMuted }}>
          <Trash2 size={11} />
        </button>
      </div>
      <WeeklyTodosInline weeklyGoalId={weekly.id} weekKey={weekly.weekKey} />
    </div>
  );
}

// ─── 월말 회고 슬롯 (달성/부분/미달 + 한 줄) ───
const RETRO_OPTIONS: { key: RetroStatus; label: string }[] = [
  { key: 'done', label: '달성' },
  { key: 'partial', label: '부분' },
  { key: 'missed', label: '미달' },
];

function RetroSlot({ goal, onChange, t }: {
  goal: MonthlyGoal; onChange: (c: { retroStatus?: RetroStatus; retroNote?: string }) => void; t: ThemeTokens;
}) {
  const [note, setNote] = useState(goal.retroNote ?? '');
  useEffect(() => { setNote(goal.retroNote ?? ''); }, [goal.id, goal.retroNote]);

  const pickStatus = (s: RetroStatus) => {
    onChange({ retroStatus: goal.retroStatus === s ? undefined : s });
  };
  const commitNote = () => {
    if ((note.trim() || undefined) !== (goal.retroNote || undefined)) {
      onChange({ retroNote: note.trim() || undefined });
    }
  };

  return (
    <div>
      <span style={{ fontSize: 11.5, color: t.textSub, fontWeight: 700 }}>월말 회고</span>
      {/* 버튼이 백지보다 먼저 */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {RETRO_OPTIONS.map(o => {
          const selected = goal.retroStatus === o.key;
          return (
            <button
              key={o.key}
              onClick={() => pickStatus(o.key)}
              className="py-2 text-center transition-all"
              style={{ ...retroStatusStyle(t, o.key, selected), fontSize: 13, fontWeight: 600 }}
            >
              <span style={{ color: selected ? retroStatusColor(t, o.key) : t.textMuted, marginRight: 4 }}>●</span>
              {o.label}
            </button>
          );
        })}
      </div>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={commitNote}
        onKeyDown={e => { if (e.key === 'Enter') { commitNote(); (e.target as HTMLInputElement).blur(); } }}
        placeholder="한 줄 회고 (선택)"
        className="w-full mt-2 px-3 py-2 rounded-lg border outline-none"
        style={{ fontSize: 13, backgroundColor: inputBg(t), borderColor: t.border, color: t.text }}
      />
    </div>
  );
}

function RetroBadge({ status, t }: { status: RetroStatus; t: ThemeTokens }) {
  const label = status === 'done' ? '달성' : status === 'partial' ? '부분' : '미달';
  const c = retroStatusColor(t, status);
  return (
    <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ fontSize: 9.5, fontWeight: 700, color: c, backgroundColor: t.card, border: `1px solid ${c}` }}>
      {label}
    </span>
  );
}

// ─── 진행바 (얇은 바 — surfaceMuted 트랙 + success 채움) ───
function ProgressBar({ pct, t, wide }: { pct: number; t: ThemeTokens; wide?: boolean }) {
  return (
    <div className={wide ? 'mt-2.5' : 'mt-1.5'} style={{ height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: t.surfaceMuted }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: t.success, borderRadius: 999, transition: 'width 0.25s' }} />
    </div>
  );
}

// ─── 빈 상태: 월간 목표 없음 → 바로 추가 어피던스 (차단 문구 없음) ───
function MonthlyEmpty({ t, onAdd }: { t: ThemeTokens; onAdd: (text: string) => void }) {
  return (
    <div style={{ ...solidCardStyle(t), padding: 16 }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles size={13} color={t.accent} />
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>이번 달 목표를 추가해보세요</span>
      </div>
      <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5, marginBottom: 10 }}>
        연간 목표 없이도 바로 추가할 수 있어요. 이 달에 이루고 싶은 것을 한 줄로 적어보세요.
      </p>
      <AddMonthlyRow t={t} onAdd={onAdd} autoFocus />
    </div>
  );
}

// ─── 월간 목표 추가 행 ───
function AddMonthlyRow({ t, onAdd, autoFocus }: { t: ThemeTokens; onAdd: (text: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const submit = () => { const v = text.trim(); if (!v) return; onAdd(v); setText(''); };
  return (
    <div className="flex gap-2">
      <input
        autoFocus={autoFocus}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="새 월간 목표..."
        className="flex-1 px-3 py-2 rounded-xl border outline-none"
        style={{ fontSize: 13, backgroundColor: inputBg(t), borderColor: t.border, color: t.text }}
      />
      <button onClick={submit} className="px-3 rounded-xl flex items-center justify-center" style={{ ...buttonStyle(t, 'primary'), minWidth: 40 }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

// ─── 주간 목표 추가 행 (주차 선택 포함) ───
function AddWeeklyRow({ t, weeks, defaultWeekKey, onAdd }: {
  t: ThemeTokens; weeks: { weekKey: string; label: string }[]; defaultWeekKey: string;
  onAdd: (text: string, weekKey: string) => void;
}) {
  const [text, setText] = useState('');
  const [weekKey, setWeekKey] = useState(defaultWeekKey);
  useEffect(() => { setWeekKey(defaultWeekKey); }, [defaultWeekKey]);
  const submit = () => { const v = text.trim(); if (!v) return; onAdd(v, weekKey); setText(''); };
  return (
    <div className="flex gap-2 mt-2">
      <select
        value={weekKey}
        onChange={e => setWeekKey(e.target.value)}
        className="px-2 py-2 rounded-xl outline-none"
        style={{ fontSize: 12, backgroundColor: inputBg(t), border: `1px solid ${t.border}`, color: t.text, flexShrink: 0 }}
      >
        {weeks.map(w => <option key={w.weekKey} value={w.weekKey}>{w.label}</option>)}
      </select>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="새 주간 목표..."
        className="flex-1 min-w-0 px-3 py-2 rounded-xl border outline-none"
        style={{ fontSize: 13, backgroundColor: inputBg(t), borderColor: t.border, color: t.text }}
      />
      <button onClick={submit} className="px-3 rounded-xl flex items-center justify-center" style={{ ...buttonStyle(t, 'secondary'), minWidth: 40 }}>
        <Plus size={15} />
      </button>
    </div>
  );
}

// ─── 날짜 유틸: 그 달에 "속하는" ISO 주 목록 + 라벨 "M월 N주차" ───
// 주(월~일)는 그 주의 "목요일이 속한 달"에 배정한다(ISO 논리와 동일 = 과반이 속한 달).
// 예) 8/1(토)~8/2(일) 주는 목요일이 7/30 → 7월 마지막 주차로 넘어가고, 8월은 8/3~8/9이 1주차.
//     8/31~9/6 주는 목요일이 9/3 → 9월 1주차. 부분 주가 앞뒤 달로 끌려가 체감과 맞춘다.
// weekKey(ISO) 자체는 store.getWeekKey 그대로 — 바뀌는 건 "N주차" 라벨과 목록 구성뿐.
function weeksOfMonth(viewDate: Date): { weekKey: string; label: string }[] {
  const year = viewDate.getFullYear();
  const month0 = viewDate.getMonth();
  const monthNum = month0 + 1;
  const last = new Date(year, month0 + 1, 0).getDate();
  const seen = new Set<string>();
  const out: { weekKey: string; label: string }[] = [];
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month0, day);
    // 이 날이 속한 ISO 주(월요일 시작)의 목요일을 구해 배정 달을 판정.
    const dow = (d.getDay() + 6) % 7; // 0=월 … 6=일
    const thu = new Date(year, month0, day - dow + 3);
    if (thu.getFullYear() !== year || thu.getMonth() !== month0) continue; // 목요일이 다른 달이면 그 달 몫
    const wk = getWeekKey(d);
    if (!seen.has(wk)) {
      seen.add(wk);
      out.push({ weekKey: wk, label: `${monthNum}월 ${out.length + 1}주차` });
    }
  }
  return out;
}

// 이번 달을 보고 있고 현재 주가 이 달에 배정됐으면 현재 주, 아니면 그 달 첫 주.
// (경계 주간 — 오늘의 주가 목요일 기준으로 옆 달에 배정된 경우 — 목록에 없는 weekKey 가
//  기본값이 되지 않도록 항상 weeksOfMonth 안의 값으로 되돌린다.)
function defaultWeekKeyForMonth(viewDate: Date): string {
  const weeks = weeksOfMonth(viewDate);
  const now = new Date();
  if (now.getFullYear() === viewDate.getFullYear() && now.getMonth() === viewDate.getMonth()) {
    const nowKey = getWeekKey(now);
    if (weeks.some(w => w.weekKey === nowKey)) return nowKey;
  }
  return weeks[0]?.weekKey ?? getWeekKey(viewDate);
}
