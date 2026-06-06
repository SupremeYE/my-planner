import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, BarChart2, Layers,
} from 'lucide-react';
import { usePlanner, getAnnualProfileForYear } from '../../store';
import { useTheme } from '../../ThemeContext';
import { annualRollup, monthlyRollup, weeklyRollup, directChildCount } from './periodProgress';

// PC "기간별" 모드 캐스케이드 3열: 연간 → 월간 → 주간
// 좌(연간) 선택 → 중(월간: 그 연간에 연결된 것만) 선택 → 우(주간: 그 월간에 연결된 것만)
// 각 카드: "연결 하위 N · 진행 %" 역추적 + 선택 시 골드 강조.
// 모바일은 Phase 3 에서 별도 트리(드릴다운)로 처리 → 본 컴포넌트는 `hidden lg:flex` 로만 노출.
export function PeriodCascadePC() {
  const { t } = useTheme();
  const {
    annualGoals, monthlyGoals, weeklyGoals, todos,
    addAnnualGoal, toggleAnnualGoal, deleteAnnualGoal,
    addMonthlyGoal, deleteMonthlyGoal,
    addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
    appSettings, updateAppSettings,
  } = usePlanner();

  const [year, setYear] = useState(() => new Date().getFullYear());

  const yearAnnual = useMemo(
    () => annualGoals.filter(g => g.year === year),
    [annualGoals, year],
  );

  // 선택 상태 — 보드 변경(연도/삭제 등)에 안전하도록 effect 로 정합 보정
  const [selectedAnnualId, setSelectedAnnualId] = useState<string | null>(null);
  const [selectedMonthlyId, setSelectedMonthlyId] = useState<string | null>(null);

  useEffect(() => {
    if (yearAnnual.length === 0) { setSelectedAnnualId(null); return; }
    if (!yearAnnual.some(g => g.id === selectedAnnualId)) {
      setSelectedAnnualId(yearAnnual[0].id);
    }
  }, [yearAnnual, selectedAnnualId]);

  const monthlyOfSelected = useMemo(
    () => selectedAnnualId
      ? monthlyGoals.filter(m => m.annualGoalId === selectedAnnualId)
      : [],
    [monthlyGoals, selectedAnnualId],
  );

  useEffect(() => {
    if (monthlyOfSelected.length === 0) { setSelectedMonthlyId(null); return; }
    if (!monthlyOfSelected.some(m => m.id === selectedMonthlyId)) {
      setSelectedMonthlyId(monthlyOfSelected[0].id);
    }
  }, [monthlyOfSelected, selectedMonthlyId]);

  const weeklyOfSelected = useMemo(
    () => selectedMonthlyId
      ? weeklyGoals.filter(w => w.monthlyGoalId === selectedMonthlyId)
      : [],
    [weeklyGoals, selectedMonthlyId],
  );

  return (
    <div className="hidden lg:flex flex-col gap-4 px-4 lg:px-8 pt-2 pb-10">
      {/* 연도 네비 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: t.text }}>{year}</div>
        <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ alignItems: 'start' }}>
        {/* ── 좌: 연간 + 정체성·핵심가치 ────────────────────── */}
        <Column
          title="연간 목표"
          accent={t.accent}
          count={yearAnnual.length}
        >
          <IdentityCard year={year} t={t} appSettings={appSettings} updateAppSettings={updateAppSettings} />
          <ValuesCard year={year} t={t} appSettings={appSettings} updateAppSettings={updateAppSettings} />

          <div style={{ height: 4 }} />
          {yearAnnual.map(g => {
            const r = annualRollup(g, monthlyGoals, weeklyGoals, todos);
            const childN = directChildCount('annual', g.id, { monthlyGoals });
            return (
              <SelectableCard
                key={g.id}
                selected={selectedAnnualId === g.id}
                onSelect={() => setSelectedAnnualId(g.id)}
                t={t}
              >
                <div className="flex items-start gap-2">
                  <button onClick={(e) => { e.stopPropagation(); toggleAnnualGoal(g.id); }} className="mt-0.5">
                    <span style={{ fontSize: 16, color: g.done ? t.success : t.borderLight }}>
                      {g.done ? '✓' : '○'}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: g.done ? t.textMuted : t.text,
                      textDecoration: g.done ? 'line-through' : 'none',
                      wordBreak: 'break-word',
                    }}>{g.text}</div>
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                      <div className="h-full" style={{ width: `${r.pct}%`, backgroundColor: t.success }} />
                    </div>
                    <div className="flex items-center justify-between mt-1" style={{ fontSize: 10, color: t.textMuted }}>
                      <span><Layers size={9} className="inline mr-0.5" /> 월간 {childN}</span>
                      <span>{r.pct}%</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteAnnualGoal(g.id); }} className="p-1" style={{ color: t.textMuted }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </SelectableCard>
            );
          })}
          {yearAnnual.length === 0 && (
            <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>{year}년 연간 목표를 추가해보세요</p>
          )}
          <AddRow
            placeholder="새 연간 목표..."
            onAdd={(text) => addAnnualGoal(text, year)}
            t={t}
          />
        </Column>

        {/* ── 중: 월간 (선택된 연간에 연결된 것만) ────────────── */}
        <Column
          title="월간 목표"
          accent={t.accent}
          count={monthlyOfSelected.length}
          empty={!selectedAnnualId}
          emptyText={yearAnnual.length === 0 ? '연간 목표를 먼저 추가하세요' : '연간 목표를 선택하세요'}
        >
          {monthlyOfSelected.map(m => {
            const r = monthlyRollup(m, weeklyGoals, todos);
            const childN = directChildCount('monthly', m.id, { weeklyGoals });
            return (
              <SelectableCard
                key={m.id}
                selected={selectedMonthlyId === m.id}
                onSelect={() => setSelectedMonthlyId(m.id)}
                t={t}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>{m.month}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 2, wordBreak: 'break-word' }}>
                      {m.text}
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                      <div className="h-full" style={{ width: `${r.pct}%`, backgroundColor: t.success }} />
                    </div>
                    <div className="flex items-center justify-between mt-1" style={{ fontSize: 10, color: t.textMuted }}>
                      <span><Layers size={9} className="inline mr-0.5" /> 주간 {childN}</span>
                      <span>{r.pct}%</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteMonthlyGoal(m.id); }} className="p-1" style={{ color: t.textMuted }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </SelectableCard>
            );
          })}
          {selectedAnnualId && monthlyOfSelected.length === 0 && (
            <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>이 연간에 월간 목표가 없습니다</p>
          )}
          {selectedAnnualId && (
            <AddRow
              placeholder="새 월간 목표..."
              monthDefault
              onAddWithMonth={(text, month) => addMonthlyGoal(text, selectedAnnualId, month)}
              t={t}
            />
          )}
        </Column>

        {/* ── 우: 주간 (선택된 월간에 연결된 것만) ─────────── */}
        <Column
          title="주간 목표"
          accent={t.accent}
          count={weeklyOfSelected.length}
          empty={!selectedMonthlyId}
          emptyText={!selectedAnnualId ? '연간을 먼저 선택' : (monthlyOfSelected.length === 0 ? '월간 목표를 먼저 추가하세요' : '월간 목표를 선택하세요')}
        >
          {weeklyOfSelected.map(w => {
            const r = weeklyRollup(w, todos);
            const childN = directChildCount('weekly', w.id, { todos });
            return (
              <div key={w.id} className="rounded-xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <div className="flex items-start gap-2">
                  <button onClick={() => toggleWeeklyGoal(w.id)} className="mt-0.5">
                    <span style={{ fontSize: 16, color: w.done ? t.success : t.borderLight }}>
                      {w.done ? '✓' : '○'}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 10, color: t.accent, fontWeight: 700 }}>{w.weekKey}</div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, marginTop: 2,
                      color: w.done ? t.textMuted : t.text,
                      textDecoration: w.done ? 'line-through' : 'none',
                      wordBreak: 'break-word',
                    }}>{w.text}</div>
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                      <div className="h-full" style={{ width: `${r.pct}%`, backgroundColor: t.success }} />
                    </div>
                    <div className="flex items-center justify-between mt-1" style={{ fontSize: 10, color: t.textMuted }}>
                      <span><BarChart2 size={9} className="inline mr-0.5" /> 할일 {childN}</span>
                      <span>{r.pct}%</span>
                    </div>
                  </div>
                  <button onClick={() => deleteWeeklyGoal(w.id)} className="p-1" style={{ color: t.textMuted }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
          {selectedMonthlyId && weeklyOfSelected.length === 0 && (
            <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>이 월간에 주간 목표가 없습니다</p>
          )}
          {selectedMonthlyId && (
            <AddRow
              placeholder="새 주간 목표 (이번주)..."
              onAdd={(text) => {
                // 현재 주차 기본 — 사용자가 weeklyView 에서 더 자세히 편집 가능
                const wk = currentWeekKey();
                addWeeklyGoal(text, selectedMonthlyId, wk);
              }}
              t={t}
            />
          )}
        </Column>
      </div>
    </div>
  );
}

// ─── 보조 컴포넌트 ─────────────────────────────────────────
function Column({
  title, count, children, accent, empty, emptyText,
}: {
  title: string; count: number; children: React.ReactNode;
  accent: string; empty?: boolean; emptyText?: string;
}) {
  const { t } = useTheme();
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        backgroundColor: t.sidebar,
        border: `1px solid ${t.borderLight}`,
        minHeight: 300,
      }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 11, color: t.textMuted }}>{count}</span>
      </div>
      {empty ? (
        <div className="flex-1 flex items-center justify-center" style={{ fontSize: 12, color: t.textMuted, minHeight: 120 }}>
          {emptyText}
        </div>
      ) : children}
    </div>
  );
}

function SelectableCard({ selected, onSelect, children, t }: {
  selected: boolean; onSelect: () => void; children: React.ReactNode;
  t: ReturnType<typeof useTheme>['t'];
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      className="rounded-xl p-3 cursor-pointer transition-all"
      style={{
        backgroundColor: selected ? t.accentLight : t.card,
        border: `1.5px solid ${selected ? t.accent : t.borderLight}`,
      }}
    >
      {children}
    </div>
  );
}

function AddRow({ placeholder, onAdd, onAddWithMonth, monthDefault, t }: {
  placeholder: string;
  onAdd?: (text: string) => void;
  onAddWithMonth?: (text: string, month: string) => void;
  monthDefault?: boolean;
  t: ReturnType<typeof useTheme>['t'];
}) {
  const [text, setText] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const submit = () => {
    const v = text.trim();
    if (!v) return;
    if (onAddWithMonth) onAddWithMonth(v, month);
    else onAdd?.(v);
    setText('');
  };
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {monthDefault && (
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-2 py-1 rounded-lg outline-none border"
          style={{ fontSize: 11, color: t.text, borderColor: t.borderLight, backgroundColor: t.card }}
        />
      )}
      <div className="flex gap-1.5">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={placeholder}
          className="flex-1 px-2.5 py-1.5 rounded-lg outline-none border"
          style={{ fontSize: 12, color: t.text, borderColor: t.borderLight, backgroundColor: t.card }}
        />
        <button onClick={submit} className="px-2 rounded-lg" style={{ backgroundColor: t.accent, color: '#fff' }}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

function IdentityCard({ year, t, appSettings, updateAppSettings }: any) {
  const yk = String(year);
  const saved = appSettings.annualProfiles[yk]?.identity ?? '';
  const [draft, setDraft] = useState(saved);
  const touched = useRef(false);
  const profilesRef = useRef(appSettings.annualProfiles);
  profilesRef.current = appSettings.annualProfiles;
  useEffect(() => { if (!touched.current) setDraft(saved); }, [saved]);
  useEffect(() => {
    if (draft === saved) return;
    const id = window.setTimeout(() => {
      const all = profilesRef.current;
      const p = getAnnualProfileForYear(all, year);
      updateAppSettings({ annualProfiles: { ...all, [yk]: { identity: draft.trim(), values: p.values } } });
    }, 600);
    return () => window.clearTimeout(id);
  }, [draft, saved, year, yk, updateAppSettings]);
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} color={t.accent} />
        <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>{year}년에 되고 싶은 나</span>
      </div>
      <textarea
        rows={2}
        value={draft}
        onChange={e => { touched.current = true; setDraft(e.target.value); }}
        placeholder="한 문장으로..."
        className="w-full rounded-lg px-2 py-1.5 border outline-none resize-none"
        style={{ fontSize: 12, lineHeight: 1.5, borderColor: t.borderLight, backgroundColor: t.bgSub, color: t.text }}
      />
    </div>
  );
}

function ValuesCard({ year, t, appSettings, updateAppSettings }: any) {
  const yk = String(year);
  const yearValues = getAnnualProfileForYear(appSettings.annualProfiles, year).values;
  const [draft, setDraft] = useState('');
  const addValue = () => {
    const v = draft.trim(); if (!v) return;
    const p = getAnnualProfileForYear(appSettings.annualProfiles, year);
    if (p.values.length >= 3 || p.values.includes(v)) return;
    updateAppSettings({ annualProfiles: { ...appSettings.annualProfiles, [yk]: { identity: p.identity, values: [...p.values, v] } } });
    setDraft('');
  };
  const removeValue = (v: string) => {
    const p = getAnnualProfileForYear(appSettings.annualProfiles, year);
    updateAppSettings({ annualProfiles: { ...appSettings.annualProfiles, [yk]: { identity: p.identity, values: p.values.filter(x => x !== v) } } });
  };
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>핵심 가치 (최대 3)</span>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {yearValues.map((v: string) => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ fontSize: 11, backgroundColor: t.accentLight, color: t.accent, border: `1px solid ${t.borderLight}` }}>
            {v}
            <button onClick={() => removeValue(v)} style={{ color: t.textMuted, lineHeight: 1 }}>×</button>
          </span>
        ))}
        {yearValues.length < 3 && (
          <div className="flex items-center gap-1">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addValue()}
              placeholder="가치..."
              className="px-2 py-0.5 rounded-full border outline-none"
              style={{ fontSize: 11, width: 70, borderColor: t.borderLight, backgroundColor: t.bgSub, color: t.text }}
            />
            <button onClick={addValue} className="p-0.5 rounded-full" style={{ backgroundColor: t.accent, color: '#fff' }}>
              <Plus size={9} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 현재 주차 → ISO 주 키 (예: 2026-W23)
function currentWeekKey(): string {
  const d = new Date();
  // ISO 8601 주차 계산
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

