import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, BarChart2, Layers,
} from 'lucide-react';
import { usePlanner } from '../../store';
import { useTheme } from '../../ThemeContext';
import { annualRollup, monthlyRollup, weeklyRollup, directChildCount } from './periodProgress';
import { IdentityCard, ValuesCard } from './IdentityValuesCards';
import { WeeklyTodosInline } from './WeeklyTodosInline';
import { MandalartSourceBadge } from '../mandalart/MandalartSourceBadge';

// 모바일 "기간별" 드릴다운: 연간 → (탭) → 월간 → (탭) → 주간
// breadcrumb 으로 복귀, 각 카드에 역추적 배지.
type Level =
  | { kind: 'annual' }
  | { kind: 'monthly'; annualId: string }
  | { kind: 'weekly'; annualId: string; monthlyId: string };

export function PeriodCascadeMobile() {
  const { t } = useTheme();
  const {
    annualGoals, monthlyGoals, weeklyGoals, todos,
    addAnnualGoal, toggleAnnualGoal, deleteAnnualGoal,
    addMonthlyGoal, deleteMonthlyGoal,
    addWeeklyGoal, toggleWeeklyGoal, deleteWeeklyGoal,
    appSettings, updateAppSettings,
  } = usePlanner();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [level, setLevel] = useState<Level>({ kind: 'annual' });

  const yearAnnual = useMemo(
    () => annualGoals.filter(g => g.year === year),
    [annualGoals, year],
  );

  const annualOf = (id: string) => annualGoals.find(g => g.id === id) ?? null;
  const monthlyOf = (id: string) => monthlyGoals.find(m => m.id === id) ?? null;

  // ── breadcrumb ──
  const renderBreadcrumb = () => {
    if (level.kind === 'annual') return null;
    const annual = annualOf(level.annualId);
    if (level.kind === 'monthly') {
      return (
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2" style={{ fontSize: 12 }}>
          <button onClick={() => setLevel({ kind: 'annual' })} className="flex items-center gap-1" style={{ color: t.accent, fontWeight: 700 }}>
            <ChevronLeft size={12} /> {year}년
          </button>
          <span style={{ color: t.textMuted }}>·</span>
          <span style={{ color: t.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {annual?.text ?? '연간'}
          </span>
        </div>
      );
    }
    const monthly = monthlyOf(level.monthlyId);
    return (
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2" style={{ fontSize: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setLevel({ kind: 'annual' })} className="flex items-center gap-1" style={{ color: t.accent, fontWeight: 700 }}>
          <ChevronLeft size={12} /> {year}년
        </button>
        <span style={{ color: t.textMuted }}>·</span>
        <button onClick={() => setLevel({ kind: 'monthly', annualId: level.annualId })}
          style={{ color: t.accent, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {annual?.text ?? '연간'}
        </button>
        <span style={{ color: t.textMuted }}>·</span>
        <span style={{ color: t.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {monthly?.text ?? '월간'}
        </span>
      </div>
    );
  };

  return (
    <div className="lg:hidden">
      {/* 연간 단계: 연도 네비 */}
      {level.kind === 'annual' && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ fontFamily: t.fontStat, fontSize: 26, color: t.text }}>{year}</div>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg" style={{ color: t.textMuted }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {renderBreadcrumb()}

      {/* 본문 */}
      {level.kind === 'annual' && (
        <div className="px-4 pb-8 space-y-2.5">
          <IdentityCard year={year} appSettings={appSettings} updateAppSettings={updateAppSettings} />
          <ValuesCard year={year} appSettings={appSettings} updateAppSettings={updateAppSettings} />

          <div className="flex items-center justify-between mt-3 mb-1">
            <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              연간 목표
            </span>
            <span style={{ fontSize: 11, color: t.textMuted }}>{yearAnnual.length}</span>
          </div>

          {yearAnnual.map(g => {
            const r = annualRollup(g, monthlyGoals, weeklyGoals, todos);
            const childN = directChildCount('annual', g.id, { monthlyGoals });
            return (
              <DrillCard
                key={g.id}
                t={t}
                onTap={() => setLevel({ kind: 'monthly', annualId: g.id })}
                left={(
                  <button onClick={(e) => { e.stopPropagation(); toggleAnnualGoal(g.id); }} className="mt-0.5">
                    <span style={{ fontSize: 17, color: g.done ? t.success : t.borderLight }}>
                      {g.done ? '✓' : '○'}
                    </span>
                  </button>
                )}
                title={g.text}
                titleDim={g.done}
                pct={r.pct}
                metaIcon={<Layers size={10} />}
                metaText={`월간 ${childN}`}
                onDelete={() => deleteAnnualGoal(g.id)}
                fromMandalart={!!g.mandalartCellId}
              />
            );
          })}
          {yearAnnual.length === 0 && (
            <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>{year}년 연간 목표를 추가해보세요</p>
          )}
          <AddRow placeholder="새 연간 목표..." onAdd={(text) => addAnnualGoal(text, year)} t={t} />
        </div>
      )}

      {level.kind === 'monthly' && (() => {
        const annualId = level.annualId;
        const list = monthlyGoals.filter(m => m.annualGoalId === annualId);
        return (
          <div className="px-4 pb-8 space-y-2.5">
            <div className="flex items-center justify-between mt-1 mb-1">
              <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                월간 목표
              </span>
              <span style={{ fontSize: 11, color: t.textMuted }}>{list.length}</span>
            </div>
            {list.map(m => {
              const r = monthlyRollup(m, weeklyGoals, todos);
              const childN = directChildCount('monthly', m.id, { weeklyGoals });
              return (
                <DrillCard
                  key={m.id}
                  t={t}
                  onTap={() => setLevel({ kind: 'weekly', annualId, monthlyId: m.id })}
                  eyebrow={m.month}
                  title={m.text}
                  pct={r.pct}
                  metaIcon={<Layers size={10} />}
                  metaText={`주간 ${childN}`}
                  onDelete={() => deleteMonthlyGoal(m.id)}
                  fromMandalart={!!m.mandalartCellId}
                />
              );
            })}
            {list.length === 0 && (
              <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>이 연간에 월간 목표가 없습니다</p>
            )}
            <AddRow
              placeholder="새 월간 목표..."
              monthDefault
              onAddWithMonth={(text, month) => addMonthlyGoal(text, annualId, month)}
              t={t}
            />
          </div>
        );
      })()}

      {level.kind === 'weekly' && (() => {
        const monthlyId = level.monthlyId;
        const list = weeklyGoals.filter(w => w.monthlyGoalId === monthlyId);
        return (
          <div className="px-4 pb-8 space-y-2.5">
            <div className="flex items-center justify-between mt-1 mb-1">
              <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                주간 목표
              </span>
              <span style={{ fontSize: 11, color: t.textMuted }}>{list.length}</span>
            </div>
            {list.map(w => {
              const r = weeklyRollup(w, todos);
              const childN = directChildCount('weekly', w.id, { todos });
              return (
                <DrillCard
                  key={w.id}
                  t={t}
                  eyebrow={w.weekKey}
                  left={(
                    <button onClick={(e) => { e.stopPropagation(); toggleWeeklyGoal(w.id); }} className="mt-0.5">
                      <span style={{ fontSize: 17, color: w.done ? t.success : t.borderLight }}>
                        {w.done ? '✓' : '○'}
                      </span>
                    </button>
                  )}
                  title={w.text}
                  titleDim={w.done}
                  pct={r.pct}
                  metaIcon={<BarChart2 size={10} />}
                  metaText={`할일 ${childN}`}
                  onDelete={() => deleteWeeklyGoal(w.id)}
                  footer={<WeeklyTodosInline weeklyGoalId={w.id} weekKey={w.weekKey} />}
                  fromMandalart={!!w.mandalartCellId}
                />
              );
            })}
            {list.length === 0 && (
              <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>이 월간에 주간 목표가 없습니다</p>
            )}
            <AddRow
              placeholder="새 주간 목표 (이번주)..."
              onAdd={(text) => addWeeklyGoal(text, monthlyId, currentWeekKey())}
              t={t}
            />
          </div>
        );
      })()}
    </div>
  );
}

// ─── 공용 드릴 카드 ──────────────────────────────────────────
function DrillCard({
  t, onTap, left, eyebrow, title, titleDim, pct, metaIcon, metaText, onDelete, footer, fromMandalart,
}: {
  t: ReturnType<typeof useTheme>['t'];
  onTap?: () => void;
  left?: React.ReactNode;
  eyebrow?: string;
  title: string;
  titleDim?: boolean;
  pct: number;
  metaIcon: React.ReactNode;
  metaText: string;
  onDelete?: () => void;
  footer?: React.ReactNode;
  fromMandalart?: boolean;
}) {
  const isTappable = !!onTap;
  return (
    <div
      onClick={onTap}
      role={isTappable ? 'button' : undefined}
      className="rounded-xl p-3"
      style={{
        backgroundColor: t.card,
        border: `1px solid ${t.borderLight}`,
        cursor: isTappable ? 'pointer' : undefined,
      }}
    >
      <div className="flex items-start gap-2">
        {left}
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <div style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>{eyebrow}</div>
          )}
          <div style={{
            fontSize: 13.5, fontWeight: 600, marginTop: eyebrow ? 2 : 0,
            color: titleDim ? t.textMuted : t.text,
            textDecoration: titleDim ? 'line-through' : 'none',
            wordBreak: 'break-word',
          }}>
            {title}
          </div>
          {fromMandalart && <div className="mt-1"><MandalartSourceBadge /></div>}
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: t.success }} />
          </div>
          <div className="flex items-center justify-between mt-1" style={{ fontSize: 11, color: t.textMuted }}>
            <span className="inline-flex items-center gap-1">{metaIcon} {metaText}</span>
            <span>{pct}%</span>
          </div>
        </div>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1" style={{ color: t.textMuted }}>
            <Trash2 size={12} />
          </button>
        )}
        {isTappable && (
          <ChevronRight size={14} style={{ color: t.textMuted, marginTop: 4 }} />
        )}
      </div>
      {footer}
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
    <div className="flex flex-col gap-1.5 mt-2">
      {monthDefault && (
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg outline-none border"
          style={{ fontSize: 12, color: t.text, borderColor: t.borderLight, backgroundColor: t.card }}
        />
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg outline-none border"
          style={{ fontSize: 13, color: t.text, borderColor: t.borderLight, backgroundColor: t.card }}
        />
        <button onClick={submit} className="px-3 rounded-lg" style={{ backgroundColor: t.accent, color: '#fff' }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// 현재 주차 → ISO 주 키
function currentWeekKey(): string {
  const d = new Date();
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
