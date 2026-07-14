import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays, startOfMonth, endOfWeek, startOfWeek, addDays, getDaysInMonth, getDay, parseISO } from 'date-fns';
import { Trash2, Plus, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../ThemeContext';
import { isHaon, solidCardStyle, solidRowStyle } from '../styles/haonStyles';
import { HaonButton } from './ui/HaonButton';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { getSymptomOptions, STRESS_LEVELS, normalizeSymptom, DEFAULT_SYMPTOMS } from '../../constants/symptoms';
import { usePlanner, type ConditionRecord, type UserSymptom, getLogicalToday } from '../store';
import ConfirmModal from './ConfirmModal';

const STRESS_COLOR = '#D4735A'; // 코랄 — 히트맵/막대 색

// 스트레스 단계(1~5)별 농도 (코랄 단색 그라데이션)
const stressShade = (level: number) => {
  const alpha = 0.18 + (level - 1) * 0.205; // 1→0.18 ... 5→1.0
  return `rgba(212,115,90,${alpha.toFixed(2)})`;
};

export function ConditionTab() {
  const { t } = useTheme();
  const { appSettings } = usePlanner();
  const weekStartsOn = appSettings.weekStartsOn ?? 1;

  const [records, setRecords] = useState<ConditionRecord[]>([]);
  const [userSymptoms, setUserSymptoms] = useState<UserSymptom[]>([]);

  // "+ 증상 추가" 인라인 입력
  const [symptomAddOpen, setSymptomAddOpen] = useState(false);
  const [symptomDraft, setSymptomDraft] = useState('');
  const [symptomNotice, setSymptomNotice] = useState<string | null>(null); // "OO은(는) 이미 있어서 선택했어요"

  // 입력 폼
  const [date, setDate] = useState(getLogicalToday());
  const [stress, setStress] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [memo, setMemo] = useState('');

  const [pendingOverwrite, setPendingOverwrite] = useState<ConditionRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(10);
  const [inputOpen, setInputOpen] = useState(false); // 입력 폼 기본 접힘
  const [weekOffset, setWeekOffset] = useState(0); // 0=이번주, -1=지난주 ...

  // 기록 영역 필터/검색 상태 (트리거 UI는 이후 Stage에서 연결)
  // 기본값 = 오늘(로컬 기준) — 탭 진입 시 오늘 날짜로 필터된 상태로 시작. 칩 ×로 전체(null) 전환
  const [selectedDate, setSelectedDate] = useState<string | null>(getLogicalToday());
  const [searchQuery, setSearchQuery] = useState(''); // 본문·태그 텍스트 검색
  const [searchOpen, setSearchOpen] = useState(false); // 검색바 펼침 여부

  // 기본 칩 + 커스텀 칩 (정규화로 중복 제거) — 통계·검색은 칩 이름 자체로 동작
  const symptomOptions = useMemo(
    () => getSymptomOptions(userSymptoms.map(u => u.name)),
    [userSymptoms]
  );
  const formRef = useRef<HTMLDivElement>(null); // 입력 카드 — 넛지에서 열 때 스크롤 대상

  // ── fetch + realtime ──
  const refresh = useCallback(() => {
    db.conditionRecords.fetchAll().then(setRecords);
  }, []);
  const refreshSymptoms = useCallback(() => {
    db.userSymptoms.fetchAll().then(setUserSymptoms);
  }, []);
  useEffect(() => { refresh(); refreshSymptoms(); }, [refresh, refreshSymptoms]);
  useRealtimeSync('condition_records', refresh);
  useRealtimeSync('user_symptoms', refreshSymptoms);

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);

  // ── 저장 ──
  const resetForm = () => {
    setStress(null); setSymptoms([]); setMemo('');
    setSymptomAddOpen(false); setSymptomDraft(''); setSymptomNotice(null);
  };

  const buildRecord = (existingId?: string): ConditionRecord => ({
    id: existingId ?? crypto.randomUUID(),
    date,
    stress: stress!,
    symptoms,
    memo: memo.trim() || null,
  });

  const saveRecord = (rec: ConditionRecord) => {
    db.conditionRecords.upsert(rec).then(refresh);
    resetForm();
    setInputOpen(false);
  };

  const handleSubmit = () => {
    if (stress == null) return;
    const existing = records.find(r => r.date === date);
    if (existing) { setPendingOverwrite(existing); return; }
    saveRecord(buildRecord());
  };

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  // 커스텀 칩 판별 — 기본과 정규화 동일한 건 기본 취급(점선 강조 X)
  const defaultNormSet = useMemo(() => new Set(DEFAULT_SYMPTOMS.map(normalizeSymptom)), []);
  const isCustomChip = (label: string) => !defaultNormSet.has(normalizeSymptom(label));

  // 안내 메시지는 잠시 후 사라짐
  useEffect(() => {
    if (!symptomNotice) return;
    const id = setTimeout(() => setSymptomNotice(null), 3000);
    return () => clearTimeout(id);
  }, [symptomNotice]);

  // "+ 증상 추가" 처리:
  // - 빈 값 → 무시
  // - 기존 칩(기본+커스텀)과 정규화 일치 → 그 칩을 선택 + 안내 표시
  // - 신규 → db.userSymptoms.add → 이번 기록에 즉시 선택 + 칩 풀에 영구 저장 + 입력창 닫힘
  const handleAddSymptom = async () => {
    const raw = symptomDraft.trim().replace(/\s+/g, ' ');
    if (!raw) return;
    const norm = normalizeSymptom(raw);

    // 1) 화면에 이미 노출 중인 칩(기본+커스텀)에서 매칭 — 사용자가 보는 그대로의 라벨로 선택
    const existing = symptomOptions.find(opt => normalizeSymptom(opt) === norm);
    if (existing) {
      setSymptoms(prev => prev.includes(existing) ? prev : [...prev, existing]);
      setSymptomNotice(`${existing}은(는) 이미 있어서 선택했어요`);
      setSymptomDraft('');
      setSymptomAddOpen(false);
      return;
    }

    // 2) 신규 저장 — DB race로 duplicate가 와도 그 칩을 선택
    const res = await db.userSymptoms.add(raw);
    if (res.ok) {
      const label = res.created.name;
      setUserSymptoms(prev => prev.some(u => normalizeSymptom(u.name) === norm) ? prev : [...prev, res.created]);
      setSymptoms(prev => prev.includes(label) ? prev : [...prev, label]);
    } else if (res.reason === 'duplicate') {
      const label = res.existing.name;
      setUserSymptoms(prev => prev.some(u => u.id === res.existing.id) ? prev : [...prev, res.existing]);
      setSymptoms(prev => prev.includes(label) ? prev : [...prev, label]);
      setSymptomNotice(`${label}은(는) 이미 있어서 선택했어요`);
    } else {
      setSymptomNotice('저장에 실패했어요. 다시 시도해 주세요');
      return;
    }
    setSymptomDraft('');
    setSymptomAddOpen(false);
  };

  // 날짜 칸(주간 셀·히트맵) 클릭 → 그 날짜로 필터 / 같은 날 재클릭 시 해제
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

  // 빈 날 넛지 [기록하기] → 기존 인라인 입력 카드를 그 날짜로 prefill하여 연다 (새 UI 없음)
  const openRecordFor = (d: string) => {
    resetForm();
    setDate(d);
    setInputOpen(true);
  };
  // 입력 카드가 열리면 화면에 보이도록 스크롤(이미 보이면 이동 없음)
  useEffect(() => {
    if (inputOpen) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [inputOpen]);

  // ── 통계 ──
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  // 선택된 주 = 설정된 주 시작 요일 기준 실제 달력 주(시작~끝), 롤링 7일이 아님
  // weekOffset: 0=이번주, -1=지난주 ... 과거 주로 이동 가능
  const weekStartDate = addDays(startOfWeek(today, { weekStartsOn }), weekOffset * 7);
  const weekEndDate = addDays(weekStartDate, 6);
  const weekStart = format(weekStartDate, 'yyyy-MM-dd');
  const weekEnd = format(weekEndDate, 'yyyy-MM-dd');
  const monthPrefix = format(today, 'yyyy-MM');

  const weekRecs = records.filter(r => r.date >= weekStart && r.date <= weekEnd);
  const monthRecs = records.filter(r => r.date.startsWith(monthPrefix));

  const avg = (arr: ConditionRecord[]) =>
    arr.length ? (arr.reduce((s, r) => s + r.stress, 0) / arr.length).toFixed(1) : '—';
  const weekAvg = avg(weekRecs);
  const monthAvg = avg(monthRecs);

  // 선택된 주의 요일별 스트레스 (주 시작 요일 설정 반영)
  const WEEK_LABELS = weekStartsOn === 1
    ? ['월', '화', '수', '목', '금', '토', '일']
    : ['일', '월', '화', '수', '목', '금', '토'];
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStartDate, i), 'yyyy-MM-dd'));
  const stressByDate: Record<string, number> = {};
  weekRecs.forEach(r => { stressByDate[r.date] = r.stress; });
  const weekRangeLabel = `${format(weekStartDate, 'M.d')} – ${format(weekEndDate, 'M.d')}`;
  const weekTitle = weekOffset === 0 ? '이번주' : weekOffset === -1 ? '지난주' : weekRangeLabel;

  // 자주 나타난 증상 Top 3 (이번달)
  const topSymptoms = useMemo(() => {
    const freq: Record<string, number> = {};
    monthRecs.forEach(r => (r.symptoms ?? []).forEach(s => { freq[s] = (freq[s] ?? 0) + 1; }));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [monthRecs]);

  // 최근 30일 스트레스 추이 (오름차순)
  const trend = useMemo(() => {
    const cutoff = format(subDays(today, 29), 'yyyy-MM-dd');
    return [...records]
      .filter(r => r.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ date: r.date.slice(5), stress: r.stress }));
  }, [records]);

  // 이번달 히트맵
  const heatmap = useMemo(() => {
    const monthStart = startOfMonth(today);
    const startDow = getDay(monthStart);
    const days = getDaysInMonth(today);
    const byDate: Record<string, number> = {};
    monthRecs.forEach(r => { byDate[r.date] = r.stress; });
    const cells: ({ day: number; dateStr: string; stress: number | null } | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr, stress: byDate[dateStr] ?? null });
    }
    return cells;
  }, [monthRecs]);

  const stressLabel = (v: number) => STRESS_LEVELS.find(s => s.value === v)?.label ?? String(v);

  // 표시할 기록 도출: 검색어 > 선택 날짜 > 전체 최신순
  // (검색과 날짜 필터는 동시 적용하지 않음 — 검색이 우선)
  const displayedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return sorted.filter(r =>
        [r.memo ?? '', ...(r.symptoms ?? []), stressLabel(r.stress)]
          .join(' ').toLowerCase().includes(q)
      );
    }
    if (selectedDate) return sorted.filter(r => r.date === selectedDate);
    return sorted.slice(0, listLimit);
  }, [sorted, searchQuery, selectedDate, listLimit]);

  // 필터/검색이 없는 기본 상태에서만 "더보기" 노출 (필터 결과는 전체 표시)
  const isDefaultView = !searchQuery.trim() && !selectedDate;

  return (
    <div className="space-y-5">
      {/* (A) 입력 영역 — 기본 접힘 */}
      {!inputOpen && (
        <HaonButton variant="primary" onClick={() => setInputOpen(true)}
          leftIcon={<Plus size={16} />} className="w-full text-sm">
          컨디션 기록하기
        </HaonButton>
      )}
      {inputOpen && (
      <div ref={formRef} className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>컨디션 기록</span>
          <button onClick={() => { setInputOpen(false); resetForm(); }} className="p-1 rounded"
            style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }} aria-label="닫기">
            <X size={15} />
          </button>
        </div>
        <div className="mb-3">
          <label style={{ fontSize: 12, color: t.textSub }}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
            style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }} />
        </div>

        {/* 스트레스 5단계 */}
        <label style={{ fontSize: 12, color: t.textSub }}>스트레스 *</label>
        <div className="grid grid-cols-5 gap-1.5 mt-1">
          {STRESS_LEVELS.map(s => {
            const active = stress === s.value;
            return (
              <button key={s.value} onClick={() => setStress(s.value)}
                className="py-2 rounded-xl transition-all"
                style={{
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  backgroundColor: active ? t.accent : t.bgSub,
                  color: active ? '#fff' : t.textSub,
                  border: `1px solid ${active ? t.accent : t.border}`,
                }}>
                <span className="lg:hidden">{s.short}</span>
                <span className="hidden lg:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* 증상 태그 */}
        <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginTop: 14 }}>증상 (선택)</label>
        <div className="flex flex-wrap gap-1.5 mt-1 items-center">
          {symptomOptions.map(s => {
            const active = symptoms.includes(s);
            const custom = isCustomChip(s);
            return (
              <button key={s} onClick={() => toggleSymptom(s)}
                className="px-3 py-1.5 rounded-full transition-all"
                style={{
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  backgroundColor: active ? STRESS_COLOR : t.bgSub,
                  color: active ? '#fff' : custom ? t.accent : t.textSub,
                  border: active
                    ? `1px solid ${STRESS_COLOR}`
                    : custom
                      ? `1px dashed ${t.accent}`
                      : `1px solid ${t.border}`,
                }}>{s}</button>
            );
          })}

          {/* "+ 증상 추가" — 인라인 입력 토글 */}
          {!symptomAddOpen ? (
            <button onClick={() => { setSymptomAddOpen(true); setSymptomNotice(null); }}
              className="px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1"
              style={{
                fontSize: 12, fontWeight: 500,
                backgroundColor: t.bgSub, color: t.accent,
                border: `1px dashed ${t.accent}`,
              }}>
              <Plus size={12} /> 증상 추가
            </button>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ backgroundColor: t.bgSub, border: `1px dashed ${t.accent}` }}>
              <input autoFocus value={symptomDraft}
                onChange={e => setSymptomDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddSymptom(); }
                  else if (e.key === 'Escape') { setSymptomAddOpen(false); setSymptomDraft(''); }
                }}
                placeholder="증상 이름"
                maxLength={20}
                className="bg-transparent outline-none"
                style={{ fontSize: 12, color: t.text, width: 90 }} />
              <button onClick={handleAddSymptom}
                style={{
                  fontSize: 12, fontWeight: 600, color: t.accent,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
                }}>추가</button>
              <button onClick={() => { setSymptomAddOpen(false); setSymptomDraft(''); }}
                aria-label="닫기"
                style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>
        {symptomNotice && (
          <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>{symptomNotice}</p>
        )}

        {/* 메모 */}
        <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginTop: 14 }}>메모 (선택)</label>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="오늘 컨디션은 어땠나요?"
          className="w-full mt-1 px-3 py-2 rounded-xl outline-none resize-none"
          style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }} />

        <HaonButton variant="primary" onClick={handleSubmit} disabled={stress == null}
          className="w-full mt-3 text-sm">기록하기</HaonButton>
      </div>
      )}

      {/* (B) 통계 — 주별 컨디션 (과거 주로 이동 가능) */}
      <div className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        {/* 헤더: 주 이동 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setWeekOffset(o => o - 1)}
            className="p-1.5 rounded-lg" aria-label="이전 주"
            style={{ backgroundColor: t.bgSub, color: t.textSub, border: 'none', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{weekTitle} 평균 스트레스</p>
            <p style={{ fontSize: 11, color: t.textMuted }}>{weekRangeLabel}</p>
          </div>
          <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={weekOffset >= 0}
            className="p-1.5 rounded-lg" aria-label="다음 주"
            style={{
              backgroundColor: t.bgSub, color: t.textSub, border: 'none',
              cursor: weekOffset >= 0 ? 'default' : 'pointer', opacity: weekOffset >= 0 ? 0.4 : 1,
            }}>
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 평균 */}
        <div className="flex items-baseline justify-center gap-2 mb-3">
          <span style={{ fontSize: 24, fontWeight: 700, color: t.text }}>{weekAvg}</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>· 기록 {weekRecs.length}일</span>
        </div>

        {/* 요일별 컨디션 셀 */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d, i) => {
            const s = stressByDate[d] ?? null;
            const isToday = d === todayStr;
            const isSelected = selectedDate === d;
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span style={{ fontSize: 10, color: t.textMuted }}>{WEEK_LABELS[i]}</span>
                <button onClick={() => toggleDate(d)} aria-pressed={isSelected}
                  className="w-full flex items-center justify-center rounded-lg aspect-square lg:aspect-auto lg:h-14"
                  style={{
                    backgroundColor: s != null ? stressShade(s) : t.bgSub,
                    border: `1px solid ${isSelected ? t.danger : isToday ? t.accent : t.border}`,
                    boxShadow: isSelected ? `0 0 0 2px ${t.danger}` : 'none',
                    cursor: 'pointer',
                  }}
                  title={s != null ? `${d} · 스트레스 ${s}` : d}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s != null && s >= 3 ? '#fff' : t.textMuted }}>
                    {parseInt(d.slice(8), 10)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 자주 나타난 증상 Top 3 */}
      {topSymptoms.length > 0 && (
        <div className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>이번달 자주 나타난 증상</p>
          <div className="flex flex-wrap gap-2">
            {topSymptoms.map(([name, count]) => (
              <span key={name} className="px-3 py-1.5 rounded-full"
                style={{ fontSize: 12, fontWeight: 600, backgroundColor: `${STRESS_COLOR}18`, color: STRESS_COLOR }}>
                {name} · {count}회
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 히트맵(좌) · 추이 선그래프(우) — PC 2단, 모바일 세로 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* 스트레스 히트맵 (이번달) + 이번달 평균 */}
        <div className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-baseline justify-between mb-3">
            <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              {format(today, 'M월')} 스트레스 히트맵
            </p>
            <p style={{ fontSize: 11, color: t.textMuted }}>
              이번달 평균 <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{monthAvg}</span>
            </p>
          </div>
          <div className="lg:max-w-[360px] lg:mx-auto">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                <div key={d} className="text-center" style={{ fontSize: 10, color: t.textMuted }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {heatmap.map((cell, i) => cell === null ? (
                <div key={i} style={{ aspectRatio: '1' }} />
              ) : (
                <button key={i} onClick={() => toggleDate(cell.dateStr)} aria-pressed={selectedDate === cell.dateStr}
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    aspectRatio: '1',
                    backgroundColor: cell.stress != null ? stressShade(cell.stress) : t.bgSub,
                    border: `1px solid ${selectedDate === cell.dateStr ? t.danger : t.border}`,
                    boxShadow: selectedDate === cell.dateStr ? `0 0 0 2px ${t.danger}` : 'none',
                    cursor: 'pointer',
                  }}
                  title={cell.stress != null ? `${cell.dateStr} · 스트레스 ${cell.stress}` : cell.dateStr}>
                  <span style={{ fontSize: 10, color: cell.stress != null && cell.stress >= 3 ? '#fff' : t.textMuted }}>
                    {cell.day}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 스트레스 추이 선그래프 */}
        <div className="p-4 rounded-2xl flex flex-col" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>최근 30일 스트레스 추이</p>
          {trend.length > 0 ? (
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.borderLight} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: `1px solid ${t.border}`, backgroundColor: t.card }} />
                  <Line type="monotone" dataKey="stress" stroke={STRESS_COLOR} strokeWidth={2}
                    dot={{ r: 3, fill: STRESS_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 min-h-[200px] flex items-center justify-center text-center" style={{ fontSize: 13, color: t.textMuted }}>기록이 쌓이면 추이가 표시됩니다</div>
          )}
        </div>
      </div>

      {/* (C) 기록 리스트 */}
      <div>
        {/* 헤더: 제목 + 돋보기 */}
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>기록</p>
          <button onClick={toggleSearch} aria-label="검색" aria-pressed={searchOpen}
            className="p-1.5 rounded-lg"
            style={{
              backgroundColor: searchOpen ? t.dangerLight : t.bgSub,
              color: searchOpen ? t.danger : t.textSub, border: 'none', cursor: 'pointer',
            }}>
            <Search size={15} />
          </button>
        </div>

        {searchOpen ? (
          /* 검색바 */
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
            style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
            <Search size={14} color={t.textMuted} />
            <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="본문·증상·레벨 검색"
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
              backgroundColor: t.dangerLight, color: t.danger, border: `1px solid ${t.danger}`,
            }}>
            {format(parseISO(selectedDate), 'M월 d일')}
            <X size={12} />
          </button>
        ) : (
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 10 }}>전체 기록 · 최신순</p>
        )}

        {displayedRecords.length === 0 ? (
          searchQuery.trim() ? (
            <div className="py-8 text-center rounded-2xl"
              style={{ backgroundColor: t.bgSub, fontSize: 13, color: t.textMuted }}>
              검색 결과가 없어요
            </div>
          ) : selectedDate ? (
            /* 빈 날 넛지 — 선택한 날짜에 기록이 없을 때 */
            <div className="py-6 px-4 text-center rounded-2xl"
              style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                {selectedDate === todayStr ? '오늘은' : `${format(parseISO(selectedDate), 'M월 d일')}은`} 아직 기록이 없어요.
              </p>
              <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>이 날은 어땠나요?</p>
              <HaonButton variant="primary" onClick={() => openRecordFor(selectedDate)}
                leftIcon={<Plus size={14} />} className="mt-3 text-sm">
                기록하기
              </HaonButton>
            </div>
          ) : (
            <div className="py-8 text-center rounded-2xl"
              style={{ backgroundColor: t.bgSub, fontSize: 13, color: t.textMuted }}>
              아직 컨디션 기록이 없습니다
            </div>
          )
        ) : (
          <div className="space-y-2">
            {displayedRecords.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={isHaon(t) ? solidRowStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.textSub, width: 50, flexShrink: 0, paddingTop: 2 }}>{r.date.slice(5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full" style={{
                      fontSize: 11, fontWeight: 700, color: '#fff', backgroundColor: stressShade(r.stress),
                    }}>
                      {stressLabel(r.stress)}
                    </span>
                    {(r.symptoms ?? []).map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-full"
                        style={{ fontSize: 11, backgroundColor: `${STRESS_COLOR}14`, color: STRESS_COLOR }}>{s}</span>
                    ))}
                  </div>
                  {r.memo && <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>{r.memo}</p>}
                </div>
                <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: t.bgSub }}>
                  <Trash2 size={13} color={t.danger} />
                </button>
              </div>
            ))}
          </div>
        )}
        {isDefaultView && sorted.length > listLimit && (
          <button onClick={() => setListLimit(n => n + 10)}
            className="w-full mt-3 py-2 rounded-xl" style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 13 }}>
            더보기
          </button>
        )}
      </div>

      {/* 덮어쓰기 확인 */}
      {pendingOverwrite && (
        <ConfirmModal
          message="오늘 이미 기록이 있어요. 덮어쓸까요?"
          description={`${pendingOverwrite.date}의 기존 컨디션 기록을 새 값으로 교체합니다.`}
          confirmText="덮어쓰기"
          onConfirm={() => { saveRecord(buildRecord(pendingOverwrite.id)); setPendingOverwrite(null); }}
          onCancel={() => setPendingOverwrite(null)}
        />
      )}

      {/* 삭제 확인 */}
      {deleteId && (
        <ConfirmModal
          message="이 기록을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { db.conditionRecords.delete(deleteId).then(refresh); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
