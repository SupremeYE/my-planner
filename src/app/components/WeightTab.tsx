import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Trash2, Plus, X, Pencil, ImagePlus, Images } from 'lucide-react';
import {
  ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTheme } from '../ThemeContext';
import { isHaon, solidCardStyle, solidRowStyle } from '../styles/haonStyles';
import { HaonButton } from './ui/HaonButton';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { WeightRecord, WeightGoal, WeightSlot } from '../store';
import { getLogicalToday, usePlanner } from '../store';
import { PeriodNavigator } from './ui/PeriodNavigator';
import { getPeriodRange, type PeriodUnit } from '../lib/periodNav';
import { prepImage } from '../../lib/imagePrep';
import { BodyGallery } from './body/BodyGallery';
import ConfirmModal from './ConfirmModal';

// 보조 지표 라인 색상 (체지방=코랄 / 골격근=그린). 아침/저녁 체중은 토큰(warning/info) 사용.
const COLOR_FAT = '#D4735A';      // 코랄
const COLOR_MUSCLE = '#6BAA7A';   // 그린

// 기록 시간대 토글 — 하루에 아침/저녁/기타 공존 (DB: UNIQUE(date, slot))
const SLOTS: WeightSlot[] = ['아침', '저녁', '기타'];
// 폼 기본값 = 시간대 자동(오전→아침 / 오후→저녁). 기타는 사용자가 명시적으로 선택할 때만.
const autoSlot = (): WeightSlot => (new Date().getHours() < 12 ? '아침' : '저녁');

const numOrNull = (s: string): number | null => {
  const v = parseFloat(s);
  return s.trim() !== '' && !Number.isNaN(v) ? v : null;
};

// ─── 목표 설정 모달 ──────────────────────────────────────────────────
function GoalModal({ initial, onClose, onSave }: {
  initial: WeightGoal | null;
  onClose: () => void;
  onSave: (goal: WeightGoal) => void;
}) {
  const { t } = useTheme();
  const [startWeight, setStartWeight] = useState(initial?.startWeight != null ? String(initial.startWeight) : '');
  const [targetWeight, setTargetWeight] = useState(initial?.targetWeight != null ? String(initial.targetWeight) : '');
  const [targetBodyFat, setTargetBodyFat] = useState(initial?.targetBodyFat != null ? String(initial.targetBodyFat) : '');
  const [targetMuscle, setTargetMuscle] = useState(initial?.targetMuscleMass != null ? String(initial.targetMuscleMass) : '');

  const canSave = numOrNull(startWeight) != null && numOrNull(targetWeight) != null;

  const fieldStyle = {
    backgroundColor: t.card,
    border: `1px solid ${t.border}`,
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div className="rounded-2xl w-[360px] max-w-full p-5"
        style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.bg, border: `1px solid ${t.border}` }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 16 }}>목표 체중 설정</h3>

        <div className="space-y-3">
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>시작 체중 (kg) *</label>
            <input type="number" inputMode="decimal" step="0.1" value={startWeight}
              onChange={e => setStartWeight(e.target.value)} placeholder="예: 65.0"
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none" style={{ ...fieldStyle, color: t.text }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>목표 체중 (kg) *</label>
            <input type="number" inputMode="decimal" step="0.1" value={targetWeight}
              onChange={e => setTargetWeight(e.target.value)} placeholder="예: 58.0"
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none" style={{ ...fieldStyle, color: t.text }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 12, color: t.textSub }}>목표 체지방 (%)</label>
              <input type="number" inputMode="decimal" step="0.1" value={targetBodyFat}
                onChange={e => setTargetBodyFat(e.target.value)} placeholder="선택"
                className="w-full mt-1 px-3 py-2 rounded-xl outline-none" style={{ ...fieldStyle, color: t.text }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: t.textSub }}>목표 골격근 (kg)</label>
              <input type="number" inputMode="decimal" step="0.1" value={targetMuscle}
                onChange={e => setTargetMuscle(e.target.value)} placeholder="선택"
                className="w-full mt-1 px-3 py-2 rounded-xl outline-none" style={{ ...fieldStyle, color: t.text }} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <HaonButton variant="secondary" onClick={onClose} className="flex-1 text-sm">취소</HaonButton>
          <HaonButton variant="primary" disabled={!canSave}
            onClick={() => onSave({
              startWeight: numOrNull(startWeight)!,
              targetWeight: numOrNull(targetWeight)!,
              targetBodyFat: numOrNull(targetBodyFat),
              targetMuscleMass: numOrNull(targetMuscle),
            })}
            className="flex-1 text-sm">저장</HaonButton>
        </div>
      </div>
    </div>
  );
}

export function WeightTab() {
  const { t } = useTheme();
  const { appSettings } = usePlanner();
  const weekStartsOn = appSettings.weekStartsOn ?? 1;

  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);

  // 입력 폼
  const [date, setDate] = useState(getLogicalToday());
  const [slot, setSlot] = useState<WeightSlot>(autoSlot);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [memo, setMemo] = useState('');

  const [pendingOverwrite, setPendingOverwrite] = useState<WeightRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null=새 기록, 값=편집 중

  const isEditing = editingId != null;

  // 눈바디 — 폼 첨부 사진(저장 시 레코드에 연결) + 전체화면 갤러리
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null); // object URL (미리보기 전용)
  const [galleryOpen, setGalleryOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 기간 네비게이터 — 롤링(7/30/1년) 대체. 기본 '월'/현재 기간.
  const [unit, setUnit] = useState<PeriodUnit>('월');
  const [offset, setOffset] = useState(0);
  // 겹쳐보기(기본) / 아침만 / 저녁만 — 아침·저녁 2시리즈 격리 보기
  const [viewMode, setViewMode] = useState<'overlay' | 'morning' | 'evening'>('overlay');
  const [showFat, setShowFat] = useState(false);
  const [showMuscle, setShowMuscle] = useState(false);
  const [listLimit, setListLimit] = useState(10);
  const [inputOpen, setInputOpen] = useState(false); // 입력 폼 기본 접힘

  // ── fetch + realtime ──
  const refresh = useCallback(() => {
    db.weightRecords.fetchAll().then(setRecords);
    db.weightGoal.fetch().then(setGoal);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('weight_records', () => { db.weightRecords.fetchAll().then(setRecords); });
  useRealtimeSync('weight_goals', () => { db.weightGoal.fetch().then(setGoal); });

  // records: 최신순 정렬되어 들어옴 (date desc)
  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);

  // ── 통계 기준 slot (like-for-like 비교; DESIGN.md §7.4) ──
  // 폴백(가용성 해결)이 아니라 '동일 slot 쌍 비교'가 목적. 기준 = 아침 고정.
  // 예외: 최근 30일 내 아침 기록이 0건일 때만 저녁으로 전환(기타는 기준 후보에서 제외).
  const referenceSlot: WeightSlot = useMemo(() => {
    const cutoff = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    return records.some(r => r.slot === '아침' && r.date >= cutoff) ? '아침' : '저녁';
  }, [records]);
  // 기준 slot 기록만 (date desc; UNIQUE(date,slot) → 날짜당 최대 1개)
  const refRecords = useMemo(() => sorted.filter(r => r.slot === referenceSlot), [sorted, referenceSlot]);
  const latest = refRecords[0] ?? null; // 현재 체중 = 최신 '기준 slot' 기록

  const hasFatData = records.some(r => r.bodyFat != null);
  const hasMuscleData = records.some(r => r.muscleMass != null);

  // ── 저장 ──
  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  };
  const resetForm = () => {
    setEditingId(null); setSlot(autoSlot()); setWeight(''); setBodyFat(''); setMuscle(''); setMemo('');
    clearPhoto();
  };
  // 저장 후 정리 + 폼 첨부 사진이 있으면 저장된 레코드(id·date)에 연결해 업로드(best-effort).
  const afterWrite = async (recId?: string, recDate?: string) => {
    if (photoFile && recId && recDate) {
      const pid = crypto.randomUUID();
      const path = await db.bodyPhotos.uploadPhoto(photoFile, pid);
      if (path) await db.bodyPhotos.insert({ id: pid, date: recDate, photoPath: path, weightRecordId: recId });
    }
    db.weightRecords.fetchAll().then(setRecords);
    resetForm();
    setInputOpen(false);
  };

  // 폼 사진 선택 — prepImage(HEIC→JPEG) 후 미리보기. 업로드는 레코드 저장 성공 시(afterWrite).
  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const prepped = await prepImage(file);
    clearPhoto();
    setPhotoFile(prepped);
    setPhotoPreview(URL.createObjectURL(prepped));
  };

  // 새 기록 폼 열기(오늘 날짜로 초기화)
  const openNew = () => { resetForm(); setDate(getLogicalToday()); setInputOpen(true); };

  // 기존 기록 편집 시작 — 값 로드 후 폼 열기
  const startEdit = (r: WeightRecord) => {
    setEditingId(r.id);
    setDate(r.date);
    setSlot(r.slot);
    setWeight(String(r.weight));
    setBodyFat(r.bodyFat != null ? String(r.bodyFat) : '');
    setMuscle(r.muscleMass != null ? String(r.muscleMass) : '');
    setMemo(r.memo ?? '');
    setInputOpen(true);
  };

  const buildRecord = (existingId?: string): WeightRecord => ({
    id: existingId ?? crypto.randomUUID(),
    date,
    slot,
    weight: numOrNull(weight)!,
    bodyFat: numOrNull(bodyFat),
    muscleMass: numOrNull(muscle),
    memo: memo.trim() || null,
  });

  const handleSubmit = () => {
    if (numOrNull(weight) == null) return;
    if (isEditing) {
      // 편집: 바꾼 날짜·시간대가 '다른' 기록과 겹치면 그 기록 교체 여부 확인
      const conflict = records.find(r => r.date === date && r.slot === slot && r.id !== editingId);
      if (conflict) { setPendingOverwrite(conflict); return; }
      const rec = buildRecord(editingId!);
      db.weightRecords.update(rec).then(() => afterWrite(rec.id, rec.date));
      return;
    }
    // 신규: 같은 날짜+시간대가 이미 있으면 덮어쓰기 확인 (아침/저녁은 공존)
    const existing = records.find(r => r.date === date && r.slot === slot);
    if (existing) { setPendingOverwrite(existing); return; }
    const rec = buildRecord();
    db.weightRecords.upsert(rec).then(() => afterWrite(rec.id, rec.date));
  };

  // 덮어쓰기/충돌 확정 처리 — 신규는 기존 값 교체(upsert), 편집은 겹친 기록 삭제 후 이동(update)
  const confirmOverwrite = () => {
    if (!pendingOverwrite) return;
    if (isEditing) {
      const rec = buildRecord(editingId!);
      db.weightRecords.delete(pendingOverwrite.id)
        .then(() => db.weightRecords.update(rec))
        .then(() => afterWrite(rec.id, rec.date));
    } else {
      const rec = buildRecord(pendingOverwrite.id);
      db.weightRecords.upsert(rec).then(() => afterWrite(rec.id, rec.date));
    }
    setPendingOverwrite(null);
  };

  const handleDelete = (id: string) => {
    db.weightRecords.delete(id).then(() => db.weightRecords.fetchAll().then(setRecords));
  };

  const handleSaveGoal = (g: WeightGoal) => {
    db.weightGoal.upsert(g).then(() => db.weightGoal.fetch().then(setGoal));
    setShowGoalModal(false);
  };

  // ── 통계 ──
  // 기준 slot 기록이 '있는 날'끼리만 비교. 기준 slot 없는 날은 건너뛰고 더 과거로(같은 날 다른 slot
  // 바꿔치기 없음). 비교 가능한 쌍이 없으면 null → UI 는 "—" + 사유(Stage 3).
  const changeFrom = (days: number): number | null => {
    if (!latest) return null;
    const targetDate = format(subDays(parseISO(latest.date), days), 'yyyy-MM-dd');
    const past = refRecords.find(r => r.date <= targetDate); // refRecords 는 기준 slot 만 → 자동 스킵
    if (!past) return null;
    return +(latest.weight - past.weight).toFixed(1);
  };
  const change7 = changeFrom(7);
  const change30 = changeFrom(30);

  // 기간 네비게이터 — 현재 unit/offset 의 달력 경계 기간(주/월/년)
  const period = useMemo(
    () => getPeriodRange(unit, offset, { weekStartsOn }),
    [unit, offset, weekStartsOn],
  );
  // 선택 기간 내 최저/최고
  const periodRecords = useMemo(
    () => sorted.filter(r => r.date >= period.start && r.date <= period.end),
    [sorted, period.start, period.end],
  );
  const minW = periodRecords.length ? Math.min(...periodRecords.map(r => r.weight)) : null;
  const maxW = periodRecords.length ? Math.max(...periodRecords.map(r => r.weight)) : null;

  // ── 진행률 ──
  const progress = useMemo(() => {
    if (!goal || !latest) return null;
    const denom = goal.startWeight - goal.targetWeight;
    if (denom === 0) return 100;
    const raw = ((goal.startWeight - latest.weight) / denom) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [goal, latest]);

  // ── 차트 데이터 (기간 창 안, 오름차순) — 아침/저녁 2시리즈 + 갭 밴드 ──
  // x축: 주/월=일별, 년=월별. 각 x점에서 slot별 평균 → 아침(warning)/저녁(info) 라인,
  // 기타=중립 점(라인·갭 제외), band=[min,max](아침·저녁 둘 다 있을 때만) → 두 선 사이 갭 밴드.
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const chartData = useMemo(() => {
    const inPeriod = records.filter(r => r.date >= period.start && r.date <= period.end);
    const groups = new Map<string, WeightRecord[]>();
    for (const r of inPeriod) {
      const key = unit === '년' ? r.date.slice(0, 7) : r.date; // 년=YYYY-MM, else YYYY-MM-DD
      const g = groups.get(key);
      if (g) g.push(r); else groups.set(key, [r]);
    }
    const avgW = (recs: WeightRecord[], slot: WeightSlot): number | null => {
      const ws = recs.filter(r => r.slot === slot).map(r => r.weight);
      return ws.length ? round1(ws.reduce((s, n) => s + n, 0) / ws.length) : null;
    };
    const avgN = (ns: number[]): number | null =>
      ns.length ? round1(ns.reduce((s, n) => s + n, 0) / ns.length) : null;
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, recs]) => {
        const morning = avgW(recs, '아침');
        const evening = avgW(recs, '저녁');
        const other = avgW(recs, '기타');
        return {
          date: unit === '년' ? `${parseInt(key.slice(5), 10)}월` : key.slice(5),
          morning, evening, other,
          band: morning != null && evening != null
            ? ([Math.min(morning, evening), Math.max(morning, evening)] as [number, number])
            : null,
          bodyFat: avgN(recs.map(r => r.bodyFat).filter((v): v is number => v != null)),
          muscleMass: avgN(recs.map(r => r.muscleMass).filter((v): v is number => v != null)),
        };
      });
  }, [records, period.start, period.end, unit]);

  // ── 갭 통계 — 하루 갭 = 그날 아침 평균 − 저녁 평균 (둘 다 있는 날만) ──
  const dayGap = useCallback((dateStr: string): number | null => {
    const day = records.filter(r => r.date === dateStr);
    const am = day.filter(r => r.slot === '아침').map(r => r.weight);
    const pm = day.filter(r => r.slot === '저녁').map(r => r.weight);
    if (!am.length || !pm.length) return null;
    const mean = (ns: number[]) => ns.reduce((s, n) => s + n, 0) / ns.length;
    return round1(mean(am) - mean(pm));
  }, [records]);

  // 오늘 갭 = 실제 오늘 날짜 기준. 기간 평균 갭 = 보이는 기간의 '하루 갭들의 평균'
  // (년: 월평균아침−월평균저녁이 아니라 하루 갭들의 평균 — 규칙 준수).
  const todayGap = dayGap(getLogicalToday());
  const periodAvgGap = useMemo(() => {
    const dates = new Set(
      records.filter(r => r.date >= period.start && r.date <= period.end).map(r => r.date),
    );
    const gaps: number[] = [];
    dates.forEach(d => { const g = dayGap(d); if (g != null) gaps.push(g); });
    return gaps.length ? round1(gaps.reduce((s, n) => s + n, 0) / gaps.length) : null;
  }, [records, period.start, period.end, dayGap]);

  const visibleRecords = sorted.slice(0, listLimit);

  const fmtChange = (v: number | null) => {
    if (v == null) return '—';
    if (v === 0) return '0 kg';
    return `${v > 0 ? '+' : ''}${v} kg`;
  };
  const changeColor = (v: number | null) => {
    if (v == null || v === 0) return t.textMuted;
    return v > 0 ? t.danger : t.success; // 증가=빨강, 감소=초록
  };

  const statCard = (label: string, value: string, color?: string) => (
    <div className="p-3 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: color ?? t.text }}>{value}</p>
    </div>
  );

  // 갭 표기 — 절대값 kg (부호 없이 "N kg")
  const fmtGap = (v: number | null) => (v == null ? '—' : `${Math.abs(v)}kg`);

  // 차트 툴팁 — 갭 밴드(band, [low,high])는 숨기고 아침/저녁/기타/체지방/골격근만 표기.
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p: any) => p.dataKey !== 'band' && p.value != null);
    if (!rows.length) return null;
    return (
      <div style={{ fontSize: 12, borderRadius: 12, border: `1px solid ${t.border}`, background: t.card, padding: '6px 10px' }}>
        <div style={{ color: t.textSub, marginBottom: 2 }}>{label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color ?? t.text }}>
            {p.name} {p.value}{p.dataKey === 'bodyFat' ? '%' : 'kg'}
          </div>
        ))}
      </div>
    );
  };

  const canSubmit = numOrNull(weight) != null;

  return (
    <div className="space-y-5">
      {/* (A) 입력 영역 — 기본 접힘 */}
      {!inputOpen && (
        <HaonButton variant="primary" onClick={openNew}
          leftIcon={<Plus size={16} />} className="w-full text-sm">
          몸무게 기록하기
        </HaonButton>
      )}
      {inputOpen && (
      <div className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{isEditing ? '몸무게 수정' : '몸무게 기록'}</span>
          <button onClick={() => { setInputOpen(false); resetForm(); }} className="p-1 rounded"
            style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }} aria-label="닫기">
            <X size={15} />
          </button>
        </div>

        {/* 시간대(slot) 토글 — 기본값은 시간대 자동(오전→아침/오후→저녁) */}
        <div className="mb-3">
          <label style={{ fontSize: 12, color: t.textSub }}>시간대</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {SLOTS.map(s => {
              const active = slot === s;
              return (
                <button key={s} type="button" onClick={() => setSlot(s)}
                  className="py-2 rounded-xl transition-all"
                  style={{
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    backgroundColor: active ? t.accent : t.bgSub,
                    color: active ? '#fff' : t.textSub,
                    border: `1px solid ${active ? t.accent : t.border}`,
                  }}>{s}</button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text, WebkitAppearance: 'none', appearance: 'none', boxSizing: 'border-box', minWidth: 0 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>체중 (kg) *</label>
            <input type="number" inputMode="decimal" step="0.1" value={weight}
              onChange={e => setWeight(e.target.value)} placeholder="예: 62.5"
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>체지방률 (%)</label>
            <input type="number" inputMode="decimal" step="0.1" value={bodyFat}
              onChange={e => setBodyFat(e.target.value)} placeholder="선택"
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>골격근량 (kg)</label>
            <input type="number" inputMode="decimal" step="0.1" value={muscle}
              onChange={e => setMuscle(e.target.value)} placeholder="선택"
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }} />
          </div>
        </div>
        <div className="mt-3">
          <label style={{ fontSize: 12, color: t.textSub }}>메모</label>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="선택"
            className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
            style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }} />
        </div>

        {/* 눈바디 사진 첨부(선택) — 저장 시 이 기록에 자동 연결 */}
        <div className="mt-3">
          <label style={{ fontSize: 12, color: t.textSub }}>눈바디 사진 (선택)</label>
          <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handlePickPhoto} />
          {photoPreview ? (
            <div className="mt-1 flex items-center gap-2">
              <img src={photoPreview} alt="" className="rounded-lg object-cover"
                style={{ width: 48, height: 48, border: `1px solid ${t.border}` }} />
              <span style={{ fontSize: 12, color: t.textSub, flex: 1 }}>저장 시 이 기록에 연결돼요</span>
              <button type="button" onClick={clearPhoto} aria-label="사진 제거" className="p-1 rounded"
                style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => photoInputRef.current?.click()}
              className="mt-1 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl"
              style={{ fontSize: 13, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight, border: `1px solid ${t.border}` }}>
              <ImagePlus size={15} /> 사진 추가
            </button>
          )}
        </div>

        <HaonButton variant="primary" onClick={handleSubmit} disabled={!canSubmit}
          className="w-full mt-3 text-sm">{isEditing ? '수정하기' : '기록하기'}</HaonButton>
      </div>
      )}

      {/* (B) 목표 영역 */}
      {goal ? (
        <div className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              목표 {goal.targetWeight}kg
              <span style={{ fontSize: 12, fontWeight: 400, color: t.textMuted }}> (시작 {goal.startWeight}kg)</span>
            </span>
            <HaonButton variant="ghost" onClick={() => setShowGoalModal(true)}
              className="text-xs px-2.5 py-1">목표 수정</HaonButton>
          </div>
          {progress != null && (
            <>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: t.accent }} />
              </div>
              <p style={{ fontSize: 12, color: t.textSub, marginTop: 6 }}>진행률 {progress}%</p>
            </>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl flex items-center justify-between"
          style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 13, color: t.textSub }}>목표 체중을 설정해보세요</span>
          <HaonButton variant="primary" onClick={() => setShowGoalModal(true)} className="text-sm">
            목표 설정
          </HaonButton>
        </div>
      )}

      {/* (C) 통계 카드 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {statCard('현재 체중', latest ? `${latest.weight} kg` : '—')}
        {statCard('7일 전 대비', fmtChange(change7), changeColor(change7))}
        {statCard('30일 전 대비', fmtChange(change30), changeColor(change30))}
        {statCard(
          `최저·최고 (${unit})`,
          minW != null && maxW != null ? `${minW} / ${maxW}` : '—',
        )}
      </div>

      {/* (D) 추이 차트 */}
      <div className="p-4 rounded-2xl" style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        {/* 기간 네비게이터 (주/월/년 세그먼트 + ‹ › 스테퍼) — 롤링 7/30/1년 대체 */}
        <PeriodNavigator
          unit={unit}
          onUnitChange={setUnit}
          offset={offset}
          onOffsetChange={setOffset}
          weekStartsOn={weekStartsOn}
          className="mb-3"
        />

        {/* 보기 모드: 겹쳐보기(기본) / 아침만 / 저녁만 */}
        <div className="flex gap-1.5 mb-2">
          {([['overlay', '겹쳐보기'], ['morning', '아침만'], ['evening', '저녁만']] as const).map(([m, label]) => {
            const on = viewMode === m;
            return (
              <button key={m} type="button" onClick={() => setViewMode(m)}
                className="px-3 py-1 rounded-full transition-colors"
                style={{
                  fontSize: 12, fontWeight: on ? 700 : 500,
                  backgroundColor: on ? t.accent : t.bgSub,
                  color: on ? '#fff' : t.textSub,
                }}>{label}</button>
            );
          })}
        </div>

        {/* 범례(아침=warning / 저녁=info) + 갭 요약 */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-3" style={{ fontSize: 11, color: t.textSub }}>
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: 8, background: t.warning }} /> 아침
          </span>
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: 8, background: t.info }} /> 저녁
          </span>
          <span>오늘 갭 <b style={{ color: t.text }}>{fmtGap(todayGap)}</b></span>
          <span>기간 평균 갭 <b style={{ color: t.text }}>{fmtGap(periodAvgGap)}</b></span>
        </div>

        {/* 라인 토글 (체지방/골격근 — 보조 우축) */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button disabled={!hasFatData} onClick={() => setShowFat(v => !v)}
            className="px-2.5 py-1 rounded-full" style={{
              fontSize: 11, fontWeight: 600,
              border: `1px solid ${showFat && hasFatData ? COLOR_FAT : t.border}`,
              backgroundColor: showFat && hasFatData ? `${COLOR_FAT}18` : 'transparent',
              color: hasFatData ? COLOR_FAT : t.textMuted,
              opacity: hasFatData ? 1 : 0.5,
            }}>체지방 {showFat && hasFatData ? '✓' : ''}</button>
          <button disabled={!hasMuscleData} onClick={() => setShowMuscle(v => !v)}
            className="px-2.5 py-1 rounded-full" style={{
              fontSize: 11, fontWeight: 600,
              border: `1px solid ${showMuscle && hasMuscleData ? COLOR_MUSCLE : t.border}`,
              backgroundColor: showMuscle && hasMuscleData ? `${COLOR_MUSCLE}18` : 'transparent',
              color: hasMuscleData ? COLOR_MUSCLE : t.textMuted,
              opacity: hasMuscleData ? 1 : 0.5,
            }}>골격근 {showMuscle && hasMuscleData ? '✓' : ''}</button>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.borderLight} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false}
                domain={['dataMin - 1', 'dataMax + 1']} />
              {(showFat || showMuscle) && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: t.textMuted }}
                  tickLine={false} axisLine={false} />
              )}
              <Tooltip content={<ChartTooltip />} />
              {goal && (
                <ReferenceLine yAxisId="left" y={goal.targetWeight} stroke={t.accent}
                  strokeDasharray="4 4" label={{ value: `목표 ${goal.targetWeight}`, fontSize: 10, fill: t.accent, position: 'insideTopRight' }} />
              )}
              {/* 갭 밴드 — 아침·저녁 둘 다 있는 지점 사이 옅은 채움. 겹쳐보기에서만 렌더(라인 뒤). */}
              {viewMode === 'overlay' && (
                <Area yAxisId="left" type="monotone" dataKey="band" name="갭"
                  stroke="none" fill={t.accentSoft} fillOpacity={0.75}
                  connectNulls={false} isAnimationActive={false} legendType="none" activeDot={false} />
              )}
              {/* 아침 라인(warning) */}
              {viewMode !== 'evening' && (
                <Line yAxisId="left" type="monotone" dataKey="morning" name="아침"
                  stroke={t.warning} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              )}
              {/* 저녁 라인(info) */}
              {viewMode !== 'morning' && (
                <Line yAxisId="left" type="monotone" dataKey="evening" name="저녁"
                  stroke={t.info} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              )}
              {/* 기타 — 중립 점만(라인·갭 제외) */}
              <Scatter yAxisId="left" dataKey="other" name="기타" fill={t.textMuted} fillOpacity={0.5} />
              {showFat && hasFatData && (
                <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="체지방"
                  stroke={COLOR_FAT} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              )}
              {showMuscle && hasMuscleData && (
                <Line yAxisId="right" type="monotone" dataKey="muscleMass" name="골격근"
                  stroke={COLOR_MUSCLE} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-12 text-center" style={{ fontSize: 13, color: t.textMuted }}>
            기록이 쌓이면 추이가 표시됩니다
          </div>
        )}
      </div>

      {/* (E) 기록 리스트 */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>기록</p>
        {visibleRecords.length === 0 ? (
          <div className="py-8 text-center rounded-2xl"
            style={{ backgroundColor: t.bgSub, fontSize: 13, color: t.textMuted }}>
            아직 체중 기록이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRecords.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  ...(isHaon(t) ? solidRowStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }),
                  ...(editingId === r.id ? { outline: `2px solid ${t.accent}`, outlineOffset: -2 } : null),
                }}>
                <span style={{ fontSize: 12, color: t.textSub, width: 60, flexShrink: 0 }}>{r.date.slice(5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ fontSize: 10, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub }}>{r.slot}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{r.weight} kg</span>
                    {r.bodyFat != null && (
                      <span style={{ fontSize: 11, color: COLOR_FAT }}>체지방 {r.bodyFat}%</span>
                    )}
                    {r.muscleMass != null && (
                      <span style={{ fontSize: 11, color: COLOR_MUSCLE }}>골격근 {r.muscleMass}kg</span>
                    )}
                  </div>
                  {r.memo && <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{r.memo}</p>}
                </div>
                <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: t.bgSub }} aria-label="수정">
                  <Pencil size={13} color={t.textSub} />
                </button>
                <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: t.bgSub }} aria-label="삭제">
                  <Trash2 size={13} color={t.danger} />
                </button>
              </div>
            ))}
          </div>
        )}
        {sorted.length > listLimit && (
          <button onClick={() => setListLimit(n => n + 10)}
            className="w-full mt-3 py-2 rounded-xl" style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 13 }}>
            더보기
          </button>
        )}
      </div>

      {/* (F) 눈바디 — 몸 사진 갤러리 진입 (전체화면 그리드) */}
      <div className="p-4 rounded-2xl flex items-center justify-between"
        style={isHaon(t) ? solidCardStyle(t) : { backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Images size={18} color={t.accent} />
          <div className="min-w-0">
            <p style={{ fontSize: 13, fontWeight: 700, color: t.text }}>눈바디</p>
            <p style={{ fontSize: 12, color: t.textSub }}>몸 사진을 기록하고 변화를 비교해요</p>
          </div>
        </div>
        <HaonButton variant="secondary" onClick={() => setGalleryOpen(true)} className="text-sm flex-shrink-0">
          갤러리 열기
        </HaonButton>
      </div>

      {galleryOpen && (
        <BodyGallery
          weightRecords={records}
          onClose={() => setGalleryOpen(false)}
          onAddWeight={(d) => { setGalleryOpen(false); openNew(); setDate(d); }}
        />
      )}

      {/* 덮어쓰기/충돌 확인 모달 */}
      {pendingOverwrite && (
        <ConfirmModal
          message={isEditing
            ? `${pendingOverwrite.slot} 자리에 다른 기록이 있어요. 옮길까요?`
            : `${pendingOverwrite.slot} 기록이 이미 있어요. 덮어쓸까요?`}
          description={isEditing
            ? `${pendingOverwrite.date} ${pendingOverwrite.slot}의 기존 기록(${pendingOverwrite.weight}kg)을 지우고 이 기록을 그 날짜·시간대로 옮깁니다.`
            : `${pendingOverwrite.date} ${pendingOverwrite.slot}의 기존 기록(${pendingOverwrite.weight}kg)을 새 값으로 교체합니다.`}
          confirmText={isEditing ? '옮기기' : '덮어쓰기'}
          confirmDanger={isEditing}
          onConfirm={confirmOverwrite}
          onCancel={() => setPendingOverwrite(null)}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteId && (
        <ConfirmModal
          message="이 기록을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { handleDelete(deleteId); setDeleteId(null); }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* 목표 설정/수정 모달 */}
      {showGoalModal && (
        <GoalModal initial={goal} onClose={() => setShowGoalModal(false)} onSave={handleSaveGoal} />
      )}
    </div>
  );
}
