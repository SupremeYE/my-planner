// 캡처 인박스 화면 (Stage 2-D) — 서버가 자동 분류해 쌓은 capture_inbox 제안을
// 사용자가 스와이프 한 번으로 승인(→목적지 저장)/버리기(→소프트 아카이브) 한다.
//
// - 승인 = 기존 store 액션(addTodo/addEvent)·db.somedaySeeds·moneyDb 로 저장(새 저장 경로 없음).
//   목적지 저장 성공 후에만 captureInbox.markRouted. 실패하면 pending 유지 + 알림.
// - 버리기 = markDiscarded(소프트 아카이브, DELETE 금지). 되돌리기 토스트(3초).
// - 목적지 null 카드는 우측 스와이프로 승인되지 않고 목적지 시트가 열린다.
// - 표면: 카드=솔리드(§1), 토스트=오버레이 글래스. 색/간격은 토큰·haonStyles 헬퍼만.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePlanner, getLogicalToday, type Tag } from '../store';
import { useTheme } from '../ThemeContext';
import { db, type SeedKind } from '../../lib/db';
import { moneyDb } from '../../features/money/db';
import type { MoneyCategory, MoneyTransaction, TxType } from '../../features/money/types';
import {
  captureInbox, type CaptureItem, type CaptureType, type CapturePayload,
} from '../../lib/captureInbox';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import {
  canvasStyle, inboxCardStyle, inboxUnconfirmedCardStyle, swipeRevealStyle,
  lowConfidenceMarkerStyle, undoToastStyle, bottomSheetStyle, sheetBackdropStyle,
  buttonStyle, withAlpha,
} from '../styles/haonStyles';

// ── 동작 상수(헬퍼가 아닌 컴포넌트 로직) ──
const THRESHOLD = 90;                                    // 스와이프 확정 임계값(px)
const SPRING = 'transform .26s cubic-bezier(.2,.8,.3,1)'; // 복귀 트랜지션
const LOW_CONF = 0.75;                                   // 이 미만이면 저확신 마커

const TYPE_LABEL: Record<CaptureType, string> = {
  todo: '할일', event: '일정', seed: '씨앗', money: '가계부',
};
const SEED_KIND_LABEL: Record<string, string> = {
  none: '미분류', do: '해보고 싶은', be: '되고 싶은', build: '만들고 싶은',
};

// ── payload 안전 리더(정규화됐지만 unknown 이므로 방어적으로 읽는다) ──
const s = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const n = (v: unknown): number | undefined => (Number.isFinite(Number(v)) ? Number(v) : undefined);

function fmtDate(iso?: string): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [, mm, dd] = iso.split('-');
  return `${Number(mm)}월 ${Number(dd)}일`;
}
function fmtCaptureTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = getLogicalToday();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const time = `${ampm} ${h12}:${min}`;
  return ymd === today ? time : `${Number(d.getMonth() + 1)}/${d.getDate()} ${time}`;
}
const won = (amt: number): string => `₩${new Intl.NumberFormat('ko-KR').format(amt)}`;

// 카드 제목(파싱된 제목). 목적지별로 다른 필드에서, 없으면 원문.
function cardTitle(item: CaptureItem): string {
  const p = item.proposedPayload ?? {};
  switch (item.proposedType) {
    case 'todo': return s(p.text) ?? item.rawText;
    case 'event': return s(p.title) ?? item.rawText;
    case 'seed': return s(p.text) ?? item.rawText;
    case 'money': return s((p as CapturePayload).memo) ?? item.rawText;
    default: return item.rawText;
  }
}

type Meta = { key: string; text: string; numeric?: boolean };
function cardMeta(item: CaptureItem): Meta[] {
  const p = item.proposedPayload ?? {};
  const out: Meta[] = [];
  switch (item.proposedType) {
    case 'todo': {
      const d = fmtDate(s(p.date));
      if (d) out.push({ key: 'date', text: d });
      if (p.important === true) out.push({ key: 'imp', text: '⭐ 중요' });
      break;
    }
    case 'event': {
      const d = fmtDate(s(p.start_date));
      if (d) out.push({ key: 'date', text: d });
      const st = s(p.start_time);
      if (st) out.push({ key: 'time', text: s(p.end_time) ? `${st}–${s(p.end_time)}` : st });
      break;
    }
    case 'seed': {
      const k = s(p.kind);
      if (k && k !== 'none') out.push({ key: 'kind', text: SEED_KIND_LABEL[k] ?? k });
      break;
    }
    case 'money': {
      const amt = n(p.amount);
      if (amt != null) out.push({ key: 'amt', text: won(amt), numeric: true });
      out.push({ key: 'io', text: p.type === 'income' ? '수입' : '지출' });
      const d = fmtDate(s(p.spent_at));
      if (d) out.push({ key: 'date', text: d });
      const ch = s(p.category_hint);
      if (ch) out.push({ key: 'cat', text: `# ${ch}` });
      const mh = s(p.method_hint);
      if (mh) out.push({ key: 'method', text: mh });
      break;
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
export function InboxView() {
  const { t } = useTheme();
  const { addTodo, addEvent, deleteTodo, deleteEvent, tags } = usePlanner();

  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyCats, setMoneyCats] = useState<MoneyCategory[]>([]);
  const [sheetFor, setSheetFor] = useState<CaptureItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 되돌리기 토스트 상태(개별 승인/버리기만). routed 는 승인 시 목적지 삭제용.
  const [undo, setUndo] = useState<
    { item: CaptureItem; action: 'approved' | 'discarded'; routed?: { table: string; refId: string } } | null
  >(null);

  const refresh = useCallback(() => {
    captureInbox.listPending().then(rows => { setItems(rows); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('capture_inbox', refresh);

  // 머니 카테고리(힌트→category_id 매칭용). 한 번만 로드.
  useEffect(() => { moneyDb.categories.fetchAll().then(setMoneyCats); }, []);

  // ── 목적지 저장(2-C) ─────────────────────────────────────────────────────
  // category_hint(문자열) → 기존 대분류 이름 일치 시 id, 없으면 null(임의 생성 금지).
  const matchCategoryId = useCallback((hint: unknown, type: TxType): string | null => {
    const h = s(hint);
    if (!h) return null;
    const hit = moneyCats.find(c => c.type === type && !c.parentId && c.name === h);
    return hit?.id ?? null;
  }, [moneyCats]);

  // tag 이름(문자열) → 기존 태그 id. 미존재 태그는 조용히 제외(임의 생성 안 함, v1).
  const resolveTagIds = useCallback((raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    const ids: string[] = [];
    for (const name of raw) {
      const nm = s(name);
      if (!nm) continue;
      const hit = (tags as Tag[]).find(tg => tg.name === nm);
      if (hit) ids.push(hit.id);
    }
    return ids;
  }, [tags]);

  // 목적지에 저장하고 { table, refId } 반환. 실패/불충분 시 null.
  const saveToDestination = useCallback(async (item: CaptureItem): Promise<{ table: string; refId: string } | null> => {
    const p: CapturePayload = item.proposedPayload ?? {};
    try {
      if (item.proposedType === 'todo') {
        const id = addTodo({
          text: s(p.text) ?? item.rawText,
          date: s(p.date) ?? null,          // 날짜 없으면 인박스(date=null)
          status: 'active',
          isTop3: p.important === true,
          tags: resolveTagIds(p.tags),
        });
        return { table: 'todos', refId: id };
      }
      if (item.proposedType === 'event') {
        const date = s(p.start_date);
        if (!date) return null;             // 일정은 날짜 필수(classify 가 보장하나 방어)
        const start = s(p.start_time);
        const id = addEvent({
          title: s(p.title) ?? item.rawText,
          date,
          startDate: date,
          endDate: date,
          startTime: start,
          endTime: s(p.end_time),
          isAllDay: !start,                 // 시간 없으면 종일
          repeatType: 'none',
          tags: [],
        });
        return { table: 'events', refId: id };
      }
      if (item.proposedType === 'seed') {
        const text = (s(p.text) ?? item.rawText).slice(0, 280); // someday_seeds.text 1~280 CHECK — UI 에서 자른다
        if (!text.trim()) return null;
        const kind = (['none', 'do', 'be', 'build'] as const).includes(p.kind as SeedKind)
          ? (p.kind as SeedKind) : 'none';
        const created = await db.somedaySeeds.create({ text, kind, status: 'seed' });
        return created ? { table: 'someday_seeds', refId: created.id } : null;
      }
      if (item.proposedType === 'money') {
        const amount = n(p.amount);
        if (amount == null || amount <= 0) return null; // 금액 없으면 저장 불가
        const txType: TxType = p.type === 'income' ? 'income' : 'expense';
        const id = crypto.randomUUID();
        const tx: MoneyTransaction = {
          id, type: txType, amount: Math.round(amount),
          categoryId: matchCategoryId(p.category_hint, txType), // 없으면 null (Stage 2 규칙)
          memo: item.rawText,
          paymentMethod: s(p.method_hint) ?? null,
          spentAt: s(p.spent_at) ?? getLogicalToday(),
          source: 'manual', rawInput: item.rawText, emoji: null,
          originalAmount: null, currency: 'KRW', fxRate: null, fixedCostId: null,
        };
        await moneyDb.transactions.upsert(tx);
        return { table: 'money_transactions', refId: id };
      }
    } catch (e) {
      console.error('[inbox] saveToDestination 실패:', String(e));
      return null;
    }
    return null;
  }, [addTodo, addEvent, resolveTagIds, matchCategoryId]);

  // ── 액션 ────────────────────────────────────────────────────────────────
  const approve = useCallback(async (item: CaptureItem) => {
    if (!item.proposedType) { setSheetFor(item); return; } // 목적지 null → 시트 오픈(승인 아님)
    const res = await saveToDestination(item);
    if (!res) { setNotice('저장에 필요한 정보가 부족해 인박스에 남겨뒀어요.'); return; }
    await captureInbox.markRouted(item.id, res.table, res.refId);
    setItems(prev => prev.filter(i => i.id !== item.id));
    setUndo({ item, action: 'approved', routed: res });
  }, [saveToDestination]);

  const discard = useCallback(async (item: CaptureItem) => {
    await captureInbox.markDiscarded(item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    setUndo({ item, action: 'discarded' });
  }, []);

  const doUndo = useCallback(async () => {
    if (!undo) return;
    const { item, action, routed } = undo;
    if (action === 'approved' && routed) {
      // 되돌리기 = 방금 만든 목적지 레코드 삭제 + 인박스 복구
      if (routed.table === 'todos') deleteTodo(routed.refId);
      else if (routed.table === 'events') deleteEvent(routed.refId);
      else if (routed.table === 'someday_seeds') await db.somedaySeeds.delete(routed.refId);
      else if (routed.table === 'money_transactions') await moneyDb.transactions.delete(routed.refId);
    }
    await captureInbox.restoreToPending(item.id);
    setUndo(null);
    refresh();
  }, [undo, deleteTodo, deleteEvent, refresh]);

  // 되돌리기 토스트 3초 자동 소멸
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 3000);
    return () => clearTimeout(timer);
  }, [undo]);

  // 알림 배너 3초 자동 소멸
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // 목적지 시트에서 타입 확정 — 최소 payload 파생 후 저장(승인 아님, 제안 갱신).
  const chooseType = useCallback(async (item: CaptureItem, type: CaptureType | null) => {
    const prev = item.proposedPayload ?? {};
    let payload: CapturePayload | null = null;
    if (type === 'todo') payload = { text: s(prev.text) ?? item.rawText, ...(s(prev.date) ? { date: prev.date } : {}) };
    else if (type === 'event') payload = { title: s(prev.title) ?? item.rawText, start_date: s(prev.start_date) ?? getLogicalToday(), ...(s(prev.start_time) ? { start_time: prev.start_time } : {}) };
    else if (type === 'seed') payload = { text: (s(prev.text) ?? item.rawText).slice(0, 280), kind: (typeof prev.kind === 'string' && ['none', 'do', 'be', 'build'].includes(prev.kind)) ? prev.kind : 'none' };
    else if (type === 'money') payload = { ...prev, type: prev.type === 'income' ? 'income' : 'expense', currency: 'KRW', spent_at: s(prev.spent_at) ?? getLogicalToday() };
    await captureInbox.updateProposal(item.id, type, payload);
    setSheetFor(null);
    refresh();
  }, [refresh]);

  const allConfident = items.length > 0 && items.every(i => i.proposedType);
  const approveAll = useCallback(async () => {
    // 하나라도 목적지 null 이면 버튼이 비활성이지만, 방어적으로 null 은 건너뛴다.
    for (const item of items) {
      if (!item.proposedType) continue;
      const res = await saveToDestination(item);
      if (res) await captureInbox.markRouted(item.id, res.table, res.refId);
    }
    refresh(); // "모두 승인"에는 되돌리기 토스트 없음
  }, [items, saveToDestination, refresh]);

  return (
    <div style={{ minHeight: '100%', ...canvasStyle(t) }}>
      <div className="mx-auto w-full max-w-[760px] px-4 pb-40 lg:px-6">
        {/* 헤더 */}
        <header className="pt-5 pb-3 lg:pt-8">
          <h1 style={{ fontFamily: t.fontPageTitle, color: t.text }} className="text-[22px] lg:text-[26px]">
            캡처 인박스
          </h1>
          <p style={{ fontFamily: t.fontBody, color: t.textMuted }} className="mt-1 text-[13px]">
            음성·텍스트로 던진 것을 서버가 분류해 모아뒀어요. 스와이프로 승인하거나 버리세요.
          </p>
        </header>

        {notice && (
          <div
            role="status"
            style={{ background: t.dangerLight, color: t.danger, fontFamily: t.fontBody }}
            className="mb-3 rounded-2xl px-4 py-2.5 text-[13px]"
          >
            {notice}
          </div>
        )}

        {loading ? (
          <p style={{ color: t.textMuted, fontFamily: t.fontBody }} className="py-16 text-center text-sm">
            불러오는 중…
          </p>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map(item => (
              <li key={item.id}>
                <SwipeCard
                  item={item}
                  onApprove={() => approve(item)}
                  onDiscard={() => discard(item)}
                  onOpenSheet={() => setSheetFor(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 일괄 "모두 승인" — 하나라도 목적지 null 이면 비활성 */}
      {!loading && items.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 lg:bottom-6">
          <button
            type="button"
            disabled={!allConfident}
            onClick={approveAll}
            style={{ ...buttonStyle(t, 'primary', !allConfident), fontFamily: t.fontLabel }}
            className="pointer-events-auto rounded-full px-6 py-3 text-[14px] shadow-lg"
            title={allConfident ? undefined : '목적지가 정해지지 않은 항목이 있어요'}
          >
            모두 승인 ({items.length})
          </button>
        </div>
      )}

      {/* 되돌리기 토스트 */}
      {undo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-32 z-40 flex justify-center px-4 lg:bottom-20">
          <div
            style={{ ...undoToastStyle(t), fontFamily: t.fontLabel }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[13px]"
          >
            <span>{undo.action === 'approved' ? '승인했어요' : '버렸어요'}</span>
            <button
              type="button"
              onClick={doUndo}
              style={{ color: '#FFFFFF' }}
              className="font-semibold underline underline-offset-2"
            >
              되돌리기
            </button>
          </div>
        </div>
      )}

      {/* 목적지 선택 시트 */}
      {sheetFor && (
        <DestinationSheet
          item={sheetFor}
          onClose={() => setSheetFor(null)}
          onChoose={(type) => chooseType(sheetFor, type)}
        />
      )}
    </div>
  );
}

// ── 스와이프 카드 ────────────────────────────────────────────────────────────
function SwipeCard({
  item, onApprove, onDiscard, onOpenSheet,
}: {
  item: CaptureItem;
  onApprove: () => void;
  onDiscard: () => void;
  onOpenSheet: () => void;
}) {
  const { t } = useTheme();
  const isNull = !item.proposedType;
  const lowConf = item.confidence != null && item.confidence < LOW_CONF;

  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    setAnimating(false);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    // 수평 우세일 때만 드래그 시작(세로 스크롤 보존)
    if (!dragging.current) {
      if (Math.abs(ddx) < 8 || Math.abs(ddx) < Math.abs(ddy)) return;
      dragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setDx(Math.max(-160, Math.min(160, ddx)));
  };
  const settle = () => {
    start.current = null;
    if (!dragging.current) return;
    dragging.current = false;
    setAnimating(true);
    if (dx >= THRESHOLD) {
      // 우측 = 승인(단, 목적지 null 이면 승인 대신 시트)
      setDx(0);
      if (isNull) onOpenSheet(); else onApprove();
    } else if (dx <= -THRESHOLD) {
      setDx(0);
      onDiscard();
    } else {
      setDx(0);
    }
  };

  const approveOpacity = Math.max(0, Math.min(1, dx / THRESHOLD));
  const discardOpacity = Math.max(0, Math.min(1, -dx / THRESHOLD));

  const title = cardTitle(item);
  const meta = cardMeta(item);

  return (
    <div className="relative overflow-hidden rounded-[20px]">
      {/* 리빌 레이어(카드 뒤) */}
      <div
        aria-hidden
        style={{ ...swipeRevealStyle(t, 'approve'), opacity: approveOpacity, color: '#FFFFFF', fontFamily: t.fontLabel }}
        className="absolute inset-0 flex items-center justify-start px-6 text-[15px] font-semibold"
      >
        {isNull ? '목적지 선택' : '승인 ✓'}
      </div>
      <div
        aria-hidden
        style={{ ...swipeRevealStyle(t, 'discard'), opacity: discardOpacity, color: t.text, fontFamily: t.fontLabel }}
        className="absolute inset-0 flex items-center justify-end px-6 text-[15px] font-semibold"
      >
        버리기
      </div>

      {/* 카드 본체(그룹 — PC hover 버튼) */}
      <div
        className="group relative touch-pan-y select-none"
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? SPRING : 'none',
          ...(isNull ? inboxUnconfirmedCardStyle(t) : inboxCardStyle(t)),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
      >
        <div className="p-4">
          {/* 상단: 목적지 칩 + 저확신 마커 + 캡처 시각 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSheet}
              style={{
                background: isNull ? 'transparent' : t.surfaceMuted,
                color: isNull ? t.textMuted : t.textSub,
                border: isNull ? `1px dashed ${withAlpha(t.textMuted, 0.5)}` : 'none',
                fontFamily: t.fontLabel,
              }}
              className="rounded-full px-2.5 py-1 text-[12px] font-medium"
            >
              {isNull ? '목적지 선택' : TYPE_LABEL[item.proposedType!]}
            </button>
            {lowConf && (
              <span
                title="분류 확신도 낮음 — 확인 필요"
                aria-label="분류 확신도 낮음 — 확인 필요"
                style={{ ...lowConfidenceMarkerStyle(t), fontFamily: t.fontLabel }}
                className="rounded-full px-2 py-0.5 text-[11px]"
              >
                ? 확인
              </span>
            )}
            <span
              style={{ color: t.textMuted, fontFamily: t.fontBody }}
              className="ml-auto text-[12px] whitespace-nowrap"
            >
              {fmtCaptureTime(item.capturedAt)}
            </span>
          </div>

          {/* 제목 */}
          <p
            style={{ color: t.text, fontFamily: t.fontBody, fontWeight: 600 }}
            className="mt-2 text-[16px] leading-snug break-words"
          >
            {title}
          </p>

          {/* 메타 칩 */}
          {meta.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {meta.map(m => (
                <span
                  key={m.key}
                  style={{
                    background: t.surfaceMuted,
                    color: t.textSub,
                    fontFamily: m.numeric ? t.fontNumeric : t.fontBody,
                  }}
                  className="rounded-lg px-2 py-0.5 text-[12px]"
                >
                  {m.text}
                </span>
              ))}
            </div>
          )}

          {/* 점선 구분선 + 원문(항상 노출) */}
          <div style={{ borderTop: `1px dashed ${withAlpha(t.textMuted, 0.35)}` }} className="mt-3 pt-2">
            <p style={{ color: t.textMuted, fontFamily: t.fontBody }} className="text-[12px] leading-relaxed break-words">
              <span style={{ color: withAlpha(t.textMuted, 0.8) }}>원문 · </span>{item.rawText}
            </p>
          </div>

          {/* PC hover 액션(스와이프 어려운 데스크톱용) */}
          <div className="mt-3 hidden items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
            <button
              type="button"
              onClick={onDiscard}
              style={{ ...buttonStyle(t, 'secondary'), fontFamily: t.fontLabel }}
              className="rounded-full px-3 py-1.5 text-[13px]"
            >
              버리기
            </button>
            <button
              type="button"
              onClick={isNull ? onOpenSheet : onApprove}
              style={{ ...buttonStyle(t, 'primary'), fontFamily: t.fontLabel }}
              className="rounded-full px-3 py-1.5 text-[13px]"
            >
              {isNull ? '목적지 선택' : '승인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 목적지 선택 시트 ─────────────────────────────────────────────────────────
function DestinationSheet({
  item, onClose, onChoose,
}: {
  item: CaptureItem;
  onClose: () => void;
  onChoose: (type: CaptureType | null) => void;
}) {
  const { t } = useTheme();
  const options: { type: CaptureType | null; label: string }[] = [
    { type: 'todo', label: '할일' },
    { type: 'event', label: '일정' },
    { type: 'seed', label: '씨앗(언젠가)' },
    { type: 'money', label: '가계부' },
    { type: null, label: '미분류로 두기' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center" onClick={onClose}>
      <div style={sheetBackdropStyle()} className="absolute inset-0" />
      <div
        style={{ ...bottomSheetStyle(t) }}
        className="relative w-full max-w-[520px] px-4 pb-8 pt-3 lg:mb-0 lg:rounded-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: withAlpha(t.textMuted, 0.4) }} />
        <p style={{ color: t.text, fontFamily: t.fontSection }} className="mb-1 text-[16px]">목적지 선택</p>
        <p style={{ color: t.textMuted, fontFamily: t.fontBody }} className="mb-3 text-[12px] break-words">
          {item.rawText}
        </p>
        <div className="flex flex-col gap-2">
          {options.map(o => {
            const active = item.proposedType === o.type;
            return (
              <button
                key={String(o.type)}
                type="button"
                onClick={() => onChoose(o.type)}
                style={{
                  background: active ? t.accentLight : t.surfaceMuted,
                  color: active ? t.accent : t.text,
                  fontFamily: t.fontLabel,
                }}
                className="rounded-xl px-4 py-3 text-left text-[14px] font-medium"
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 빈 상태 ──────────────────────────────────────────────────────────────────
function EmptyState() {
  const { t } = useTheme();
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center">
      <div
        style={{ background: t.surfaceMuted }}
        className="mb-1 flex h-14 w-14 items-center justify-center rounded-full text-[26px]"
      >
        📥
      </div>
      <p style={{ color: t.text, fontFamily: t.fontSection }} className="text-[16px]">인박스가 비었어요</p>
      <p style={{ color: t.textMuted, fontFamily: t.fontBody }} className="max-w-[280px] text-[13px] leading-relaxed">
        음성이나 텍스트로 떠오르는 걸 캡처하면 서버가 자동으로 분류해 여기 모아둬요.
      </p>
    </div>
  );
}
