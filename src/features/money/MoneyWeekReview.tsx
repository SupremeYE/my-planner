// 하온 머니 — Plan-Stage 2A: 주간 회고(가볍게).
//  철학: "입력"보다 "확인". 빠르게 보고 다음 주 방향만 잡는 용도 — 입력 강제 없음(소감만 선택).
//  · WeekBanner : 가계부 탭 상단 슬림 배너(이번 주 예산 진행) — 탭하면 시트.
//  · WeekReviewSheet : 주차 선택 → ① 주간 예산 ② 소비 요약(전주 대비·무지출) ③ 다음 주 조정(메모 선택).
//  · 주(week)는 달력 주(전역 '주 시작 요일') 경계로 분할(getMoneyWeeks) — 일간/캘린더와 동일 기준.
//  · 색은 전부 tokens(MONEY_PALETTE) 경유, 배경/텍스트는 ThemeContext. PC 레이아웃 불변(공유 패널 내부 콘텐츠).
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../app/ThemeContext';
import type { UseMoney } from './useMoney';
import type { MoneyWeek } from './period';
import { MONEY_PALETTE, formatWon, formatManShort, resolveCategoryColor } from './tokens';

// 예산 대비 진행 막대 색: 초과=코랄, 임박(85%+)=골드, 평상=그린.
function progressColor(spent: number, budget: number): string {
  if (budget <= 0) return MONEY_PALETTE.gold;
  const r = spent / budget;
  if (r > 1) return MONEY_PALETTE.coral;
  if (r >= 0.85) return MONEY_PALETTE.gold;
  return MONEY_PALETTE.green;
}

// 한 주의 대분류별 지출 합(내림차순). rootCategoryOf 로 소분류는 대분류로 롤업.
function weekCategoryTotals(m: UseMoney, week: MoneyWeek): { id: string | null; name: string; color: string; amount: number }[] {
  const totals = new Map<string | null, number>();
  for (const t of m.periodTransactions) {
    if (t.type !== 'expense' || t.spentAt < week.start || t.spentAt > week.end) continue;
    const root = m.rootCategoryOf(t.categoryId);
    const key = root?.id ?? null;
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([id, amount]) => {
      const cat = id ? m.categoryOf(id) : null;
      return { id, name: cat?.name ?? '미분류', color: resolveCategoryColor(cat), amount };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ── 가계부 탭 상단 슬림 배너 ──
export function WeekBanner({ m, onOpen }: { m: UseMoney; onOpen: () => void }) {
  const { t } = useTheme();
  const week = m.thisWeek;
  if (!week) return null;
  const spent = m.weekSpending(week);
  const budget = m.weeklyLivingBudget;
  const ratio = budget > 0 ? Math.min(1, spent / budget) : 0;
  const remain = budget - spent;
  const color = progressColor(spent, budget);
  return (
    <button onClick={onOpen} className="w-full active:scale-[0.99] transition-transform"
      style={{ background: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: '12px 16px', boxShadow: t.shadow }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
          📅 {week.index}주차 <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>({format(week.startDate, 'M.d')}–{format(week.endDate, 'M.d')})</span>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textSub }}>이번 주 보기 ›</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: t.bgSub, overflow: 'hidden' }}>
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11, color: t.textSub }}>사용 <b style={{ color: t.text }}>{formatManShort(spent)}</b> / 예산 {formatManShort(budget)}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: remain < 0 ? MONEY_PALETTE.coral : MONEY_PALETTE.green }}>
          {remain < 0 ? `${formatManShort(-remain)} 초과` : `${formatManShort(remain)} 남음`}
        </span>
      </div>
    </button>
  );
}

// ── 주간 회고 시트 ──
export function WeekReviewSheet({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const weeks = m.weeks;
  // 기본 선택 = 이번 주(없으면 마지막 주).
  const [sel, setSel] = useState<number>(m.thisWeek?.index ?? weeks[weeks.length - 1]?.index ?? 1);
  const week = useMemo(() => weeks.find(w => w.index === sel) ?? weeks[0], [weeks, sel]);
  const prevWeek = useMemo(() => weeks.find(w => w.index === sel - 1) ?? null, [weeks, sel]);

  const saved = week ? m.reviewOfWeek(week.index) : null;
  const [note, setNote] = useState(saved?.note ?? '');
  // 주차 바꾸면 그 주차의 저장 메모로 동기화.
  React.useEffect(() => { setNote(m.reviewOfWeek(sel)?.note ?? ''); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!week) return null;

  const budget = m.weeklyLivingBudget;
  const spent = m.weekSpending(week);
  const remain = budget - spent;
  const ratio = budget > 0 ? Math.min(1, spent / budget) : 0;
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const over = spent > budget && budget > 0;
  const color = progressColor(spent, budget);
  const noSpend = m.weekNoSpendDays(week);

  const cats = weekCategoryTotals(m, week);
  const topCats = cats.slice(0, 2);
  const prevCats = prevWeek ? weekCategoryTotals(m, prevWeek) : [];
  const prevAmountOf = (id: string | null) => prevCats.find(c => c.id === id)?.amount ?? 0;

  const isCurrent = m.thisWeek?.index === week.index;

  const save = async () => {
    await m.saveReview({ type: 'weekly', weekIndex: week.index, totalSpent: spent, note: note.trim() || null });
    onClose();
  };

  const card = { background: t.bgSub, borderRadius: 14, padding: 14 };

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full lg:w-[480px] lg:max-w-[92vw] rounded-t-3xl lg:rounded-3xl"
        style={{ background: t.card, padding: '20px 20px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-start" style={{ marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{isCurrent ? '이번 주 돌아보기' : `${week.index}주차 돌아보기`}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{m.period.label} · {format(week.startDate, 'M.d')}–{format(week.endDate, 'M.d')} · 빠르게 확인하고 다음 주 방향만 잡아요</div>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {/* 주차 선택 칩 */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ marginBottom: 16, paddingBottom: 2 }}>
          {weeks.map(w => {
            const active = w.index === sel;
            const cur = m.thisWeek?.index === w.index;
            return (
              <button key={w.index} onClick={() => setSel(w.index)} className="flex-shrink-0"
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: `1.5px solid ${active ? MONEY_PALETTE.gold : t.border}`,
                  background: active ? `${MONEY_PALETTE.gold}18` : 'transparent',
                  color: active ? t.text : t.textSub, whiteSpace: 'nowrap',
                }}>
                {w.index}주차{cur ? ' ·' : ''}
              </button>
            );
          })}
        </div>

        {/* ① 주간 예산 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>
            ① {week.index}주차 예산 <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>({format(week.startDate, 'M.d')}–{format(week.endDate, 'M.d')})</span>
          </div>
          <div style={card}>
            <div className="flex items-end justify-between" style={{ marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: t.textSub }}>이번 주 사용</div>
                <div style={{ fontSize: 22, fontWeight: 900, color }}>{formatWon(spent)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: t.textSub }}>주간 예산</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.textSub }}>{formatWon(budget)}</div>
              </div>
            </div>
            <div style={{ height: 9, borderRadius: 5, background: t.card, overflow: 'hidden' }}>
              <div style={{ width: `${ratio * 100}%`, height: '100%', background: color, borderRadius: 5, transition: 'width .3s' }} />
            </div>
            <div className="flex items-center justify-between" style={{ marginTop: 7 }}>
              <span style={{ fontSize: 11.5, color: t.textMuted }}>{pct}% 사용</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: remain < 0 ? MONEY_PALETTE.coral : MONEY_PALETTE.green }}>
                {remain < 0 ? `${formatWon(-remain)} 초과` : `${formatWon(remain)} 남음`}
              </span>
            </div>
          </div>
          {budget <= 0 && (
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, textAlign: 'center' }}>
              월초 계획을 세우면 생활비 예산이 주별로 자동 분배돼요.
            </div>
          )}
        </div>

        {/* ② 소비 요약 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>② 이번 주 소비</div>
          <div style={card}>
            {spent === 0 ? (
              <div style={{ fontSize: 12.5, color: t.textMuted, textAlign: 'center', padding: '6px 0' }}>
                {isCurrent ? '아직 이번 주 지출이 없어요 👍' : '이 주엔 지출 기록이 없어요'}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {topCats.map((c, i) => {
                  const prev = prevAmountOf(c.id);
                  const up = prev > 0 && c.amount > prev;
                  const down = prev > 0 && c.amount < prev;
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span className="flex items-center gap-2" style={{ fontSize: 12.5, color: t.textSub }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} />
                        {c.name}
                        {i === 0 && <span style={{ fontSize: 10, color: t.textMuted }}>최다</span>}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                        {formatWon(c.amount)}
                        {prevWeek && (up || down) && (
                          <span style={{ fontSize: 11, marginLeft: 6, color: up ? MONEY_PALETTE.coral : MONEY_PALETTE.green }}>
                            {up ? '▲' : '▼'} 전주
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ height: 1, background: t.borderLight, margin: '12px 0 10px' }} />
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: t.textSub }}>무지출 일수</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: noSpend > 0 ? MONEY_PALETTE.gold : t.textMuted }}>
                {noSpend}일 <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted }}>/ {week.totalDays}일</span>
              </span>
            </div>
          </div>
        </div>

        {/* ③ 다음 주 조정 */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8 }}>③ 다음 주 조정 <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>(선택)</span></div>
          <div style={{
            background: over ? `${MONEY_PALETTE.coral}12` : `${MONEY_PALETTE.green}12`,
            borderRadius: 12, padding: '11px 14px', marginBottom: 10,
          }}>
            <span style={{ fontSize: 12, color: over ? MONEY_PALETTE.coral : t.textSub }}>
              {over
                ? '이번 주 예산을 넘었어요. 다음 주는 조금 아껴볼까요?'
                : spent === 0
                  ? '아직 여유가 많아요. 이대로 가볍게 가요.'
                  : '예산 안에서 잘 쓰고 있어요. 좋아요 👍'}
            </span>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="한 줄 메모 (예: 배달 줄이기 / 주말 외식 1회)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${t.border}`, fontSize: 13, color: t.text, background: 'transparent', outline: 'none', resize: 'none', fontFamily: t.font }} />
        </div>

        <button onClick={save} className="w-full"
          style={{ padding: 14, borderRadius: 12, background: MONEY_PALETTE.ink, color: '#FDFAF4', fontSize: 14, fontWeight: 700 }}>
          {saved ? '이번 주 기록 수정' : '이번 주 기록 저장'}
        </button>
      </div>
    </div>
  );
}
