import React, { useState } from 'react';
import { Plus, X, Dumbbell, BookOpen, Sparkles, Moon, ChevronDown, ChevronRight, Heart, Trash2, Pencil } from 'lucide-react';
import { usePlanner, SelfCareRecord } from '../store';
import { useTheme } from '../ThemeContext';
import { format, subDays, differenceInDays, parseISO, addDays } from 'date-fns';
import { TimePicker } from './TimePicker';

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
  if (diff <= 0) diff += 24 * 60; // 자정 넘기는 케이스
  return diff;
}

function fmtSleep(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function PeriodSection() {
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
                <div style={{ fontSize: 20, fontWeight: 700, color: cycleLabelColor(prediction.avgCycle), fontFamily: "'DM Serif Display', serif" }}>
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

function SleepSection() {
  const { selfCareRecords, addSelfCareRecord, deleteSelfCareRecord } = usePlanner();
  const { t } = useTheme();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sleepStart, setSleepStart] = useState('');
  const [sleepEnd, setSleepEnd] = useState('');

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
      duration: calcSleepMinutes(sleepStart, sleepEnd),
      sleepStart,
      sleepEnd,
    });
    setSleepStart('');
    setSleepEnd('');
  };

  // 통계
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');
  const monthRecords = sleepRecords.filter(r => r.date.startsWith(currentMonth));
  const monthAvg = monthRecords.length
    ? Math.round(monthRecords.reduce((s, r) => s + r.duration, 0) / monthRecords.length)
    : 0;

  // 최근 7일 데이터
  const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));
  const sleepByDate: Record<string, number> = {};
  sleepRecords.forEach(r => { if (!sleepByDate[r.date]) sleepByDate[r.date] = r.duration; });
  const last7Data = last7Days.map(d => ({
    date: d,
    label: d === format(today, 'yyyy-MM-dd') ? '오늘' : ['일','월','화','수','목','금','토'][new Date(d).getDay()],
    duration: sleepByDate[d] ?? 0,
  }));
  const weekWithData = last7Data.filter(d => d.duration > 0);
  const weekAvg = weekWithData.length
    ? Math.round(weekWithData.reduce((s, d) => s + d.duration, 0) / weekWithData.length)
    : 0;
  const maxBar = Math.max(...last7Data.map(d => d.duration), 8 * 60);

  const hasStats = sleepRecords.length > 0;

  return (
    <div className="mb-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Moon size={16} color={SLEEP_COLOR} />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>수면</span>
        {monthRecords.length > 0 && (
          <span className="ml-auto px-2.5 py-0.5 rounded-full"
            style={{ fontSize: 10, backgroundColor: SLEEP_COLOR + '20', color: SLEEP_COLOR }}>
            {monthRecords.length}회 &middot; 이번달 평균 {fmtSleep(monthAvg)}
          </span>
        )}
      </div>

      {/* 입력 폼 */}
      <div className="p-4 rounded-xl mb-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:items-end">
          {/* 날짜 */}
          <div className="col-span-2 lg:col-span-1">
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: t.border, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }} />
          </div>
          {/* 취침 시간 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>취침</label>
            <div className="mt-1">
              <TimePicker value={sleepStart} onChange={setSleepStart} placeholder="취침 시간" minuteStep={5} />
            </div>
          </div>
          {/* 기상 시간 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>기상</label>
            <div className="mt-1">
              <TimePicker value={sleepEnd} onChange={setSleepEnd} placeholder="기상 시간" minuteStep={5} />
            </div>
          </div>
          {/* 자동 계산 + 기록 버튼 */}
          <div className="col-span-2 lg:col-span-1 flex flex-col justify-end gap-1">
            {previewMin > 0 && (
              <div className="text-center" style={{ fontSize: 12, color: SLEEP_COLOR, fontWeight: 700 }}>
                {fmtSleep(previewMin)}
              </div>
            )}
            <button onClick={handleAdd} disabled={!sleepStart || !sleepEnd}
              className="w-full py-2 rounded-lg transition-colors"
              style={{
                fontSize: 13, fontWeight: 600,
                backgroundColor: sleepStart && sleepEnd ? SLEEP_COLOR : t.bgSub,
                color: sleepStart && sleepEnd ? '#fff' : t.textMuted,
                cursor: sleepStart && sleepEnd ? 'pointer' : 'default',
              }}>
              기록하기
            </button>
          </div>
        </div>
      </div>

      {/* 통계 + 바 차트 */}
      {hasStats && (
        <div className="p-4 rounded-xl mb-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          {/* 통계 카드 */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 text-center">
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>이번주 평균</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>
                {weekAvg > 0 ? fmtSleep(weekAvg) : '—'}
              </div>
            </div>
            <div style={{ width: 1, backgroundColor: t.borderLight, flexShrink: 0 }} />
            <div className="flex-1 text-center">
              <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 2 }}>이번달 평균</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>
                {monthAvg > 0 ? fmtSleep(monthAvg) : '—'}
              </div>
            </div>
          </div>

          {/* 최근 7일 바 차트 */}
          <div>
            <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 600, marginBottom: 6 }}>최근 7일 수면</div>
            <div className="flex items-end justify-between gap-1" style={{ height: 80 }}>
              {last7Data.map(d => {
                const barH = d.duration > 0 ? Math.max(6, Math.round((d.duration / maxBar) * 56)) : 3;
                const isGood = d.duration >= 7 * 60;
                const barColor = d.duration === 0
                  ? t.borderLight
                  : isGood ? SLEEP_COLOR : '#D4735A';
                return (
                  <div key={d.date} className="flex flex-col items-center flex-1" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 8, color: SLEEP_COLOR, fontWeight: 600, height: 12, lineHeight: '12px' }}>
                      {d.duration > 0 ? `${Math.floor(d.duration / 60)}h` : ''}
                    </span>
                    <div style={{
                      width: '75%', minWidth: 8, height: barH,
                      backgroundColor: barColor,
                      borderRadius: '3px 3px 2px 2px',
                    }} />
                    <span style={{ fontSize: 9, color: t.textMuted, marginTop: 3 }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SLEEP_COLOR, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: t.textMuted }}>7시간 이상</span>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#D4735A', flexShrink: 0, marginLeft: 6 }} />
              <span style={{ fontSize: 9, color: t.textMuted }}>7시간 미만</span>
            </div>
          </div>
        </div>
      )}

      {/* 최근 기록 목록 */}
      <div className="space-y-2">
        {sleepRecords.slice(0, 5).map(r => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
            <Moon size={12} color={SLEEP_COLOR} />
            <span style={{ fontSize: 11, color: t.textMuted, width: 48, flexShrink: 0 }}>{r.date.slice(5)}</span>
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
        {sleepRecords.length === 0 && (
          <p style={{ fontSize: 12, color: t.textMuted, padding: '4px 0' }}>아직 수면 기록이 없습니다</p>
        )}
      </div>
    </div>
  );
}

function AddRecordModal({ onClose }: { onClose: () => void }) {
  const { addSelfCareRecord } = usePlanner();
  const { t } = useTheme();
  const [category, setCategory] = useState<'exercise' | 'study' | 'beauty'>('exercise');
  const [content, setContent] = useState('');
  const [duration, setDuration] = useState(30);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = () => {
    if (!content.trim()) return;
    addSelfCareRecord({ date, category, content: content.trim(), duration });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl shadow-xl w-[400px]" style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>기록 추가</h3>
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
          <button onClick={handleSubmit} className="flex-1 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>추가</button>
        </div>
      </div>
    </div>
  );
}

export function SelfCareView() {
  const { selfCareRecords } = usePlanner();
  const { t } = useTheme();
  const [showAdd, setShowAdd] = useState(false);

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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>자기관리</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>운동, 공부, 케어 활동을 기록하고 추적하세요</p>
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
              <span style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* 생리 기록 섹션 */}
        <PeriodSection />

        {/* 수면 섹션 */}
        <SleepSection />

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
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                    <span style={{ fontSize: 11, color: t.textMuted, width: 80 }}>{r.date.slice(5)}</span>
                    <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{r.content}</span>
                    <span style={{ fontSize: 11, color: cat.color, fontWeight: 600 }}>{r.duration}분</span>
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
    </div>
  );
}
