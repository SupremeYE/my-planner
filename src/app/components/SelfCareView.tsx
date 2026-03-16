import React, { useState } from 'react';
import { Plus, X, Dumbbell, BookOpen, Sparkles } from 'lucide-react';
import { usePlanner, SelfCareRecord } from '../store';
import { useTheme } from '../ThemeContext';
import { format, subDays } from 'date-fns';

const CATEGORIES = [
  { key: 'exercise' as const, label: '운동 & 피트니스', icon: Dumbbell, color: '#D4735A' },
  { key: 'study' as const, label: '퇴근 후 공부', icon: BookOpen, color: '#7B9ED9' },
  { key: 'beauty' as const, label: '뷰티 & 케어', icon: Sparkles, color: '#A07BE0' },
];

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
