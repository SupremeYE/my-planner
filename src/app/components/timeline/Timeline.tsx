import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner, Todo, Event, TimelineLog, SelfCareRecord, getTimerElapsedSec } from '../../store';
import { useTheme } from '../../ThemeContext';
import { formatDuration, formatTotalDoKo, todoDoDurationSeconds } from '../../../lib/todoDoDuration';
import { isEventPast } from '../../../api/events';
import { sleepRectsForColumn } from '../../../lib/sleepTimeline';
import { TimelineLogModal } from './TimelineLogModal';
import { TimelineAddModal } from './TimelineAddModal';
import { SleepTimeEditModal } from './SleepTimeEditModal';
import {
  HOUR_HEIGHT, PX_PER_MIN, TIMELINE_LABEL_WIDTH, TIMELINE_CONTENT_LEFT, TIMELINE_LANE_GAP,
  PLAN_BAR_BORDER, OVERTIME_BAR_BG, OVERTIME_BAR_BORDER, CURRENT_TIME_COLOR, LOG_OFFSET_STORAGE_KEY,
  timeToMinutes, minutesToTime, getContrastTextColor,
} from './timelineConstants';

// ─── Timeline (타임테이블) ───
// DailyView 에서 추출한 재사용 타임테이블. Stage 1 순수 리팩토링 — 화면·동작은 추출 전과 100% 동일.
// 데이터(선택 날짜·해당 날짜 todos/events)와 컨텍스트 메뉴 콜백은 props 로 받고, 나머지(updateTodo·
// 수면·로그·타이머·시간대 설정값)는 usePlanner 로 직접 읽는다. 블록 탭=편집은 기존처럼 window
// CustomEvent('editTodo') 로 부모(DailyView)에 위임한다.
// days: 1=일간(기본, dateTodos/dateEvents 사용) / 7=주간(weekDays 사용 — Stage 4).
// 주간(PC) 은 7일 × P/D 14컬럼 그리드로 블록 이동·리사이즈·탭편집을 일간과 동일한 핸들러로 제공한다.
// (수면=탭 편집 / 이벤트·로그·진행중 타이머 오버레이는 일간 전용 — 주간은 계획·실적 블록과 수면만 표시)
export interface TimelineWeekDay {
  date: string;
  todos: Todo[];
  events?: Event[];
}
interface TimelineProps {
  days?: number;
  selectedDate: string;
  dateTodos: Todo[];
  dateEvents: Event[];
  onShowContextMenu: (todo: Todo, pos: { x: number; y: number }, source?: 'do' | 'plan') => void;
  className?: string;
  // ── 주간(days=7) 전용 ──
  weekDays?: TimelineWeekDay[];
  onSelectDate?: (date: string) => void;
  onToday?: () => void;
  // ── 색상 오버라이드(옵션) — 일간 파스텔 테마 전용. 미전달 시 기존 하드코딩값 유지(캘린더 무영향) ──
  nowLineColor?: string;       // 현재 시각선 색 (기본 CURRENT_TIME_COLOR)
  defaultBlockBg?: string;     // 태그 없는 블록 배경 (기본 초록 계열)
  defaultBlockBorder?: string; // 태그 없는 블록 테두리
  defaultBlockText?: string;   // 태그 없는 블록 텍스트
  dayBoundLabel?: string;      // "하루 기준 · 04:00 – 익일 02:00" — TIMELINE 라벨 우측에 작게 노출(일간 전용)
}

// 주간 그리드: 시간 레이블 폭 + (7일 × P/D 2컬럼)
const WEEK_TIME_COL = 44;

export function Timeline({ days = 1, selectedDate, dateTodos, dateEvents, onShowContextMenu, className, weekDays, onSelectDate, onToday, nowLineColor = CURRENT_TIME_COLOR, defaultBlockBg, defaultBlockBorder, defaultBlockText, dayBoundLabel }: TimelineProps) {
  const isWeek = days > 1 && !!weekDays;
  const {
    todos, updateTodo, updateEvent, tags,
    activeTimer,
    selfCareRecords, updateSelfCareRecord,
    dayStartHour: tlStartHour, dayEndHour: tlEndHour,
    timelineLogs,
    addTimelineLog: storeAddTimelineLog,
    deleteTimelineLog: storeDeleteTimelineLog,
  } = usePlanner();
  const { t } = useTheme();

  // Sleep block drag state
  const [sleepDragState, setSleepDragState] = useState<{
    recordId: string;
    mode: 'move' | 'resize';
    startY: number;
    origStartMin: number;
    origEndMin: number;
  } | null>(null);
  const [sleepDragPreview, setSleepDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const sleepDragMovedRef = useRef(false);
  const [editingSleepRecord, setEditingSleepRecord] = useState<SelfCareRecord | null>(null);

  const createDragRef = useRef<{
    startMin: number;
    endMin: number;
    lane: 'plan' | 'do';
    startClientY: number;
    startClientX: number;
    pointerId: number;
    pointerType: string;
    active: boolean; // 사이징 활성 (마우스=즉시 / 터치=롱프레스 후)
    moved: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const timelineRelativeRef = useRef<HTMLDivElement>(null);
  const [createPreview, setCreatePreview] = useState<{ startMin: number; endMin: number; lane: 'plan' | 'do' } | null>(null);
  const [createTarget, setCreateTarget] = useState<{ start: string; end: string; lane: 'plan' | 'do'; date?: string } | null>(null);
  const [hoverSlot, setHoverSlot] = useState<{ startMin: number; endMin: number; lane: 'plan' | 'do' } | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [timelineTab, setTimelineTab] = useState<'plan' | 'do' | 'compare'>('compare');
  const [timerNowMs, setTimerNowMs] = useState(Date.now());
  const [logOffsets, setLogOffsets] = useState<Record<string, number>>({});

  // Drag state for timeline blocks
  const [dragState, setDragState] = useState<{
    todoId: string;
    type: 'plan' | 'do';
    mode: 'move' | 'resize';
    startY: number;
    origStartMin: number;
    origEndMin: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const dragMovedRef = useRef(false);
  const logDragRef = useRef<{ id: string; startX: number; startOffset: number } | null>(null);
  const logDragMovedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOG_OFFSET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      setLogOffsets(parsed);
    } catch {
      // ignore malformed local storage value
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOG_OFFSET_STORAGE_KEY, JSON.stringify(logOffsets));
  }, [logOffsets]);

  // ── Timeline block move/resize — unified Pointer Events (mouse + touch + pen) ──
  // 좌표계/스냅(15분)/클램프 로직은 기존 마우스 드래그와 동일. setPointerCapture 로
  // document 리스너 의존 없이 드래그 시작 엘리먼트에서 move/up/cancel 을 모두 받는다.
  type BlockDrag = {
    pointerId: number;
    el: HTMLElement;
    todo: Todo;
    type: 'plan' | 'do';
    mode: 'move' | 'resize';
    canDrag: boolean;
    pointerType: string;
    startX: number;
    startY: number;
    origStartMin: number;
    origEndMin: number;
    activated: boolean;
    moved: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    preview: { startMin: number; endMin: number } | null;
  };
  const pointerDragRef = useRef<BlockDrag | null>(null);
  const BLOCK_SNAP_MIN = 15;

  const cancelBlockLongPress = (d: BlockDrag) => {
    if (d.longPressTimer) { clearTimeout(d.longPressTimer); d.longPressTimer = null; }
  };

  const activateBlockDrag = (d: BlockDrag) => {
    d.activated = true;
    // 실제 스크롤 차단은 document 의 네이티브 비-passive touchmove 리스너가 담당(아래 useEffect).
    // (el 의 touch-action 은 제스처 시작 후 설정이라 무효 → 보조용으로만 남김)
    d.el.style.touchAction = 'none';
    if (d.pointerType !== 'mouse') {
      // 터치/펜 이동 모드 진입 피드백
      d.el.style.transform = 'scale(1.03)';
      d.el.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)';
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
    }
    setDragState({
      todoId: d.todo.id, type: d.type, mode: d.mode,
      startY: d.startY, origStartMin: d.origStartMin, origEndMin: d.origEndMin,
    });
  };

  const clearBlockDrag = (d: BlockDrag) => {
    cancelBlockLongPress(d);
    try { d.el.releasePointerCapture(d.pointerId); } catch { /* noop */ }
    d.el.style.touchAction = '';
    d.el.style.transform = '';
    d.el.style.boxShadow = '';
    if (pointerDragRef.current === d) pointerDragRef.current = null;
    dragMovedRef.current = d.moved;
    setDragState(null);
    setDragPreview(null);
    setTimeout(() => { dragMovedRef.current = false; }, 50);
  };

  const handleBlockPointerMove = (e: React.PointerEvent) => {
    const d = pointerDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.activated) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.pointerType === 'mouse') {
        // 마우스: 5px 이상 움직이면 이동 시작 (미만이면 pointerup 에서 탭=편집)
        if (d.canDrag && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) activateBlockDrag(d);
        else return;
      } else {
        // 터치/펜: 롱프레스 전 움직임은 스크롤로 간주 → 대기 취소(캡처 미보유라 스크롤 진행)
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearBlockDrag(d);
        return;
      }
    }
    const dy = e.clientY - d.startY;
    const dMin = Math.round(dy / PX_PER_MIN / BLOCK_SNAP_MIN) * BLOCK_SNAP_MIN; // 15분 스냅
    let preview: { startMin: number; endMin: number };
    if (d.mode === 'move') {
      const duration = d.origEndMin - d.origStartMin;
      const newStart = Math.max(tlStartHour * 60, d.origStartMin + dMin);
      const newEnd = Math.min(tlEndHour * 60, newStart + duration); // 길이 유지 + 클램프
      preview = { startMin: newEnd - duration, endMin: newEnd };
    } else {
      const newEnd = Math.max(d.origStartMin + BLOCK_SNAP_MIN, Math.min(tlEndHour * 60, d.origEndMin + dMin)); // start 고정, 최소 15분
      preview = { startMin: d.origStartMin, endMin: newEnd };
    }
    d.preview = preview;
    d.moved = true;
    setDragPreview(preview);
  };

  const handleBlockPointerUp = (e: React.PointerEvent) => {
    const d = pointerDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    cancelBlockLongPress(d);
    if (d.activated && d.moved && d.preview) {
      // PLAN → planStart/End, DO → doStart/End 만 갱신(서로 안 섞임)
      const startField = d.type === 'plan' ? 'planStart' : 'doStart';
      const endField = d.type === 'plan' ? 'planEnd' : 'doEnd';
      updateTodo(d.todo.id, {
        [startField]: minutesToTime(d.preview.startMin),
        [endField]: minutesToTime(d.preview.endMin),
        ...(d.type === 'do' ? { doElapsedSec: undefined } : {}),
      });
    } else if (!d.activated) {
      // 탭(마우스 5px 미만 / 터치 짧게) → 편집 모달
      window.dispatchEvent(new CustomEvent('editTodo', { detail: d.todo }));
    }
    clearBlockDrag(d);
  };

  const handleBlockPointerCancel = (e: React.PointerEvent) => {
    const d = pointerDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearBlockDrag(d);
  };

  const handleBlockPointerDown = (
    e: React.PointerEvent, todo: Todo, type: 'plan' | 'do', canDrag: boolean,
    origStartMin: number, origEndMin: number,
  ) => {
    if (e.button === 2) return; // 우클릭은 onContextMenu 가 처리
    const el = e.currentTarget as HTMLElement;
    const d: BlockDrag = {
      pointerId: e.pointerId, el, todo, type, mode: 'move', canDrag,
      pointerType: e.pointerType, startX: e.clientX, startY: e.clientY,
      origStartMin, origEndMin, activated: false, moved: false,
      longPressTimer: null, preview: null,
    };
    pointerDragRef.current = d;
    if (e.pointerType === 'mouse') {
      try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
      // 이동 시작은 5px 이동 시점까지 보류 (탭=편집 구분)
    } else if (canDrag) {
      // 터치/펜: 250ms 롱프레스 → 이동 모드. 대기 중 스크롤 허용(캡처 보류).
      d.longPressTimer = setTimeout(() => {
        d.longPressTimer = null;
        if (pointerDragRef.current !== d) return;
        try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
        activateBlockDrag(d);
      }, 250);
    }
  };

  const handleResizePointerDown = (
    e: React.PointerEvent, todo: Todo, type: 'plan' | 'do',
    origStartMin: number, origEndMin: number,
  ) => {
    if (e.button === 2) return;
    e.stopPropagation(); // 본체 이동과 분리
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const d: BlockDrag = {
      pointerId: e.pointerId, el, todo, type, mode: 'resize', canDrag: true,
      pointerType: e.pointerType, startX: e.clientX, startY: e.clientY,
      origStartMin, origEndMin, activated: true, moved: false, // 손잡이는 롱프레스 없이 즉시
      longPressTimer: null, preview: null,
    };
    pointerDragRef.current = d;
    try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
    el.style.touchAction = 'none';
    setDragState({ todoId: todo.id, type, mode: 'resize', startY: e.clientY, origStartMin, origEndMin });
  };

  // ── 일정(Event) 블록 이동/리사이즈 — 할일 블록과 동일한 Pointer Events 패턴 ──
  // 일정도 타임라인에서 드래그로 시간 이동/리사이즈하고, 짧은 탭은 편집(EventModal) 으로 위임한다.
  // (할일은 plan/do 두 레인이라 BlockDrag 를 공유하기 어려워 일정 전용 핸들러로 분리)
  type EventDrag = {
    pointerId: number;
    el: HTMLElement;
    event: Event;
    mode: 'move' | 'resize';
    pointerType: string;
    startX: number;
    startY: number;
    origStartMin: number;
    origEndMin: number;
    activated: boolean;
    moved: boolean;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    preview: { startMin: number; endMin: number } | null;
  };
  const eventDragRef = useRef<EventDrag | null>(null);
  const [eventDragState, setEventDragState] = useState<{ eventId: string } | null>(null);
  const [eventDragPreview, setEventDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);

  const activateEventDrag = (d: EventDrag) => {
    d.activated = true;
    d.el.style.touchAction = 'none';
    if (d.pointerType !== 'mouse') {
      d.el.style.transform = 'scale(1.03)';
      d.el.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)';
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch { /* noop */ } }
    }
    setEventDragState({ eventId: d.event.id });
  };

  const clearEventDrag = (d: EventDrag) => {
    if (d.longPressTimer) { clearTimeout(d.longPressTimer); d.longPressTimer = null; }
    try { d.el.releasePointerCapture(d.pointerId); } catch { /* noop */ }
    d.el.style.touchAction = '';
    d.el.style.transform = '';
    d.el.style.boxShadow = '';
    if (eventDragRef.current === d) eventDragRef.current = null;
    setEventDragState(null);
    setEventDragPreview(null);
  };

  const handleEventPointerMove = (e: React.PointerEvent) => {
    const d = eventDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.activated) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.pointerType === 'mouse') {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) activateEventDrag(d);
        else return;
      } else {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearEventDrag(d);
        return;
      }
    }
    const dy = e.clientY - d.startY;
    const dMin = Math.round(dy / PX_PER_MIN / BLOCK_SNAP_MIN) * BLOCK_SNAP_MIN;
    let preview: { startMin: number; endMin: number };
    if (d.mode === 'move') {
      const duration = d.origEndMin - d.origStartMin;
      const newStart = Math.max(tlStartHour * 60, d.origStartMin + dMin);
      const newEnd = Math.min(tlEndHour * 60, newStart + duration);
      preview = { startMin: newEnd - duration, endMin: newEnd };
    } else {
      const newEnd = Math.max(d.origStartMin + BLOCK_SNAP_MIN, Math.min(tlEndHour * 60, d.origEndMin + dMin));
      preview = { startMin: d.origStartMin, endMin: newEnd };
    }
    d.preview = preview;
    d.moved = true;
    setEventDragPreview(preview);
  };

  const handleEventPointerUp = (e: React.PointerEvent) => {
    const d = eventDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.activated && d.moved && d.preview) {
      updateEvent(d.event.id, {
        startTime: minutesToTime(d.preview.startMin),
        endTime: minutesToTime(d.preview.endMin),
      });
    } else if (!d.activated) {
      window.dispatchEvent(new CustomEvent('editEvent', { detail: d.event }));
    }
    clearEventDrag(d);
  };

  const handleEventPointerCancel = (e: React.PointerEvent) => {
    const d = eventDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    clearEventDrag(d);
  };

  const handleEventPointerDown = (
    e: React.PointerEvent, evt: Event, origStartMin: number, origEndMin: number,
  ) => {
    if (e.button === 2) return; // 우클릭은 onContextMenu 가 처리
    const el = e.currentTarget as HTMLElement;
    const d: EventDrag = {
      pointerId: e.pointerId, el, event: evt, mode: 'move',
      pointerType: e.pointerType, startX: e.clientX, startY: e.clientY,
      origStartMin, origEndMin, activated: false, moved: false,
      longPressTimer: null, preview: null,
    };
    eventDragRef.current = d;
    if (e.pointerType === 'mouse') {
      try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
    } else {
      d.longPressTimer = setTimeout(() => {
        d.longPressTimer = null;
        if (eventDragRef.current !== d) return;
        try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
        activateEventDrag(d);
      }, 250);
    }
  };

  const handleEventResizePointerDown = (
    e: React.PointerEvent, evt: Event, origStartMin: number, origEndMin: number,
  ) => {
    if (e.button === 2) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const d: EventDrag = {
      pointerId: e.pointerId, el, event: evt, mode: 'resize',
      pointerType: e.pointerType, startX: e.clientX, startY: e.clientY,
      origStartMin, origEndMin, activated: true, moved: false,
      longPressTimer: null, preview: null,
    };
    eventDragRef.current = d;
    try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
    el.style.touchAction = 'none';
    setEventDragState({ eventId: evt.id });
  };

  // Sleep block drag (mouse)
  useEffect(() => {
    if (!sleepDragState) return;
    const handleMouseMove = (e: MouseEvent) => {
      sleepDragMovedRef.current = true;
      const dy = e.clientY - sleepDragState.startY;
      const dMin = Math.round(dy / PX_PER_MIN / 5) * 5;
      if (sleepDragState.mode === 'move') {
        const duration = sleepDragState.origEndMin - sleepDragState.origStartMin;
        const newStart = sleepDragState.origStartMin + dMin;
        setSleepDragPreview({ startMin: newStart, endMin: newStart + duration });
      } else {
        const newEnd = Math.max(sleepDragState.origStartMin + 5, sleepDragState.origEndMin + dMin);
        setSleepDragPreview({ startMin: sleepDragState.origStartMin, endMin: newEnd });
      }
    };
    const handleMouseUp = () => {
      if (sleepDragPreview && sleepDragMovedRef.current) {
        const startTime = minutesToTime(((sleepDragPreview.startMin % (24 * 60)) + 24 * 60) % (24 * 60));
        const endTime = minutesToTime(((sleepDragPreview.endMin % (24 * 60)) + 24 * 60) % (24 * 60));
        const duration = sleepDragPreview.endMin - sleepDragPreview.startMin;
        updateSelfCareRecord(sleepDragState.recordId, {
          sleepStart: startTime, sleepEnd: endTime,
          content: `${startTime} ~ ${endTime}`, duration,
        });
      }
      setSleepDragState(null);
      setSleepDragPreview(null);
      setTimeout(() => { sleepDragMovedRef.current = false; }, 50);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sleepDragState, sleepDragPreview, updateSelfCareRecord]);

  // ── 빈 타임라인 영역 — 클릭/드래그로 추가 모달 (Pointer Events 통일) ──
  // 클릭(5px 미만)=기본 60분 / 드래그=드래그 범위(15분 스냅). 레인은 클릭 X 로 결정(compare: 좌 PLAN/우 DO).
  const CREATE_DEFAULT_MIN = 60;
  const detectLaneFromX = (clientX: number, rect: DOMRect): 'plan' | 'do' => {
    if (timelineTab === 'plan') return 'plan';
    if (timelineTab === 'do') return 'do';
    const contentLeft = rect.left + TIMELINE_CONTENT_LEFT;
    const mid = contentLeft + (rect.right - contentLeft) / 2;
    return clientX < mid ? 'plan' : 'do';
  };
  const yToSnappedMin = (clientY: number, rect: DOMRect) => {
    const relY = clientY - rect.top;
    const rawMin = tlStartHour * 60 + relY / PX_PER_MIN;
    return Math.round(rawMin / 15) * 15;
  };
  const clearCreateDrag = () => {
    const d = createDragRef.current;
    if (d?.longPressTimer) clearTimeout(d.longPressTimer);
    if (d) { try { timelineRelativeRef.current?.releasePointerCapture(d.pointerId); } catch { /* noop */ } }
    createDragRef.current = null;
    setCreatePreview(null);
  };
  const openCreateFromDrag = (lane: 'plan' | 'do', rawStart: number, rawEnd: number, ranged: boolean) => {
    let startMin = Math.max(tlStartHour * 60, Math.min(tlEndHour * 60 - 15, rawStart));
    let endMin = ranged
      ? Math.max(startMin + 15, rawEnd)
      : startMin + CREATE_DEFAULT_MIN;
    endMin = Math.min(tlEndHour * 60, Math.max(startMin + 15, endMin));
    setCreateTarget({ start: minutesToTime(startMin), end: minutesToTime(endMin), lane });
  };

  const handleCreatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    if ((e.target as HTMLElement).closest('.timeline-block')) return; // 블록 위는 블록 핸들러가 처리
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (e.clientX - rect.left < TIMELINE_CONTENT_LEFT) return; // 시간 레이블 영역 제외
    setHoverSlot(null);
    const lane = detectLaneFromX(e.clientX, rect);
    const startMin = Math.max(tlStartHour * 60, Math.min(tlEndHour * 60 - 15, yToSnappedMin(e.clientY, rect)));
    const d = {
      startMin, endMin: startMin, lane,
      startClientX: e.clientX, startClientY: e.clientY,
      pointerId: e.pointerId, pointerType: e.pointerType,
      active: e.pointerType === 'mouse', moved: false,
      longPressTimer: null as ReturnType<typeof setTimeout> | null,
    };
    createDragRef.current = d;
    if (e.pointerType === 'mouse') {
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    } else {
      // 터치/펜: 롱프레스 후 범위 드래그. 대기 중 움직이면 스크롤로 간주(빠른 탭은 pointerup 에서 기본 60분).
      d.longPressTimer = setTimeout(() => {
        d.longPressTimer = null;
        if (createDragRef.current !== d) return;
        d.active = true;
        d.endMin = Math.min(tlEndHour * 60, d.startMin + 30);
        try { el.setPointerCapture(d.pointerId); } catch { /* noop */ }
        if (navigator.vibrate) { try { navigator.vibrate(20); } catch { /* noop */ } }
        setCreatePreview({ startMin: d.startMin, endMin: d.endMin, lane: d.lane });
      }, 350);
    }
  };

  const handleCreatePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = createDragRef.current;
    if (!d) {
      // PC hover 미리보기 (버튼 안 눌린 마우스 이동, 터치는 hover 없음)
      if (e.pointerType !== 'mouse') return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX - rect.left < TIMELINE_CONTENT_LEFT || (e.target as HTMLElement).closest('.timeline-block')) {
        setHoverSlot(null); return;
      }
      const lane = detectLaneFromX(e.clientX, rect);
      const startMin = Math.max(tlStartHour * 60, Math.min(tlEndHour * 60 - 15, yToSnappedMin(e.clientY, rect)));
      setHoverSlot({ startMin, endMin: Math.min(tlEndHour * 60, startMin + CREATE_DEFAULT_MIN), lane });
      return;
    }
    if (e.pointerId !== d.pointerId) return;
    if (!d.active) {
      // 터치 롱프레스 대기 — 움직이면 스크롤 허용
      if (Math.abs(e.clientX - d.startClientX) > 5 || Math.abs(e.clientY - d.startClientY) > 5) clearCreateDrag();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const endMin = Math.max(d.startMin + 15, Math.min(tlEndHour * 60, yToSnappedMin(e.clientY, rect)));
    d.endMin = endMin;
    if (Math.abs(e.clientY - d.startClientY) > 5) d.moved = true;
    setCreatePreview({ startMin: d.startMin, endMin, lane: d.lane });
  };

  const handleCreatePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = createDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const ranged = d.moved && (d.endMin - d.startMin) >= 15;
    const { lane, startMin, endMin } = d;
    clearCreateDrag();
    openCreateFromDrag(lane, startMin, endMin, ranged);
  };

  const handleCreatePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = createDragRef.current;
    if (d && e.pointerId !== d.pointerId) return;
    clearCreateDrag();
  };

  // (모바일 터치 빈영역 생성은 위 handleCreatePointer* 로 통합 — 별도 네이티브 touch 리스너 제거)

  // ── 주간 컬럼 빈영역 클릭 → 추가 (PC 마우스 전용, 기본 60분) ──
  // 좁은 컬럼에서 스크롤/탭 혼동을 피하려 드래그 범위 없이 클릭만 지원한다.
  const weekCreateRef = useRef<{ date: string; lane: 'plan' | 'do'; startMin: number; startY: number; moved: boolean; pointerId: number } | null>(null);
  const handleWeekCreateDown = (e: React.PointerEvent<HTMLDivElement>, date: string, lane: 'plan' | 'do') => {
    if (e.button === 2 || e.pointerType !== 'mouse') return;
    if ((e.target as HTMLElement).closest('.timeline-block')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = tlStartHour * 60 + (e.clientY - rect.top) / PX_PER_MIN;
    const startMin = Math.max(tlStartHour * 60, Math.min(tlEndHour * 60 - 15, Math.round(raw / 15) * 15));
    weekCreateRef.current = { date, lane, startMin, startY: e.clientY, moved: false, pointerId: e.pointerId };
  };
  const handleWeekCreateMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = weekCreateRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (Math.abs(e.clientY - d.startY) > 5) d.moved = true;
  };
  const handleWeekCreateUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = weekCreateRef.current;
    if (!d || e.pointerId !== d.pointerId) { weekCreateRef.current = null; return; }
    if (!d.moved && !(e.target as HTMLElement).closest('.timeline-block')) {
      const endMin = Math.min(tlEndHour * 60, Math.max(d.startMin + 15, d.startMin + CREATE_DEFAULT_MIN));
      setCreateTarget({ start: minutesToTime(d.startMin), end: minutesToTime(endMin), lane: d.lane, date: d.date });
    }
    weekCreateRef.current = null;
  };

  useEffect(() => {
    const clampLogOffset = (offset: number) => {
      const limit = window.innerWidth < 1024 ? 56 : 120;
      return Math.max(-limit, Math.min(limit, offset));
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!logDragRef.current) return;
      logDragMovedRef.current = true;
      const delta = e.clientX - logDragRef.current.startX;
      setLogOffsets(prev => ({
        ...prev,
        [logDragRef.current!.id]: clampLogOffset(logDragRef.current!.startOffset + delta),
      }));
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!logDragRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      logDragMovedRef.current = true;
      const delta = touch.clientX - logDragRef.current.startX;
      setLogOffsets(prev => ({
        ...prev,
        [logDragRef.current!.id]: clampLogOffset(logDragRef.current!.startOffset + delta),
      }));
    };
    const handleEnd = () => {
      if (!logDragRef.current) return;
      logDragRef.current = null;
      setTimeout(() => {
        logDragMovedRef.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  useEffect(() => {
    if (!activeTimer || activeTimer.isPaused) return;
    const iv = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

  const getActiveTimerElapsedSec = () => {
    if (!activeTimer) return 0;
    return getTimerElapsedSec(activeTimer, timerNowMs);
  };

  const activeTimerTodo = activeTimer ? todos.find(td => td.id === activeTimer.todoId) : null;
  const activeTimerSec = activeTimer && activeTimerTodo?.date === selectedDate
    ? getActiveTimerElapsedSec()
    : 0;

  // 타임라인 요약 계산 (실제 DO 초: 타이머 기록 우선, 진행 중 타이머는 초 단위 합산)
  const totalPlanMin = dateTodos.filter(td => td.planStart && td.planEnd)
    .reduce((sum, td) => sum + (timeToMinutes(td.planEnd!) - timeToMinutes(td.planStart!)), 0);
  const totalDoSec = dateTodos
    .filter(td => td.doStart && td.doEnd)
    .reduce((sum, td) => sum + todoDoDurationSeconds(td), 0) + activeTimerSec;
  const doneCount = dateTodos.filter(td => td.status === 'done').length;
  const achieveRate = dateTodos.length > 0 ? Math.round((doneCount / dateTodos.length) * 100) : 0;

  const addTimelineLog = useCallback((log: TimelineLog) => {
    const { id: _id, ...logWithoutId } = log;
    storeAddTimelineLog(logWithoutId);
  }, [storeAddTimelineLog]);

  const deleteTimelineLog = useCallback((id: string) => {
    storeDeleteTimelineLog(id);
  }, [storeDeleteTimelineLog]);

  // ── Timeline ──
  const hours: number[] = [];
  for (let h = tlStartHour; h < tlEndHour; h++) hours.push(h % 24);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollToHour = Math.max(0, currentHour - tlStartHour - 2);
      scrollRef.current.scrollTop = scrollToHour * HOUR_HEIGHT;
    }
  }, [selectedDate, tlStartHour]);

  // 블록 이동/리사이즈가 '활성'인 동안에만 네이티브 비-passive touchmove 로 스크롤을 실제 취소.
  // touch-action 사후설정/React passive 리스너로는 이미 시작된 터치 제스처의 스크롤을 못 막아
  // pointercancel 로 드래그가 즉시 끊기던 문제를 해결한다. 평상시(비활성)엔 preventDefault 하지
  // 않으므로 타임라인 세로 스크롤은 정상 유지. document 에 한 번만 등록(탭 전환에 의한 재마운트 무관).
  useEffect(() => {
    const onTouchMoveNative = (e: TouchEvent) => {
      const d = pointerDragRef.current;
      const ed = eventDragRef.current;
      if ((d && d.activated && d.pointerType !== 'mouse') ||
          (ed && ed.activated && ed.pointerType !== 'mouse')) e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => document.removeEventListener('touchmove', onTouchMoveNative);
  }, []);

  // Current time indicator (1분마다 자동 갱신)
  const [nowDate, setNowDate] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNowDate(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);
  const nowStr = format(nowDate, 'yyyy-MM-dd');
  const showCurrentTime = selectedDate === nowStr;
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const currentTimeTop = ((currentMinutes / 60) - tlStartHour) * HOUR_HEIGHT;

  const getTimelineLaneBounds = (lane: 'plan' | 'do') => {
    if (timelineTab === 'plan') return lane === 'plan' ? { left: '0%', right: '0%' } : null;
    if (timelineTab === 'do') return lane === 'do' ? { left: '0%', right: '0%' } : null;
    const halfGap = TIMELINE_LANE_GAP / 2;
    return lane === 'plan'
      ? { left: '0%', right: `calc(50% + ${halfGap}px)` }
      : { left: `calc(50% + ${halfGap}px)`, right: '0%' };
  };

  // Sleep block renderer for the DO lane — 절대 시간축 기준으로 이 날짜 컬럼에 들어오는 조각만 렌더.
  // 취침 시작(isStart)을 포함하는 조각만 이동/리사이즈 가능, 다음날로 이어지는 조각은 표시 전용(탭 시 편집).
  const renderSleepBlocks = () => {
    const laneBounds = getTimelineLaneBounds('do');
    if (!laneBounds) return null;

    const rects = sleepRectsForColumn(selectedDate, selfCareRecords, tlStartHour, tlEndHour);

    return rects.map((rect, ri) => {
      const record = rect.record;
      const interactive = rect.isStart; // 취침 시작을 포함하는 조각만 드래그/리사이즈
      const isDragging = interactive && sleepDragState?.recordId === record.id;

      // 드래그 origin/preview는 컬럼 자정 기준 자연 좌표(naturalStart/End, 자정 넘김 시 24:00+ 가능)
      const naturalStart = rect.naturalStartMin;
      const naturalEnd = rect.naturalEndMin;
      const previewStartMin = isDragging && sleepDragPreview ? sleepDragPreview.startMin : naturalStart;
      const previewEndMin = isDragging && sleepDragPreview ? sleepDragPreview.endMin : naturalEnd;

      const displayStart = minutesToTime(((previewStartMin % (24 * 60)) + 24 * 60) % (24 * 60));
      const displayEnd = minutesToTime(((previewEndMin % (24 * 60)) + 24 * 60) % (24 * 60));

      const hh = Math.floor(rect.totalMin / 60);
      const mm = rect.totalMin % 60;
      const durationLabel = hh > 0 ? (mm > 0 ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`;

      // 드래그 중에는 연속 이동감을 위해 전체 블록(컬럼 밖으로 넘침 허용)을, 아니면 클립된 조각을 그린다.
      const top = isDragging
        ? (previewStartMin - tlStartHour * 60) * PX_PER_MIN
        : rect.offsetMin * PX_PER_MIN;
      const height = isDragging
        ? Math.max((previewEndMin - previewStartMin) * PX_PER_MIN, 20)
        : Math.max(rect.lengthMin * PX_PER_MIN, 20);

      return (
        <div key={`sleep-${record.id}-${ri}`}
          className={`absolute rounded-xl px-2 py-1.5 overflow-hidden timeline-block${interactive ? ' group' : ''}`}
          style={{
            top, height,
            left: laneBounds.left, right: laneBounds.right,
            backgroundColor: 'rgba(200,210,220,0.45)',
            border: '1px solid rgba(148,163,184,0.35)',
            borderLeft: '3px solid #94A3B8',
            opacity: isDragging ? 0.85 : 1,
            cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
            userSelect: 'none',
            zIndex: isDragging ? 30 : 1,
            transition: isDragging ? 'none' : 'opacity 0.15s',
          }}
          onMouseDown={interactive ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            sleepDragMovedRef.current = false;
            setSleepDragState({
              recordId: record.id, mode: 'move', startY: e.clientY,
              origStartMin: naturalStart, origEndMin: naturalEnd,
            });
          } : undefined}
          onClick={() => { if (!sleepDragMovedRef.current) setEditingSleepRecord(record); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>🌙 수면</div>
            {height > 32 && <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', whiteSpace: 'nowrap' }}>{durationLabel}</div>}
            {interactive && height > 52 && (
              <div style={{ fontSize: 9, color: '#94A3B8', opacity: 0.8, whiteSpace: 'nowrap' }}>
                {displayStart}–{displayEnd}
              </div>
            )}
          </div>
          {interactive && (
            <>
              <div
                className="absolute left-0 right-0 bottom-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ height: 8, cursor: 'ns-resize', backgroundColor: 'rgba(148,163,184,0.3)' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  sleepDragMovedRef.current = false;
                  setSleepDragState({
                    recordId: record.id, mode: 'resize', startY: e.clientY,
                    origStartMin: naturalStart, origEndMin: naturalEnd,
                  });
                }}
              >
                <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: '#94A3B8' }} />
              </div>
              <div
                className="absolute left-0 right-0 bottom-0 lg:hidden"
                style={{ height: 44, touchAction: 'none' }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  const touch = e.touches[0];
                  if (!touch) return;
                  sleepDragMovedRef.current = false;
                  setSleepDragState({
                    recordId: record.id, mode: 'resize', startY: touch.clientY,
                    origStartMin: naturalStart, origEndMin: naturalEnd,
                  });
                }}
              />
            </>
          )}
        </div>
      );
    });
  };

  // Render timeline block
  const planTodos = dateTodos.filter(td => td.planStart && td.planEnd);
  const doTodos = dateTodos.filter(td => td.doStart && td.doEnd);

  // Get tag color for a todo (first tag's color, or null)
  const getTodoTagColor = (todo: Todo): string | null => {
    if (!todo.tags || todo.tags.length === 0) return null;
    const tag = tags.find(tg => tg.id === todo.tags![0]);
    return tag?.color || null;
  };

  // layout: 주간 컬럼 내부 배치용 left/right 오버라이드 (지정 시 compare 레인 분할/탭필터 무시).
  const renderBlock = (todo: Todo, type: 'plan' | 'do', layout?: { left: string; right: string }) => {
    const start = type === 'plan' ? todo.planStart : todo.doStart;
    const end = type === 'plan' ? todo.planEnd : todo.doEnd;
    if (!start || !end) return null;

    let startMin = timeToMinutes(start);
    let endMin = timeToMinutes(end);

    // Apply drag preview if this is the block being dragged
    const isDragging = dragState?.todoId === todo.id && dragState?.type === type;
    if (isDragging && dragPreview) {
      startMin = dragPreview.startMin;
      endMin = dragPreview.endMin;
    }

    const isPlan = type === 'plan';
    const isCheckOnlyDo = !isPlan && todo.doElapsedSec === 0;
    const hasFocusedDuration = !isPlan && todo.doElapsedSec != null && todo.doElapsedSec > 0;
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = isCheckOnlyDo ? 30 : Math.max((endMin - startMin) * PX_PER_MIN, 20);
    const tagColor = getTodoTagColor(todo);
    const laneBounds = layout ?? getTimelineLaneBounds(isPlan ? 'plan' : 'do');
    if (!laneBounds) return null;
    const canDrag = isPlan || !isCheckOnlyDo;

    // DO 초과 감지 (DO 시간 > PLAN 시간) — 타이머 실제 초가 있으면 분 단위 막대 대신 사용
    let isOvertime = false;
    if (!isPlan && !isCheckOnlyDo && todo.planStart && todo.planEnd) {
      const planDur = timeToMinutes(todo.planEnd) - timeToMinutes(todo.planStart);
      const doDurMin =
        todo.doElapsedSec != null && todo.doElapsedSec >= 0
          ? todo.doElapsedSec / 60
          : endMin - startMin;
      isOvertime = doDurMin > planDur;
    }

    let bg: string;
    let textColor: string;
    let borderClr: string;

    if (isPlan) {
      bg = 'rgba(237,228,216,0.52)';
      textColor = '#7D6347';
      borderClr = '#C4A882';
    } else if (isOvertime) {
      bg = 'rgba(250,232,214,0.65)';
      textColor = OVERTIME_BAR_BORDER;
      borderClr = OVERTIME_BAR_BORDER;
    } else if (isCheckOnlyDo) {
      bg = tagColor ? `${tagColor}12` : (defaultBlockBg ?? 'rgba(212,237,224,0.45)');
      textColor = tagColor || defaultBlockText || '#3D7A58';
      borderClr = tagColor || defaultBlockBorder || '#6BAA7A';
    } else if (tagColor) {
      bg = tagColor + '1A';
      textColor = tagColor;
      borderClr = tagColor;
    } else {
      bg = defaultBlockBg ?? 'rgba(212,237,224,0.52)';
      textColor = defaultBlockText ?? '#3D7A58';
      borderClr = defaultBlockBorder ?? '#6BAA7A';
    }

    const baseTimeLabel = isDragging && dragPreview
      ? `${minutesToTime(dragPreview.startMin)}-${minutesToTime(dragPreview.endMin)}`
      : `${start}-${end}`;
    const durationLabel = hasFocusedDuration ? formatDuration(todo.doElapsedSec!) : '';
    const compactLabel = isPlan
      ? `${todo.text} ${baseTimeLabel}`
      : hasFocusedDuration
        ? `${todo.text} ${baseTimeLabel} ${durationLabel}`
        : todo.text;
    const detailLabel = isPlan ? baseTimeLabel : hasFocusedDuration ? `${baseTimeLabel} ${durationLabel}` : '';
    const isCompact = isCheckOnlyDo || height < 52;
    const titleLabel = isPlan
      ? `${todo.text}\n${baseTimeLabel}`
      : hasFocusedDuration
        ? `${todo.text}\n${baseTimeLabel}\n${durationLabel}`
        : `${todo.text}\n${start}`;

    return (
      <div key={`${todo.id}-${type}`}
        className="absolute rounded-xl px-2 py-1.5 overflow-hidden group timeline-block"
        style={{
          top,
          height,
          left: laneBounds.left,
          right: laneBounds.right,
          backgroundColor: bg,
          border: `1px solid ${borderClr}20`,
          borderLeft: `3px solid ${borderClr}`,
          opacity: isDragging ? 0.85 : (todo.status === 'cancelled' ? 0.4 : 1),
          cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          userSelect: 'none',
          zIndex: isDragging ? 30 : 1,
          transition: isDragging ? 'none' : 'opacity 0.15s',
          boxShadow: `0 2px 8px ${borderClr}14, 0 1px 2px rgba(0,0,0,0.04)`,
        }}
        onPointerDown={(e) => handleBlockPointerDown(e, todo, type, canDrag, timeToMinutes(start), timeToMinutes(end))}
        onPointerMove={handleBlockPointerMove}
        onPointerUp={handleBlockPointerUp}
        onPointerCancel={handleBlockPointerCancel}
        onContextMenu={e => {
          e.preventDefault();
          onShowContextMenu(todo, { x: e.clientX, y: e.clientY }, isPlan ? 'plan' : 'do');
        }}
        title={titleLabel}
      >
        {/* 모바일 임시 ⋯ 메뉴 버튼 — PC는 우클릭 유지, 모바일은 본체 롱프레스가 '이동'으로 바뀌어 메뉴 접근용 (Stage 4 재정비) */}
        <button
          type="button"
          aria-label="메뉴"
          className="absolute lg:hidden flex items-center justify-center"
          style={{
            top: 1, right: 1, width: 22, height: 22, borderRadius: 6,
            color: textColor, opacity: 0.55, zIndex: 6, lineHeight: 1,
            fontSize: 15, fontWeight: 700, background: 'transparent', touchAction: 'none',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onShowContextMenu(todo, { x: r.left, y: r.bottom }, isPlan ? 'plan' : 'do');
          }}
        >⋯</button>
        {isCompact ? (
          <div className="flex items-center gap-2 h-full">
            {isCheckOnlyDo && (
              <span
                className="relative inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: `1.5px solid ${borderClr}`,
                  backgroundColor: `${borderClr}12`,
                }}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    backgroundColor: borderClr,
                    color: '#fff',
                    fontSize: 7,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  ✓
                </span>
              </span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, color: textColor,
              textDecoration: isCheckOnlyDo ? 'none' : (todo.status === 'done' ? 'line-through' : 'none'),
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {compactLabel}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 11, fontWeight: 700, color: textColor,
                textDecoration: todo.status === 'done' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {todo.text}
              </span>
            </div>
            {detailLabel && (
              <div style={{ fontSize: 10, color: textColor, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {detailLabel}
              </div>
            )}
          </>
        )}
        {canDrag && (
          <>
            {/* PC 리사이즈 손잡이 (hover 노출) */}
            <div
              className="absolute left-0 right-0 bottom-0 hidden lg:flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ height: 8, cursor: 'ns-resize', touchAction: 'none', backgroundColor: isDragging ? 'transparent' : (isPlan ? '#515f7440' : '#00000015') }}
              onPointerDown={(e) => handleResizePointerDown(e, todo, type, timeToMinutes(start), timeToMinutes(end))}
              onPointerMove={handleBlockPointerMove}
              onPointerUp={handleBlockPointerUp}
              onPointerCancel={handleBlockPointerCancel}
            >
              <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: isPlan ? PLAN_BAR_BORDER : `${textColor}80` }} />
            </div>
            {/* 모바일 리사이즈 손잡이 (터치 타깃 + 가시 grip) */}
            <div
              className="absolute left-0 right-0 bottom-0 lg:hidden flex justify-center items-end"
              style={{ height: 22, touchAction: 'none', paddingBottom: 3, cursor: 'ns-resize' }}
              onPointerDown={(e) => handleResizePointerDown(e, todo, type, timeToMinutes(start), timeToMinutes(end))}
              onPointerMove={handleBlockPointerMove}
              onPointerUp={handleBlockPointerUp}
              onPointerCancel={handleBlockPointerCancel}
            >
              <div style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: isPlan ? PLAN_BAR_BORDER : `${textColor}66` }} />
            </div>
          </>
        )}
      </div>
    );
  };

  // Event block (일정) — 타임라인 왼쪽(PLAN) 컬럼에 렌더링.
  // 할일 블록처럼 드래그=시간 이동/리사이즈, 짧은 탭/우클릭=편집(EventModal) 로 동작한다.
  const renderEventBlock = (evt: Event) => {
    if (!evt.startTime || !evt.endTime) return null;
    const laneBounds = getTimelineLaneBounds('plan');
    if (!laneBounds) return null;
    let startMin = timeToMinutes(evt.startTime);
    let endMin = timeToMinutes(evt.endTime);
    const isDragging = eventDragState?.eventId === evt.id;
    if (isDragging && eventDragPreview) {
      startMin = eventDragPreview.startMin;
      endMin = eventDragPreview.endMin;
    }
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, 20);
    const eventColor = evt.color || '#7B9ED9';
    const isDone = !!evt.completed;
    const isPast = !isDone && isEventPast(evt);
    const timeLabel = isDragging && eventDragPreview
      ? `${minutesToTime(startMin)} - ${minutesToTime(endMin)}`
      : `${evt.startTime} - ${evt.endTime}`;

    return (
      <div key={`ev-${evt.id}`}
        className="absolute rounded-lg px-2.5 py-1.5 overflow-hidden group timeline-block"
        style={{
          top, height,
          left: laneBounds.left, right: laneBounds.right,
          backgroundColor: `${eventColor}24`,
          border: `1.5px solid ${eventColor}`,
          zIndex: isDragging ? 30 : 3,
          opacity: isDragging ? 0.85 : (isDone ? 0.5 : (isPast ? 0.7 : 1)),
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'opacity 0.15s',
          boxShadow: `0 2px 8px ${eventColor}14, 0 1px 2px rgba(0,0,0,0.04)`,
        }}
        onPointerDown={(e) => handleEventPointerDown(e, evt, timeToMinutes(evt.startTime!), timeToMinutes(evt.endTime!))}
        onPointerMove={handleEventPointerMove}
        onPointerUp={handleEventPointerUp}
        onPointerCancel={handleEventPointerCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('editEvent', { detail: evt }));
        }}
        title={`${evt.title}\n${timeLabel}`}
      >
        {/* 모바일 편집 버튼 — 본체 롱프레스는 '이동'이라 탭 편집 접근용 */}
        <button
          type="button"
          aria-label="일정 편집"
          className="absolute lg:hidden flex items-center justify-center"
          style={{
            top: 1, right: 1, width: 22, height: 22, borderRadius: 6,
            color: eventColor, opacity: 0.6, zIndex: 6, lineHeight: 1,
            fontSize: 15, fontWeight: 700, background: 'transparent', touchAction: 'none',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('editEvent', { detail: evt }));
          }}
        >⋯</button>
        <div style={{
          fontSize: 11, fontWeight: 600, color: eventColor,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          📅 {evt.title}
        </div>
        {height > 30 && (
          <div style={{ fontSize: 9, color: eventColor, opacity: 0.8, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {timeLabel}
            {evt.location && ` · ${evt.location}`}
          </div>
        )}
        {/* PC 리사이즈 손잡이 (hover 노출) */}
        <div
          className="absolute left-0 right-0 bottom-0 hidden lg:flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ height: 8, cursor: 'ns-resize', touchAction: 'none', backgroundColor: isDragging ? 'transparent' : `${eventColor}22` }}
          onPointerDown={(e) => handleEventResizePointerDown(e, evt, timeToMinutes(evt.startTime!), timeToMinutes(evt.endTime!))}
          onPointerMove={handleEventPointerMove}
          onPointerUp={handleEventPointerUp}
          onPointerCancel={handleEventPointerCancel}
        >
          <div style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: eventColor }} />
        </div>
        {/* 모바일 리사이즈 손잡이 */}
        <div
          className="absolute left-0 right-0 bottom-0 lg:hidden flex justify-center items-end"
          style={{ height: 22, touchAction: 'none', paddingBottom: 3, cursor: 'ns-resize' }}
          onPointerDown={(e) => handleEventResizePointerDown(e, evt, timeToMinutes(evt.startTime!), timeToMinutes(evt.endTime!))}
          onPointerMove={handleEventPointerMove}
          onPointerUp={handleEventPointerUp}
          onPointerCancel={handleEventPointerCancel}
        >
          <div style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: `${eventColor}99` }} />
        </div>
      </div>
    );
  };

  // 경량 이벤트 블록 — 데일리 드래그 좌표 로직과 분리(탭 → 편집). 주어진 레인 좌표(bounds) 안에 렌더.
  //  · 주간(days=7): 각 날짜 PLAN/DO 슬롯 내부(left/right 2px)
  //  · 데일리 DO 레인: 완료 일정 미러용 (getTimelineLaneBounds('do'))
  // lane='do' 면 "완료 표시"이므로 done 스타일(취소선·감쇠) 강제.
  const renderLiteEventBlock = (
    evt: Event,
    bounds: { left: number | string; right: number | string },
    lane: 'plan' | 'do',
  ) => {
    if (!evt.startTime || !evt.endTime) return null;
    const startMin = timeToMinutes(evt.startTime);
    const endMin = timeToMinutes(evt.endTime);
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, 16);
    const eventColor = evt.color || '#7B9ED9';
    const isDoLane = lane === 'do';
    const isDone = !!evt.completed;
    const isPast = !isDone && isEventPast(evt);
    return (
      <button
        key={`lite-ev-${lane}-${evt.id}`}
        type="button"
        className="timeline-block"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => window.dispatchEvent(new CustomEvent('editEvent', { detail: evt }))}
        style={{
          position: 'absolute', top, height, left: bounds.left, right: bounds.right,
          backgroundColor: `${eventColor}24`,
          border: `1.5px solid ${eventColor}`,
          borderRadius: 8, padding: '2px 4px', zIndex: 2,
          cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
          opacity: (isDone || isDoLane) ? 0.5 : (isPast ? 0.7 : 1),
        }}
        title={`${evt.title}\n${evt.startTime} - ${evt.endTime}`}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: eventColor, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: (isDone || isDoLane) ? 'line-through' : 'none' }}>
          📅 {evt.title}
        </div>
        {height >= 28 && (
          <div style={{ fontSize: 9, fontWeight: 600, color: eventColor, opacity: 0.8, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {evt.startTime} - {evt.endTime}
          </div>
        )}
      </button>
    );
  };

  // Timer block
  const renderTimerBlock = () => {
    if (!activeTimer) return null;
    const todo = todos.find(td => td.id === activeTimer.todoId);
    if (!todo || todo.date !== selectedDate) return null;
    const laneBounds = getTimelineLaneBounds('do');
    if (!laneBounds) return null;
    const startMin = timeToMinutes(activeTimer.startHHMM);
    const elapsedSec = getActiveTimerElapsedSec();
    const elapsedMin = Math.max(1, Math.ceil(elapsedSec / 60));
    const top = (startMin / 60 - tlStartHour) * HOUR_HEIGHT;
    const height = Math.max(elapsedMin * PX_PER_MIN, 30);
    const currentEndHHMM = minutesToTime(startMin + elapsedMin);
    const tagColor = getTodoTagColor(todo);
    const planDur = todo.planStart && todo.planEnd
      ? timeToMinutes(todo.planEnd) - timeToMinutes(todo.planStart)
      : null;
    const isOvertime = planDur !== null ? elapsedMin > planDur : false;
    const bgColor = isOvertime ? OVERTIME_BAR_BG : (tagColor || '#059669');
    const textColor = isOvertime ? OVERTIME_BAR_BORDER : (tagColor ? getContrastTextColor(tagColor) : '#ffffff');

    return (
      <div className="absolute rounded-lg px-2.5 py-1.5 animate-pulse timeline-block"
        style={{
          top, height, left: laneBounds.left, right: laneBounds.right,
          backgroundColor: bgColor,
          border: `1px solid ${isOvertime ? OVERTIME_BAR_BORDER : (tagColor || '#047857')}`,
        }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{todo.text}</div>
        <div style={{ fontSize: 9, color: textColor, opacity: 0.85 }}>
          {activeTimer.startHHMM}-{currentEndHHMM} {formatDuration(elapsedSec)}
        </div>
      </div>
    );
  };

  // Log markers on timeline - gold dot on left + colored content block on DO area
  const renderLogMarkers = () => {
    const laneBounds = getTimelineLaneBounds('do');
    if (!laneBounds) return null;
    return timelineLogs
      .filter(l => l.date === selectedDate)
      .map(log => {
        const min = timeToMinutes(log.time);
        const top = (min / 60 - tlStartHour) * HOUR_HEIGHT;
        const logColor = log.color || t.accent;
        const offset = logOffsets[log.id] ?? 0;
        const beginLogDrag = (clientX: number) => {
          logDragRef.current = {
            id: log.id,
            startX: clientX,
            startOffset: offset,
          };
          logDragMovedRef.current = false;
        };

        return (
          <div key={log.id} style={{ display: 'contents' }}>
            {/* Gold dot marker on the left timeline area */}
            <div className="absolute z-20 pointer-events-none"
              style={{ top: top - 4, left: -4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: t.accent, border: `2px solid ${t.card}` }} />
            </div>
            {/* Dashed line across */}
            <div className="absolute z-15 pointer-events-none"
              style={{ top: top - 0.5, left: 0, right: 0, height: 1, borderBottom: `1px dashed ${logColor}40` }} />
            {/* Thought bubble in DO area */}
            <div className="absolute z-20"
              style={{
                top: top - 14,
                left: laneBounds.left,
                minWidth: 108,
                maxWidth: 'min(210px, calc(100vw - 132px))',
                backgroundColor: 'rgba(253,250,244,0.74)',
                border: `1px solid ${logColor}28`,
                borderRadius: '0 10px 10px 10px',
                boxShadow: `0 3px 12px rgba(0,0,0,0.05), 0 1px 3px ${logColor}18`,
                padding: '5px 9px',
                transform: `translateX(${offset}px)`,
                cursor: 'grab',
              }}
              onMouseDown={(e) => beginLogDrag(e.clientX)}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                beginLogDrag(touch.clientX);
              }}
              onClick={() => {
                if (!logDragMovedRef.current) setShowLogModal(true);
              }}
              title={log.text}
            >
              <div className="flex items-start gap-1.5">
                <span style={{ fontSize: 12, color: logColor, flexShrink: 0, lineHeight: 1.3 }}>
                  {log.icon || '💭'}
                </span>
                <div>
                  <p style={{ fontSize: 10, fontStyle: 'italic', color: '#3D3020', lineHeight: 1.4, margin: 0 }}>
                    {log.text.length > 28 ? log.text.slice(0, 28) + '…' : log.text}
                  </p>
                  <span style={{ fontSize: 8, fontWeight: 700, color: logColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {log.time}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      });
  };

  // ── Timeline 소유 모달 (일간·주간 공유) ──
  const timelineModals = (
    <>
      {createTarget && (
        <TimelineAddModal
          date={createTarget.date ?? selectedDate}
          initialStart={createTarget.start}
          initialEnd={createTarget.end}
          initialLane={createTarget.lane}
          onClose={() => setCreateTarget(null)}
        />
      )}
      {editingSleepRecord && (
        <SleepTimeEditModal
          record={editingSleepRecord}
          onClose={() => setEditingSleepRecord(null)}
          onConfirm={(sleepStart, sleepEnd) => {
            const [sh, sm] = sleepStart.split(':').map(Number);
            const [eh, em] = sleepEnd.split(':').map(Number);
            let endMin = eh * 60 + em;
            const startMin = sh * 60 + sm;
            if (endMin <= startMin) endMin += 24 * 60;
            updateSelfCareRecord(editingSleepRecord.id, {
              sleepStart, sleepEnd,
              content: `${sleepStart} ~ ${sleepEnd}`,
              duration: endMin - startMin,
            });
            setEditingSleepRecord(null);
          }}
        />
      )}
      {showLogModal && (
        <TimelineLogModal
          date={selectedDate}
          logs={timelineLogs}
          onAdd={addTimelineLog}
          onDelete={deleteTimelineLog}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </>
  );

  // ── 주간(days=7) 렌더 — 7일 × P/D 14컬럼, 일간과 동일한 블록 핸들러로 편집 ──
  if (isWeek && weekDays) {
    const weekFlatCols = `${WEEK_TIME_COL}px repeat(14, minmax(0, 1fr))`;
    const weekHours: number[] = [];
    for (let h = tlStartHour; h <= tlEndHour; h++) weekHours.push(h);
    const weekBodyHeight = (tlEndHour - tlStartHour) * HOUR_HEIGHT;
    const SLOT_PAD = { left: '2px', right: '2px' };
    const nowInWindow = currentMinutes >= tlStartHour * 60 && currentMinutes <= tlEndHour * 60;

    return (
      <div className={`flex-1 min-w-0 flex flex-col overflow-hidden${className ? ' ' + className : ''}`}>
        {/* 범례 + Today */}
        <div className="px-3 py-2 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `1px solid ${t.borderLight}` }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 10, fontWeight: 700, color: '#5B8FD8' }}>● PLAN</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#5BAA78' }}>● DO</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>● 수면</span>
          </div>
          {onToday && (
            <button onClick={onToday}
              style={{ fontSize: 11, fontWeight: 700, color: t.accent, backgroundColor: t.bgSub, border: `1px solid ${t.border}`, borderRadius: 8, padding: '2px 12px', cursor: 'pointer' }}>
              Today
            </button>
          )}
        </div>

        {/* 스크롤 컨테이너 (sticky 헤더 + 바디 동일 컨테이너 → 컬럼 정렬 보장) */}
        <div ref={scrollRef} className="flex-1" style={{ overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain' }}>
          {/* sticky 헤더: 날짜 행 + P/D 서브헤더 */}
          <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: t.card, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: weekFlatCols }}>
              <div />
              {weekDays.map((wd, i) => {
                const isToday = wd.date === nowStr;
                const isSelected = wd.date === selectedDate;
                const day = parseISO(wd.date);
                return (
                  <button key={wd.date} onClick={() => onSelectDate?.(wd.date)}
                    style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px 4px', borderLeft: i > 0 ? `1px solid ${t.borderLight}` : 'none', background: 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{format(day, 'E', { locale: ko })}</span>
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', marginTop: 3, fontSize: 12, fontWeight: 700,
                      backgroundColor: isSelected ? t.text : isToday ? t.textSub : 'transparent',
                      color: isSelected || isToday ? '#fff' : t.text,
                    }}>
                      {format(day, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: weekFlatCols }}>
              <div />
              {weekDays.map((wd, i) => (
                <React.Fragment key={wd.date}>
                  <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#5B8FD8', backgroundColor: '#EEF4FF', padding: '3px 0', borderLeft: i > 0 ? `1px solid ${t.borderLight}` : 'none', borderRight: '1px dashed #C8D8F0' }}>P</div>
                  <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#5BAA78', backgroundColor: '#EEFAF2', padding: '3px 0' }}>D</div>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 바디 */}
          <div className="relative" style={{ height: weekBodyHeight + 16, WebkitUserSelect: 'none', userSelect: 'none' }}>
            {/* 정각 가로선 */}
            {weekHours.map(h => (
              <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: (h - tlStartHour) * HOUR_HEIGHT }}>
                <span style={{ width: WEEK_TIME_COL, fontSize: 10, color: t.textMuted, textAlign: 'right', paddingRight: 8, flexShrink: 0 }}>{String(h % 24).padStart(2, '0')}:00</span>
                <div className="flex-1" style={{ borderTop: `1px solid ${t.border}` }} />
              </div>
            ))}
            {/* 30분 점선 */}
            {weekHours.slice(0, -1).map(h => (
              <div key={`half-${h}`} className="absolute" style={{ left: WEEK_TIME_COL, right: 0, top: (h - tlStartHour) * HOUR_HEIGHT + HOUR_HEIGHT / 2, borderTop: `1px dashed ${t.borderLight}` }} />
            ))}
            {/* 날짜 컬럼 (14 flat: 7일 × P/D) */}
            <div className="absolute" style={{ left: WEEK_TIME_COL, right: 0, top: 0, bottom: 0, display: 'grid', gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
              {weekDays.map((wd, dayIdx) => {
                const planTodos = wd.todos.filter(td => td.planStart && td.planEnd);
                const doTodos = wd.todos.filter(td => td.doStart && td.doEnd);
                const sleepRects = sleepRectsForColumn(wd.date, selfCareRecords, tlStartHour, tlEndHour);
                const isToday = wd.date === nowStr;
                return (
                  <div key={wd.date} style={{ gridColumn: 'span 2', position: 'relative', borderLeft: dayIdx > 0 ? `1px solid ${t.borderLight}` : 'none' }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      {/* PLAN 슬롯 */}
                      <div style={{ position: 'relative', borderRight: '1px dashed #C8D8F0' }}
                        onPointerDown={e => handleWeekCreateDown(e, wd.date, 'plan')}
                        onPointerMove={handleWeekCreateMove}
                        onPointerUp={handleWeekCreateUp}>
                        {planTodos.map(td => renderBlock(td, 'plan', SLOT_PAD))}
                        {(wd.events ?? []).map(evt => renderLiteEventBlock(evt, SLOT_PAD, 'plan'))}
                      </div>
                      {/* DO 슬롯 (수면 = 탭 편집) */}
                      <div style={{ position: 'relative' }}
                        onPointerDown={e => handleWeekCreateDown(e, wd.date, 'do')}
                        onPointerMove={handleWeekCreateMove}
                        onPointerUp={handleWeekCreateUp}>
                        {sleepRects.map((rect, ri) => {
                          const hh = Math.floor(rect.totalMin / 60);
                          const mm = rect.totalMin % 60;
                          const durationLabel = hh > 0 ? (mm > 0 ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`;
                          const top = rect.offsetMin * PX_PER_MIN;
                          const height = Math.max(rect.lengthMin * PX_PER_MIN, 16);
                          return (
                            <button key={`sleep-${rect.record.id}-${ri}`} type="button"
                              onClick={() => setEditingSleepRecord(rect.record)}
                              className="timeline-block"
                              style={{ position: 'absolute', top, height, left: 2, right: 2, backgroundColor: 'rgba(200,210,220,0.45)', border: '1px solid rgba(148,163,184,0.4)', borderLeft: '3px solid #94A3B8', borderRadius: 8, padding: '3px 5px', zIndex: 1, cursor: 'pointer', textAlign: 'left', overflow: 'hidden' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', lineHeight: 1.3 }}>🌙 수면</div>
                              {height >= 28 && <div style={{ fontSize: 9, fontWeight: 600, color: '#94A3B8', lineHeight: 1.3 }}>{durationLabel}</div>}
                            </button>
                          );
                        })}
                        {doTodos.map(td => renderBlock(td, 'do', SLOT_PAD))}
                        {(wd.events ?? []).filter(ev => ev.completed).map(evt => renderLiteEventBlock(evt, SLOT_PAD, 'do'))}
                      </div>
                    </div>
                    {/* 현재 시각선 (오늘 컬럼) */}
                    {isToday && nowInWindow && (
                      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTimeTop }}>
                        <div style={{ height: 2, backgroundColor: nowLineColor }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {timelineModals}
      </div>
    );
  }

  return (
    <div className={`flex-1 min-w-0 flex flex-col overflow-hidden${className ? ' ' + className : ''}`}>
      {/* Timeline header */}
      <div className="px-3 py-2.5 lg:px-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="flex-shrink-0" style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.08em' }}>TIMELINE</span>
            {/* 하루 경계 라벨 — TIMELINE 우측에 작게. 공간이 부족하면 말줄임(모바일 헤더 오버플로 방지) */}
            {dayBoundLabel && (
              <span
                className="truncate"
                style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 600, letterSpacing: '0.01em', minWidth: 0 }}
                title={dayBoundLabel}
              >
                {dayBoundLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg lg:gap-1.5 lg:px-2.5"
              style={{ fontSize: 11, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 11 }}>💭</span> Think
            </button>
            {/* PLAN / 비교 / DO 탭 */}
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
              {(['plan', 'compare', 'do'] as const).map((tab, i) => (
                <button key={tab}
                  onClick={() => setTimelineTab(tab)}
                  className="px-2 py-1.5 lg:px-2.5"
                  style={{
                    fontSize: 10, fontWeight: timelineTab === tab ? 700 : 500,
                    backgroundColor: timelineTab === tab ? t.bgSub : 'transparent',
                    color: timelineTab === tab
                      ? t.text
                      : t.textMuted,
                    borderRight: i < 2 ? `1px solid ${t.border}` : 'none',
                    transition: 'all 0.15s',
                  }}>
                  {tab === 'plan' ? 'PLAN' : tab === 'do' ? 'DO' : '비교'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <div style={{ width: TIMELINE_LABEL_WIDTH, flexShrink: 0, fontSize: 8, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', paddingRight: 6 }}>
            TIME
          </div>
          {timelineTab === 'compare' ? (
            <div className="flex-1 grid" style={{ gridTemplateColumns: `1fr ${TIMELINE_LANE_GAP}px 1fr` }}>
              <div className="px-3 py-1"
                style={{ fontSize: 9, fontWeight: 800, color: '#C4A882', letterSpacing: '0.1em', textTransform: 'uppercase', borderLeft: '3px solid #C4A88230' }}>
                PLAN
              </div>
              <div />
              <div className="px-3 py-1"
                style={{ fontSize: 9, fontWeight: 800, color: '#6BAA7A', letterSpacing: '0.1em', textTransform: 'uppercase', borderLeft: '3px solid #6BAA7A30' }}>
                DO
              </div>
            </div>
          ) : (
            <div className="flex-1 px-3 py-1"
              style={{ borderLeft: `3px solid ${timelineTab === 'plan' ? '#C4A88230' : '#6BAA7A30'}` }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: timelineTab === 'plan' ? '#C4A882' : '#6BAA7A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {timelineTab === 'plan' ? 'PLAN' : 'DO'}
              </span>
            </div>
          )}
        </div>
        {/* 요약: 계획 시간/실제 시간/달성률 */}
        {(totalPlanMin > 0 || totalDoSec > 0 || dateTodos.length > 0) && (
          <div className="flex items-center gap-3 mt-1.5">
            {totalPlanMin > 0 && (
              <span style={{ fontSize: 10, color: '#7D6347' }}>
                계획 시간 {Math.floor(totalPlanMin / 60) > 0 ? `${Math.floor(totalPlanMin / 60)}h ` : ''}{totalPlanMin % 60 > 0 ? `${totalPlanMin % 60}m` : ''}
              </span>
            )}
            {totalDoSec > 0 && (
              <span style={{ fontSize: 10, color: '#4A8A5A' }}>
                실제 시간 {formatTotalDoKo(totalDoSec)}
              </span>
            )}
            {dateTodos.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: achieveRate >= 100 ? '#059669' : t.accent }}>
                달성률 {achieveRate}% ({doneCount}/{dateTodos.length})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timeline body */}
      <div ref={scrollRef} className="flex-1 relative overflow-y-auto overflow-x-hidden px-3 pb-4 lg:px-4"
        style={{ minHeight: 0 }}>
        <div ref={timelineRelativeRef} className="relative" style={{ height: totalHeight + 16, WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
          onPointerDown={handleCreatePointerDown}
          onPointerMove={handleCreatePointerMove}
          onPointerUp={handleCreatePointerUp}
          onPointerCancel={handleCreatePointerCancel}
          onPointerLeave={() => setHoverSlot(null)}>
          {/* Lane backgrounds */}
          <div className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: TIMELINE_CONTENT_LEFT, right: 0 }}>
            {timelineTab === 'compare' ? (
              <>
                <div className="absolute inset-y-0 rounded-2xl"
                  style={{
                    left: 0,
                    right: `calc(50% + ${TIMELINE_LANE_GAP / 2}px)`,
                    background: 'transparent',
                    border: `1px solid ${t.borderLight}`,
                  }} />
                <div className="absolute inset-y-0 rounded-2xl"
                  style={{
                    left: `calc(50% + ${TIMELINE_LANE_GAP / 2}px)`,
                    right: 0,
                    background: 'transparent',
                    border: `1px solid ${t.borderLight}`,
                  }} />
                <div className="absolute inset-y-0"
                  style={{
                    left: `calc(50% - ${TIMELINE_LANE_GAP / 2}px)`,
                    width: TIMELINE_LANE_GAP,
                    borderLeft: `1px dashed ${t.border}`,
                    borderRight: `1px dashed ${t.border}`,
                  }} />
              </>
            ) : (
              <div className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'transparent',
                  border: `1px solid ${t.borderLight}`,
                }} />
            )}
          </div>
          {/* Hour grid */}
          {hours.map((h, idx) => (
            <div key={idx} style={{ display: 'contents' }}>
              {/* Hour line */}
              <div className="absolute left-0 right-0 flex items-start" style={{ top: idx * HOUR_HEIGHT }}>
                <span style={{
                  fontSize: 10, color: t.textMuted, width: TIMELINE_LABEL_WIDTH, flexShrink: 0,
                  paddingTop: 0, textAlign: 'right', paddingRight: 8,
                }}>
                  {String(h).padStart(2, '0')}:00
                </span>
                <div className="flex-1" style={{ borderTop: `1px solid ${t.border}` }} />
              </div>
              {/* 30 min dotted line */}
              <div className="absolute left-0 right-0 flex items-start" style={{ top: idx * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}>
                <span style={{ width: TIMELINE_LABEL_WIDTH, flexShrink: 0 }} />
                <div className="flex-1" style={{ borderTop: `1px dashed ${t.borderLight}` }} />
              </div>
            </div>
          ))}

          {/* Current time indicator */}
          {showCurrentTime && (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTimeTop }}>
              <div className="flex items-center" style={{ marginLeft: TIMELINE_LABEL_WIDTH - 4 }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nowLineColor }} />
                <div className="flex-1 h-[2px]" style={{ backgroundColor: nowLineColor }} />
              </div>
            </div>
          )}

          {/* Blocks container */}
          <div className="absolute" style={{ left: TIMELINE_CONTENT_LEFT, right: 0, top: 0, bottom: 0 }}>
            {dateEvents.map(evt => renderEventBlock(evt))}
            {/* 완료 일정 미러 — 할일과 동일하게 PLAN(위 renderEventBlock, 흐림) 은 유지하고 DO 레인에도 렌더 */}
            {(() => {
              const doBounds = getTimelineLaneBounds('do');
              return doBounds
                ? dateEvents.filter(ev => ev.completed).map(evt => renderLiteEventBlock(evt, doBounds, 'do'))
                : null;
            })()}
            {planTodos.map(todo => renderBlock(todo, 'plan'))}
            {doTodos.map(todo => renderBlock(todo, 'do'))}
            {renderTimerBlock()}
            {renderSleepBlocks()}
            {renderLogMarkers()}
            {/* PC hover 미리보기 하이라이트 (드래그 중이 아닐 때만, 모바일 미표시) */}
            {!createPreview && hoverSlot && (() => {
              const lb = getTimelineLaneBounds(hoverSlot.lane);
              if (!lb) return null;
              const hTop = (hoverSlot.startMin / 60 - tlStartHour) * HOUR_HEIGHT;
              const hHeight = Math.max((hoverSlot.endMin - hoverSlot.startMin) * PX_PER_MIN, 20);
              const hClr = hoverSlot.lane === 'plan' ? '#C4A882' : '#6BAA7A';
              return (
                <div className="absolute rounded-xl pointer-events-none hidden lg:block"
                  style={{
                    top: hTop, height: hHeight, left: lb.left, right: lb.right,
                    backgroundColor: `${hClr}14`, border: `1.5px dashed ${hClr}66`, zIndex: 40,
                  }}>
                  <div style={{ fontSize: 10, color: hClr, padding: '2px 6px', fontWeight: 600 }}>
                    + {minutesToTime(hoverSlot.startMin)}
                  </div>
                </div>
              );
            })()}
            {createPreview && (() => {
              const lb = getTimelineLaneBounds(createPreview.lane);
              if (!lb) return null;
              const previewTop = (createPreview.startMin / 60 - tlStartHour) * HOUR_HEIGHT;
              const previewHeight = Math.max((createPreview.endMin - createPreview.startMin) * PX_PER_MIN, 20);
              const pClr = createPreview.lane === 'plan' ? '#C4A882' : '#6BAA7A';
              return (
                <div className="absolute rounded-xl pointer-events-none"
                  style={{
                    top: previewTop, height: previewHeight,
                    left: lb.left, right: lb.right,
                    backgroundColor: `${pClr}40`,
                    border: `2px dashed ${pClr}`,
                    zIndex: 50,
                  }}>
                  <div style={{ fontSize: 10, color: pClr === '#C4A882' ? '#7D6347' : '#3D7A58', padding: '2px 6px', fontWeight: 600 }}>
                    {minutesToTime(createPreview.startMin)} - {minutesToTime(createPreview.endMin)}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {timelineModals}
    </div>
  );
}
