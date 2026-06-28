// 하온 머니 — 외화 환율(고정비 외화 구독용).
//  · 결제일 "직전"에만(FX_WINDOW_DAYS 이내) + 사이클당 1회(FX_CYCLE_MIN_DAYS 가드) 호출.
//  · 환율/외부 호출은 "입력/조회 시점"에만 — 렌더 루프에서 무한 호출 금지(매니저 진입 시 1회).
//  · 호출은 Supabase Edge Function(fx-rate)을 경유 — 서버사이드 다중 공급자 폴백
//    (frankfurter.dev → frankfurter.app → open.er-api). 브라우저 직접 호출의 CORS/호스트다운 취약점 제거.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import type { Currency, MoneyFixedCost } from './types';

export const FX_WINDOW_DAYS = 3;        // 결제일 며칠 전부터 갱신 시도
export const FX_CYCLE_MIN_DAYS = 20;    // 마지막 갱신 후 이 일수 지나야 재갱신(월 1회 보장)

export const CURRENCY_SYMBOL: Record<Currency, string> = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥' };

// fx-rate Edge Function 호출 공통부. 실패 시 null(호출부에서 graceful 폴백).
async function invokeFx(from: Currency, to: Currency, date?: string): Promise<number | null> {
  if (from === to) return 1;
  try {
    const { data, error } = await supabase.functions.invoke('fx-rate', { body: { from, to, date } });
    if (error) { console.error('[money] fx invoke:', error.message); return null; }
    const rate = data?.rate;
    return data?.ok && typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch (e) {
    console.error('[money] fx invoke 예외:', String(e));
    return null;
  }
}

// 1 단위(from) → KRW 최신 환율. 실패 시 null.
export async function fetchFxRate(from: Currency, to: Currency = 'KRW'): Promise<number | null> {
  return invokeFx(from, to);
}

// 특정 날짜(date 'yyyy-MM-dd')의 1 단위(from) → KRW 환율. 결제일 환산용(과거/당일).
//  · 해당일이 휴장이면 공급자가 직전 영업일 환율 반환. 미래 날짜는 데이터가 없어 null → 호출부에서 latest 폴백.
export async function fetchFxRateOn(date: string, from: Currency, to: Currency = 'KRW'): Promise<number | null> {
  return invokeFx(from, to, date);
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
