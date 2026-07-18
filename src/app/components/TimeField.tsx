import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { inputBg, addPopoverStyle, withAlpha, isHaon } from '../styles/haonStyles';

// ─── TimeField (DESIGN.md §5 「시각 입력」) ───────────────────────────────────
// 시각 입력기를 직접 만들지 않는다: 모바일 = <input type="time">(OS 위임), PC(lg:) = 콤보박스.
// · 5분 고정 목록 — `minuteStep` 같은 "반영 안 되는 prop"은 받지 않는다(§5 금지). 타이핑은 임의 분 허용.
// · role='end' → 종료 전용: 시작 이전 시각 배제 + 목록에 duration 병기 + 모바일 duration chip(시작+chip=종료).
// · 표면 = inputBg(§5 Input), 팝오버 = addPopoverStyle(§1 오버레이 글래스). 새 색 토큰 없음(기존 accent/그레이 토큰 인라인 조합).
// · 非-H 폴백(안전망, 이번 소비처에선 미사용): 콤보박스를 띄우지 않고 전 브레이크포인트 네이티브 <input type="time">
//   + §5 Input(bgSub) 표면만 렌더한다. 현재 TodoModal은 isHaon 게이트로 H에서만 TimeField, A/B/C/D는 TimePicker 유지.

const STEP = 5; // 목록 간격 5분 고정 (DESIGN §5)
const DAY_MAX = 1435; // 23:55 (same-day clamp)
const DURATION_CHIPS = [30, 60, 90, 120]; // 모바일 종료 자동설정용 (시작 + chip = 종료)

function toMin(v: string): number | null {
  if (!v) return null;
  const [h, m] = v.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function toHHMM(min: number): string {
  const mm = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}
// 타이핑 파싱: 9→09:00, 930→09:30, 1415→14:15 (§5). 임의 분 허용(5분 스냅 강제 안 함 — step 제약 금지).
function parseTyped(raw: string): string | null {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (!d) return null;
  let h: number, m: number;
  if (d.length <= 2) { h = Number(d); m = 0; }
  else if (d.length === 3) { h = Number(d[0]); m = Number(d.slice(1)); }
  else { h = Number(d.slice(0, 2)); m = Number(d.slice(2)); }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fmtDur(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}시간 ${m}분`;
  return h ? `${h}시간` : `${m}분`;
}
// HHMM 타입키(선행0 유무 둘 다)로 프리픽스 매칭 — "9"→09:xx, "0930"·"930"→09:30
function matchQuery(value: string, q: string): boolean {
  if (!q) return true;
  const [hh, mm] = value.split(':');
  return `${Number(hh)}${mm}`.startsWith(q) || `${hh}${mm}`.startsWith(q);
}

interface TimeFieldProps {
  value: string;                       // "HH:mm" | "" (빈 값)
  onChange: (value: string) => void;   // "" = 지움 (TimePicker 시그니처 호환)
  role?: 'start' | 'end';
  rangeStart?: string;                 // role='end'일 때 시작 시각(이전 배제 + duration 병기용)
  onCommitFocusNext?: () => void;      // start 확정 후 종료로 포커스 이동
  clearable?: boolean;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>; // 종료 필드 포커스 이동 대상
  size?: 'sm' | 'md';
}

export function TimeField({
  value,
  onChange,
  role = 'start',
  rangeStart,
  onCommitFocusNext,
  clearable = true,
  placeholder = '시간',
  inputRef,
  size = 'sm',
}: TimeFieldProps) {
  const { t } = useTheme();
  const haon = isHaon(t);
  const startMin = role === 'end' && rangeStart ? toMin(rangeStart) : null;

  // 5분 목록 (end면 시작 다음 슬롯부터)
  const list = useMemo(() => {
    const from = startMin != null ? startMin + STEP : 0;
    const items: { value: string; min: number }[] = [];
    for (let mnt = from; mnt <= DAY_MAX; mnt += STEP) items.push({ value: toHHMM(mnt), min: mnt });
    return items;
  }, [startMin]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false); // 포커스 후 실제 타이핑했는지 — 안 했으면 목록 필터 안 함(현재값 전체선택 상태로 전체 목록 노출)
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const comboRef = inputRef ?? localInputRef;
  const blurTimer = useRef<number | null>(null);

  const q = dirty ? text.replace(/\D/g, '') : ''; // 타이핑 전(전체선택 상태)엔 전체 목록
  const filtered = useMemo(() => list.filter(it => matchQuery(it.value, q)), [list, q]);
  const focusRing = `0 0 0 3px ${withAlpha(t.accent, 0.25)}`;

  // 열릴 때: 현재값으로 스크롤 + 하이라이트
  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex(it => it.value === value);
    const target = idx >= 0 ? idx : 0;
    setHi(target);
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-i="${target}"]`);
      (el as HTMLElement | null)?.scrollIntoView({ block: 'center' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 하이라이트 이동 시 스크롤
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-i="${hi}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setText('');
    setDirty(false);
    if (role === 'start') onCommitFocusNext?.();
  };

  const tryCommitTyped = () => {
    const parsed = dirty ? parseTyped(text) : null; // 타이핑 안 했으면 하이라이트 항목 확정
    if (!dirty && filtered[hi]) { commit(filtered[hi].value); return; }
    if (parsed) {
      const pmin = toMin(parsed)!;
      if (startMin != null && pmin <= startMin) return; // 시작 이전 배제
      commit(parsed);
      return;
    }
    if (filtered[hi]) commit(filtered[hi].value);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); tryCommitTyped(); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setText(''); setDirty(false); comboRef.current?.blur(); }
  };

  const handleFocus = () => {
    if (blurTimer.current) { window.clearTimeout(blurTimer.current); blurTimer.current = null; }
    setOpen(true);
    setText(value ?? '');
    setDirty(false);
    requestAnimationFrame(() => comboRef.current?.select());
  };
  const handleBlur = () => {
    blurTimer.current = window.setTimeout(() => { setOpen(false); setText(''); setDirty(false); }, 150);
  };
  const clear = () => { onChange(''); setText(''); setDirty(false); setOpen(false); };

  const isMd = size === 'md';
  const fieldStyle: CSSProperties = {
    background: inputBg(t),
    border: `1px solid ${t.border}`,
    borderRadius: isMd ? 12 : 10,
    color: t.text,
    fontFamily: t.fontNumeric,
    fontSize: isMd ? 16 : 14,
    padding: isMd ? '8px 12px' : '6px 10px',
    width: '100%',
    outline: 'none',
  };

  // ── 네이티브 입력 (모바일 항상 / 非-H는 전 브레이크포인트) ──
  // duration chip은 여기(좁은 종료 칼럼) 대신 폼 레벨(<DurationChips/>, 전체 폭)에서 렌더한다.
  const nativeBlock = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="time"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.boxShadow = focusRing; }}
        onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; }}
        style={fieldStyle}
      />
      {clearable && value && (
        <button type="button" onClick={clear} aria-label="시간 지우기"
          style={{ position: 'absolute', right: 8, color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <X size={14} />
        </button>
      )}
    </div>
  );

  // 非-H 안전망: 콤보박스 없이 네이티브만 (전 브레이크포인트). 현재 소비처에선 미사용.
  if (!haon) {
    return <div style={{ position: 'relative', width: '100%' }}>{nativeBlock}</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 모바일: 네이티브 (OS 위임) */}
      <div className="lg:hidden">{nativeBlock}</div>

      {/* PC(lg): 콤보박스 */}
      <div className="hidden lg:block" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={comboRef}
            type="text"
            inputMode="numeric"
            value={open ? text : (value || '')}
            placeholder={placeholder}
            onChange={e => { setText(e.target.value); setDirty(true); setOpen(true); }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            style={{ ...fieldStyle, borderColor: open ? t.accent : t.border, boxShadow: open ? focusRing : 'none' }}
          />
          {clearable && value && !open && (
            <button type="button" onMouseDown={e => { e.preventDefault(); clear(); }} aria-label="시간 지우기"
              style={{ position: 'absolute', right: 8, color: t.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {open && (
          <div ref={listRef}
            style={{ ...addPopoverStyle(t), position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', maxHeight: 200, overflowY: 'auto', zIndex: 300, padding: 4 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: t.textMuted, textAlign: 'center' }}>일치 없음</div>
            )}
            {filtered.map((it, i) => {
              const strong = it.min % 60 === 0 || it.min % 60 === 30; // 정시·30분 강조
              const selected = it.value === value;
              const durLabel = startMin != null ? fmtDur(it.min - startMin) : '';
              return (
                <button key={it.value} data-i={i} type="button"
                  onMouseDown={e => { e.preventDefault(); commit(it.value); }}
                  onMouseEnter={() => setHi(i)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                    padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: t.fontNumeric, fontSize: 13,
                    background: selected ? t.accentLight : i === hi ? t.bgSub : 'transparent',
                    color: selected ? t.accent : strong ? t.text : t.textMuted,
                    fontWeight: strong || selected ? 500 : 400,
                  }}>
                  <span>{it.value}</span>
                  {durLabel && <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 8 }}>{durLabel}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DurationChips — 모바일 종료 빠른설정 칩(시작 + chip = 종료) ───
// 좁은 종료 필드 칼럼이 아니라 폼 전체 폭에 한 줄로 배치한다(모바일). start가 있어야 렌더.
// 단일 선택 토글: 현재 계획 길이(end−start)와 일치하는 칩만 선택 상태(라일락 fill + 딥 인디고 텍스트).
// 색 규정은 DESIGN.md §5 「시각 입력」 duration chip 표 참조(코랄 금지 — accentSoft 라일락, accentLight은 소프트 코랄).
// TimeField와 시간 헬퍼(toMin/toHHMM/fmtDur/DURATION_CHIPS)를 공유하려 같은 파일에 둔다.
export function DurationChips({ start, end, onPick, className = '' }: {
  start: string;                 // "HH:mm"
  end: string;                   // "HH:mm" — 현재 계획 종료(선택 상태 판정용)
  onPick: (end: string) => void; // 시작 + duration = 종료
  className?: string;
}) {
  const { t } = useTheme();
  const startMin = toMin(start);
  if (startMin == null) return null;
  const endMin = toMin(end);
  const gap = endMin != null ? endMin - startMin : null; // 현재 계획 길이(분)
  return (
    <div className={className} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {DURATION_CHIPS.map(d => {
        const selected = gap === d; // 현재 길이와 일치하는 칩만 활성
        return (
          <button key={d} type="button"
            onClick={() => onPick(toHHMM(Math.min(startMin + d, DAY_MAX)))}
            style={{
              fontSize: 12, fontWeight: 500, padding: '4px 14px', borderRadius: 999,
              border: `1px solid ${t.border}`, cursor: 'pointer', whiteSpace: 'nowrap',
              background: selected ? t.accentSoft : t.card, // 선택=라일락 tint / 기본=흰색
              color: selected ? t.text : t.textMuted,        // 선택=딥 인디고 / 기본=muted
            }}>
            {fmtDur(d)}
          </button>
        );
      })}
    </div>
  );
}
