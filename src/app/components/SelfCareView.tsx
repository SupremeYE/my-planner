import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Dumbbell, BookOpen, Sparkles, Moon, ChevronDown, ChevronLeft, ChevronRight, Heart, Trash2, Pencil, Sun, Search } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePlanner, SelfCareRecord, SLEEP_GOAL_DEFAULT_MIN } from '../store';
import { useTheme } from '../ThemeContext';
import { format, subDays, differenceInDays, parseISO, addDays, startOfWeek } from 'date-fns';

const CATEGORIES = [
  { key: 'exercise' as const, label: '운동 & 피트니스', icon: Dumbbell, color: '#D4735A' },
  { key: 'study' as const, label: '퇴근 후 공부', icon: BookOpen, color: '#7B9ED9' },
  { key: 'beauty' as const, label: '뷰티 & 케어', icon: Sparkles, color: '#A07BE0' },
];

const SLEEP_COLOR = '#5B8ED4';
const PERIOD_COLOR = '#E07899';

const SYMPTOM_OPTIONS = ['두통', '복통', '피로', '부종', '기분변화', '요통', '메스꺼움', '가슴통증'];
const FLOW_OPTIONS: { key: 'light' | 'medium' | 'heavy'; label: string; emoji: string }[] = [
  { key: 'light', label: '적음', emoji: '🩸' },
  { key: 'medium', label: '보통', emoji: '🩸🩸' },
  { key: 'heavy', label: '많음', emoji: '🩸🩸🩸' },
];

function calcSleepMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60; // 기상이 취침보다 이른 시각 → 다음날 기상
  return diff;
}

function fmtSleep(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// HH:mm 시각들의 원형 평균(자정 넘김 안전) — 분 단위(0..1440) + 원형 표준편차 분
function circularMeanHHMM(times: string[]): { mean: number; stdMin: number } | null {
  if (times.length === 0) return null;
  let sumX = 0, sumY = 0;
  for (const s of times) {
    const [h, m] = s.split(':').map(Number);
    const angle = ((h * 60 + m) / 1440) * 2 * Math.PI;
    sumX += Math.cos(angle);
    sumY += Math.sin(angle);
  }
  const meanX = sumX / times.length;
  const meanY = sumY / times.length;
  const R = Math.sqrt(meanX * meanX + meanY * meanY);
  let theta = Math.atan2(meanY, meanX);
  if (theta < 0) theta += 2 * Math.PI;
  const mean = (theta / (2 * Math.PI)) * 1440;
  // 원형 표준편차(rad) → 분
  const stdMin = R > 0 && R <= 1
    ? Math.sqrt(-2 * Math.log(R)) * (1440 / (2 * Math.PI))
    : 0;
  return { mean, stdMin };
}

// 분 → "HH:mm" (24시간 normalize)
function minutesToHHMM(m: number): string {
  const total = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// 원형 차이(분) — b 가 a 보다 얼마나 늦은지 (-720~720), 자정 넘김 안전
function circularDiffMin(a: number, b: number): number {
  let d = b - a;
  d = ((d % 1440) + 1440) % 1440;
  if (d > 720) d -= 1440;
  return d;
}

export function PeriodSection() {
  const { periodRecords, addPeriodRecord, updatePeriodRecord, deletePeriodRecord } = usePlanner();
  const { t } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // 폼 상태
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [flowLevel, setFlowLevel] = useState<'light' | 'medium' | 'heavy' | null>(null);
  const [memo, setMemo] = useState('');

  const sorted = [...periodRecords].sort((a, b) => b.startDate.localeCompare(a.startDate));

  // 평균 주기 계산 (최근 기록 기반)
  const prediction = (() => {
    if (sorted.length < 2) return null;
    const cycles: number[] = [];
    for (let i = 0; i < Math.min(sorted.length - 1, 5); i++) {
      const diff = differenceInDays(parseISO(sorted[i].startDate), parseISO(sorted[i + 1].startDate));
      if (diff > 0 && diff < 60) cycles.push(diff);
    }
    if (cycles.length === 0) return null;
    const avgCycle = Math.round(cycles.reduce((s, c) => s + c, 0) / cycles.length);
    const nextStart = format(addDays(parseISO(sorted[0].startDate), avgCycle), 'yyyy-MM-dd');
    return { avgCycle, nextStart };
  })();

  const resetForm = () => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate('');
    setSymptoms([]);
    setFlowLevel(null);
    setMemo('');
    setEditId(null);
  };

  const handleOpenForm = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (r: (typeof sorted)[number]) => {
    setEditId(r.id);
    setStartDate(r.startDate);
    setEndDate(r.endDate ?? '');
    setSymptoms([...r.symptoms]);
    setFlowLevel(r.flowLevel);
    setMemo(r.memo ?? '');
    setShowForm(true);
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!startDate) return;
    const record = {
      startDate,
      endDate: endDate || null,
      symptoms,
      flowLevel,
      memo: memo || null,
    };
    if (editId) {
      updatePeriodRecord(editId, record);
    } else {
      addPeriodRecord(record);
    }
    setShowForm(false);
    resetForm();
  };

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const fmtDate = (d: string) => d.slice(5).replace('-', '/');

  const cycleLabelColor = (days: number) =>
    days >= 21 && days <= 35 ? PERIOD_COLOR : '#D4735A';

  return (
    <div className="mb-6">
      {/* 섹션 헤더 (접기/펼치기) */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-2 w-full mb-3 text-left"
      >
        <Heart size={16} color={PERIOD_COLOR} fill={isOpen ? PERIOD_COLOR : 'none'} />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>생리 기록</span>
        {prediction && !isOpen && (
          <span className="ml-2 px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: PERIOD_COLOR + '18', color: PERIOD_COLOR }}>
            다음 예상 {fmtDate(prediction.nextStart)}
          </span>
        )}
        <span className="ml-auto" style={{ color: t.textMuted }}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {isOpen && (
        <div>
          {/* 예측 카드 */}
          {prediction && (
            <div className="p-3 rounded-xl mb-3 flex items-center gap-4"
              style={{ backgroundColor: PERIOD_COLOR + '12', border: `1px solid ${PERIOD_COLOR}30` }}>
              <div className="flex-1 text-center">
                <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>평균 주기</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: cycleLabelColor(prediction.avgCycle), fontFamily: 'var(--font-gmarket)' }}>
                  {prediction.avgCycle}일
                </div>
              </div>
              <div style={{ width: 1, backgroundColor: PERIOD_COLOR + '30', flexShrink: 0 }} />
              <div className="flex-1 text-center">
                <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>다음 예상 시작일</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: PERIOD_COLOR }}>
                  {fmtDate(prediction.nextStart)}
                </div>
              </div>
            </div>
          )}

          {/* 기록 추가/편집 폼 */}
          {showForm ? (
            <div className="p-4 rounded-xl mb-3" style={{ backgroundColor: t.card, border: `1px solid ${PERIOD_COLOR}40` }}>
              {/* 날짜 행 */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작일 *</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                    style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>종료일</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
                    style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
                </div>
              </div>

              {/* 흘림양 */}
              <div className="mb-3">
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>흘림양</label>
                <div className="flex gap-2 mt-1.5">
                  {FLOW_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => setFlowLevel(flowLevel === opt.key ? null : opt.key)}
                      className="flex-1 py-2 rounded-lg flex items-center justify-center gap-1"
                      style={{
                        fontSize: 12, fontWeight: 600,
                        backgroundColor: flowLevel === opt.key ? PERIOD_COLOR : t.bgSub,
                        color: flowLevel === opt.key ? '#fff' : t.text,
                        border: `1px solid ${flowLevel === opt.key ? PERIOD_COLOR : t.border}`,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 증상 체크박스 */}
              <div className="mb-3">
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>증상 (복수 선택)</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {SYMPTOM_OPTIONS.map(s => (
                    <button key={s} onClick={() => toggleSymptom(s)}
                      className="px-2.5 py-1 rounded-full transition-colors"
                      style={{
                        fontSize: 11, fontWeight: 600,
                        backgroundColor: symptoms.includes(s) ? PERIOD_COLOR + '25' : t.bgSub,
                        color: symptoms.includes(s) ? PERIOD_COLOR : t.textMuted,
                        border: `1px solid ${symptoms.includes(s) ? PERIOD_COLOR : t.border}`,
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모 */}
              <div className="mb-4">
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>메모 (선택)</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="증상이나 특이사항을 입력하세요"
                  rows={2}
                  className="w-full mt-1 rounded-lg px-3 py-2 border outline-none resize-none"
                  style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); resetForm(); }}
                  className="flex-1 py-2 rounded-xl" style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}>
                  취소
                </button>
                <button onClick={handleSave} disabled={!startDate}
                  className="flex-1 py-2 rounded-xl" style={{
                    fontSize: 13, fontWeight: 600,
                    backgroundColor: startDate ? PERIOD_COLOR : t.bgSub,
                    color: startDate ? '#fff' : t.textMuted,
                  }}>
                  {editId ? '수정' : '기록하기'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={handleOpenForm}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl mb-3 transition-colors"
              style={{ border: `1.5px dashed ${PERIOD_COLOR}60`, color: PERIOD_COLOR, fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} /> 기록 추가
            </button>
          )}

          {/* 기록 목록 */}
          <div className="space-y-2">
            {sorted.slice(0, 6).map(r => {
              const duration = r.endDate
                ? differenceInDays(parseISO(r.endDate), parseISO(r.startDate)) + 1
                : null;
              return (
                <div key={r.id} className="px-4 py-3 rounded-xl"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <div className="flex items-center gap-2">
                    <Heart size={12} color={PERIOD_COLOR} fill={PERIOD_COLOR} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {fmtDate(r.startDate)}
                      {r.endDate ? ` ~ ${fmtDate(r.endDate)}` : ''}
                    </span>
                    {duration && (
                      <span className="px-1.5 py-0.5 rounded-full ml-1"
                        style={{ fontSize: 10, backgroundColor: PERIOD_COLOR + '18', color: PERIOD_COLOR, fontWeight: 600 }}>
                        {duration}일
                      </span>
                    )}
                    {r.flowLevel && (
                      <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 2 }}>
                        {FLOW_OPTIONS.find(f => f.key === r.flowLevel)?.label}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => handleEdit(r)} className="p-1 rounded"
                        style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => deletePeriodRecord(r.id)} className="p-1 rounded"
                        style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {r.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.symptoms.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded-full"
                          style={{ fontSize: 9, backgroundColor: PERIOD_COLOR + '15', color: PERIOD_COLOR }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.memo && (
                    <p className="mt-1" style={{ fontSize: 11, color: t.textMuted }}>{r.memo}</p>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <p style={{ fontSize: 12, color: t.textMuted, padding: '4px 0' }}>아직 생리 기록이 없습니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 인라인 시간 수정 입력
function TimeEditInput({ value, onChange, onDone }: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <input
      ref={ref}
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') onDone(); }}
      className="outline-none bg-transparent text-center"
      style={{ fontSize: 22, fontWeight: 700, color: SLEEP_COLOR, width: '100%', border: 'none' }}
    />
  );
}

export function SleepSection() {
  const { selfCareRecords, addSelfCareRecord, deleteSelfCareRecord, appSettings } = usePlanner();
  const { t } = useTheme();
  const sleepGoalMin = appSettings.sleepGoalMinutes ?? SLEEP_GOAL_DEFAULT_MIN;
  const sleepGoalHours = sleepGoalMin / 60;
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sleepStart, setSleepStart] = useState('');
  const [sleepEnd, setSleepEnd] = useState('');
  const [editingField, setEditingField] = useState<'start' | 'end' | null>(null);
  const [inputOpen, setInputOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0=이번주, -1=지난주 ...

  // 기록 영역 필터/검색 (컨디션 탭과 동일 패턴)
  // 기본값 = 오늘(로컬 기준) — 탭 진입 시 오늘 날짜로 필터된 상태로 시작
  const [selectedDate, setSelectedDate] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [listLimit, setListLimit] = useState(5);

  const formRef = useRef<HTMLDivElement>(null); // 입력 카드 — 넛지에서 열 때 스크롤 대상

  const nowHHMM = () => format(new Date(), 'HH:mm');

  // 날짜 칸(주간 막대) 클릭 → 그 날짜로 필터 / 같은 날 재클릭 시 해제
  // 검색과 날짜 필터는 동시 적용하지 않으므로 날짜 선택 시 검색은 닫고 비운다
  const toggleDate = (d: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSelectedDate(prev => (prev === d ? null : d));
  };

  // 돋보기 토글 — 열면 날짜 필터 해제, 닫으면 검색어 비워 전체로 복귀
  const toggleSearch = () => {
    setSearchOpen(prev => {
      const next = !prev;
      if (next) setSelectedDate(null);
      else setSearchQuery('');
      return next;
    });
  };

  // 빈 날 넛지 [수면 기록하기] → 기존 인라인 입력 카드를 그 날짜로 prefill하여 연다
  const openRecordFor = (d: string) => {
    setSleepStart('');
    setSleepEnd('');
    setEditingField(null);
    setDate(d);
    setInputOpen(true);
  };

  // 입력 카드가 열리면 화면에 보이도록 스크롤
  useEffect(() => {
    if (inputOpen) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [inputOpen]);

  const sleepRecords = selfCareRecords
    .filter(r => r.category === 'sleep')
    .sort((a, b) => b.date.localeCompare(a.date));

  const previewMin = sleepStart && sleepEnd ? calcSleepMinutes(sleepStart, sleepEnd) : 0;

  const handleAdd = () => {
    if (!sleepStart || !sleepEnd) return;
    addSelfCareRecord({
      date,
      category: 'sleep',
      content: `${sleepStart} ~ ${sleepEnd}`,
      duration: previewMin,
      sleepStart,
      sleepEnd,
    });
    setSleepStart('');
    setSleepEnd('');
    setEditingField(null);
    setInputOpen(false);
    // 방금 기록한 날짜가 속한 주로 차트를 이동해 바로 확인 가능하게
    const recMonday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
    const curMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    setWeekOffset(Math.round(differenceInDays(recMonday, curMonday) / 7));
  };

  // 통계
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = format(today, 'yyyy-MM');

  // 선택된 주(월~일) 데이터 — weekOffset: 0=이번주, -1=지난주 ...
  const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
  const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

  // 보고 있는 주가 가장 많이 걸쳐 있는 달 기준으로 월간 통계 집계
  const monthCounts: Record<string, number> = {};
  weekDays.forEach(d => { const m = d.slice(0, 7); monthCounts[m] = (monthCounts[m] ?? 0) + 1; });
  const viewMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0][0];
  const monthRecords = sleepRecords.filter(r => r.date.startsWith(viewMonth));
  const monthAvg = monthRecords.length
    ? Math.round(monthRecords.reduce((s, r) => s + r.duration, 0) / monthRecords.length)
    : 0;
  const monthLabel = viewMonth === currentMonth ? '이번달 평균' : `${parseInt(viewMonth.slice(5), 10)}월 평균`;
  const sleepByDate: Record<string, { duration: number; start?: string; end?: string }> = {};
  sleepRecords.forEach(r => {
    if (!sleepByDate[r.date]) sleepByDate[r.date] = { duration: r.duration, start: r.sleepStart, end: r.sleepEnd };
  });
  const weekData = weekDays.map((d, i) => ({
    date: d,
    label: WEEK_LABELS[i],
    isToday: d === todayStr,
    duration: sleepByDate[d]?.duration ?? 0,
    start: sleepByDate[d]?.start,
    end: sleepByDate[d]?.end,
  }));
  const weekWithData = weekData.filter(d => d.duration > 0);
  const weekAvg = weekWithData.length
    ? Math.round(weekWithData.reduce((s, d) => s + d.duration, 0) / weekWithData.length)
    : 0;
  // 그래프 기준: 최대 10시간(600분) 또는 실제 최대값
  const maxBar = Math.max(...weekData.map(d => d.duration), 10 * 60);

  const weekRangeLabel = `${format(weekStart, 'M.d')} – ${format(weekEnd, 'M.d')}`;
  const weekTitle = weekOffset === 0 ? '이번주' : weekOffset === -1 ? '지난주' : weekRangeLabel;

  const hasStats = sleepRecords.length > 0;

  // 최근 30일 수면시간 추이 (오름차순) — 기록이 있는 날만 점 표시
  const trend = useMemo(() => {
    const cutoff = format(subDays(today, 29), 'yyyy-MM-dd');
    return sleepRecords
      .filter(r => r.date >= cutoff)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ date: r.date.slice(5), hours: +(r.duration / 60).toFixed(2), minutes: r.duration }));
  }, [sleepRecords, today]);

  // 최근 30일 취침·기상 규칙성 — sleepStart/sleepEnd 가 있는 기록만 사용
  const regularity = useMemo(() => {
    const cutoff = format(subDays(today, 29), 'yyyy-MM-dd');
    const recent = sleepRecords.filter(r => r.date >= cutoff && r.sleepStart && r.sleepEnd);
    const starts = recent.map(r => r.sleepStart as string);
    const ends = recent.map(r => r.sleepEnd as string);
    const startStat = circularMeanHHMM(starts);
    const endStat = circularMeanHHMM(ends);

    // 주중(월~금)/주말(토·일) 분리 — date-fns getDay(): 0=일, 6=토
    const weekdayStarts: string[] = [];
    const weekendStarts: string[] = [];
    recent.forEach(r => {
      const dow = parseISO(r.date).getDay();
      const isWeekend = dow === 0 || dow === 6;
      (isWeekend ? weekendStarts : weekdayStarts).push(r.sleepStart as string);
    });
    const weekdayStat = circularMeanHHMM(weekdayStarts);
    const weekendStat = circularMeanHHMM(weekendStarts);
    const weekendOffsetMin = weekdayStat && weekendStat
      ? circularDiffMin(weekdayStat.mean, weekendStat.mean)
      : null;

    return {
      count: recent.length,
      weekdayCount: weekdayStarts.length,
      weekendCount: weekendStarts.length,
      startStat, endStat, weekdayStat, weekendStat, weekendOffsetMin,
    };
  }, [sleepRecords, today]);
  // Y축 상한: 최대 기록과 권장선 중 큰 값 + 1시간 여유, 최소 10시간
  const trendMax = Math.max(10, Math.ceil(Math.max(sleepGoalHours, ...trend.map(d => d.hours))) + 1);
  const trendTicks = Array.from({ length: Math.floor(trendMax / 2) + 1 }, (_, i) => i * 2);

  // 취침/기상 버튼 공통 렌더
  const renderTimeSlot = (
    field: 'start' | 'end',
    label: string,
    Icon: React.ElementType,
    value: string,
    setter: (v: string) => void,
  ) => {
    const isEmpty = !value;
    const isEditing = editingField === field;

    return (
      <div
        className="flex-1 rounded-2xl p-3 lg:p-4 flex flex-col items-center gap-1"
        style={{
          backgroundColor: isEmpty ? t.bgSub : SLEEP_COLOR + '12',
          border: `1.5px solid ${isEmpty ? t.borderLight : SLEEP_COLOR + '40'}`,
          minWidth: 0,
        }}
      >
        <div className="flex items-center gap-1 mb-1" style={{ fontSize: 10, color: SLEEP_COLOR, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <Icon size={11} />
          {label}
        </div>

        {isEditing ? (
          <TimeEditInput
            value={value}
            onChange={setter}
            onDone={() => setEditingField(null)}
          />
        ) : isEmpty ? (
          <button
            onClick={() => { setter(nowHHMM()); setEditingField(null); }}
            className="w-full rounded-xl py-2.5 mt-0.5 transition-colors"
            style={{ backgroundColor: SLEEP_COLOR, color: '#fff', fontSize: 12, fontWeight: 700 }}
          >
            지금 기록
          </button>
        ) : (
          <>
            <button
              onClick={() => setEditingField(field)}
              style={{ fontSize: 22, fontWeight: 700, color: SLEEP_COLOR, lineHeight: 1, background: 'none', border: 'none', cursor: 'text' }}
            >
              {value}
            </button>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setter(nowHHMM())}
                className="rounded-full px-2 py-0.5"
                style={{ fontSize: 9, color: t.textMuted, border: `1px solid ${t.borderLight}`, background: 'none' }}
              >
                지금으로
              </button>
              <button
                onClick={() => { setter(''); setEditingField(null); }}
                style={{ color: t.textMuted, background: 'none', border: 'none' }}
              >
                <X size={11} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Moon size={16} color={SLEEP_COLOR} />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>수면</span>
        {monthRecords.length > 0 && (
          <span className="ml-auto px-2.5 py-0.5 rounded-full"
            style={{ fontSize: 10, backgroundColor: SLEEP_COLOR + '20', color: SLEEP_COLOR }}>
            {monthRecords.length}회 &middot; {monthLabel} {fmtSleep(monthAvg)}
          </span>
        )}
      </div>

      {/* 입력 폼 토글 버튼 (기본 접힘) */}
      {!inputOpen && (
        <button
          onClick={() => setInputOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl mb-3 transition-colors"
          style={{ fontSize: 13, fontWeight: 700, color: '#fff', backgroundColor: SLEEP_COLOR }}
        >
          <Plus size={15} /> 수면 기록하기
        </button>
      )}

      {/* 입력 카드 (펼침 상태에서만) */}
      {inputOpen && (
      <div ref={formRef} className="p-3 lg:p-4 rounded-2xl mb-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        {/* 입력 헤더 + 닫기 */}
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 12, fontWeight: 700, color: SLEEP_COLOR }}>수면 기록</span>
          <button
            onClick={() => { setInputOpen(false); setEditingField(null); }}
            className="p-1 rounded"
            style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="닫기"
          >
            <X size={15} />
          </button>
        </div>
        {/* 날짜 */}
        <div className="mb-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl px-3 py-2 border outline-none"
            style={{ borderColor: t.borderLight, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
          />
        </div>

        {/* 취침 / 기상 버튼 */}
        <div className="flex gap-2 mb-3">
          {renderTimeSlot('start', '취침', Moon, sleepStart, setSleepStart)}
          {renderTimeSlot('end', '기상', Sun, sleepEnd, setSleepEnd)}
        </div>

        {/* 수면 시간 자동 계산 */}
        <div className="flex items-center justify-center mb-3" style={{ minHeight: 28 }}>
          {previewMin > 0 ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{ backgroundColor: SLEEP_COLOR + '15', border: `1px solid ${SLEEP_COLOR}30` }}>
              <Moon size={12} color={SLEEP_COLOR} />
              <span style={{ fontSize: 13, fontWeight: 700, color: SLEEP_COLOR }}>수면 {fmtSleep(previewMin)}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: t.textMuted }}>취침·기상 시각을 기록하면 수면시간이 계산됩니다</span>
          )}
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleAdd}
          disabled={!sleepStart || !sleepEnd}
          className="w-full py-2.5 rounded-xl transition-colors"
          style={{
            fontSize: 13, fontWeight: 700,
            backgroundColor: sleepStart && sleepEnd ? SLEEP_COLOR : t.bgSub,
            color: sleepStart && sleepEnd ? '#fff' : t.textMuted,
            cursor: sleepStart && sleepEnd ? 'pointer' : 'default',
          }}
        >
          기록하기
        </button>
      </div>
      )}

      {/* 통계 + 주간 그래프 */}
      {hasStats && (
        <div className="p-3 lg:p-4 rounded-2xl mb-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          {/* 통계 카드 */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center">
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>
                {weekOffset === 0 ? '이번주 평균' : '주간 평균'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>
                {weekAvg > 0 ? fmtSleep(weekAvg) : '—'}
              </div>
            </div>
            <div style={{ width: 1, backgroundColor: t.borderLight, flexShrink: 0 }} />
            <div className="flex-1 text-center">
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>{monthLabel}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>
                {monthAvg > 0 ? fmtSleep(monthAvg) : '—'}
              </div>
            </div>
          </div>

          {/* 주간 바 차트 + 주 이동 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setWeekOffset(o => o - 1)}
                className="p-1 rounded-lg transition-colors"
                style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="이전 주"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{weekTitle} 수면</div>
                <div style={{ fontSize: 9, color: t.textMuted, marginTop: 1 }}>{weekRangeLabel}</div>
              </div>
              <button
                onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
                disabled={weekOffset >= 0}
                className="p-1 rounded-lg transition-colors"
                style={{ color: weekOffset >= 0 ? t.borderLight : t.textMuted, background: 'none', border: 'none', cursor: weekOffset >= 0 ? 'default' : 'pointer' }}
                aria-label="다음 주"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }}>
              {weekData.map(d => {
                const isGood = d.duration >= 7 * 60;
                const barColor = d.duration === 0
                  ? t.borderLight
                  : isGood ? SLEEP_COLOR : '#D4735A';
                // 바 높이: 72px 기준
                const barH = d.duration > 0 ? Math.max(8, Math.round((d.duration / maxBar) * 72)) : 4;
                const hLabel = d.duration > 0
                  ? (d.duration >= 60 ? `${Math.floor(d.duration / 60)}h${d.duration % 60 > 0 ? (d.duration % 60) + 'm' : ''}` : `${d.duration}m`)
                  : '';
                const isSelected = selectedDate === d.date;

                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => toggleDate(d.date)}
                    aria-pressed={isSelected}
                    title={d.duration > 0 ? `${d.start ?? '?'} ~ ${d.end ?? '?'} · ${fmtSleep(d.duration)}` : d.date}
                    className="flex flex-col items-center flex-1 rounded-lg py-1 transition-colors"
                    style={{
                      minWidth: 0,
                      background: isSelected ? `${SLEEP_COLOR}14` : 'none',
                      border: `1px solid ${isSelected ? SLEEP_COLOR : 'transparent'}`,
                      boxShadow: isSelected ? `0 0 0 2px ${SLEEP_COLOR}40` : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {/* 수면시간 레이블 */}
                    <span style={{ fontSize: 8, color: barColor, fontWeight: 700, height: 14, lineHeight: '14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {hLabel}
                    </span>
                    {/* 바 */}
                    <div
                      style={{
                        width: '70%',
                        minWidth: 8,
                        height: barH,
                        backgroundColor: barColor,
                        borderRadius: '4px 4px 2px 2px',
                        transition: 'height 0.3s',
                      }}
                    />
                    {/* 요일 레이블 */}
                    <span style={{ fontSize: 9, color: d.isToday ? SLEEP_COLOR : t.textMuted, marginTop: 4, fontWeight: d.isToday ? 700 : 400 }}>
                      {d.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* 범례 */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SLEEP_COLOR, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: t.textMuted }}>7시간 이상 (권장)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#D4735A', flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: t.textMuted }}>7시간 미만</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 최근 30일 수면 추이 선그래프 — 컨디션 탭 30일 추이와 동일 위치/형태 */}
      <div className="p-3 lg:p-4 rounded-2xl mb-3 flex flex-col" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <div className="flex items-baseline justify-between mb-2">
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>최근 30일 수면 추이</p>
          <p style={{ fontSize: 10, color: t.textMuted }}>
            권장 <span style={{ color: SLEEP_COLOR, fontWeight: 700 }}>{fmtSleep(sleepGoalMin)}</span>
          </p>
        </div>
        {trend.length >= 2 ? (
          <div className="min-h-[200px]" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.borderLight} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0, trendMax]}
                  ticks={trendTicks}
                  tick={{ fontSize: 10, fill: t.textMuted }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}h`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: `1px solid ${t.borderLight}`, backgroundColor: t.card }}
                  formatter={(_v: number, _n, p) => [fmtSleep((p.payload as { minutes: number }).minutes), '수면']}
                />
                <ReferenceLine
                  y={sleepGoalHours}
                  stroke={SLEEP_COLOR}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: '권장', position: 'right', fontSize: 10, fill: SLEEP_COLOR }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke={SLEEP_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: SLEEP_COLOR, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="min-h-[200px] flex items-center justify-center text-center" style={{ fontSize: 13, color: t.textMuted }}>
            기록이 쌓이면 추이가 표시됩니다
          </div>
        )}
      </div>

      {/* 최근 30일 취침·기상 규칙성 */}
      <div className="p-3 lg:p-4 rounded-2xl mb-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <div className="flex items-baseline justify-between mb-3">
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>취침·기상 규칙성</p>
          <p style={{ fontSize: 10, color: t.textMuted }}>최근 30일 · 기록 {regularity.count}일</p>
        </div>

        {regularity.count < 3 ? (
          <div className="py-6 text-center" style={{ fontSize: 13, color: t.textMuted }}>
            취침·기상 시각이 3일 이상 모이면 규칙성을 보여드릴게요
          </div>
        ) : (
          <>
            {/* 평균 취침 / 평균 기상 */}
            <div className="flex gap-4 mb-3">
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1 mb-1" style={{ fontSize: 10, color: SLEEP_COLOR, fontWeight: 700, letterSpacing: '0.06em' }}>
                  <Moon size={10} /> 평균 취침
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>
                  {regularity.startStat ? minutesToHHMM(regularity.startStat.mean) : '—'}
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  편차 ±{regularity.startStat ? Math.round(regularity.startStat.stdMin) : 0}분
                </div>
              </div>
              <div style={{ width: 1, backgroundColor: t.borderLight, flexShrink: 0 }} />
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1 mb-1" style={{ fontSize: 10, color: SLEEP_COLOR, fontWeight: 700, letterSpacing: '0.06em' }}>
                  <Sun size={10} /> 평균 기상
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>
                  {regularity.endStat ? minutesToHHMM(regularity.endStat.mean) : '—'}
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                  편차 ±{regularity.endStat ? Math.round(regularity.endStat.stdMin) : 0}분
                </div>
              </div>
            </div>

            {/* 주중/주말 인사이트 */}
            {regularity.weekdayCount > 0 && regularity.weekendCount > 0 && regularity.weekendOffsetMin != null ? (
              <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: `${SLEEP_COLOR}10`, border: `1px solid ${SLEEP_COLOR}30` }}>
                <p style={{ fontSize: 12, color: t.text, lineHeight: 1.5 }}>
                  {(() => {
                    const diff = regularity.weekendOffsetMin;
                    const wd = regularity.weekdayStat ? minutesToHHMM(regularity.weekdayStat.mean) : '—';
                    const we = regularity.weekendStat ? minutesToHHMM(regularity.weekendStat.mean) : '—';
                    if (Math.abs(diff) < 10) {
                      return (
                        <>
                          주중·주말 취침 시각이 비슷해요 (<b style={{ color: SLEEP_COLOR }}>{wd}</b> vs <b style={{ color: SLEEP_COLOR }}>{we}</b>)
                        </>
                      );
                    }
                    const dir = diff > 0 ? '늦게' : '일찍';
                    const min = Math.abs(Math.round(diff));
                    return (
                      <>
                        주말엔 평균 <b style={{ color: SLEEP_COLOR }}>{min}분 {dir}</b> 잠들어요 (주중 {wd} · 주말 {we})
                      </>
                    );
                  })()}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: t.textMuted, textAlign: 'center', padding: '4px 0' }}>
                주중·주말 비교는 양쪽 요일에 기록이 모두 있을 때 표시돼요
              </p>
            )}
          </>
        )}
      </div>

      {/* 기록 영역 (컨디션 탭 패턴) */}
      {(() => {
        const q = searchQuery.trim().toLowerCase();
        const displayed = q
          ? sleepRecords.filter(r => {
              const dur = fmtSleep(r.duration).toLowerCase();
              return (
                r.date.toLowerCase().includes(q) ||
                (r.content ?? '').toLowerCase().includes(q) ||
                dur.includes(q)
              );
            })
          : selectedDate
            ? sleepRecords.filter(r => r.date === selectedDate)
            : sleepRecords.slice(0, listLimit);
        const isDefaultView = !q && !selectedDate;

        return (
          <div>
            {/* 헤더: 제목 + 돋보기 */}
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>기록</p>
              <button onClick={toggleSearch} aria-label="검색" aria-pressed={searchOpen}
                className="p-1.5 rounded-lg"
                style={{
                  backgroundColor: searchOpen ? `${SLEEP_COLOR}1A` : t.bgSub,
                  color: searchOpen ? SLEEP_COLOR : t.textSub, border: 'none', cursor: 'pointer',
                }}>
                <Search size={15} />
              </button>
            </div>

            {searchOpen ? (
              /* 검색바 */
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
                <Search size={14} color={t.textMuted} />
                <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="날짜·시간·수면시간 검색"
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 13, color: t.text }} />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} aria-label="검색어 지우기"
                    style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : selectedDate ? (
              /* 날짜 필터 칩 */
              <button onClick={() => setSelectedDate(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full mb-3"
                style={{
                  fontSize: 12, fontWeight: 600,
                  backgroundColor: `${SLEEP_COLOR}1A`, color: SLEEP_COLOR, border: `1px solid ${SLEEP_COLOR}`,
                }}>
                {format(parseISO(selectedDate), 'M월 d일')}
                <X size={12} />
              </button>
            ) : (
              <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>전체 기록 · 최신순</p>
            )}

            {displayed.length === 0 ? (
              q ? (
                <div className="py-8 text-center rounded-2xl"
                  style={{ backgroundColor: t.bgSub, fontSize: 13, color: t.textMuted }}>
                  검색 결과가 없어요
                </div>
              ) : selectedDate ? (
                /* 빈 날 넛지 — 선택한 날짜에 수면 기록이 없을 때 */
                <div className="py-6 px-4 text-center rounded-2xl"
                  style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    {selectedDate === todayStr ? '오늘은' : `${format(parseISO(selectedDate), 'M월 d일')}은`} 아직 수면 기록이 없어요
                  </p>
                  <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>이 날 수면은 어땠나요?</p>
                  <button
                    onClick={() => openRecordFor(selectedDate)}
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl"
                    style={{ fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: SLEEP_COLOR }}>
                    <Plus size={14} /> 수면 기록하기
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: t.textMuted, padding: '4px 0' }}>아직 수면 기록이 없습니다</p>
              )
            ) : (
              <div className="space-y-2">
                {displayed.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                    <Moon size={12} color={SLEEP_COLOR} />
                    <span style={{ fontSize: 11, color: t.textMuted, width: 44, flexShrink: 0 }}>{r.date.slice(5)}</span>
                    <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{r.content}</span>
                    <span style={{ fontSize: 11, color: SLEEP_COLOR, fontWeight: 600, flexShrink: 0 }}>
                      {fmtSleep(r.duration)}
                    </span>
                    <button onClick={() => deleteSelfCareRecord(r.id)}
                      className="p-1 rounded" style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isDefaultView && sleepRecords.length > listLimit && (
              <button onClick={() => setListLimit(n => n + 10)}
                className="w-full mt-3 py-2 rounded-xl" style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 13 }}>
                더보기
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function AddRecordModal({ onClose, editRecord }: { onClose: () => void; editRecord?: SelfCareRecord }) {
  const { addSelfCareRecord, updateSelfCareRecord } = usePlanner();
  const { t } = useTheme();
  const [category, setCategory] = useState<'exercise' | 'study' | 'beauty'>(
    (editRecord?.category as 'exercise' | 'study' | 'beauty') ?? 'exercise'
  );
  const [content, setContent] = useState(editRecord?.content ?? '');
  const [duration, setDuration] = useState(editRecord?.duration ?? 30);
  const [date, setDate] = useState(editRecord?.date ?? format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = () => {
    if (!content.trim()) return;
    if (editRecord) {
      updateSelfCareRecord(editRecord.id, { date, category, content: content.trim(), duration });
    } else {
      addSelfCareRecord({ date, category, content: content.trim(), duration });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl shadow-xl w-[400px]" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{editRecord ? '기록 수정' : '기록 추가'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>카테고리</label>
            <div className="flex gap-2 mt-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setCategory(cat.key)}
                  className="flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
                  style={{
                    fontSize: 12, backgroundColor: category === cat.key ? cat.color : t.bgSub,
                    color: category === cat.key ? '#fff' : t.text, border: `1px solid ${category === cat.key ? cat.color : t.border}`,
                  }}>
                  <cat.icon size={13} /> {cat.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>내용</label>
            <input autoFocus value={content} onChange={e => setContent(e.target.value)} placeholder="예: 헬스장 상체 운동"
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>소요 시간 (분)</label>
            <input type="number" min={5} max={480} value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: t.border }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-xl" style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}>취소</button>
          <button onClick={handleSubmit} className="flex-1 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            {editRecord ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SelfCareView() {
  const { selfCareRecords, deleteSelfCareRecord } = usePlanner();
  const { t } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<SelfCareRecord | null>(null);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthRecords = selfCareRecords.filter(r => r.date.startsWith(currentMonth));

  const statsByCategory = (cat: 'exercise' | 'study' | 'beauty') => {
    const recs = monthRecords.filter(r => r.category === cat);
    const count = recs.length;
    const totalMin = recs.reduce((sum, r) => sum + r.duration, 0);
    const avgMin = count ? Math.round(totalMin / count) : 0;
    return { count, totalMin, avgMin };
  };

  const exerciseStats = statsByCategory('exercise');
  const studyStats = statsByCategory('study');
  const beautyStats = statsByCategory('beauty');

  const fmtDuration = (min: number) => min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;

  // Group records by date
  const groupedByDate: Record<string, SelfCareRecord[]> = {};
  selfCareRecords.forEach(r => {
    if (!groupedByDate[r.date]) groupedByDate[r.date] = [];
    groupedByDate[r.date].push(r);
  });
  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>시간 리포트</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>운동, 공부, 케어 등 카테고리별 시간 사용을 확인하세요</p>
      </div>

      <div className="px-6 pb-8">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: '이번달 공부시간', value: fmtDuration(studyStats.totalMin), color: '#7B9ED9', icon: BookOpen },
            { label: '운동 횟수', value: `${exerciseStats.count}회`, color: '#D4735A', icon: Dumbbell },
            { label: '케어 횟수', value: `${beautyStats.count}회`, color: '#A07BE0', icon: Sparkles },
          ].map((s, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={14} color={s.color} />
                <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{s.label}</span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Category sections */}
        {CATEGORIES.map(cat => {
          const stats = statsByCategory(cat.key);
          const catRecords = selfCareRecords.filter(r => r.category === cat.key).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={cat.key} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <cat.icon size={16} color={cat.color} />
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{cat.label}</span>
                <span className="ml-auto px-2.5 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: cat.color + '20', color: cat.color }}>
                  {stats.count}회 &middot; 총 {fmtDuration(stats.totalMin)} &middot; 평균 {stats.avgMin}분
                </span>
              </div>
              <div className="space-y-2">
                {catRecords.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl group"
                    style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                    <span style={{ fontSize: 11, color: t.textMuted, width: 80 }}>{r.date.slice(5)}</span>
                    <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{r.content}</span>
                    <span style={{ fontSize: 11, color: cat.color, fontWeight: 600 }}>{r.duration}분</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditRecord(r)} className="p-1 rounded" style={{ color: t.textMuted }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => deleteSelfCareRecord(r.id)} className="p-1 rounded" style={{ color: t.textMuted }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {catRecords.length === 0 && (
                  <p style={{ fontSize: 12, color: t.textMuted, padding: '8px 0' }}>아직 기록이 없습니다</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Add button */}
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
          style={{ border: `2px dashed ${t.border}`, color: t.accent, fontSize: 13, fontWeight: 600 }}>
          <Plus size={16} /> 기록 추가
        </button>

        {/* Integration note */}
        <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}>
          <p style={{ fontSize: 11, color: t.textMuted }}>
            💡 스톱워치(DO 블록) 완료 시 태그 기반으로 자동 집계됩니다. 태그에 "건강", "자기계발", "자기관리" 등을 설정해보세요.
          </p>
        </div>
      </div>

      {showAdd && <AddRecordModal onClose={() => setShowAdd(false)} />}
      {editRecord && <AddRecordModal editRecord={editRecord} onClose={() => setEditRecord(null)} />}
    </div>
  );
}
