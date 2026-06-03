import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays, subYears, parseISO } from 'date-fns';
import { Trash2, Plus, X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { WeightRecord, WeightGoal } from '../store';
import ConfirmModal from './ConfirmModal';

// 차트 라인 색상 (디자인 시스템: 골드/코랄/그린)
const COLOR_WEIGHT = '#C4A882';   // 골드
const COLOR_FAT = '#D4735A';      // 코랄
const COLOR_MUSCLE = '#6BAA7A';   // 그린

type RangeKey = '7d' | '30d' | '1y';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: '1y', label: '1년', days: 365 },
];

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
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}
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
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl"
            style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14 }}>취소</button>
          <button disabled={!canSave}
            onClick={() => onSave({
              startWeight: numOrNull(startWeight)!,
              targetWeight: numOrNull(targetWeight)!,
              targetBodyFat: numOrNull(targetBodyFat),
              targetMuscleMass: numOrNull(targetMuscle),
            })}
            className="flex-1 py-2.5 rounded-xl"
            style={{
              backgroundColor: canSave ? t.accent : t.bgSub,
              color: canSave ? '#fff' : t.textMuted, fontSize: 14, fontWeight: 600,
            }}>저장</button>
        </div>
      </div>
    </div>
  );
}

export function WeightTab() {
  const { t } = useTheme();

  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);

  // 입력 폼
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [memo, setMemo] = useState('');

  const [pendingOverwrite, setPendingOverwrite] = useState<WeightRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const [range, setRange] = useState<RangeKey>('30d');
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
  const latest = sorted[0] ?? null;

  const hasFatData = records.some(r => r.bodyFat != null);
  const hasMuscleData = records.some(r => r.muscleMass != null);

  // ── 저장 ──
  const resetForm = () => { setWeight(''); setBodyFat(''); setMuscle(''); setMemo(''); };

  const buildRecord = (existingId?: string): WeightRecord => ({
    id: existingId ?? crypto.randomUUID(),
    date,
    weight: numOrNull(weight)!,
    bodyFat: numOrNull(bodyFat),
    muscleMass: numOrNull(muscle),
    memo: memo.trim() || null,
  });

  const saveRecord = (rec: WeightRecord) => {
    db.weightRecords.upsert(rec).then(() => db.weightRecords.fetchAll().then(setRecords));
    resetForm();
    setInputOpen(false);
  };

  const handleSubmit = () => {
    if (numOrNull(weight) == null) return;
    const existing = records.find(r => r.date === date);
    if (existing) {
      setPendingOverwrite(existing);
      return;
    }
    saveRecord(buildRecord());
  };

  const handleDelete = (id: string) => {
    db.weightRecords.delete(id).then(() => db.weightRecords.fetchAll().then(setRecords));
  };

  const handleSaveGoal = (g: WeightGoal) => {
    db.weightGoal.upsert(g).then(() => db.weightGoal.fetch().then(setGoal));
    setShowGoalModal(false);
  };

  // ── 통계 ──
  const changeFrom = (days: number): number | null => {
    if (!latest) return null;
    const targetDate = format(subDays(parseISO(latest.date), days), 'yyyy-MM-dd');
    // 기준일 이전(<=)에서 가장 가까운 기록
    const past = sorted.find(r => r.date <= targetDate);
    if (!past) return null;
    return +(latest.weight - past.weight).toFixed(1);
  };
  const change7 = changeFrom(7);
  const change30 = changeFrom(30);

  // 선택 기간 내 최저/최고
  const rangeDays = RANGES.find(r => r.key === range)!.days;
  const rangeCutoff = format(subDays(new Date(), rangeDays - 1), 'yyyy-MM-dd');
  const rangeRecords = useMemo(
    () => sorted.filter(r => r.date >= rangeCutoff),
    [sorted, rangeCutoff],
  );
  const minW = rangeRecords.length ? Math.min(...rangeRecords.map(r => r.weight)) : null;
  const maxW = rangeRecords.length ? Math.max(...rangeRecords.map(r => r.weight)) : null;

  // ── 진행률 ──
  const progress = useMemo(() => {
    if (!goal || !latest) return null;
    const denom = goal.startWeight - goal.targetWeight;
    if (denom === 0) return 100;
    const raw = ((goal.startWeight - latest.weight) / denom) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [goal, latest]);

  // ── 차트 데이터 (오래된→최신, 오름차순) ──
  const chartCutoff = range === '1y'
    ? format(subYears(new Date(), 1), 'yyyy-MM-dd')
    : format(subDays(new Date(), rangeDays - 1), 'yyyy-MM-dd');
  const chartData = useMemo(() =>
    [...records]
      .filter(r => r.date >= chartCutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({
        date: r.date.slice(5), // MM-dd
        weight: r.weight,
        bodyFat: r.bodyFat ?? null,
        muscleMass: r.muscleMass ?? null,
      })),
    [records, chartCutoff],
  );

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
    <div className="p-3 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: color ?? t.text }}>{value}</p>
    </div>
  );

  const canSubmit = numOrNull(weight) != null;

  return (
    <div className="space-y-5">
      {/* (A) 입력 영역 — 기본 접힘 */}
      {!inputOpen && (
        <button onClick={() => setInputOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl"
          style={{ fontSize: 14, fontWeight: 600, color: '#fff', backgroundColor: t.accent }}>
          <Plus size={16} /> 몸무게 기록하기
        </button>
      )}
      {inputOpen && (
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>몸무게 기록</span>
          <button onClick={() => { setInputOpen(false); resetForm(); }} className="p-1 rounded"
            style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer' }} aria-label="닫기">
            <X size={15} />
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <label style={{ fontSize: 12, color: t.textSub }}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text }} />
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
        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full mt-3 py-2.5 rounded-xl"
          style={{
            backgroundColor: canSubmit ? t.accent : t.bgSub,
            color: canSubmit ? '#fff' : t.textMuted, fontSize: 14, fontWeight: 600,
          }}>기록하기</button>
      </div>
      )}

      {/* (B) 목표 영역 */}
      {goal ? (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              목표 {goal.targetWeight}kg
              <span style={{ fontSize: 12, fontWeight: 400, color: t.textMuted }}> (시작 {goal.startWeight}kg)</span>
            </span>
            <button onClick={() => setShowGoalModal(true)}
              style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>목표 수정</button>
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
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 13, color: t.textSub }}>목표 체중을 설정해보세요</span>
          <button onClick={() => setShowGoalModal(true)}
            className="px-3 py-1.5 rounded-xl" style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            목표 설정
          </button>
        </div>
      )}

      {/* (C) 통계 카드 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {statCard('현재 체중', latest ? `${latest.weight} kg` : '—')}
        {statCard('7일 전 대비', fmtChange(change7), changeColor(change7))}
        {statCard('30일 전 대비', fmtChange(change30), changeColor(change30))}
        {statCard(
          `최저·최고 (${RANGES.find(r => r.key === range)!.label})`,
          minW != null && maxW != null ? `${minW} / ${maxW}` : '—',
        )}
      </div>

      {/* (D) 추이 차트 */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        {/* 기간 토글 */}
        <div className="flex gap-1.5 mb-3">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className="px-3 py-1 rounded-full transition-colors"
              style={{
                fontSize: 12, fontWeight: range === r.key ? 700 : 500,
                backgroundColor: range === r.key ? t.accent : t.bgSub,
                color: range === r.key ? '#fff' : t.textSub,
              }}>{r.label}</button>
          ))}
        </div>

        {/* 라인 토글 */}
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
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.borderLight} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false}
                domain={['dataMin - 1', 'dataMax + 1']} />
              {(showFat || showMuscle) && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: t.textMuted }}
                  tickLine={false} axisLine={false} />
              )}
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: `1px solid ${t.border}`, backgroundColor: t.card }} />
              {goal && (
                <ReferenceLine yAxisId="left" y={goal.targetWeight} stroke={t.accent}
                  strokeDasharray="4 4" label={{ value: `목표 ${goal.targetWeight}`, fontSize: 10, fill: t.accent, position: 'insideTopRight' }} />
              )}
              <Line yAxisId="left" type="monotone" dataKey="weight" name="체중"
                stroke={COLOR_WEIGHT} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              {showFat && hasFatData && (
                <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="체지방"
                  stroke={COLOR_FAT} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              )}
              {showMuscle && hasMuscleData && (
                <Line yAxisId="right" type="monotone" dataKey="muscleMass" name="골격근"
                  stroke={COLOR_MUSCLE} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              )}
            </LineChart>
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
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.textSub, width: 60, flexShrink: 0 }}>{r.date.slice(5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
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
                <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: t.bgSub }}>
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

      {/* 덮어쓰기 확인 모달 */}
      {pendingOverwrite && (
        <ConfirmModal
          message="오늘 이미 기록이 있어요. 덮어쓸까요?"
          description={`${pendingOverwrite.date}의 기존 기록(${pendingOverwrite.weight}kg)을 새 값으로 교체합니다.`}
          confirmText="덮어쓰기"
          onConfirm={() => { saveRecord(buildRecord(pendingOverwrite.id)); setPendingOverwrite(null); }}
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
