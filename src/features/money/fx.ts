// 하온 머니 — 외화 환율(고정비 외화 구독용). 무료·키불필요 Frankfurter API.
//  · 결제일 "직전"에만(FX_WINDOW_DAYS 이내) + 사이클당 1회(FX_CYCLE_MIN_DAYS 가드) 호출.
//  · 환율/외부 호출은 "입력/조회 시점"에만 — 렌더 루프에서 무한 호출 금지(매니저 진입 시 1회).
//  · Frankfurter 는 CORS 허용이라 클라에서 직접 호출(엣지 함수 불필요).
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Currency, MoneyFixedCost } from './types';

export const FX_WINDOW_DAYS = 3;        // 결제일 며칠 전부터 갱신 시도
export const FX_CYCLE_MIN_DAYS = 20;    // 마지막 갱신 후 이 일수 지나야 재갱신(월 1회 보장)

export const CURRENCY_SYMBOL: Record<Currency, string> = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥' };

// 1 단위(from) → KRW 환율. 실패 시 null(호출부에서 graceful 스킵).
export async function fetchFxRate(from: Currency, to: Currency = 'KRW'): Promise<number | null> {
  if (from === to) return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    if (!res.ok) { console.error('[money] fx fetch:', res.status); return null; }
    const j = await res.json();
    const rate = j?.rates?.[to];
    return typeof rate === 'number' && Number.isFinite(rate) ? rate : null;
  } catch (e) {
    console.error('[money] fx fetch 예외:', String(e));
    return null;
  }
}

// 오늘 기준 매월 day 일까지 남은 일수(D-day). day 없으면 null.
export function daysUntilDay(day: number | null, base = new Date()): number | null {
  if (!day) return null;
  const y = base.getFullYear(), mo = base.getMonth(), d = base.getDate();
  let next = new Date(y, mo, day);
  if (next < new Date(y, mo, d)) next = new Date(y, mo + 1, day);
  return Math.round((next.getTime() - new Date(y, mo, d).getTime()) / 86400000);
}

// 월 환산 금액(주기 보정): 매월=그대로, 매주≈×52/12, 매년=÷12.
export function monthlyEquivalent(f: Pick<MoneyFixedCost, 'amount' | 'cycle'>): number {
  if (f.cycle === 'weekly') return Math.round(f.amount * 52 / 12);
  if (f.cycle === 'yearly') return Math.round(f.amount / 12);
  return f.amount;
}

// 이 외화 고정비가 지금 환율 갱신 대상인가?
//  · 외화 + 외화원금 있음 + 결제일 있음
//  · force 면 무조건, 아니면 결제일 임박(FX_WINDOW_DAYS) + 마지막 갱신 후 FX_CYCLE_MIN_DAYS 경과.
export function needsFxRefresh(f: MoneyFixedCost, todayStr: string, force = false): boolean {
  if (f.currency === 'KRW' || f.originalAmount == null) return false;
  if (force) return true;
  const dday = daysUntilDay(f.billingDay);
  if (dday == null || dday > FX_WINDOW_DAYS) return false;
  if (!f.fxRateDate) return true;
  return differenceInCalendarDays(parseISO(todayStr), parseISO(f.fxRateDate)) >= FX_CYCLE_MIN_DAYS;
}
