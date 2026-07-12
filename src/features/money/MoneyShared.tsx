// 하온 머니 — 공용 프레젠테이션 조각(모바일/PC 공유). 레이아웃 셸만 Mobile/Desktop 에서 분기.
import React, { useState } from 'react';
import { format, parseISO, subDays, addDays, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { Send, X, Plus, Tags, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { MoneySheet } from './MoneySheet';
import type { UseMoney } from './useMoney';
import {
  MONEY_PALETTE, resolveCategoryColor, categoryInitial, formatWon, formatManShort, subcategoryShade, INVEST_KIND_META,
} from './tokens';
import type { MoneyCategory, MoneyAccount, MoneyCard, MoneyLoan, MoneyGoal, MoneyFixedCost, PeriodType } from './types';
import { TransactionForm, AccountForm, CardForm, FixedCostForm, LoanForm, GoalForm } from './MoneyForms';
import { MoneyPlanSheet } from './MoneyPlanSheet';
import { WeekBanner, WeekReviewSheet } from './MoneyWeekReview';
import { MonthBanner, MonthReviewSheet } from './MoneyMonthReview';
import { CURRENCY_SYMBOL } from './fx';
import { CategoryManager } from './MoneyCategoryManager';
import { FixedCostManager } from './MoneyFixedCostManager';
import { CardManager } from './MoneyCardManager';

// 섹션 헤더(+ 추가 / 관리 버튼 포함)
function SectionHead({ title, onAdd, onManage }: { title: string; onAdd?: () => void; onManage?: () => void }) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between" style={{ margin: '4px 2px 8px' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{title}</span>
      <div className="flex items-center gap-3">
        {onManage && (
          <button onClick={onManage} style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>관리</button>
        )}
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-1" style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600 }}>
            <Plus size={13} /> 추가
          </button>
        )}
      </div>
    </div>
  );
}
// 빈 상태 + 추가 유도
function EmptyAdd({ text, onAdd }: { text: string; onAdd: () => void }) {
  const { t } = useTheme();
  return (
    <button onClick={onAdd} className="w-full flex flex-col items-center justify-center"
      style={{ padding: '20px 12px', borderRadius: 16, border: `1.5px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13, gap: 4 }}>
      <span>{text}</span>
      <span style={{ color: MONEY_PALETTE.gold, fontWeight: 600, fontSize: 12 }}>+ 추가하기</span>
    </button>
  );
}

export type MoneyTab = 'budget' | 'asset' | 'invest' | 'plan';

export const MONEY_TABS: { key: MoneyTab; label: string }[] = [
  { key: 'budget', label: '가계부' },
  { key: 'asset', label: '자산' },
  { key: 'invest', label: '투자' },
  { key: 'plan', label: '계획' },
];

// 오늘 기준 매월 day 일까지 남은 일수(D-day). day 없으면 null.
function daysUntilDay(day: number | null): number | null {
  if (!day) return null;
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), day);
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, day);
  }
  return Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
}

// ── 거래 아이콘(거래 이모지 > 카테고리 이모지 > 색상점+첫글자) ──
function TxIcon({ emoji, cat }: { emoji: string | null; cat: MoneyCategory | null }) {
  const color = resolveCategoryColor(cat);
  const icon = emoji || cat?.emoji;
  return (
    <div className="flex items-center justify-center flex-shrink-0"
      style={{ width: 38, height: 38, borderRadius: 11, background: `${color}20`, fontSize: 18 }}>
      {icon ? icon : (
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{categoryInitial(cat?.name)}</span>
      )}
    </div>
  );
}

// ── 무지출 아이콘(₩ 위 사선, 골드) ──
function NoSpendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={MONEY_PALETTE.gold} strokeWidth="1.5" />
      <line x1="7" y1="7" x2="17" y2="17" stroke={MONEY_PALETTE.gold} strokeWidth="1.5" strokeLinecap="round" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700" fill={MONEY_PALETTE.gold}>₩</text>
    </svg>
  );
}

// ── 메인 탭 바 ──
export function MoneyTabBar({ tab, setTab }: { tab: MoneyTab; setTab: (t: MoneyTab) => void }) {
  const { t } = useTheme();
  return (
    <div className="flex gap-1 px-1">
      {MONEY_TABS.map(({ key, label }) => {
        const active = tab === key;
        return (
          <button key={key} onClick={() => setTab(key)}
            className="flex-1 py-2.5 transition-all"
            style={{
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? t.text : t.textMuted,
              borderBottom: `2px solid ${active ? MONEY_PALETTE.gold : 'transparent'}`,
              background: 'transparent',
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── 기간 바 (전월/다음달 이동 + 오늘 복귀) ──
export function PeriodBar({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const s = parseISO(m.period.start), e = parseISO(m.period.end);
  const basis = m.settings.periodType === 'payday' ? '급여일 기준' : '월 기준';
  const navBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: t.card, color: t.textSub, boxShadow: t.shadow, flexShrink: 0,
  };
  return (
    <div className="flex items-center justify-between px-1 py-1" style={{ gap: 8 }}>
      {/* 좌: 기간 범위 + 기준 (좁으면 말줄임) */}
      <span className="flex items-center min-w-0" style={{ fontSize: 12, color: t.textSub, gap: 5, overflow: 'hidden' }}>
        <span style={{ color: MONEY_PALETTE.gold, flexShrink: 0 }}>●</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {format(s, 'M.d')} – {format(e, 'M.d')} <span style={{ color: t.textMuted }}>· {basis}</span>
        </span>
      </span>
      {/* 우: 오늘 복귀 + ‹ 연·월 › */}
      <div className="flex items-center flex-shrink-0" style={{ gap: 5 }}>
        {!m.isCurrentPeriod && (
          <button onClick={() => m.setPeriodOffset(0)}
            style={{ fontSize: 11, fontWeight: 600, color: MONEY_PALETTE.gold, padding: '4px 9px', borderRadius: 8, background: `${MONEY_PALETTE.gold}18`, whiteSpace: 'nowrap' }}>
            오늘
          </button>
        )}
        <button onClick={() => m.setPeriodOffset(m.periodOffset - 1)} style={navBtn} title="이전 기간"><ChevronLeft size={16} /></button>
        <div className="text-center" style={{ minWidth: 58 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.15 }}>{m.period.label}</div>
          <div style={{ fontSize: 9.5, color: t.textMuted, lineHeight: 1 }}>{format(s, 'yyyy')}</div>
        </div>
        <button onClick={() => m.setPeriodOffset(m.periodOffset + 1)} style={navBtn} title="다음 기간"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

// ── 요약 3칸 ──
export function SummaryStrip({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const cell = (label: string, value: string, color: string) => (
    <div className="flex-1 text-center" style={{ background: t.card, borderRadius: 14, padding: '12px 10px', boxShadow: t.shadow }}>
      <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
  return (
    <div className="flex gap-2">
      {cell('수입', `+${formatManShort(m.income)}`, MONEY_PALETTE.green)}
      {cell('지출', `-${formatManShort(m.expense)}`, MONEY_PALETTE.coral)}
      {cell('잔여', formatManShort(m.balance), t.text)}
    </div>
  );
}

// ── 예산 진행률 ──
export function BudgetBar({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const budget = m.budgetBase;   // 생활비 한도(계획) ?? 월예산 폴백 — 설정의 월예산 입력은 제거(단일 출처=계획)
  const used = m.expense;
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
  const over = budget > 0 && used > budget;
  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: t.textSub }}>월 예산 {formatManShort(budget)}</span>
        <span style={{ color: t.textMuted }}>{used.toLocaleString('ko-KR')} / {budget.toLocaleString('ko-KR')}</span>
      </div>
      <div style={{ height: 8, background: t.bgSub, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: over ? MONEY_PALETTE.coral : MONEY_PALETTE.gold, transition: 'width 0.6s' }} />
      </div>
      <div className="flex justify-between items-center" style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {m.isCurrentPeriod
            ? `D-${m.daysLeft} · 하루 ${m.dailyAllowance.toLocaleString('ko-KR')}원 사용 가능`
            : '지난/다음 기간 보기'}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: over ? MONEY_PALETTE.coral : t.textSub }}>
          {over ? `${formatManShort(used - budget)} 초과` : `${formatManShort(budget - used)} 남음`}
        </span>
      </div>
    </div>
  );
}

// ── 지출 캘린더(기간 단위 그리드 + 무지출/지출/수입 마킹 + 스트릭) ──
//  · 날짜 셀 탭 → 그 날짜로 거래 입력(onPickDate). 원하는 날짜에 자유롭게 기록.
//  · 주 시작 요일은 전역 설정(m.weekStartsOn)을 따른다.
export function SpendCalendar({ m, onPickDate }: { m: UseMoney; onPickDate?: (date: string) => void }) {
  const { t } = useTheme();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const ws = m.weekStartsOn; // 0=일, 1=월

  // 기간(start~end)을 날짜 배열로 펼친 뒤, 시작 요일만큼 앞에 빈칸을 채워 주별 그리드 정렬.
  const days: string[] = [];
  for (let d = new Date(m.period.startDate); d <= m.period.endDate; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(format(d, 'yyyy-MM-dd'));
  }
  // 주 시작 요일 기준 앞 빈칸 수 + 요일 헤더 회전.
  const leadEmpty = (m.period.startDate.getDay() - ws + 7) % 7;
  const weekdayNames = Array.from({ length: 7 }, (_, i) => ['일', '월', '화', '수', '목', '금', '토'][(ws + i) % 7]);
  const cells: (string | null)[] = [...Array(leadEmpty).fill(null), ...days];

  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
        <div className="flex flex-col" style={{ gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>지출 캘린더</span>
          {onPickDate && <span style={{ fontSize: 10.5, color: t.textMuted }}>날짜를 탭하면 그날 지출을 기록해요</span>}
        </div>
        {m.noSpendStreak > 0 ? (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${MONEY_PALETTE.green}20`, color: MONEY_PALETTE.green }}>
            {m.noSpendStreak}일 무지출 🔥
          </span>
        ) : m.trackingStartDate === null ? (
          <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>첫 지출을 기록해보세요</span>
        ) : null}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {weekdayNames.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, fontWeight: 500 }}>{w}</div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} style={{ aspectRatio: '1' }} />;
          const agg = m.spendByDay.get(date);
          const hasExpense = (agg?.expense ?? 0) > 0;
          const hasIncome = (agg?.income ?? 0) > 0;
          const isToday = date === todayStr;
          const isFuture = date > todayStr;
          // 기록 시작일 이전 = "기록 안 한 날" → 무지출 판정 제외(빈 날짜).
          const beforeTracking = m.trackingStartDate === null || date < m.trackingStartDate;
          // 무지출로 표시할 수 있는 날: 기록 시작 이후 ~ 어제, 지출 0건.
          const isNoSpend = !hasExpense && !isFuture && !isToday && !beforeTracking;
          const dayNum = parseInt(date.slice(8, 10), 10);
          return (
            <button key={i} type="button"
              onClick={onPickDate ? () => onPickDate(date) : undefined}
              className={`relative flex flex-col items-center justify-center ${onPickDate ? 'active:scale-90 transition-transform' : ''}`}
              style={{
                aspectRatio: '1', borderRadius: 12, gap: 1, cursor: onPickDate ? 'pointer' : 'default',
                background: isToday ? MONEY_PALETTE.ink : isNoSpend ? '#F0EBE2' : 'transparent',
              }}>
              {hasIncome && (
                <span className="absolute" style={{ top: 3, right: 3, width: 4, height: 4, borderRadius: '50%', background: MONEY_PALETTE.green }} />
              )}
              {isNoSpend && <NoSpendIcon size={16} />}
              <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1, color: isToday ? '#FDFAF4' : isFuture ? t.textMuted : t.text }}>
                {dayNum}
              </span>
              {hasExpense && (
                <span style={{ fontSize: 7, fontWeight: 700, lineHeight: 1, color: isToday ? MONEY_PALETTE.gold : MONEY_PALETTE.coral }}>
                  -{formatManShort(agg!.expense)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex justify-center" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textMuted }}><NoSpendIcon size={13} /> 무지출</span>
        <span className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textMuted }}><span style={{ width: 8, height: 8, borderRadius: 3, background: MONEY_PALETTE.coral }} /> 지출</span>
        <span className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textMuted }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: MONEY_PALETTE.green }} /> 수입</span>
      </div>

      {/* 스트릭 카운터(Nanum Pen Script) */}
      {m.noSpendStreak > 0 && (
        <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.borderLight}` }}>
          <div style={{ fontFamily: t.fontDecoratePen, fontSize: 28, color: MONEY_PALETTE.gold, lineHeight: 1 }}>{/* 손글씨 장식 */}
            {m.noSpendStreak}일 연속 무지출!
          </div>
          <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>한 푼도 안 쓴 날을 이어가고 있어요 ✨</div>
        </div>
      )}
    </div>
  );
}

// ── 카테고리별 지출 분석(대분류 롤업 스택 바 + 행 탭 → 소분류 드릴다운) ──
const SELF_KEY = '__self__';   // 대분류에 직접 지정(소분류 미지정) 거래 버킷
const NONE_KEY = '__none__';   // 미분류

export function CategoryBreakdown({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);  // 펼친 대분류 id

  // 대분류 롤업 + 대분류별 소분류 분해를 한 번에 집계.
  const rootMap = new Map<string, number>();                  // rootId → 합계
  const subMap = new Map<string, Map<string, number>>();      // rootId → (subId|SELF_KEY → 합계)
  m.periodTransactions.filter(x => x.type === 'expense').forEach(x => {
    const root = m.rootCategoryOf(x.categoryId);
    const rootId = root?.id ?? NONE_KEY;
    rootMap.set(rootId, (rootMap.get(rootId) ?? 0) + x.amount);
    const cat = m.categoryOf(x.categoryId);
    const subKey = cat?.parentId ? cat.id : SELF_KEY;          // 소분류 거래면 소분류 id, 아니면 대분류 직접
    const sm = subMap.get(rootId) ?? new Map<string, number>();
    sm.set(subKey, (sm.get(subKey) ?? 0) + x.amount);
    subMap.set(rootId, sm);
  });

  const rows = Array.from(rootMap.entries())
    .map(([cid, amount]) => {
      const cat = cid === NONE_KEY ? null : m.categoryOf(cid);
      // 소분류 데이터가 있을 때만(SELF 외 키 존재) 드릴다운 허용.
      const sm = subMap.get(cid);
      const hasSubs = !!sm && Array.from(sm.keys()).some(k => k !== SELF_KEY);
      return { cid, cat, amount, color: resolveCategoryColor(cat), name: cat?.name ?? '미분류', hasSubs };
    })
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total === 0) return null;

  // 펼친 대분류의 소분류 행(명도 변형 색, 금액순).
  const subRowsOf = (rootId: string, parentColor: string) => {
    const sm = subMap.get(rootId);
    if (!sm) return [];
    const subTotal = Array.from(sm.values()).reduce((s, v) => s + v, 0);
    const entries = Array.from(sm.entries()).sort((a, b) => b[1] - a[1]);
    return entries.map(([k, amount], i) => ({
      key: k,
      name: k === SELF_KEY ? '기타(대분류 직접)' : m.categoryOf(k)?.name ?? '소분류',
      amount,
      pct: subTotal > 0 ? Math.round((amount / subTotal) * 100) : 0,
      color: k === SELF_KEY ? parentColor : subcategoryShade(parentColor, i, entries.length),
    }));
  };

  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 14 }}>카테고리별 지출</div>
      <div className="flex" style={{ height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ width: `${(r.amount / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const open = openId === r.cid;
          return (
            <div key={r.cid}>
              <button
                onClick={() => r.hasSubs && setOpenId(open ? null : r.cid)}
                className="flex items-center justify-between w-full text-left"
                style={{ cursor: r.hasSubs ? 'pointer' : 'default' }}>
                <span className="flex items-center gap-2" style={{ fontSize: 12, color: t.text }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                  {r.name}
                  {r.hasSubs && <span style={{ fontSize: 9, color: t.textMuted }}>{open ? '▲' : '▼'}</span>}
                </span>
                <span style={{ fontSize: 12, color: t.textSub }}>
                  {formatWon(r.amount)} <span style={{ color: t.textMuted }}>({Math.round((r.amount / total) * 100)}%)</span>
                </span>
              </button>
              {open && r.hasSubs && (
                <div className="flex flex-col gap-1.5" style={{ marginTop: 6, marginBottom: 4, paddingLeft: 16, borderLeft: `2px solid ${r.color}30` }}>
                  {subRowsOf(r.cid, r.color).map(s => (
                    <div key={s.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-2" style={{ fontSize: 11, color: t.textSub }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                        {s.name}
                      </span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>
                        {formatWon(s.amount)} ({s.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 만원 단위로 보기 좋게 올림(1/2/5 ×10ⁿ). Y축 눈금/스케일용.
function niceCeilWon(v: number): number {
  if (v <= 0) return 100000;
  const man = v / 10000;
  const pow = Math.pow(10, Math.floor(Math.log10(man)));
  const n = man / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow * 10000;
}

// ── 카테고리별 스택 바 차트(주간/월간/연간 · 예산선 · 가로 스크롤) ──
type Gran = 'weekly' | 'monthly' | 'yearly';
export function SpendTrendChart({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [gran, setGran] = useState<Gran>('monthly');
  const now = new Date();

  // 버킷(X축) 정의 + 날짜→버킷키 매핑
  const buckets: { key: string; label: string; current: boolean }[] = [];
  let keyOf: (d: string) => string;
  if (gran === 'weekly') {
    // 이번 주: 오늘이 속한 달력 주의 시작 요일(전역 설정 m.weekStartsOn)부터 7일. 캘린더와 동일 기준.
    const ws = m.weekStartsOn;
    const todayStr = format(now, 'yyyy-MM-dd');
    const weekStart = subDays(now, (now.getDay() - ws + 7) % 7);
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const key = format(d, 'yyyy-MM-dd');
      buckets.push({ key, label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()], current: key === todayStr });
    }
    keyOf = (d) => d;
  } else if (gran === 'monthly') {
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.push({ key: format(d, 'yyyy-MM'), label: `${d.getMonth() + 1}월`, current: i === 0 }); }
    keyOf = (d) => d.slice(0, 7);
  } else {
    for (let i = 4; i >= 0; i--) { const y = now.getFullYear() - i; buckets.push({ key: String(y), label: String(y), current: i === 0 }); }
    keyOf = (d) => d.slice(0, 4);
  }

  // 집계: 버킷키 → 카테고리id → 합계
  const agg = new Map<string, Map<string, number>>();
  buckets.forEach(b => agg.set(b.key, new Map()));
  for (const tx of m.transactions) {
    if (tx.type !== 'expense') continue;
    const cm = agg.get(keyOf(tx.spentAt)); if (!cm) continue;
    // 소분류 거래는 대분류로 롤업 — 스택 색/범례는 대분류 기준 유지(하위 호환).
    const cid = m.rootCategoryOf(tx.categoryId)?.id ?? '__none__';
    cm.set(cid, (cm.get(cid) ?? 0) + tx.amount);
  }
  const totals = buckets.map(b => Array.from(agg.get(b.key)!.values()).reduce((s, v) => s + v, 0));
  const maxTotal = Math.max(...totals, 0);
  const budget = m.budgetBase;   // 생활비 한도(계획) ?? 월예산 폴백
  const showBudget = gran === 'monthly' && budget > 0;
  const scaleMax = niceCeilWon(Math.max(maxTotal, showBudget ? budget : 0));
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map(r => scaleMax * r); // 위→아래
  const hasData = totals.some(x => x > 0);
  const BAR_AREA = 150;

  // 범례용 등장 카테고리(미분류 제외)
  const seen = new Set<string>();
  agg.forEach(cm => cm.forEach((_, cid) => { if (cid !== '__none__') seen.add(cid); }));
  const legendCats = Array.from(seen).map(cid => m.categoryOf(cid)).filter(Boolean) as MoneyCategory[];

  const tab = (g: Gran, label: string) => {
    const active = gran === g;
    return (
      <button onClick={() => setGran(g)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: t.font,
        border: `1px solid ${active ? MONEY_PALETTE.ink : t.border}`, background: active ? MONEY_PALETTE.ink : 'transparent', color: active ? '#FDFAF4' : t.textSub }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>지출 추이</span>
      </div>
      <div className="flex gap-1" style={{ marginBottom: 14 }}>
        {tab('weekly', '주간')}{tab('monthly', '월간')}{tab('yearly', '연간')}
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: t.textMuted, fontSize: 13 }}>지출이 쌓이면 추이가 보여요 📊</div>
      ) : (
        <>
          {/* Y축(고정) + 차트 영역 */}
          <div className="flex">
            {/* Y축 눈금 — 만원 단위, 좌측 고정(스크롤 안 함). 바 영역(BAR_AREA)에만 정렬 */}
            <div className="flex flex-col justify-between flex-shrink-0" style={{ width: 38, height: BAR_AREA, paddingRight: 6 }}>
              {yTicks.map((v, i) => (
                <span key={i} style={{ fontSize: 9, color: t.textMuted, textAlign: 'right', lineHeight: 1 }}>{v === 0 ? '0' : formatManShort(v)}</span>
              ))}
            </div>
            {/* 차트 영역 */}
            <div className="flex-1 relative" style={{ minWidth: 0 }}>
              {/* 그리드라인 + 예산선 — 바 영역(상단 BAR_AREA)에 고정 오버레이 */}
              <div className="absolute left-0 right-0 top-0 pointer-events-none" style={{ height: BAR_AREA }}>
                {yTicks.map((v, i) => (
                  <div key={i} className="absolute left-0 right-0" style={{ top: `${(1 - v / scaleMax) * 100}%`, borderTop: `1px solid ${t.borderLight}` }} />
                ))}
                {showBudget && (
                  <div className="absolute left-0 right-0" style={{ top: `${(1 - budget / scaleMax) * 100}%`, borderTop: `1.5px dashed ${MONEY_PALETTE.coral}`, zIndex: 1 }} />
                )}
              </div>
              {/* 바+X라벨 — 모바일: 고정폭 + 가로 스크롤(라벨 동반 스크롤) / PC: flex 확장 */}
              <div className="overflow-x-auto lg:overflow-x-visible">
                <div className="flex items-end gap-2">
                  {buckets.map((b, i) => {
                    const total = totals[i];
                    const cm = agg.get(b.key)!;
                    const barH = (total / scaleMax) * BAR_AREA;
                    const over = showBudget && total > budget;
                    const segs = Array.from(cm.entries()).map(([cid, amt]) => ({ cid, amt, color: resolveCategoryColor(cid === '__none__' ? null : m.categoryOf(cid)) })).sort((a, b2) => b2.amt - a.amt);
                    return (
                      <div key={b.key} className="flex flex-col items-center flex-shrink-0 w-10 lg:flex-1 lg:w-auto lg:min-w-0">
                        {/* 바 영역(BAR_AREA 고정 — 그리드와 정렬) */}
                        <div className="flex flex-col items-center justify-end" style={{ height: BAR_AREA }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: over ? MONEY_PALETTE.coral : t.textSub, marginBottom: 2, whiteSpace: 'nowrap' }}>
                            {total > 0 ? formatManShort(total) : ''}
                          </div>
                          <div style={{ width: 28, height: Math.max(barH, total > 0 ? 3 : 0), display: 'flex', flexDirection: 'column-reverse', borderRadius: '5px 5px 2px 2px', overflow: 'hidden', boxShadow: b.current ? '0 2px 8px rgba(58,53,46,0.12)' : 'none', position: 'relative', zIndex: 2 }}>
                            {segs.map(s => (
                              <div key={s.cid} style={{ width: '100%', height: total > 0 ? `${(s.amt / total) * 100}%` : 0, background: s.color }} />
                            ))}
                          </div>
                        </div>
                        {/* X축 라벨(바와 동반 스크롤) */}
                        <span style={{ marginTop: 4, fontSize: 9, color: b.current ? t.text : t.textMuted, fontWeight: b.current ? 700 : 400, whiteSpace: 'nowrap' }}>{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {/* 스와이프 힌트 — 모바일에서 버킷이 넘칠 때만 */}
          {buckets.length > 6 && (
            <div className="lg:hidden" style={{ textAlign: 'center', fontSize: 10, color: t.textMuted, marginTop: 6 }}>← 좌우로 스와이프 →</div>
          )}

          {/* 범례 */}
          {legendCats.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              {legendCats.map(c => (
                <span key={c.id} className="flex items-center" style={{ gap: 4, fontSize: 10, color: t.textSub }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: resolveCategoryColor(c) }} />{c.name}
                </span>
              ))}
            </div>
          )}
          {showBudget && (
            <div className="flex items-center" style={{ gap: 6, marginTop: 8, fontSize: 10, color: t.textMuted }}>
              <span style={{ width: 16, borderTop: `1.5px dashed ${MONEY_PALETTE.coral}` }} /> 월 예산 {formatManShort(budget)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 거래 리스트 (행 탭 = 수정) ──
export function TransactionList({ m, limit, onEdit }: { m: UseMoney; limit?: number; onEdit: (tx: any) => void }) {
  const { t } = useTheme();
  const list = (limit ? m.transactions.slice(0, limit) : m.transactions);
  if (list.length === 0) {
    return <div style={{ textAlign: 'center', padding: '24px 0', color: t.textMuted, fontSize: 13 }}>아직 거래가 없어요. 아래에 입력해 보세요.</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {list.map(tx => {
        const cat = m.categoryOf(tx.categoryId);
        const root = m.rootCategoryOf(tx.categoryId);
        // 소분류 거래면 "대분류 · 소분류", 아니면 대분류명. 아이콘 색/이모지는 대분류(root) 기준.
        const catLabel = cat?.parentId ? `${root?.name ?? ''} · ${cat.name}` : cat?.name ?? null;
        const isIncome = tx.type === 'income';
        return (
          <button key={tx.id} onClick={() => onEdit(tx)} className="flex items-center gap-3 text-left w-full transition-transform active:scale-[0.99]"
            style={{ background: t.card, borderRadius: 14, padding: '11px 14px', boxShadow: t.shadow }}>
            <TxIcon emoji={tx.emoji} cat={root} />
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.memo || catLabel || (isIncome ? '수입' : '지출')}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                {[
                  catLabel,
                  tx.originalAmount != null && tx.currency !== 'KRW' ? `${CURRENCY_SYMBOL[tx.currency]}${tx.originalAmount}` : null,
                  tx.paymentMethod,
                  tx.source === 'fixed' ? '🔁 고정' : null,
                  format(parseISO(tx.spentAt), 'M.d'),
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isIncome ? MONEY_PALETTE.green : t.text, whiteSpace: 'nowrap' }}>
              {isIncome ? '+' : '-'}{tx.amount.toLocaleString('ko-KR')}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── 자산 패널 (항목 탭=수정 / 섹션 +추가) ──
type AssetEditor =
  | { kind: 'account'; item: MoneyAccount | null }
  | { kind: 'card'; item: MoneyCard | null }
  | { kind: 'fixed'; item: MoneyFixedCost | null }
  | null;

export function AssetPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<AssetEditor>(null);
  const [showFixedMgr, setShowFixedMgr] = useState(false);
  const [showCardMgr, setShowCardMgr] = useState(false);
  const banks = m.accounts.filter(a => a.type !== 'investment');
  const rowBtn = { background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow } as React.CSSProperties;

  return (
    <div className="flex flex-col gap-3">
      {/* 순자산 */}
      <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
        <div className="text-center">
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>순자산</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: t.text }}>{formatWon(m.netWorth)}</div>
          <div className="flex gap-3 mt-3">
            <div className="flex-1" style={{ background: `${MONEY_PALETTE.green}18`, borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10, color: t.textSub }}>+ 자산</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.green }}>{m.assets.toLocaleString('ko-KR')}</div>
            </div>
            <div className="flex-1" style={{ background: `${MONEY_PALETTE.coral}14`, borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10, color: t.textSub }}>− 카드 부채</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.coral }}>{m.cardDebt.toLocaleString('ko-KR')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 통장·예금 */}
      <div>
        <SectionHead title="🏦 통장 · 예금" onAdd={() => setEditor({ kind: 'account', item: null })} />
        <div className="flex flex-col gap-2">
          {banks.map(a => (
            <button key={a.id} onClick={() => setEditor({ kind: 'account', item: a })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={rowBtn}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${MONEY_PALETTE.green}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{a.icon || '🏦'}</div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.name}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{a.type === 'savings' ? '적금' : a.type === 'cash' ? '현금' : '예금'}{a.interestRate != null ? ` · 연 ${a.interestRate}%` : ''}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.balance.toLocaleString('ko-KR')}</div>
            </button>
          ))}
          {banks.length === 0 && <EmptyAdd text="등록된 통장이 없어요" onAdd={() => setEditor({ kind: 'account', item: null })} />}
        </div>
      </div>

      {/* 신용·체크카드 */}
      <div>
        <SectionHead title="💳 신용 · 체크카드" onManage={m.cards.length > 0 ? () => setShowCardMgr(true) : undefined} onAdd={() => setEditor({ kind: 'card', item: null })} />
        <div className="flex flex-col gap-2">
          {m.cards.map(c => {
            const dday = daysUntilDay(c.billingDay);
            const unpaid = m.cardUnpaid(c);
            const isCheck = c.type === 'check';
            return (
              <button key={c.id} onClick={() => setEditor({ kind: 'card', item: c })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={rowBtn}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color || MONEY_PALETTE.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💳</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{isCheck ? '체크' : `신용 · 미결제 ${unpaid.toLocaleString('ko-KR')}`}</div>
                </div>
                {!isCheck && (
                  <div className="text-right">
                    <div style={{ fontSize: 15, fontWeight: 700, color: MONEY_PALETTE.coral }}>-{unpaid.toLocaleString('ko-KR')}</div>
                    {c.billingDay && <div style={{ fontSize: 10, color: t.textMuted }}>결제일 {c.billingDay}일{dday != null ? ` · D-${dday}` : ''}</div>}
                  </div>
                )}
              </button>
            );
          })}
          {m.cards.length === 0 && <EmptyAdd text="등록된 카드가 없어요" onAdd={() => setEditor({ kind: 'card', item: null })} />}
        </div>
      </div>

      {/* 고정비 */}
      <div>
        <SectionHead title={`🔁 고정비 · 월 ${m.fixedTotal.toLocaleString('ko-KR')}원`} onManage={() => setShowFixedMgr(true)} onAdd={() => setEditor({ kind: 'fixed', item: null })} />
        <div className="flex flex-col gap-2">
          {m.fixedCosts.map(f => {
            const cat = m.categoryOf(f.categoryId);
            const dday = daysUntilDay(f.billingDay);
            return (
              <button key={f.id} onClick={() => setEditor({ kind: 'fixed', item: f })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={rowBtn}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${resolveCategoryColor(cat)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{f.emoji || cat?.emoji || '🔁'}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{f.name}{f.isVariable ? ' (변동)' : ''}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{[f.paymentMethod, f.billingDay ? `매월 ${f.billingDay}일` : null, dday != null ? `D-${dday}` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{f.isVariable ? '~' : ''}{f.amount.toLocaleString('ko-KR')}</div>
                  {f.currency !== 'KRW' && f.originalAmount != null && <div style={{ fontSize: 10, color: t.textMuted }}>{f.currency} {f.originalAmount}</div>}
                </div>
              </button>
            );
          })}
          {m.fixedCosts.length === 0 && <EmptyAdd text="등록된 고정비가 없어요" onAdd={() => setEditor({ kind: 'fixed', item: null })} />}
        </div>
      </div>

      {/* 대출은 계획 탭으로 이동(Stage 7) */}

      {editor?.kind === 'account' && <AccountForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'card' && <CardForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
      {editor?.kind === 'fixed' && <FixedCostForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
      {showFixedMgr && <FixedCostManager m={m} onClose={() => setShowFixedMgr(false)} />}
      {showCardMgr && <CardManager m={m} onClose={() => setShowCardMgr(false)} />}
    </div>
  );
}

// ── 투자 패널 (투자계좌 = accounts.type==='investment') ──
//  · 6-1 요약: 총 투자자산 + 총 수익률(원금 입력 종목 기준) / 6-2 포트폴리오: 종목·구분·수량·평가액·등락률.
//  · 시세 자동연동은 후순위 — 평가액/원금은 수동 입력.
export function InvestPanel({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<{ item: MoneyAccount | null } | null>(null);

  if (m.investments.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div style={{ background: t.card, borderRadius: 20, padding: 24, boxShadow: t.shadow, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 14 }}>주식·펀드·코인 등<br />투자 내역을 추가해보세요</div>
          <button onClick={() => setEditor({ item: null })} style={{ padding: '8px 20px', borderRadius: 10, border: `1.5px solid ${t.border}`, color: t.text, fontSize: 13, fontWeight: 500 }}>+ 투자 추가</button>
        </div>
        {editor && <AccountForm m={m} item={editor.item} onClose={() => setEditor(null)} defaultType="investment" />}
      </div>
    );
  }

  const ret = m.investReturn;
  const pct = m.investReturnPct;
  const profit = ret >= 0;
  const retColor = profit ? MONEY_PALETTE.green : MONEY_PALETTE.coral;

  return (
    <div className="flex flex-col gap-3">
      {/* 6-1 투자 요약 */}
      <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>총 투자자산</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: t.text, marginTop: 4 }}>{formatWon(m.investTotal)}</div>
        {pct != null ? (
          <div className="flex items-center justify-center gap-1.5" style={{ marginTop: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: retColor }}>{profit ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</span>
            <span style={{ fontSize: 12, color: retColor }}>({profit ? '+' : '-'}{Math.abs(ret).toLocaleString('ko-KR')}원)</span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>매입원금을 입력하면 수익률이 표시돼요</div>
        )}
      </div>

      {/* 6-2 포트폴리오 */}
      <SectionHead title="📈 포트폴리오" onAdd={() => setEditor({ item: null })} />
      <div className="flex flex-col gap-2">
        {m.investments.map(a => {
          const meta = a.investKind ? INVEST_KIND_META[a.investKind] : null;
          const hasP = a.principal != null && a.principal > 0;
          const r = hasP ? a.balance - (a.principal as number) : 0;
          const rPct = hasP ? (r / (a.principal as number)) * 100 : null;
          const up = r >= 0;
          const rc = up ? MONEY_PALETTE.green : MONEY_PALETTE.coral;
          return (
            <button key={a.id} onClick={() => setEditor({ item: a })} className="flex items-center gap-3 text-left w-full active:scale-[0.99] transition-transform" style={{ background: t.card, borderRadius: 14, padding: 14, boxShadow: t.shadow }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: meta ? `${meta.color}20` : t.bgSub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{a.icon || '📈'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  {meta && <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, background: `${meta.color}1A`, borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>{meta.label}</span>}
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                  {[a.quantity != null ? `${a.quantity.toLocaleString('ko-KR')}${meta?.unit ?? ''}` : null, hasP ? `원금 ${formatManShort(a.principal as number)}` : null].filter(Boolean).join(' · ') || '평가액'}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{a.balance.toLocaleString('ko-KR')}</div>
                {rPct != null && (
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: rc }}>{up ? '▲' : '▼'} {Math.abs(rPct).toFixed(1)}%</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {editor && <AccountForm m={m} item={editor.item} onClose={() => setEditor(null)} defaultType="investment" />}
    </div>
  );
}

// ── 목표 색상(유형 기준): savings 그린 / networth 골드 / travel 코랄 / 그 외 저장색 ──
function goalColor(g: MoneyGoal): string {
  if (g.type === 'savings') return MONEY_PALETTE.green;
  if (g.type === 'networth') return MONEY_PALETTE.gold;
  if (g.type === 'travel') return MONEY_PALETTE.coral;
  return g.color || MONEY_PALETTE.green;
}

// ── 목표 달성 페이스 계산 ──
//  · 월 필요 적립액 = (목표 − 현재) / 남은 개월
//  · 페이스 상태: 경과시간 대비 진행률(createdAt~deadline)로 순조/부족 판정.
type PaceStatus = 'done' | 'ontrack' | 'behind' | 'overdue' | 'none';
function goalPace(g: MoneyGoal): { pct: number; status: PaceStatus; monthlyNeed: number | null; daysLeft: number | null; monthsLeft: number | null } {
  const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
  const done = g.targetAmount > 0 && g.currentAmount >= g.targetAmount;
  const remaining = Math.max(0, g.targetAmount - g.currentAmount);
  if (!g.deadline) return { pct, status: done ? 'done' : 'none', monthlyNeed: null, daysLeft: null, monthsLeft: null };
  const now = new Date();
  const dl = parseISO(g.deadline);
  const daysLeft = differenceInCalendarDays(dl, now);
  const monthsLeft = Math.max(0, differenceInCalendarMonths(dl, now));
  const monthlyNeed = done ? 0 : Math.ceil(remaining / Math.max(1, monthsLeft));
  let status: PaceStatus;
  if (done) status = 'done';
  else if (daysLeft < 0) status = 'overdue';
  else if (g.createdAt) {
    const start = parseISO(g.createdAt);
    const totalDays = differenceInCalendarDays(dl, start);
    const elapsed = differenceInCalendarDays(now, start);
    const expectedPct = totalDays > 0 ? Math.min(100, (elapsed / totalDays) * 100) : 0;
    status = pct + 0.5 >= expectedPct ? 'ontrack' : 'behind';
  } else status = 'ontrack';
  return { pct, status, monthlyNeed, daysLeft, monthsLeft };
}

// 페이스 뱃지 메타(라벨/색)
function paceBadge(s: PaceStatus, t: any): { label: string; color: string; bg: string } | null {
  if (s === 'done') return { label: '달성 🎉', color: MONEY_PALETTE.green, bg: `${MONEY_PALETTE.green}1A` };
  if (s === 'ontrack') return { label: '순조로움 ✓', color: MONEY_PALETTE.green, bg: `${MONEY_PALETTE.green}1A` };
  if (s === 'behind') return { label: '페이스 부족 ⚠', color: MONEY_PALETTE.coral, bg: `${MONEY_PALETTE.coral}14` };
  if (s === 'overdue') return { label: '기한 초과 ⚠', color: MONEY_PALETTE.coral, bg: `${MONEY_PALETTE.coral}14` };
  return null;
}

// ── 7-1 저축 목표(페이스 포함) ──
function GoalSection({ m, onEdit }: { m: UseMoney; onEdit: (g: MoneyGoal | null) => void }) {
  const { t } = useTheme();
  return (
    <div>
      <SectionHead title="🎯 저축 목표" onAdd={() => onEdit(null)} />
      {m.goals.length === 0 && <EmptyAdd text="저축 목표가 없어요" onAdd={() => onEdit(null)} />}
      <div className="flex flex-col gap-2">
        {m.goals.map(g => {
          const { pct, status, monthlyNeed, daysLeft, monthsLeft } = goalPace(g);
          const color = goalColor(g);
          const badge = paceBadge(status, t);
          // 남은 기간 표기: 개월(있으면) · D-day / 기한 초과
          const periodLabel = g.deadline == null ? null
            : daysLeft != null && daysLeft < 0 ? '기한 지남'
            : [monthsLeft && monthsLeft > 0 ? `${monthsLeft}개월` : null, daysLeft != null ? `D-${daysLeft}` : null].filter(Boolean).join(' · ');
          return (
            <button key={g.id} onClick={() => onEdit(g)} className="text-left w-full active:scale-[0.99] transition-transform" style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow, border: `1.5px solid ${t.borderLight}` }}>
              <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
                <div className="min-w-0">
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{g.emoji ? `${g.emoji} ` : ''}{g.name}</div>
                  {g.deadline && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{format(parseISO(g.deadline), 'yyyy.MM.dd')}까지{periodLabel ? ` · ${periodLabel}` : ''}</div>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span style={{ fontSize: 18, fontWeight: 900, color }}>{pct}%</span>
                  {badge && <span style={{ fontSize: 9.5, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>{badge.label}</span>}
                </div>
              </div>
              <div style={{ height: 10, background: t.bgSub, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: color, transition: 'width 0.6s' }} />
              </div>
              <div className="flex justify-between" style={{ fontSize: 11, color: t.textMuted }}>
                <span><strong style={{ color: t.text }}>{g.currentAmount.toLocaleString('ko-KR')}</strong> 달성</span>
                <span>목표 {g.targetAmount.toLocaleString('ko-KR')}원</span>
              </div>
              {monthlyNeed != null && monthlyNeed > 0 && (
                <div className="flex justify-between items-center" style={{ marginTop: 10, padding: '8px 10px', background: t.bgSub, borderRadius: 10 }}>
                  <span style={{ fontSize: 11, color: t.textSub }}>달성 페이스 (월 필요 적립)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: badge?.color ?? t.text }}>{monthlyNeed.toLocaleString('ko-KR')}원</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 7-2 자산 형성 로드맵 타임라인 (완료 → 오늘 → 미래) ──
function RoadmapTimeline({ m }: { m: UseMoney }) {
  const { t } = useTheme();
  if (m.goals.length === 0) return null;
  const isDone = (g: MoneyGoal) => g.targetAmount > 0 && g.currentAmount >= g.targetAmount;
  // 마감일 오름차순(없으면 뒤로)
  const byDeadline = (a: MoneyGoal, b: MoneyGoal) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
  const done = m.goals.filter(isDone).sort(byDeadline);
  const future = m.goals.filter(g => !isDone(g)).sort(byDeadline);
  type Node = { kind: 'done' | 'today' | 'future'; g?: MoneyGoal };
  const nodes: Node[] = [...done.map(g => ({ kind: 'done' as const, g })), { kind: 'today' as const }, ...future.map(g => ({ kind: 'future' as const, g }))];

  return (
    <div style={{ background: t.card, borderRadius: 20, padding: 18, boxShadow: t.shadow }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 16 }}>🗺️ 자산 형성 로드맵</div>
      <div className="flex flex-col">
        {nodes.map((n, i) => {
          const last = i === nodes.length - 1;
          const dotColor = n.kind === 'done' ? MONEY_PALETTE.green : n.kind === 'today' ? MONEY_PALETTE.gold : t.textMuted;
          const isToday = n.kind === 'today';
          return (
            <div key={i} className="flex gap-3" style={{ minHeight: isToday ? 40 : 52 }}>
              {/* 레일(점 + 연결선) */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 18 }}>
                <div style={{
                  width: isToday ? 14 : 12, height: isToday ? 14 : 12, borderRadius: '50%', marginTop: 2,
                  background: n.kind === 'future' ? 'transparent' : dotColor,
                  border: n.kind === 'future' ? `2px solid ${t.border}` : `2px solid ${dotColor}`,
                  boxShadow: isToday ? `0 0 0 4px ${MONEY_PALETTE.gold}33` : 'none',
                }} />
                {!last && <div style={{ flex: 1, width: 2, background: t.borderLight, marginTop: 2 }} />}
              </div>
              {/* 내용 */}
              <div className="flex-1 min-w-0" style={{ paddingBottom: 14 }}>
                {isToday ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: MONEY_PALETTE.gold }}>오늘 · {format(new Date(), 'yyyy.MM.dd')}</div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 600, color: n.kind === 'future' ? t.textSub : t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.kind === 'done' ? '✓ ' : ''}{n.g!.emoji ? `${n.g!.emoji} ` : ''}{n.g!.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>
                        {[n.g!.deadline ? format(parseISO(n.g!.deadline), 'yyyy.MM') : '기한 없음', `목표 ${formatManShort(n.g!.targetAmount)}`].join(' · ')}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: n.kind === 'done' ? MONEY_PALETTE.green : t.textMuted, flexShrink: 0 }}>
                      {n.g!.targetAmount > 0 ? Math.min(100, Math.round((n.g!.currentAmount / n.g!.targetAmount) * 100)) : 0}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 7-3 대출 관리 (총 잔액/상환완료/남은원금 + 대출별 상세 + 다음 상환 D-day) ──
function LoanSection({ m, onEdit }: { m: UseMoney; onEdit: (l: MoneyLoan | null) => void }) {
  const { t } = useTheme();
  // 상환 완료 합 = Σ(최초원금 − 잔액) [원금 입력된 건만], 남은 원금 = Σ 잔액
  const repaid = m.loans.reduce((s, l) => s + (l.principal != null ? Math.max(0, l.principal - l.balance) : 0), 0);
  const remain = m.loans.reduce((s, l) => s + l.balance, 0);
  return (
    <div>
      <SectionHead title="🏛️ 대출 관리" onAdd={() => onEdit(null)} />
      {m.loans.length === 0 ? (
        <EmptyAdd text="등록된 대출이 없어요" onAdd={() => onEdit(null)} />
      ) : (
        <div className="flex flex-col gap-2">
          {/* 요약 */}
          <div style={{ background: t.card, borderRadius: 16, padding: 16, boxShadow: t.shadow }}>
            <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'center' }}>총 대출 잔액</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: MONEY_PALETTE.coral, textAlign: 'center', marginTop: 2 }}>{formatWon(remain)}</div>
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              <div className="flex-1 text-center" style={{ background: `${MONEY_PALETTE.green}14`, borderRadius: 10, padding: 8 }}>
                <div style={{ fontSize: 10, color: t.textSub }}>상환 완료</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: MONEY_PALETTE.green }}>{repaid.toLocaleString('ko-KR')}</div>
              </div>
              <div className="flex-1 text-center" style={{ background: t.bgSub, borderRadius: 10, padding: 8 }}>
                <div style={{ fontSize: 10, color: t.textSub }}>남은 원금</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{remain.toLocaleString('ko-KR')}</div>
              </div>
            </div>
          </div>
          {/* 대출별 상세 */}
          {m.loans.map(l => {
            const pct = l.totalInstallments ? Math.round((l.paidInstallments / l.totalInstallments) * 100) : 0;
            const left = l.totalInstallments != null ? Math.max(0, l.totalInstallments - l.paidInstallments) : null;
            const dday = daysUntilDay(l.paymentDay);
            const meta = [l.interestRate != null ? `연 ${l.interestRate}%` : null, l.repaymentType].filter(Boolean).join(' · ');
            return (
              <button key={l.id} onClick={() => onEdit(l)} className="text-left w-full active:scale-[0.99] transition-transform" style={{ background: t.card, borderRadius: 14, padding: 16, boxShadow: t.shadow }}>
                <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
                  <div className="min-w-0">
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{[l.lender, meta].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div style={{ fontSize: 16, fontWeight: 700, color: MONEY_PALETTE.coral }}>{l.balance.toLocaleString('ko-KR')}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>원금 잔액</div>
                  </div>
                </div>
                {l.totalInstallments != null && (
                  <>
                    <div className="flex justify-between" style={{ fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: t.textSub }}>상환 {l.paidInstallments}/{l.totalInstallments}회{left != null ? ` · ${left}회 남음` : ''}</span>
                      <span style={{ color: MONEY_PALETTE.green, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: t.bgSub, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: MONEY_PALETTE.green }} />
                    </div>
                  </>
                )}
                {l.monthlyPayment != null && (
                  <div className="flex justify-between items-center" style={{ marginTop: 10, padding: 10, background: t.bgSub, borderRadius: 10 }}>
                    <span style={{ fontSize: 12, color: t.textSub }}>다음 상환{dday != null ? ` D-${dday}` : ''}{l.paymentDay ? ` (매월 ${l.paymentDay}일)` : ''}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{l.monthlyPayment.toLocaleString('ko-KR')}원</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 계획 패널 (저축 목표 + 로드맵 + 대출) ──
export function PlanPanel({ m }: { m: UseMoney }) {
  const [goalEd, setGoalEd] = useState<{ item: MoneyGoal | null } | null>(null);
  const [loanEd, setLoanEd] = useState<{ item: MoneyLoan | null } | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <GoalSection m={m} onEdit={(g) => setGoalEd({ item: g })} />
      <RoadmapTimeline m={m} />
      <LoanSection m={m} onEdit={(l) => setLoanEd({ item: l })} />
      {goalEd && <GoalForm m={m} item={goalEd.item} onClose={() => setGoalEd(null)} />}
      {loanEd && <LoanForm m={m} item={loanEd.item} onClose={() => setLoanEd(null)} />}
    </div>
  );
}

// ── 채팅형 자연어 입력바 (Stage 2 핵심) ──
export function ChatInputBar({ m, floating }: { m: UseMoney; floating?: boolean }) {
  const { t } = useTheme();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });

  const submit = async () => {
    const val = text.trim();
    if (!val || status.kind === 'loading') return;
    setStatus({ kind: 'loading' });
    const res = await m.parseAndAdd(val, 'chat');
    if (res.ok && res.parsed) {
      const p = res.parsed;
      const sign = p.type === 'income' ? '+' : '-';
      setStatus({ kind: 'ok', msg: `${p.category ?? '미분류'} ${sign}${p.amount.toLocaleString('ko-KR')}원 기록됨` });
      setText('');
      setTimeout(() => setStatus({ kind: 'idle' }), 2500);
    } else {
      setStatus({ kind: 'err', msg: res.error || '인식하지 못했어요' });
      setTimeout(() => setStatus({ kind: 'idle' }), 3000);
    }
  };

  return (
    <div style={floating ? undefined : { position: 'relative' }}>
      {status.kind !== 'idle' && status.kind !== 'loading' && (
        <div style={{
          fontSize: 12, fontWeight: 600, marginBottom: 6, textAlign: 'center',
          color: status.kind === 'ok' ? MONEY_PALETTE.green : MONEY_PALETTE.coral,
        }}>
          {status.kind === 'ok' ? '✓ ' : '⚠ '}{status.msg}
        </div>
      )}
      <div className="flex items-center gap-2"
        style={{ background: t.card, borderRadius: 16, padding: '6px 6px 6px 16px', boxShadow: '0 4px 20px rgba(58,53,46,0.12)', border: `1px solid ${t.borderLight}` }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={status.kind === 'loading' ? '기록 중…' : '예: 점심 김치찌개 8000'}
          disabled={status.kind === 'loading'}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: t.text, fontFamily: t.font }}
        />
        {text && (
          <button onClick={() => setText('')} style={{ color: t.textMuted, padding: 4 }}><X size={15} /></button>
        )}
        <button onClick={submit} disabled={status.kind === 'loading'}
          className="flex items-center justify-center"
          style={{ width: 34, height: 34, borderRadius: 10, background: MONEY_PALETTE.ink, color: '#FDFAF4', flexShrink: 0, opacity: status.kind === 'loading' ? 0.5 : 1 }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── 이번 달 계획 배너(가계부 탭 상단) — 미수립이면 유도, 수립됐으면 요약+수정 ──
function PlanBanner({ m, onOpen }: { m: UseMoney; onOpen: () => void }) {
  const { t } = useTheme();
  const plan = m.currentPlan;
  if (!plan) {
    return (
      <button onClick={onOpen} className="w-full flex items-center justify-between active:scale-[0.99] transition-transform"
        style={{ background: `${MONEY_PALETTE.gold}1a`, border: `1.5px solid ${MONEY_PALETTE.gold}55`, borderRadius: 16, padding: '14px 16px' }}>
        <div className="text-left">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>🗓️ 이번 달 계획을 세워보세요</div>
          <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 2 }}>수입에서 고정비 빼고 → 저축 먼저 → 남은 걸로 생활</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: MONEY_PALETTE.gold, flexShrink: 0 }}>계획하기 ›</span>
      </button>
    );
  }
  return (
    <button onClick={onOpen} className="w-full active:scale-[0.99] transition-transform"
      style={{ background: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: '13px 16px', boxShadow: t.shadow }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
          <span style={{ color: MONEY_PALETTE.green }}>✓</span> 이번 달 계획 완료
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textSub }}>수정 ›</span>
      </div>
      <div className="flex gap-2">
        {[
          { l: '예상 수입', v: plan.expectedIncome, c: t.text },
          { l: '저축+투자', v: plan.plannedSavings + plan.plannedInvestment, c: MONEY_PALETTE.green },
          { l: '생활비', v: plan.plannedLiving, c: MONEY_PALETTE.gold },
        ].map((x, i) => (
          <div key={i} className="flex-1 text-center" style={{ background: t.bgSub, borderRadius: 10, padding: '7px 4px' }}>
            <div style={{ fontSize: 10, color: t.textMuted }}>{x.l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: x.c, marginTop: 1 }}>{formatManShort(x.v)}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

// ── 가계부 패널(요약·예산·캘린더·분석·거래, 거래 탭=수정) ──
//  · desktop=true(PC 셸)면 넓은 화면용 2단 레이아웃, 아니면 모바일 단일 컬럼(기존 그대로).
//  · 모바일 분기는 절대 변경 금지 — PC 최적화는 desktop 분기에서만.
export function BudgetPanel({ m, desktop = false }: { m: UseMoney; desktop?: boolean }) {
  const { t } = useTheme();
  const [editTx, setEditTx] = useState<{ item: any; date?: string } | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showWeek, setShowWeek] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  // 캘린더 날짜 탭 → 그 날짜로 새 거래 입력.
  const pickDate = (date: string) => setEditTx({ item: null, date });

  // 공통 "최근 거래" 블록 + 시트 오버레이(두 레이아웃 공유).
  const recentBlock = (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 10, marginLeft: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>최근 거래</span>
        <button onClick={() => setEditTx({ item: null, date: m.isCurrentPeriod ? undefined : m.period.end })} className="flex items-center gap-1" style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600 }}>
          <Plus size={13} /> 직접 추가
        </button>
      </div>
      <TransactionList m={m} limit={20} onEdit={(tx) => setEditTx({ item: tx })} />
    </div>
  );
  const sheets = (
    <>
      {editTx && <TransactionForm m={m} item={editTx.item} presetDate={editTx.date} onClose={() => setEditTx(null)} />}
      {showPlan && <MoneyPlanSheet m={m} onClose={() => setShowPlan(false)} />}
      {showWeek && <WeekReviewSheet m={m} onClose={() => setShowWeek(false)} />}
      {showMonth && <MonthReviewSheet m={m} onClose={() => setShowMonth(false)} />}
    </>
  );

  // PC: 상단(계획 배너+요약) 풀폭 → 본문 2단(좌: 예산·캘린더·추세 / 우: 주·월 회고·카테고리·최근거래).
  if (desktop) {
    return (
      <div className="flex flex-col gap-3">
        <PlanBanner m={m} onOpen={() => setShowPlan(true)} />
        <SummaryStrip m={m} />
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.35fr 1fr', alignItems: 'start' }}>
          <div className="flex flex-col gap-3 min-w-0">
            <BudgetBar m={m} />
            <SpendCalendar m={m} onPickDate={pickDate} />
            <SpendTrendChart m={m} />
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <WeekBanner m={m} onOpen={() => setShowWeek(true)} />
            <MonthBanner m={m} onOpen={() => setShowMonth(true)} />
            <CategoryBreakdown m={m} />
            {recentBlock}
          </div>
        </div>
        {sheets}
      </div>
    );
  }

  // 모바일 — 기존 단일 컬럼(변경 금지).
  return (
    <div className="flex flex-col gap-3">
      <PlanBanner m={m} onOpen={() => setShowPlan(true)} />
      <WeekBanner m={m} onOpen={() => setShowWeek(true)} />
      <MonthBanner m={m} onOpen={() => setShowMonth(true)} />
      <SummaryStrip m={m} />
      <BudgetBar m={m} />
      <SpendCalendar m={m} onPickDate={pickDate} />
      <SpendTrendChart m={m} />
      <CategoryBreakdown m={m} />
      {recentBlock}
      {sheets}
    </div>
  );
}

// ── 머니 설정 시트(예산 기간/급여일/환율 알림 + 카테고리 관리 진입) — 모바일/PC 공유 ──
//  · 월 예산 입력은 제거(Plan-Stage 1.5-A) — 예산(생활비 한도)은 "계획하기"에서만 결정(단일 출처).
export function SettingsSheet({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const [periodType, setPeriodType] = useState<PeriodType>(m.settings.periodType);
  const [payday, setPayday] = useState(String(m.settings.payday));
  const [fxThreshold, setFxThreshold] = useState(String(m.settings.fxAlertThreshold));
  const [showCategories, setShowCategories] = useState(false);

  const save = async () => {
    const thr = Number(fxThreshold);
    await m.updateSettings({
      ...m.settings,   // monthlyBudget/currency 는 기존 값 보존 — 통화·월예산은 설정에서 다루지 않음
      periodType,
      payday: Math.min(Math.max(parseInt(payday) || 1, 1), 31),
      fxAlertThreshold: Number.isFinite(thr) && thr > 0 ? thr : 3.0,
    });
    onClose();
  };

  const opt = (active: boolean) => ({
    flex: 1, padding: 10, borderRadius: 12, textAlign: 'center' as const, fontSize: 13, cursor: 'pointer',
    border: `1.5px solid ${active ? MONEY_PALETTE.gold : t.border}`,
    background: active ? `${MONEY_PALETTE.gold}18` : 'transparent',
    color: active ? t.text : t.textSub, fontWeight: active ? 600 : 400,
  });
  const input = { padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${t.border}`, fontSize: 15, fontWeight: 700, textAlign: 'center' as const, color: t.text, background: 'transparent', outline: 'none' };

  return (
    <>
    <MoneySheet onClose={onClose} size="wide" padClass="pt-5 px-5 pb-8 lg:p-7" maxVh={88}>
        <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>머니 설정</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>
        {/* PC: 설정 그룹 2열 / 모바일: 단일 컬럼(순서 동일) */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-6 lg:items-start">
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>예산 기간 기준</div>
          <div className="flex gap-2">
            <button style={opt(periodType === 'calendar')} onClick={() => setPeriodType('calendar')}>1일 ~ 말일</button>
            <button style={opt(periodType === 'payday')} onClick={() => setPeriodType('payday')}>급여일 기준</button>
          </div>
        </div>
        {periodType === 'payday' && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>급여일 (매월)</div>
            <div className="flex items-center gap-2">
              <input type="number" value={payday} onChange={e => setPayday(e.target.value)} min={1} max={31} style={{ ...input, width: 60 }} />
              <span style={{ fontSize: 13, color: t.textSub }}>일</span>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>월 예산</div>
          <div style={{ fontSize: 12, color: t.textMuted, background: t.bgSub, borderRadius: 10, padding: '11px 13px', lineHeight: 1.5 }}>
            이제 월 예산은 <b style={{ color: t.textSub }}>가계부 ›  계획하기</b>의 <b style={{ color: t.textSub }}>생활비 한도</b>로 정해요.
            수입에서 고정비·저축을 떼고 남은 돈으로 한 달 한도를 세웁니다.
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>환율 알림 임계값</div>
          <div className="flex items-center gap-2">
            <input type="number" step="0.5" value={fxThreshold} onChange={e => setFxThreshold(e.target.value)} style={{ ...input, width: 70 }} />
            <span style={{ fontSize: 13, color: t.textSub }}>% 이상 변동 시 알림</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>외화 고정비 환율이 직전 대비 이만큼 변하면 고정비 관리 화면에 ⚠ 표시</div>
        </div>
        </div>{/* /설정 그룹 2열 */}

        {/* 카테고리 관리 진입 */}
        <button onClick={() => setShowCategories(true)}
          className="flex items-center gap-3 w-full text-left" style={{ padding: '13px 14px', borderRadius: 12, background: t.bgSub, marginBottom: 20 }}>
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 9, background: `${MONEY_PALETTE.gold}20`, color: MONEY_PALETTE.gold }}>
            <Tags size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>카테고리 관리</div>
            <div style={{ fontSize: 11, color: t.textMuted }}>대분류 · 소분류 추가/수정/삭제</div>
          </div>
          <ChevronRight size={16} style={{ color: t.textMuted }} />
        </button>

        <button onClick={save} className="w-full" style={{ padding: 13, borderRadius: 12, background: MONEY_PALETTE.ink, color: '#FDFAF4', fontSize: 14, fontWeight: 600 }}>저장</button>
    </MoneySheet>

    {/* 카테고리 관리 — 설정 백드롭의 형제로 띄움(바깥 클릭 전파 방지) */}
    {showCategories && <CategoryManager m={m} onClose={() => setShowCategories(false)} />}
    </>
  );
}

// ── 탭 본문 라우팅(공유) ──
//  · desktop=true(PC): 가계부 탭은 넓은 2단, 그 외 탭은 단일 컬럼으로 콘텐츠 영역을 채움(건강 등 타 페이지와 동일).
export function MoneyTabPanel({ tab, m, desktop = false }: { tab: MoneyTab; m: UseMoney; desktop?: boolean }) {
  if (tab === 'budget') return <BudgetPanel m={m} desktop={desktop} />;
  if (tab === 'asset') return <AssetPanel m={m} />;
  if (tab === 'invest') return <InvestPanel m={m} />;
  return <PlanPanel m={m} />;
}
