import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays, startOfMonth, getDaysInMonth, getDay, parseISO } from 'date-fns';
import { Trash2, Plus, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { getSymptomOptions, STRESS_LEVELS } from '../../constants/symptoms';
import type { ConditionRecord } from '../store';
import ConfirmModal from './ConfirmModal';

const STRESS_COLOR = '#D4735A'; // 코랄 — 히트맵/막대 색

// 스트레스 단계(1~5)별 농도 (코랄 단색 그라데이션)
const stressShade = (level: number) => {
  const alpha = 0.18 + (level - 1) * 0.205; // 1→0.18 ... 5→1.0
  return `rgba(212,115,90,${alpha.toFixed(2)})`;
};

export function ConditionTab() {
  const { t } = useTheme();

  const [records, setRecords] = useState<ConditionRecord[]>([]);

  // 입력 폼
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [stress, setStress] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [memo, setMemo] = useState('');

  const [pendingOverwrite, setPendingOverwrite] = useState<ConditionRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(10);
  const [inputOpen, setInputOpen] = useState(false); // 입력 폼 기본 접힘

  const symptomOptions = getSymptomOptions();

  // ── fetch + realtime ──
  const refresh = useCallback(() => {
    db.conditionRecords.fetchAll().then(setRecords);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('condition_records', refresh);

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);

  // ── 저장 ──
  const resetForm = () => { setStress(null); setSymptoms([]); setMemo(''); };

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

  // ── 통계 ──
  const today = new Date();
  const weekCutoff = format(subDays(today, 6), 'yyyy-MM-dd');
  const monthPrefix = format(today, 'yyyy-MM');

  const weekRecs = records.filter(r => r.date >= weekCutoff);
  const monthRecs = records.filter(r => r.date.startsWith(monthPrefix));

  const avg = (arr: ConditionRecord[]) =>
    arr.length ? (arr.reduce((s, r) => s + r.stress, 0) / arr.length).toFixed(1) : '—';
  const weekAvg = avg(weekRecs);
  const monthAvg = avg(monthRecs);

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

  const visibleRecords = sorted.slice(0, listLimit);

  const stressLabel = (v: number) => STRESS_LEVELS.find(s => s.value === v)?.label ?? String(v);

  return (
    <div className="space-y-5">
      {/* (A) 입력 영역 — 기본 접힘 */}
      {!inputOpen && (
        <button onClick={() => setInputOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl"
          style={{ fontSize: 14, fontWeight: 600, color: '#fff', backgroundColor: t.accent }}>
          <Plus size={16} /> 컨디션 기록하기
        </button>
      )}
      {inputOpen && (
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
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
        <div className="flex flex-wrap gap-1.5 mt-1">
          {symptomOptions.map(s => {
            const active = symptoms.includes(s);
            return (
              <button key={s} onClick={() => toggleSymptom(s)}
                className="px-3 py-1.5 rounded-full transition-all"
                style={{
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  backgroundColor: active ? STRESS_COLOR : t.bgSub,
                  color: active ? '#fff' : t.textSub,
                  border: `1px solid ${active ? STRESS_COLOR : t.border}`,
                }}>{s}</button>
            );
          })}
        </div>

        {/* 메모 */}
        <label style={{ fontSize: 12, color: t.textSub, display: 'block', marginTop: 14 }}>메모 (선택)</label>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="오늘 컨디션은 어땠나요?"
          className="w-full mt-1 px-3 py-2 rounded-xl outline-none resize-none"
          style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }} />

        <button onClick={handleSubmit} disabled={stress == null}
          className="w-full mt-3 py-2.5 rounded-xl"
          style={{
            backgroundColor: stress != null ? t.accent : t.bgSub,
            color: stress != null ? '#fff' : t.textMuted, fontSize: 14, fontWeight: 600,
          }}>기록하기</button>
      </div>
      )}

      {/* (B) 통계 — 평균 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>이번주 평균 스트레스</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{weekAvg}</p>
        </div>
        <div className="p-3 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>이번달 평균 스트레스</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{monthAvg}</p>
        </div>
      </div>

      {/* 자주 나타난 증상 Top 3 */}
      {topSymptoms.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
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

      {/* 스트레스 추이 차트 */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>최근 30일 스트레스 추이</p>
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.borderLight} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: t.textMuted }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: `1px solid ${t.border}`, backgroundColor: t.card }} />
              <Bar dataKey="stress" radius={[4, 4, 0, 0]}>
                {trend.map((d, i) => <Cell key={i} fill={stressShade(d.stress)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-10 text-center" style={{ fontSize: 13, color: t.textMuted }}>기록이 쌓이면 추이가 표시됩니다</div>
        )}
      </div>

      {/* 스트레스 히트맵 (이번달) */}
      <div className="p-4 rounded-2xl" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>
          {format(today, 'M월')} 스트레스 히트맵
        </p>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <div key={d} className="text-center" style={{ fontSize: 10, color: t.textMuted }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {heatmap.map((cell, i) => cell === null ? (
            <div key={i} style={{ aspectRatio: '1' }} />
          ) : (
            <div key={i} className="flex items-center justify-center rounded-lg"
              style={{
                aspectRatio: '1',
                backgroundColor: cell.stress != null ? stressShade(cell.stress) : t.bgSub,
                border: `1px solid ${t.border}`,
              }}
              title={cell.stress != null ? `${cell.dateStr} · 스트레스 ${cell.stress}` : cell.dateStr}>
              <span style={{ fontSize: 10, color: cell.stress != null && cell.stress >= 3 ? '#fff' : t.textMuted }}>
                {cell.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* (C) 기록 리스트 */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>기록</p>
        {visibleRecords.length === 0 ? (
          <div className="py-8 text-center rounded-2xl"
            style={{ backgroundColor: t.bgSub, fontSize: 13, color: t.textMuted }}>
            아직 컨디션 기록이 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {visibleRecords.map(r => (
              <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
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
        {sorted.length > listLimit && (
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
