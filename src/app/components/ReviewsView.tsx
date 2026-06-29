import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Mic, Search, ChevronLeft, ChevronRight, ChevronDown, Trash2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePlanner, ReviewRecord, MonthlyReview, getWeekKey, getLogicalToday } from '../store';
import { useTheme } from '../ThemeContext';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { weekFocusReport, monthFocusReport } from '../hooks/useTimeReport';
import { supabase } from '../../lib/supabase';
import { getCategoryEmoji, getMoodCategoryLabel, ENERGY_LABELS } from './MoodView';
import {
  format, addDays, subDays, subYears, parseISO,
  startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth,
  addMonths, subMonths,
  startOfISOWeek, endOfISOWeek, setISOWeek, setISOWeekYear,
} from 'date-fns';
import { ko } from 'date-fns/locale';

// ─── 음성 입력 버튼 (기존 useVoiceInput 재사용) ───
function VoiceInputButton({
  onResult,
  disabled,
}: {
  onResult: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  const { status, startRecording, stopRecording, text, setText } = useVoiceInput();
  const isRec = status === 'recording';
  const isBusy = status === 'transcribing';

  useEffect(() => {
    if (text) {
      onResult(text);
      setText('');
    }
  }, [text, onResult, setText]);

  const toggle = async () => {
    if (isBusy) return;
    if (isRec) await stopRecording();
    else await startRecording();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isBusy}
      title={isRec ? '녹음 중지' : '음성으로 입력'}
      className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors"
      style={{
        width: 30,
        height: 30,
        backgroundColor: isRec ? '#fee2e2' : t.bgSub,
        border: `1px solid ${isRec ? '#fca5a5' : t.borderLight}`,
        color: isRec ? '#ef4444' : t.textMuted,
      }}
    >
      {isRec ? (
        <span
          className="animate-pulse rounded-full"
          style={{ width: 9, height: 9, backgroundColor: '#ef4444', display: 'block' }}
        />
      ) : (
        <Mic size={13} />
      )}
    </button>
  );
}

// label + VoiceInputButton을 한 줄에 나란히
function LabelRow({ label, labelColor, onVoiceResult }: {
  label: string;
  labelColor?: string;
  onVoiceResult: (text: string) => void;
}) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between mb-1">
      <label style={{ fontSize: 11, color: labelColor ?? t.textSub, fontWeight: 600 }}>{label}</label>
      <VoiceInputButton onResult={onVoiceResult} />
    </div>
  );
}

const RECORD_TYPES = [
  { key: 'gratitude', emoji: '🙏', label: '감사 일기' },
  { key: 'kpt', emoji: '🔄', label: 'KPT 회고' },
  { key: 'happiness', emoji: '✨', label: '행복 기록' },
  { key: 'daily', emoji: '📔', label: '데일리 리뷰' },
];

// 본문(감사·KPT) 입력 폰트 — 이 페이지 한정 NanumSquareRound
const BODY_FONT = 'var(--font-nanum-round)';

// ─── mood_records 타입(읽기 전용) ───
interface MoodRow {
  id: string;
  date: string;
  emotion_tags: string[];
  energy_level: number;
  created_at: string;
}

// ─── 컨디션 배지 (mood_records 읽기 전용, 단일 진실 공급원) ───
function ConditionBadge({ date }: { date: string }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [moods, setMoods] = useState<MoodRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('mood_records')
      .select('id,date,emotion_tags,energy_level,created_at')
      .eq('date', date)
      .order('created_at', { ascending: false });
    setMoods((data as MoodRow[]) ?? []);
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync('mood_records', load);

  const latest = moods[0] ?? null;

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between mb-2">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>오늘의 컨디션</h3>
        <button onClick={() => navigate('/mood')}
          className="flex items-center gap-0.5"
          style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>
          기분 기록하러 <ChevronRight size={13} />
        </button>
      </div>
      {latest ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 26 }}>{getCategoryEmoji(latest.emotion_tags)}</span>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {getMoodCategoryLabel(latest.emotion_tags) && (
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                  {getMoodCategoryLabel(latest.emotion_tags)}
                </span>
              )}
              {latest.emotion_tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full"
                  style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent, fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
            <span style={{ fontSize: 11, color: t.textMuted }}>에너지 · {ENERGY_LABELS[latest.energy_level]}</span>
          </div>
          {moods.length > 1 && (
            <span className="ml-auto" style={{ fontSize: 10, color: t.textMuted }}>외 {moods.length - 1}건</span>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: t.textMuted }}>아직 기분 기록 없음</p>
      )}
    </div>
  );
}

// ─── 과거 타임라인 카드 ───
function recordPreview(r: ReviewRecord): string {
  const g = (r.gratitude ?? []).filter(Boolean);
  if (g.length) return `🙏 ${g.join(', ')}`;
  const kpt = [r.kptKeep, r.kptProblem, r.kptTry].filter(Boolean).join(' · ');
  if (kpt) return `🔄 ${kpt}`;
  if (r.dailySummary) return `📔 ${r.dailySummary}`;
  return '';
}

function PastCard({ record, onSelect, anniversary }: {
  record: ReviewRecord; onSelect: (date: string) => void; anniversary?: boolean;
}) {
  const { t } = useTheme();
  const gCount = (record.gratitude ?? []).filter(Boolean).length;
  const hasKpt = !!(record.kptKeep || record.kptProblem || record.kptTry);
  const preview = recordPreview(record);
  return (
    <button onClick={() => onSelect(record.date)}
      className="w-full text-left p-3 rounded-xl transition-colors"
      style={{
        backgroundColor: anniversary ? t.accentLight : t.card,
        border: `1px solid ${anniversary ? t.accent : t.borderLight}`,
      }}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {anniversary && <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>🕰 1년 전 오늘</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
          {format(parseISO(record.date), 'M월 d일 (E)', { locale: ko })}
        </span>
        <div className="flex gap-1">
          {gCount > 0 && (
            <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.bgSub, color: t.textSub }}>감사 {gCount}</span>
          )}
          {hasKpt && (
            <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.bgSub, color: t.textSub }}>KPT</span>
          )}
        </div>
      </div>
      {preview && (
        <p style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
      )}
    </button>
  );
}

function PastTimeline({ dayDate, onSelect }: { dayDate: string; onSelect: (date: string) => void }) {
  const { t } = useTheme();
  const { reviewRecords } = usePlanner();

  const anniversaryDate = format(subYears(parseISO(dayDate), 1), 'yyyy-MM-dd');
  const anniversaryRec = reviewRecords.find(r => r.date === anniversaryDate);

  const recent = [...reviewRecords]
    .filter(r => r.date !== dayDate && r.date !== anniversaryDate && recordPreview(r))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
        <Clock size={13} /> 지난 기록
      </h3>
      {anniversaryRec && <PastCard record={anniversaryRec} onSelect={onSelect} anniversary />}
      {recent.length === 0 && !anniversaryRec ? (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '12px 0' }}>아직 지난 기록이 없어요</p>
      ) : (
        recent.map(r => <PastCard key={r.id} record={r} onSelect={onSelect} />)
      )}
    </div>
  );
}

// ─── 일간 탭 ───
function DayTab() {
  const { reviewRecords, addReviewRecord, updateReviewRecord } = usePlanner();
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const todayStr = getLogicalToday();
  const [dayDate, setDayDate] = useState(todayStr);

  const dayRecord = reviewRecords.find(r => r.date === dayDate);

  const [gratitude, setGratitude] = useState<string[]>(['', '', '']);
  const [kptKeep, setKptKeep] = useState('');
  const [kptProblem, setKptProblem] = useState('');
  const [kptTry, setKptTry] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  // 선택 날짜/레코드 변경 시 입력 상태 동기화
  useEffect(() => {
    setGratitude(dayRecord?.gratitude && dayRecord.gratitude.length ? dayRecord.gratitude : ['', '', '']);
    setKptKeep(dayRecord?.kptKeep || '');
    setKptProblem(dayRecord?.kptProblem || '');
    setKptTry(dayRecord?.kptTry || '');
  }, [dayDate, dayRecord?.id]);

  const goPrev = () => setDayDate(format(subDays(parseISO(dayDate), 1), 'yyyy-MM-dd'));
  const goNext = () => setDayDate(format(addDays(parseISO(dayDate), 1), 'yyyy-MM-dd'));

  const addGratitudeLine = () => setGratitude(prev => [...prev, '']);
  const removeGratitudeLine = (i: number) => setGratitude(prev => prev.filter((_, idx) => idx !== i));
  const setGratitudeLine = (i: number, v: string) =>
    setGratitude(prev => prev.map((g, idx) => idx === i ? v : g));
  const appendGratitudeVoice = (i: number, text: string) =>
    setGratitude(prev => prev.map((g, idx) => idx === i ? (g ? `${g} ${text}` : text) : g));

  const save = () => {
    const cleanGratitude = gratitude.map(g => g.trim()).filter(Boolean);
    const hasG = cleanGratitude.length > 0;
    const hasK = !!(kptKeep.trim() || kptProblem.trim() || kptTry.trim());
    // 기존 types 중 gratitude/kpt 외(happiness/daily)는 보존
    const otherTypes = (dayRecord?.types ?? []).filter(ty => ty !== 'gratitude' && ty !== 'kpt');
    const types = [...otherTypes, ...(hasG ? ['gratitude'] : []), ...(hasK ? ['kpt'] : [])];

    // 부분 업데이트(머지): gratitude/kpt 만 전송 → 과거 daily_*/happiness 보존(Stage 1)
    const data: Omit<ReviewRecord, 'id'> = {
      date: dayDate,
      types,
      gratitude: cleanGratitude,
      kptKeep: kptKeep,
      kptProblem: kptProblem,
      kptTry: kptTry,
    };
    if (dayRecord) updateReviewRecord(dayRecord.id, data);
    else addReviewRecord(data);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const inputStyle = {
    borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13,
    fontFamily: BODY_FONT,
  };

  const writeCol = (
    <div className="space-y-4">
      {/* 컨디션 배지 */}
      <ConditionBadge date={dayDate} />

      {/* 감사 일기 */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🙏 감사 일기</h3>
        <div className="space-y-2">
          {gratitude.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: t.accent, fontWeight: 600, width: 16 }}>{i + 1}.</span>
              <input value={g} onChange={e => setGratitudeLine(i, e.target.value)}
                placeholder="오늘 감사한 것" className="flex-1 rounded-lg px-3 py-2 border outline-none min-w-0" style={inputStyle} />
              <VoiceInputButton onResult={text => appendGratitudeVoice(i, text)} />
              <button type="button" onClick={() => removeGratitudeLine(i)} title="이 줄 삭제"
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: 30, height: 30, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, color: t.textMuted }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addGratitudeLine}
          className="flex items-center gap-1 mt-3"
          style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
          <Plus size={14} /> 한 줄 더 추가
        </button>
      </div>

      {/* KPT 회고 */}
      <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>🔄 KPT 회고</h3>
        <div className={isDesktop ? 'grid grid-cols-3 gap-3' : 'space-y-3'}>
          <div>
            <LabelRow label="Keep (유지할 것)" labelColor="#006b62" onVoiceResult={text => setKptKeep(prev => prev ? `${prev} ${text}` : text)} />
            <textarea value={kptKeep} onChange={e => setKptKeep(e.target.value)} rows={isDesktop ? 4 : 2}
              className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
          </div>
          <div>
            <LabelRow label="Problem (문제점)" labelColor="#D4735A" onVoiceResult={text => setKptProblem(prev => prev ? `${prev} ${text}` : text)} />
            <textarea value={kptProblem} onChange={e => setKptProblem(e.target.value)} rows={isDesktop ? 4 : 2}
              className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
          </div>
          <div>
            <LabelRow label="Try (시도할 것)" labelColor="#7B9ED9" onVoiceResult={text => setKptTry(prev => prev ? `${prev} ${text}` : text)} />
            <textarea value={kptTry} onChange={e => setKptTry(e.target.value)} rows={isDesktop ? 4 : 2}
              className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
          </div>
        </div>
      </div>

      <button onClick={save}
        className="w-full py-3 rounded-xl transition-colors"
        style={{ fontSize: 14, fontWeight: 600, backgroundColor: savedFlash ? t.success : t.accent, color: '#fff' }}>
        {savedFlash ? '저장됨 ✓' : '저장하기'}
      </button>
    </div>
  );

  const dateNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={goPrev} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setDayDate(todayStr)}
        style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 160, textAlign: 'center' }}>
        {format(parseISO(dayDate), 'M월 d일 EEEE', { locale: ko })}
        {dayDate !== todayStr && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>오늘로</span>}
      </button>
      <button onClick={goNext} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  return (
    <div>
      {dateNav}
      {isDesktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">{writeCol}</div>
          <div className="flex-shrink-0" style={{ width: 320 }}>
            <div style={{ position: 'sticky', top: 12 }}>
              <PastTimeline dayDate={dayDate} onSelect={setDayDate} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {writeCol}
          <PastTimeline dayDate={dayDate} onSelect={setDayDate} />
        </div>
      )}
    </div>
  );
}

// ─── 주간 탭 ───────────────────────────────────────────────────────────────

// 분 → 소수 시간 문자열(목업 표기 "12.4"). 단위(h)는 호출부에서 붙인다.
function fmtHours(min: number): string {
  return (min / 60).toFixed(1);
}

// weekKey(YYYY-Www, ISO주) → 그 주의 월~일 범위
function weekKeyToRange(weekKey: string) {
  const [y, w] = weekKey.split('-W').map(Number);
  let d = new Date(y, 0, 4); // 1월 4일은 항상 ISO 1주차
  d = setISOWeekYear(d, y);
  d = setISOWeek(d, w);
  const start = startOfISOWeek(d);
  const end = endOfISOWeek(d);
  return { start, end, startStr: format(start, 'yyyy-MM-dd'), endStr: format(end, 'yyyy-MM-dd') };
}

// 그 주가 속한 달에서 몇 번째 주인지(달력 주차)
function weekOfMonth(weekStart: Date, weekStartsOn: 0 | 1): number {
  const firstWeekStart = startOfWeek(startOfMonth(weekStart), { weekStartsOn });
  return Math.round((startOfWeek(weekStart, { weekStartsOn }).getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;
}

// 작은 통계 카드(값 + 단위 + 라벨(서브 인라인) + 얇은 막대) — 목업 .stat
function StatCard({ value, unit, label, sub, pct, barColor }: {
  value: string; unit?: string; label: string; sub?: string; pct: number; barColor: string;
}) {
  const { t } = useTheme();
  return (
    <div className="rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: '13px 14px' }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)', lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 400, marginLeft: 1 }}>{unit}</span>}
      </span>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>{label}{sub ? ` · ${sub}` : ''}</div>
      <div className="rounded-full overflow-hidden" style={{ height: 5, backgroundColor: t.bgSub, marginTop: 8 }}>
        <div className="rounded-full" style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: barColor, transition: 'width .3s' }} />
      </div>
    </div>
  );
}

// 자동집계 한 셀(큰 숫자 + 단위 + 라벨) — 월간 "숫자로 보는 한 달" 6셀 그리드용
function MiniCell({ value, unit, label }: { value: string; unit?: string; label: string }) {
  const { t } = useTheme();
  return (
    <div className="rounded-xl flex flex-col" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: '12px 10px' }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)', lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginLeft: 1 }}>{unit}</span>}
      </span>
      <span style={{ fontSize: 10.5, color: t.textMuted, marginTop: 6 }}>{label}</span>
    </div>
  );
}

// ─── 집중시간 분석 블록 (주간/월간 공용) ───
// "언제" 축(요일별/주차별)을 buckets·bucketTitle prop 으로 주입해 한 컴포넌트로 양쪽 처리.
// 데이터는 모두 시간 리포트 엔진(aggregateRange) 기반 — 별도 집계·중복 구현 없음.
interface FocusBucket { key: string; label: string; isCurrent: boolean; totalMinutes: number }
function FocusBlock({
  totalMinutes, prevTotalMinutes, deltaMinutes, avgPerDayMinutes,
  prevLabel, buckets, bucketTitle, byCategory, isDesktop, emptyText, onMore,
}: {
  totalMinutes: number; prevTotalMinutes: number; deltaMinutes: number; avgPerDayMinutes: number;
  prevLabel: string; buckets: FocusBucket[]; bucketTitle: string;
  byCategory: Array<{ tagId: string; tagName: string; tagColor: string; totalMinutes: number }>;
  isDesktop: boolean; emptyText: string; onMore: () => void;
}) {
  const { t } = useTheme();
  const TOP_TAGS = 5;
  const topTags = byCategory.slice(0, TOP_TAGS);
  const restMin = byCategory.slice(TOP_TAGS).reduce((s, c) => s + c.totalMinutes, 0);
  const tagRows = restMin > 0
    ? [...topTags, { tagId: '__etc', tagName: '기타', tagColor: t.textMuted, totalMinutes: restMin }]
    : topTags;
  const maxTag = Math.max(1, ...tagRows.map(r => r.totalMinutes));
  const maxBucket = Math.max(1, ...buckets.map(b => b.totalMinutes));
  // 증가 green / 감소 warm(danger) / 0 muted — 토큰만(목업 코랄 = 테마 warm 토큰)
  const deltaColor = deltaMinutes > 0 ? t.success : deltaMinutes < 0 ? t.danger : t.textMuted;
  const deltaText = deltaMinutes === 0 ? '—' : `${deltaMinutes > 0 ? '▲' : '▼'} ${fmtHours(Math.abs(deltaMinutes))}h`;

  const bucketViz = (
    <div className="min-w-0" style={{ flex: 1.1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 9, letterSpacing: '.3px' }}>{bucketTitle}</div>
      <div className="flex items-end gap-1.5" style={{ height: 84 }}>
        {buckets.map(b => {
          const barH = b.totalMinutes > 0 ? `${Math.max(6, (b.totalMinutes / maxBucket) * 100)}%` : '0%';
          return (
            <div key={b.key} className="flex flex-col items-center gap-1.5 flex-1 min-w-0" style={{ height: '100%', justifyContent: 'flex-end' }}>
              <div className="relative w-full flex justify-center" style={{ flex: 1, alignItems: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 26, height: barH, borderRadius: '6px 6px 0 0', backgroundColor: b.isCurrent ? t.danger : t.accent, position: 'relative', transition: 'height .3s' }}>
                  {b.totalMinutes > 0 && (
                    <span style={{ position: 'absolute', top: -16, left: 0, right: 0, textAlign: 'center', fontSize: 9, fontWeight: 700, color: b.isCurrent ? t.danger : t.textMuted }}>{fmtHours(b.totalMinutes)}</span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 10, color: b.isCurrent ? t.danger : t.textMuted, fontWeight: b.isCurrent ? 700 : 400 }}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const tagViz = (
    <div className="flex-1 min-w-0">
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 9, letterSpacing: '.3px' }}>무엇에 — 태그별</div>
      <div className="space-y-2.5">
        {tagRows.map(r => (
          <div key={r.tagId} className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: t.text, fontWeight: 500, width: 52, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tagName}</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 9, backgroundColor: t.bgSub }}>
              <div className="rounded-full" style={{ height: '100%', width: `${(r.totalMinutes / maxTag) * 100}%`, backgroundColor: r.tagColor, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 11, color: t.textMuted, width: 42, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtHours(r.totalMinutes)}h</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: 16 }}>
      <div className="flex items-end justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 15 }}>⏱</span>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>집중 시간</h3>
        </div>
        <button onClick={onMore} className="flex items-center gap-0.5"
          style={{ fontSize: 11, color: t.accent, fontWeight: 600, whiteSpace: 'nowrap' }}>
          시간 리포트 자세히 <ChevronRight size={13} />
        </button>
      </div>

      {totalMinutes <= 0 ? (
        <p style={{ fontSize: 13, color: t.textMuted, padding: '16px 0' }}>{emptyText}</p>
      ) : (
        <>
          {/* (a) 큰 숫자 + 증감 */}
          <div className="flex items-baseline gap-2.5" style={{ margin: '6px 0 2px' }}>
            <span style={{ fontSize: 38, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)', lineHeight: 1 }}>
              {fmtHours(totalMinutes)}<span style={{ fontSize: 18, color: t.textMuted, fontWeight: 400, marginLeft: 2 }}>h</span>
            </span>
            <span className="rounded-lg" style={{ fontSize: 13, fontWeight: 700, color: deltaColor, border: `1px solid ${deltaColor}`, padding: '3px 9px' }}>{deltaText}</span>
          </div>
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>
            지난{prevLabel} {fmtHours(prevTotalMinutes)}h 대비 · 하루 평균 {fmtHours(avgPerDayMinutes)}h
          </p>

          {/* (b)(c) 모바일 세로(구분선) / PC 2열 */}
          {isDesktop ? (
            <div className="grid gap-6 items-start" style={{ gridTemplateColumns: '1.1fr 1fr' }}>{bucketViz}{tagViz}</div>
          ) : (
            <div>
              {bucketViz}
              <div style={{ height: 1, backgroundColor: t.borderLight, margin: '16px 0' }} />
              {tagViz}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WeekTab() {
  const {
    todos, tags, habits,
    weeklyReviews, addWeeklyReview, updateWeeklyReview,
    appSettings,
  } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const weekStartsOn = (appSettings.weekStartsOn ?? 1) as 0 | 1;

  // ── 주 범위 단일 계산 — 아래 모든 통계/회고/과거 조회가 공유 ──
  const [anchor, setAnchor] = useState(() => parseISO(getLogicalToday()));
  const range = useMemo(() => {
    const start = startOfWeek(anchor, { weekStartsOn });
    const end = endOfWeek(anchor, { weekStartsOn });
    const thu = addDays(start, weekStartsOn === 0 ? 4 : 3); // ISO 주차 판정 기준(목요일)
    return {
      start, end, thu,
      startStr: format(start, 'yyyy-MM-dd'),
      endStr: format(end, 'yyyy-MM-dd'),
      weekKey: getWeekKey(thu),
    };
  }, [anchor, weekStartsOn]);

  const currentWeekKey = useMemo(() => {
    const start = startOfWeek(parseISO(getLogicalToday()), { weekStartsOn });
    return getWeekKey(addDays(start, weekStartsOn === 0 ? 4 : 3));
  }, [weekStartsOn]);
  const isCurrentWeek = range.weekKey === currentWeekKey;

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(range.start, i), 'yyyy-MM-dd')),
    [range.startStr],
  );

  // ── 작은 통계 2종 (선택 주 범위 기준) ──
  const weekTodos = todos.filter(td => td.date && td.date >= range.startStr && td.date <= range.endStr);
  const doneTodos = weekTodos.filter(td => td.status === 'done');
  const completionPct = weekTodos.length ? Math.round((doneTodos.length / weekTodos.length) * 100) : 0;

  // 습관 달성일 — 그 주 7일 중 습관을 하나라도 체크한 날 수 (목업: n/7)
  const habitDays = habits.length ? weekDays.filter(d => habits.some(h => h.checkedDates.includes(d))).length : 0;
  const habitPct = Math.round((habitDays / 7) * 100);

  // ── 집중시간 분석 — 시간 리포트 엔진(aggregateRange) 재사용. 합계/요일별/태그별/직전주 비교 모두 단일 소스 ──
  const focus = useMemo(
    () => weekFocusReport(todos, tags, range.start, weekStartsOn, getLogicalToday()),
    [todos, tags, range.startStr, weekStartsOn],
  );

  // ── 회고 입력 (Stage 1 필드로 실제 저장) ──
  const weeklyReview = weeklyReviews.find(r => r.weekKey === range.weekKey);
  const [wrGood, setWrGood] = useState('');
  const [wrHard, setWrHard] = useState('');
  const [wrNext, setWrNext] = useState('');
  const [wrKptKeep, setWrKptKeep] = useState('');
  const [wrKptProblem, setWrKptProblem] = useState('');
  const [wrKptTry, setWrKptTry] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setWrGood(weeklyReview?.good || '');
    setWrHard(weeklyReview?.hard || '');
    setWrNext(weeklyReview?.nextWeek || '');
    setWrKptKeep(weeklyReview?.kptKeep || '');
    setWrKptProblem(weeklyReview?.kptProblem || '');
    setWrKptTry(weeklyReview?.kptTry || '');
  }, [weeklyReview?.id, range.weekKey]);

  const save = () => {
    const payload = {
      weekKey: range.weekKey,
      good: wrGood, hard: wrHard, nextWeek: wrNext,
      kptKeep: wrKptKeep, kptProblem: wrKptProblem, kptTry: wrKptTry,
    };
    if (weeklyReview) updateWeeklyReview(weeklyReview.id, payload);
    else addWeeklyReview(payload);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  // ── 과거 주간 리뷰(월별 그룹 + 작년 비교) ──
  const weekCompletion = useCallback((startStr: string, endStr: string): number | null => {
    const ws = todos.filter(td => td.date && td.date >= startStr && td.date <= endStr);
    if (!ws.length) return null;
    return Math.round((ws.filter(td => td.status === 'done').length / ws.length) * 100);
  }, [todos]);

  const lastYearKey = useMemo(() => {
    const [y, w] = range.weekKey.split('-W');
    return `${Number(y) - 1}-W${w}`;
  }, [range.weekKey]);
  const lastYearReview = weeklyReviews.find(r => r.weekKey === lastYearKey);

  const hasText = (r: { good?: string; hard?: string; nextWeek?: string; kptKeep?: string; kptProblem?: string; kptTry?: string }) =>
    !!(r.good || r.hard || r.nextWeek || r.kptKeep || r.kptProblem || r.kptTry);

  const pastGroups = useMemo(() => {
    const items = weeklyReviews
      .filter(r => r.weekKey !== range.weekKey && hasText(r))
      .map(r => {
        const rg = weekKeyToRange(r.weekKey);
        return { review: r, ...rg, monthKey: format(addDays(rg.start, 3), 'yyyy-MM') };
      })
      .sort((a, b) => b.review.weekKey.localeCompare(a.review.weekKey));
    const groups: { monthKey: string; rows: typeof items }[] = [];
    for (const it of items) {
      let g = groups.find(x => x.monthKey === it.monthKey);
      if (!g) { g = { monthKey: it.monthKey, rows: [] }; groups.push(g); }
      g.rows.push(it);
    }
    return groups;
  }, [weeklyReviews, range.weekKey]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (mk: string, idx: number) => expanded[mk] ?? idx === 0; // 최신 그룹 기본 펼침
  const toggleGroup = (mk: string, idx: number) =>
    setExpanded(prev => ({ ...prev, [mk]: !(prev[mk] ?? idx === 0) }));

  const inputStyle = {
    borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13,
    fontFamily: BODY_FONT,
  };

  // 과거 주간 카드 1개 렌더 (작년 비교 카드/일반 카드 공용)
  const renderPastItem = (
    row: { review: typeof weeklyReviews[number]; start: Date; end: Date; startStr: string; endStr: string },
    anniversary = false,
  ) => {
    const womN = weekOfMonth(row.start, weekStartsOn);
    const comp = weekCompletion(row.startStr, row.endStr);
    const preview = [row.review.good, row.review.hard, row.review.nextWeek].filter(Boolean).join(' · ');
    return (
      <button key={row.review.id} onClick={() => setAnchor(row.start)}
        className="w-full text-left p-3 rounded-xl transition-colors"
        style={{
          backgroundColor: anniversary ? t.accentLight : t.card,
          border: `1px solid ${anniversary ? t.accent : t.borderLight}`,
        }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {anniversary && <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>🕰 작년 같은 주차</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{format(row.start, 'M')}월 {womN}주차</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>{format(row.start, 'M.d')}–{format(row.end, 'M.d')}</span>
          {comp != null && (
            <span className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.bgSub, color: t.textSub }}>완료 {comp}%</span>
          )}
        </div>
        {preview && (
          <p style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
        )}
      </button>
    );
  };

  const womNum = weekOfMonth(range.start, weekStartsOn);
  const navLabel = `${format(range.thu, 'M')}월 ${womNum}주차 · ${format(range.start, 'M.d')}–${format(range.end, 'M.d')}`;

  const weekNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={() => setAnchor(a => subWeeks(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setAnchor(parseISO(getLogicalToday()))}
        style={{ fontSize: 14, fontWeight: 700, color: t.text, minWidth: 210, textAlign: 'center' }}>
        {navLabel}
        {!isCurrentWeek && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>이번 주로</span>}
      </button>
      <button onClick={() => setAnchor(a => addWeeks(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  // ── 작은 통계 2종 (완료율 % · 습관 달성일 n/7) ──
  const statsBlock = (
    <div className="grid grid-cols-2 gap-3">
      <StatCard value={weekTodos.length ? String(completionPct) : '–'} unit={weekTodos.length ? '%' : undefined}
        label="할일 완료율" sub={weekTodos.length ? `${doneTodos.length}/${weekTodos.length}` : '할일 없음'}
        pct={completionPct} barColor={t.success} />
      <StatCard value={habits.length ? String(habitDays) : '–'} unit={habits.length ? '/7' : undefined}
        label="습관 달성일" sub={habits.length ? undefined : '습관 없음'}
        pct={habitPct} barColor={t.accent} />
    </div>
  );

  // ── 집중시간 분석 블록 (주간/월간 공용 컴포넌트, 요일 축 주입) ──
  const focusBlock = (
    <FocusBlock
      totalMinutes={focus.totalMinutes}
      prevTotalMinutes={focus.prevTotalMinutes}
      deltaMinutes={focus.deltaMinutes}
      avgPerDayMinutes={focus.avgPerDayMinutes}
      prevLabel="주"
      bucketTitle="언제 — 요일별"
      buckets={focus.daily.map(d => ({ key: d.date, label: d.dayLabel, isCurrent: d.isToday, totalMinutes: d.totalMinutes }))}
      byCategory={focus.byCategory}
      isDesktop={isDesktop}
      emptyText="이번 주 기록된 집중시간이 없어요"
      onMore={() => navigate('/time-report')}
    />
  );

  const reviewForm = (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>주간 리뷰 · {navLabel}</h3>
      <div className="space-y-3">
        <div>
          <LabelRow label="잘한 것" labelColor="#006b62" onVoiceResult={text => setWrGood(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={wrGood} onChange={e => setWrGood(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="어려웠던 점" labelColor="#D4735A" onVoiceResult={text => setWrHard(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={wrHard} onChange={e => setWrHard(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="다음 주 다짐" labelColor="#7B9ED9" onVoiceResult={text => setWrNext(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={wrNext} onChange={e => setWrNext(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
      </div>

      {/* KPT 섹션 — 설정에서 ON 시 표시, 실제 저장(Stage 1 컬럼) */}
      {appSettings.showWeeklyKpt && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>🔄 KPT 주간 회고</h4>
          <div className={isDesktop ? 'grid grid-cols-3 gap-3' : 'space-y-3'}>
            <div>
              <LabelRow label="Keep (유지할 것)" labelColor="#006b62" onVoiceResult={text => setWrKptKeep(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={wrKptKeep} onChange={e => setWrKptKeep(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Problem (문제점)" labelColor="#D4735A" onVoiceResult={text => setWrKptProblem(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={wrKptProblem} onChange={e => setWrKptProblem(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Try (시도할 것)" labelColor="#7B9ED9" onVoiceResult={text => setWrKptTry(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={wrKptTry} onChange={e => setWrKptTry(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      <button onClick={save}
        className="w-full mt-4 py-2.5 rounded-xl transition-colors"
        style={{ fontSize: 13, fontWeight: 600, backgroundColor: savedFlash ? t.success : t.accent, color: '#fff' }}>
        {savedFlash ? '저장됨 ✓' : '저장'}
      </button>
    </div>
  );

  const pastBlock = (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
        <Clock size={13} /> 지난 주간 리뷰
      </h3>
      {lastYearReview && hasText(lastYearReview) && renderPastItem({ review: lastYearReview, ...weekKeyToRange(lastYearReview.weekKey) }, true)}
      {pastGroups.length === 0 && !(lastYearReview && hasText(lastYearReview)) ? (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '12px 0' }}>아직 지난 주간 리뷰가 없어요</p>
      ) : (
        pastGroups.map((g, gi) => (
          <div key={g.monthKey} className="space-y-2">
            <button onClick={() => toggleGroup(g.monthKey, gi)}
              className="flex items-center gap-1 w-full mt-1"
              style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
              <ChevronDown size={14} style={{ transform: isExpanded(g.monthKey, gi) ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
              {format(parseISO(`${g.monthKey}-01`), 'yyyy년 M월', { locale: ko })}
              <span style={{ color: t.textMuted, fontWeight: 400 }}>· {g.rows.length}건</span>
            </button>
            {isExpanded(g.monthKey, gi) && g.rows.map(row => renderPastItem(row))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      {weekNav}
      {isDesktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            {statsBlock}
            {focusBlock}
            {reviewForm}
          </div>
          <div className="flex-shrink-0" style={{ width: 340 }}>
            <div style={{ position: 'sticky', top: 12 }}>{pastBlock}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {statsBlock}
          {focusBlock}
          {reviewForm}
          {pastBlock}
        </div>
      )}
    </div>
  );
}

// ─── 월간 탭 ───────────────────────────────────────────────────────────────

type BestItem = { id: string; label: string };

// 이 달의 베스트 — 후보 칩(라디오) + 직접 입력. 선택값은 제목 문자열로 저장.
function BestCategory({ emoji, label, candidates, value, onChange }: {
  emoji: string; label: string; candidates: BestItem[]; value: string; onChange: (v: string) => void;
}) {
  const { t } = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const isCustom = !!value && !candidates.some(c => c.label === value);

  const chipStyle = (sel: boolean) => ({
    fontSize: 11, padding: '5px 10px', maxWidth: 200,
    overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
    backgroundColor: sel ? t.accent : t.bgSub, color: sel ? '#fff' : t.textSub,
    border: `1px solid ${sel ? t.accent : t.borderLight}`, fontWeight: sel ? 600 : 400,
  });

  return (
    <div className="rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}`, padding: '12px 14px' }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span style={{ fontSize: 15 }}>{emoji}</span>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{label}</h4>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {candidates.length === 0 && !isCustom && (
          <span style={{ fontSize: 11, color: t.textMuted, padding: '4px 0' }}>이 달 기록이 없어요 · 직접 입력해 주세요</span>
        )}
        {candidates.map(c => {
          const sel = c.label === value;
          return (
            <button key={c.id} onClick={() => onChange(sel ? '' : c.label)} className="rounded-full" style={chipStyle(sel)}>
              {sel ? '⭐ ' : ''}{c.label}
            </button>
          );
        })}
        {isCustom && (
          <button onClick={() => onChange('')} className="rounded-full" style={chipStyle(true)}>⭐ {value}</button>
        )}
        <button onClick={() => setCustomOpen(o => !o)} className="rounded-full"
          style={{ fontSize: 11, padding: '5px 10px', backgroundColor: t.bgSub, color: t.textMuted, border: `1px dashed ${t.border}` }}>
          ＋ 직접 입력
        </button>
      </div>
      {customOpen && (
        <div className="flex items-center gap-2 mt-2.5">
          <input value={customText} onChange={e => setCustomText(e.target.value)}
            placeholder={`${label} 직접 입력`} className="flex-1 rounded-lg px-3 py-1.5 border outline-none min-w-0"
            style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 12 }} />
          <button onClick={() => { const v = customText.trim(); if (v) { onChange(v); setCustomText(''); setCustomOpen(false); } }}
            className="rounded-lg flex-shrink-0" style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', backgroundColor: t.accent, color: '#fff' }}>
            선택
          </button>
        </div>
      )}
    </div>
  );
}

function MonthTab() {
  const {
    todos, tags, habits,
    monthlyReviews, addMonthlyReview, updateMonthlyReview,
    appSettings,
  } = usePlanner();
  const { t } = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const weekStartsOn = (appSettings.weekStartsOn ?? 1) as 0 | 1;

  // ── 월 범위 단일 계산 — 아래 모든 섹션이 공유 ──
  const [anchor, setAnchor] = useState(() => startOfMonth(parseISO(getLogicalToday())));
  const monthKey = format(anchor, 'yyyy-MM');
  const monthStartStr = `${monthKey}-01`;
  const monthEndStr = format(endOfMonth(anchor), 'yyyy-MM-dd');
  const currentMonthKey = format(parseISO(getLogicalToday()), 'yyyy-MM');
  const isCurrentMonth = monthKey === currentMonthKey;

  // ── 자동집계: 할일/습관 (store) ──
  const monthTodos = todos.filter(td => td.date && td.date >= monthStartStr && td.date <= monthEndStr);
  const doneTodos = monthTodos.filter(td => td.status === 'done');
  const completionPct = monthTodos.length ? Math.round((doneTodos.length / monthTodos.length) * 100) : 0;
  const habitDays = useMemo(() => {
    const s = new Set<string>();
    habits.forEach(h => h.checkedDates.forEach(d => { if (d.startsWith(monthKey)) s.add(d); }));
    return s.size;
  }, [habits, monthKey]);

  // ── 자동집계 + 베스트 후보: 외부 소스 테이블 읽기 전용 ──
  const [src, setSrc] = useState<{ video: BestItem[]; music: BestItem[]; book: BestItem[]; place: BestItem[]; walkCount: number }>(
    { video: [], music: [], book: [], place: [], walkCount: 0 },
  );
  const loadSrc = useCallback(async () => {
    const [cu, mu, bk, pv, wk] = await Promise.all([
      supabase.from('culture_records').select('id,title,watched_date')
        .gte('watched_date', monthStartStr).lte('watched_date', monthEndStr).order('watched_date', { ascending: false }),
      supabase.from('music_records').select('id,track_title,artist,created_at').order('created_at', { ascending: false }),
      supabase.from('books').select('id,title,status,finish_date')
        .eq('status', 'done').gte('finish_date', monthStartStr).lte('finish_date', monthEndStr),
      supabase.from('place_visits').select('id,name,visited_on')
        .gte('visited_on', monthStartStr).lte('visited_on', monthEndStr).order('visited_on', { ascending: false }),
      supabase.from('walk_sessions').select('id,started_at,created_at'),
    ]);
    setSrc({
      video: (cu.data ?? []).map((r: any) => ({ id: r.id, label: r.title })),
      music: (mu.data ?? []).filter((r: any) => String(r.created_at ?? '').slice(0, 7) === monthKey)
        .map((r: any) => ({ id: r.id, label: `${r.track_title} — ${r.artist}` })),
      book: (bk.data ?? []).map((r: any) => ({ id: r.id, label: r.title })),
      place: (pv.data ?? []).map((r: any) => ({ id: r.id, label: r.name })),
      walkCount: (wk.data ?? []).filter((r: any) => String((r.started_at ?? r.created_at) ?? '').slice(0, 7) === monthKey).length,
    });
  }, [monthKey, monthStartStr, monthEndStr]);
  useEffect(() => { loadSrc(); }, [loadSrc]);
  useRealtimeSync('culture_records', loadSrc);
  useRealtimeSync('music_records', loadSrc);
  useRealtimeSync('books', loadSrc);
  useRealtimeSync('place_visits', loadSrc);
  useRealtimeSync('walk_sessions', loadSrc);

  // ── 집중시간(월 버전) — 시간 리포트 엔진(aggregateRange) 재사용 ──
  const focus = useMemo(
    () => monthFocusReport(todos, tags, anchor, weekStartsOn, getLogicalToday()),
    [todos, tags, monthKey, weekStartsOn],
  );

  // ── 회고 + 베스트 (Stage 1 monthly_reviews 컬럼) ──
  const monthlyReview = monthlyReviews.find(r => r.month === monthKey);
  const ensureSaved = (partial: Partial<MonthlyReview>) => {
    if (monthlyReview) updateMonthlyReview(monthlyReview.id, partial);
    else addMonthlyReview({ month: monthKey, achievement: '', nextFocus: '', ...partial });
  };

  const [mHighlight, setMHighlight] = useState('');
  const [mDidWell, setMDidWell] = useState('');
  const [mRegret, setMRegret] = useState('');
  const [mNextFocus, setMNextFocus] = useState('');
  const [mKptKeep, setMKptKeep] = useState('');
  const [mKptProblem, setMKptProblem] = useState('');
  const [mKptTry, setMKptTry] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setMHighlight(monthlyReview?.highlight || '');
    setMDidWell(monthlyReview?.didWell || '');
    setMRegret(monthlyReview?.regret || '');
    setMNextFocus(monthlyReview?.nextFocus || '');
    setMKptKeep(monthlyReview?.kptKeep || '');
    setMKptProblem(monthlyReview?.kptProblem || '');
    setMKptTry(monthlyReview?.kptTry || '');
  }, [monthlyReview?.id, monthKey]);

  const saveReview = () => {
    ensureSaved({
      highlight: mHighlight, didWell: mDidWell, regret: mRegret, nextFocus: mNextFocus,
      kptKeep: mKptKeep, kptProblem: mKptProblem, kptTry: mKptTry,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  // 베스트 — 선택 즉시 저장(merge). 회고 텍스트/achievement 은 보존됨.
  const best = {
    video: monthlyReview?.bestVideo ?? '',
    music: monthlyReview?.bestMusic ?? '',
    book: monthlyReview?.bestBook ?? '',
    place: monthlyReview?.bestPlace ?? '',
  };

  // ── 과거 월간 리뷰(연도별 그룹 + 작년 같은 달 비교) ──
  const hasMonthText = (r: MonthlyReview) =>
    !!(r.highlight || r.didWell || r.regret || r.nextFocus || r.achievement ||
       r.bestVideo || r.bestMusic || r.bestBook || r.bestPlace ||
       r.kptKeep || r.kptProblem || r.kptTry);

  const lastYearKey = `${Number(monthKey.slice(0, 4)) - 1}-${monthKey.slice(5, 7)}`;
  const lastYearReview = monthlyReviews.find(r => r.month === lastYearKey);

  const pastGroups = useMemo(() => {
    const items = monthlyReviews
      .filter(r => r.month !== monthKey && hasMonthText(r))
      .sort((a, b) => b.month.localeCompare(a.month));
    const groups: { year: string; rows: MonthlyReview[] }[] = [];
    for (const r of items) {
      const year = r.month.slice(0, 4);
      let g = groups.find(x => x.year === year);
      if (!g) { g = { year, rows: [] }; groups.push(g); }
      g.rows.push(r);
    }
    return groups;
  }, [monthlyReviews, monthKey]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (yr: string, idx: number) => expanded[yr] ?? idx === 0;
  const toggleGroup = (yr: string, idx: number) =>
    setExpanded(prev => ({ ...prev, [yr]: !(prev[yr] ?? idx === 0) }));

  const inputStyle = {
    borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13, fontFamily: BODY_FONT,
  };

  const renderMonthCard = (r: MonthlyReview, anniversary = false) => {
    const preview = [r.highlight, r.didWell, r.achievement, r.nextFocus].filter(Boolean).join(' · ');
    const badges = [
      r.bestVideo && `🎬 ${r.bestVideo}`,
      r.bestMusic && `🎵 ${r.bestMusic}`,
      r.bestBook && `📖 ${r.bestBook}`,
      r.bestPlace && `📍 ${r.bestPlace}`,
    ].filter(Boolean) as string[];
    return (
      <button key={r.id} onClick={() => setAnchor(startOfMonth(parseISO(`${r.month}-01`)))}
        className="w-full text-left p-3 rounded-xl transition-colors"
        style={{ backgroundColor: anniversary ? t.accentLight : t.card, border: `1px solid ${anniversary ? t.accent : t.borderLight}` }}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {anniversary && <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>🕰 작년 같은 달</span>}
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            {format(parseISO(`${r.month}-01`), 'yyyy년 M월', { locale: ko })}
          </span>
        </div>
        {preview && (
          <p style={{ fontSize: 12, color: t.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
        )}
        {badges.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {badges.map((b, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: t.bgSub, color: t.textSub, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</span>
            ))}
          </div>
        )}
      </button>
    );
  };

  const monthNav = (
    <div className="flex items-center justify-center gap-3 mb-4">
      <button onClick={() => setAnchor(a => subMonths(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => setAnchor(startOfMonth(parseISO(getLogicalToday())))}
        style={{ fontSize: 15, fontWeight: 700, color: t.text, minWidth: 150, textAlign: 'center' }}>
        {format(anchor, 'yyyy년 M월', { locale: ko })}
        {!isCurrentMonth && <span style={{ fontSize: 11, color: t.accent, marginLeft: 6 }}>이번 달로</span>}
      </button>
      <button onClick={() => setAnchor(a => addMonths(a, 1))} className="p-2 rounded-lg" style={{ color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );

  // 4-1. 숫자로 보는 한 달 (자동집계, 입력 0)
  const statsBlock = (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 9 }}>숫자로 보는 한 달</h3>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: isDesktop ? 'repeat(6,1fr)' : 'repeat(3,1fr)' }}>
        <MiniCell value={monthTodos.length ? String(completionPct) : '–'} unit={monthTodos.length ? '%' : undefined} label="할일 완료율" />
        <MiniCell value={String(habitDays)} unit="일" label="습관 달성일" />
        <MiniCell value={String(src.book.length)} unit="권" label="읽은 책" />
        <MiniCell value={String(src.video.length)} unit="개" label="본 미디어" />
        <MiniCell value={String(src.walkCount)} unit="회" label="산책" />
        <MiniCell value={String(src.place.length)} unit="곳" label="다녀온 곳" />
      </div>
    </div>
  );

  // 4-2. 집중시간 분석 블록(월 버전 — 주차별 축)
  const focusBlock = (
    <FocusBlock
      totalMinutes={focus.totalMinutes}
      prevTotalMinutes={focus.prevTotalMinutes}
      deltaMinutes={focus.deltaMinutes}
      avgPerDayMinutes={focus.avgPerDayMinutes}
      prevLabel="달"
      bucketTitle="언제 — 주차별"
      buckets={focus.weekly.map(w => ({ key: w.key, label: w.label, isCurrent: w.isCurrent, totalMinutes: w.totalMinutes }))}
      byCategory={focus.byCategory}
      isDesktop={isDesktop}
      emptyText="이번 달 기록된 집중시간이 없어요"
      onMore={() => navigate('/time-report')}
    />
  );

  // 4-3. 이 달의 베스트 (하이브리드 픽)
  const bestBlock = (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 9 }}>이 달의 베스트</h3>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr' }}>
        <BestCategory emoji="🎬" label="영상" candidates={src.video} value={best.video} onChange={v => ensureSaved({ bestVideo: v })} />
        <BestCategory emoji="🎵" label="음악" candidates={src.music} value={best.music} onChange={v => ensureSaved({ bestMusic: v })} />
        <BestCategory emoji="📖" label="독서" candidates={src.book} value={best.book} onChange={v => ensureSaved({ bestBook: v })} />
        <BestCategory emoji="📍" label="장소" candidates={src.place} value={best.place} onChange={v => ensureSaved({ bestPlace: v })} />
      </div>
    </div>
  );

  // 4-4. 이 달의 회고
  const reviewForm = (
    <div className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>이 달의 회고 · {format(anchor, 'M월', { locale: ko })}</h3>
      <div className="space-y-3">
        <div>
          <LabelRow label="하이라이트" labelColor="#515f74" onVoiceResult={text => setMHighlight(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mHighlight} onChange={e => setMHighlight(e.target.value)} placeholder="이번 달 가장 기억에 남는 순간은?" rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="잘한 것" labelColor="#006b62" onVoiceResult={text => setMDidWell(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mDidWell} onChange={e => setMDidWell(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="후회·아쉬운 것" labelColor="#D4735A" onVoiceResult={text => setMRegret(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mRegret} onChange={e => setMRegret(e.target.value)} rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
        <div>
          <LabelRow label="다음 달 포커스" labelColor="#7B9ED9" onVoiceResult={text => setMNextFocus(prev => prev ? `${prev} ${text}` : text)} />
          <textarea value={mNextFocus} onChange={e => setMNextFocus(e.target.value)} placeholder="다음 달에 집중하고 싶은 것은?" rows={3}
            className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
        </div>
      </div>

      {/* 월간 KPT — 설정 ON 시 표시, 실제 저장(Stage 1 컬럼) */}
      {appSettings.showMonthlyKpt && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 10 }}>🔄 KPT 월간 회고</h4>
          <div className={isDesktop ? 'grid grid-cols-3 gap-3' : 'space-y-3'}>
            <div>
              <LabelRow label="Keep" labelColor="#006b62" onVoiceResult={text => setMKptKeep(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={mKptKeep} onChange={e => setMKptKeep(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Problem" labelColor="#D4735A" onVoiceResult={text => setMKptProblem(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={mKptProblem} onChange={e => setMKptProblem(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
            <div>
              <LabelRow label="Try" labelColor="#7B9ED9" onVoiceResult={text => setMKptTry(prev => prev ? `${prev} ${text}` : text)} />
              <textarea value={mKptTry} onChange={e => setMKptTry(e.target.value)} rows={isDesktop ? 4 : 2}
                className="w-full rounded-lg px-3 py-2 border outline-none resize-none" style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      <button onClick={saveReview}
        className="w-full mt-4 py-2.5 rounded-xl transition-colors"
        style={{ fontSize: 13, fontWeight: 600, backgroundColor: savedFlash ? t.success : t.accent, color: '#fff' }}>
        {savedFlash ? '저장됨 ✓' : '저장'}
      </button>
    </div>
  );

  const pastBlock = (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
        <Clock size={13} /> 지난 월간 리뷰
      </h3>
      {lastYearReview && hasMonthText(lastYearReview) && renderMonthCard(lastYearReview, true)}
      {pastGroups.length === 0 && !(lastYearReview && hasMonthText(lastYearReview)) ? (
        <p style={{ fontSize: 12, color: t.textMuted, padding: '12px 0' }}>아직 지난 월간 리뷰가 없어요</p>
      ) : (
        pastGroups.map((g, gi) => (
          <div key={g.year} className="space-y-2">
            <button onClick={() => toggleGroup(g.year, gi)} className="flex items-center gap-1 w-full mt-1"
              style={{ fontSize: 12, fontWeight: 700, color: t.textSub }}>
              <ChevronDown size={14} style={{ transform: isExpanded(g.year, gi) ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
              {g.year}년
              <span style={{ color: t.textMuted, fontWeight: 400 }}>· {g.rows.length}건</span>
            </button>
            {isExpanded(g.year, gi) && g.rows.map(r => renderMonthCard(r))}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      {monthNav}
      {isDesktop ? (
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0 space-y-5">
            {statsBlock}
            {focusBlock}
            {bestBlock}
            {reviewForm}
          </div>
          <div className="flex-shrink-0" style={{ width: 340 }}>
            <div style={{ position: 'sticky', top: 12 }}>{pastBlock}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {statsBlock}
          {focusBlock}
          {bestBlock}
          {reviewForm}
          {pastBlock}
        </div>
      )}
    </div>
  );
}

export function ReviewsView() {
  const { reviewRecords } = usePlanner();
  const { t } = useTheme();
  // 'list' 는 탭 UI 에서 제거되었지만 과거 기록 승계 대비로 union·블록은 보존(진입 불가)
  const [tab, setTab] = useState<'day' | 'week' | 'month' | 'list'>('day');

  const tabs = [
    { key: 'day', label: '일간' },
    { key: 'week', label: '주간' },
    { key: 'month', label: '월간' },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>리뷰 & 기록</h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>매일의 기록이 성장의 발판이 됩니다</p>
        </div>
        {/* 🔍 검색 — Stage 5 에서 연결(현재 placeholder) */}
        <button type="button" disabled title="검색 (준비 중)"
          className="flex items-center justify-center rounded-xl"
          style={{ width: 38, height: 38, backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}`, color: t.textMuted, opacity: 0.5, cursor: 'not-allowed' }}>
          <Search size={17} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 mb-4">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className="px-4 py-2 rounded-xl transition-all"
            style={{
              fontSize: 13, fontWeight: tab === tb.key ? 600 : 400,
              backgroundColor: tab === tb.key ? t.accent : t.bgSub,
              color: tab === tb.key ? '#fff' : t.textSub,
            }}>{tb.label}</button>
        ))}
      </div>

      <div className="px-6 pb-8">
        {/* 일간 탭 */}
        {tab === 'day' && <DayTab />}

        {/* List Tab — 진입 제거(보존). 후속 "돌아보기"에서 과거 daily/happiness 기록 승계 예정 */}
        {tab === 'list' && (
          <div className="space-y-3">
            {reviewRecords.length === 0 && (
              <p className="text-center py-8" style={{ fontSize: 13, color: t.textMuted }}>아직 기록이 없습니다</p>
            )}
            {[...reviewRecords].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
              <div key={record.id} className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{record.date}</span>
                  <div className="flex gap-1">
                    {record.types.map(ty => {
                      const rt = RECORD_TYPES.find(r => r.key === ty);
                      return rt ? (
                        <span key={ty} className="px-2 py-0.5 rounded-full"
                          style={{ fontSize: 9, backgroundColor: t.accentLight, color: t.accent }}>
                          {rt.emoji} {rt.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                {record.dailySummary && (
                  <p style={{ fontSize: 12, color: t.textSub }}>📔 {record.dailySummary}</p>
                )}
                {record.gratitude && record.gratitude.length > 0 && (
                  <p style={{ fontSize: 12, color: t.textSub }}>🙏 {record.gratitude.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 주간 탭 — 통계 정확화 + 회고(KPT) + 과거(월별 그룹·작년 비교) */}
        {tab === 'week' && <WeekTab />}

        {/* 월간 탭 — 자동집계 + 집중블록(주차) + 베스트(하이브리드 픽) + 회고 + 과거(연도별·작년 비교) */}
        {tab === 'month' && <MonthTab />}
      </div>
    </div>
  );
}
