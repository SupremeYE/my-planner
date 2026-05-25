import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Mic, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '../ThemeContext';
import { supabase } from '../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type TimeOfDay = '아침' | '낮' | '저녁' | '지금';

interface MoodRecord {
  id: string;
  date: string;
  time_of_day: TimeOfDay;
  body_signals: string[];
  emotion_tags: string[];
  energy_level: number;
  memo: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BODY_SIGNALS = ['어깨 뭉침', '가슴 답답', '배 긴장', '목 뻐근', '편안함'];

const EMOTION_CATEGORIES: { emoji: string; label: string; emotions: string[] }[] = [
  { emoji: '😊', label: '행복', emotions: ['만족', '즐거움', '설렘', '기쁨', '안도감', '희망', '편안함', '흥분', '뿌듯함', '열정'] },
  { emoji: '💕', label: '사랑', emotions: ['따뜻함', '감동', '애착', '다정함', '연민'] },
  { emoji: '😤', label: '분노', emotions: ['짜증', '속상함', '불만', '언짢음', '답답함'] },
  { emoji: '😨', label: '두려움', emotions: ['불안', '긴장됨', '걱정', '초조함', '무서움'] },
  { emoji: '💚', label: '부러움/질투', emotions: ['부러움', '질투', '시기', '경쟁심', '소유욕'] },
  { emoji: '😢', label: '슬픔', emotions: ['외로움', '우울', '실망', '낙담', '허무함'] },
  { emoji: '🤢', label: '혐오', emotions: ['불쾌함', '역겨움', '싫음', '반감'] },
  { emoji: '😔', label: '수치/죄책감', emotions: ['부끄러움', '후회', '미안함', '창피함'] },
  { emoji: '😑', label: '기타', emotions: ['무기력', '피곤', '멍함', '집중', '평온'] },
];

const ENERGY_LABELS: Record<number, string> = { 1: '매우 낮음', 2: '낮음', 3: '보통', 4: '높음', 5: '매우 높음' };

// ─── 감정 카테고리 색상 ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
  '행복':      { bg: '#FFF0F3', accent: '#E88CA0' },
  '사랑':      { bg: '#FFE4E8', accent: '#D4607A' },
  '분노':      { bg: '#FDE8E8', accent: '#C45A5A' },
  '두려움':    { bg: '#FFF4E0', accent: '#D4922A' },
  '부러움/질투': { bg: '#F2F2F2', accent: '#888888' },
  '슬픔':      { bg: '#E8EEF8', accent: '#6B8CC4' },
  '혐오':      { bg: '#FDE8E8', accent: '#C45A5A' },
  '수치/죄책감': { bg: '#E8EEF8', accent: '#6B8CC4' },
  '기타':      { bg: '#F0EEF8', accent: '#8B7EC8' },
};

// 감정 태그 → 카테고리 레이블 매핑
const TAG_CATEGORY: Record<string, string> = {};
EMOTION_CATEGORIES.forEach(cat => {
  cat.emotions.forEach(e => { TAG_CATEGORY[e] = cat.label; });
});

function getEmotionColor(tags: string[]): { bg: string; accent: string } | null {
  for (const tag of tags) {
    const cat = TAG_CATEGORY[tag];
    if (cat && CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  }
  return null;
}

function getCategoryEmoji(tags: string[]): string {
  for (const tag of tags) {
    const cat = EMOTION_CATEGORIES.find(c => c.emotions.includes(tag));
    if (cat) return cat.emoji;
  }
  return '🌸';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKoreanTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}

function autoTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '아침';
  if (h >= 12 && h < 18) return '낮';
  if (h >= 18 && h < 23) return '저녁';
  return '지금';
}

// ─── VoiceInputButton ─────────────────────────────────────────────────────────

function VoiceInputButton({ onResult, disabled }: { onResult: (text: string) => void; disabled?: boolean }) {
  const { t } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) return null;

  const toggle = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SpeechRecognitionAPI();
    r.lang = 'ko-KR'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => onResult(e.results[0][0].transcript);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    recognitionRef.current = r;
    r.start(); setIsListening(true);
  };

  return (
    <button type="button" onClick={toggle} disabled={disabled}
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{ width: 30, height: 30, backgroundColor: isListening ? '#fee2e2' : t.bgSub, border: `1px solid ${isListening ? '#fca5a5' : t.borderLight}`, color: isListening ? '#ef4444' : t.textMuted }}>
      {isListening
        ? <span className="animate-pulse rounded-full" style={{ width: 9, height: 9, backgroundColor: '#ef4444', display: 'block' }} />
        : <Mic size={13} />}
    </button>
  );
}

// ─── RecordSheet (4-step form) ────────────────────────────────────────────────

interface RecordSheetProps {
  onClose: () => void;
  onSave: (data: Omit<MoodRecord, 'id' | 'created_at'>) => Promise<void>;
  initialData?: MoodRecord | null;
  defaultDate?: string;
}

function RecordSheet({ onClose, onSave, initialData, defaultDate }: RecordSheetProps) {
  const { t } = useTheme();
  const [step, setStep] = useState(1);
  const [bodySignals, setBodySignals] = useState<string[]>(initialData?.body_signals ?? []);
  const [emotionTags, setEmotionTags] = useState<string[]>(initialData?.emotion_tags ?? []);
  const [energyLevel, setEnergyLevel] = useState(initialData?.energy_level ?? 3);
  const [memo, setMemo] = useState(initialData?.memo ?? '');
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const totalSteps = 4;

  const toggleBodySignal = (s: string) =>
    setBodySignals(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleEmotionTag = (tag: string) => {
    if (emotionTags.includes(tag)) setEmotionTags(prev => prev.filter(x => x !== tag));
    else if (emotionTags.length < 3) setEmotionTags(prev => [...prev, tag]);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      date: initialData?.date ?? defaultDate ?? today,
      time_of_day: initialData?.time_of_day ?? autoTimeOfDay(),
      body_signals: bodySignals,
      emotion_tags: emotionTags,
      energy_level: energyLevel,
      memo: memo.trim() || null,
    });
    setSaving(false);
    onClose();
  };

  const chipStyle = (active: boolean) => ({
    padding: '6px 12px', borderRadius: 20, fontSize: 12,
    fontWeight: active ? 600 : 400,
    backgroundColor: active ? t.accentLight : t.card,
    border: `1px solid ${active ? t.accent : t.borderLight}`,
    color: active ? t.accent : t.textSub,
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="rounded-t-2xl" style={{ backgroundColor: t.bg, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div>
            <p style={{ fontSize: 11, color: t.textMuted }}>{step} / {totalSteps}단계</p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              {step === 1 && '몸 상태는 어떤가요?'}
              {step === 2 && '감정 단어를 골라보세요 (최대 3개)'}
              {step === 3 && '에너지 레벨은 어느 정도인가요?'}
              {step === 4 && '이 감정이 든 이유 (선택)'}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-5 mb-5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full transition-all"
              style={{ backgroundColor: i < step ? t.accent : t.borderLight }} />
          ))}
        </div>

        {/* Step Content */}
        <div className="px-5 pb-6">
          {/* Step 1: 몸 상태 */}
          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {BODY_SIGNALS.map(signal => (
                <button key={signal} onClick={() => toggleBodySignal(signal)} style={chipStyle(bodySignals.includes(signal))}>
                  {signal}
                </button>
              ))}
              <p style={{ fontSize: 11, color: t.textMuted, width: '100%', marginTop: 8 }}>
                복수 선택 가능 · 없으면 건너뛰기 가능
              </p>
            </div>
          )}

          {/* Step 2: 감정 단어 */}
          {step === 2 && (
            <div className="space-y-4">
              <p style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
                선택됨: {emotionTags.length}/3{emotionTags.length > 0 && ` — ${emotionTags.join(', ')}`}
              </p>
              {EMOTION_CATEGORIES.map(cat => {
                const color = CATEGORY_COLORS[cat.label];
                return (
                  <div key={cat.label}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: color?.accent ?? t.textSub, marginBottom: 6 }}>
                      {cat.emoji} {cat.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.emotions.map(emotion => {
                        const selected = emotionTags.includes(emotion);
                        const maxed = emotionTags.length >= 3 && !selected;
                        return (
                          <button key={emotion} onClick={() => toggleEmotionTag(emotion)} disabled={maxed}
                            style={{
                              padding: '5px 11px', borderRadius: 20, fontSize: 12,
                              fontWeight: selected ? 600 : 400,
                              backgroundColor: selected ? (color?.bg ?? t.accentLight) : t.card,
                              border: `1px solid ${selected ? (color?.accent ?? t.accent) : t.borderLight}`,
                              color: selected ? (color?.accent ?? t.accent) : t.textSub,
                              cursor: maxed ? 'not-allowed' : 'pointer',
                              opacity: maxed ? 0.4 : 1,
                              transition: 'all 0.15s',
                            }}>
                            {emotion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 3: 에너지 레벨 */}
          {step === 3 && (
            <div>
              <div className="flex justify-center gap-4 mb-6">
                {[1, 2, 3, 4, 5].map(level => (
                  <button key={level} onClick={() => setEnergyLevel(level)}
                    className="flex flex-col items-center gap-1.5 transition-transform"
                    style={{ transform: energyLevel === level ? 'scale(1.1)' : 'scale(1)' }}>
                    <div className="rounded-full transition-all"
                      style={{ width: energyLevel === level ? 40 : 32, height: energyLevel === level ? 40 : 32, backgroundColor: energyLevel === level ? t.accent : t.bgSub, border: `2px solid ${energyLevel === level ? t.accent : t.borderLight}` }} />
                    <span style={{ fontSize: 12, fontWeight: energyLevel === level ? 700 : 400, color: energyLevel === level ? t.accent : t.textMuted }}>
                      {level}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-center py-3 rounded-xl" style={{ backgroundColor: t.accentLight }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{ENERGY_LABELS[energyLevel]}</span>
              </div>
            </div>
          )}

          {/* Step 4: 이유 메모 */}
          {step === 4 && (
            <div>
              <div className="flex items-end gap-2">
                <textarea value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="어떤 일이 있었나요? (선택)"
                  rows={4}
                  className="flex-1 rounded-xl px-4 py-3 border outline-none resize-none"
                  style={{ borderColor: t.border, backgroundColor: t.card, color: t.text, fontSize: 14 }}
                  autoFocus />
                <VoiceInputButton onResult={text => setMemo(prev => prev ? `${prev} ${text}` : text)} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 px-5 pb-8">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 px-5 py-3 rounded-xl"
              style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14, fontWeight: 600, border: `1px solid ${t.borderLight}` }}>
              <ChevronLeft size={16} /> 이전
            </button>
          ) : <div className="w-2 flex-shrink-0" />}
          {step < totalSteps ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 600 }}>
              다음 <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-3 rounded-xl"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? '저장 중...' : '저장하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────────

function RecordCard({
  record,
  onEdit,
  onDelete,
  compact = false,
}: {
  record: MoodRecord;
  onEdit: (r: MoodRecord) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const { t } = useTheme();
  const color = getEmotionColor(record.emotion_tags);

  return (
    <div className="rounded-xl" style={{ backgroundColor: color?.bg ?? t.card, border: `1px solid ${color ? color.accent + '33' : t.borderLight}`, padding: compact ? 12 : 16 }}>
      <div className="flex items-start justify-between mb-2">
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: color?.accent ?? t.accent }}>
          {formatKoreanTime(record.created_at)}
        </span>
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(record)} style={{ color: t.textMuted }}><Pencil size={13} /></button>
          <button onClick={() => onDelete(record.id)} style={{ color: t.textMuted }}><Trash2 size={13} /></button>
        </div>
      </div>

      {record.body_signals.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {record.body_signals.map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full"
              style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.7)', color: t.textSub, border: `1px solid ${t.borderLight}` }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {record.emotion_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {record.emotion_tags.map(tag => (
            <span key={tag} className="px-2.5 py-0.5 rounded-full"
              style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.8)', color: color?.accent ?? t.accent, fontWeight: 600 }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(l => (
            <div key={l} className="rounded-full"
              style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, backgroundColor: l <= record.energy_level ? (color?.accent ?? t.accent) : t.borderLight }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: t.textMuted }}>{ENERGY_LABELS[record.energy_level]}</span>
      </div>

      {record.memo && (
        <p className="mt-1.5" style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>"{record.memo}"</p>
      )}
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({
  records,
  today,
  onAddRecord,
  onEdit,
  onDelete,
}: {
  records: MoodRecord[];
  today: string;
  onAddRecord: (date: string) => void;
  onEdit: (r: MoodRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(today);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const dateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };

  const selectedRecords = selectedDate ? records.filter(r => r.date === selectedDate) : [];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-2 rounded-lg" style={{ color: t.textSub }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button onClick={nextMonth} className="p-2 rounded-lg" style={{ color: t.textSub }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '2px 0', color: i === 0 ? '#E88CA0' : i === 6 ? '#6B8CC4' : t.textMuted }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ backgroundColor: t.borderLight }}>
        {cells.map((day, i) => {
          if (!day) return (
            <div key={i} style={{ backgroundColor: t.bg, minHeight: 44 }} />
          );

          const ds = dateStr(day);
          const dayRecs = records.filter(r => r.date === ds);
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const latestRec = dayRecs[0] ?? null;
          const color = latestRec ? getEmotionColor(latestRec.emotion_tags) : null;
          const hasMultiple = dayRecs.length > 1;

          return (
            <div key={i} onClick={() => setSelectedDate(isSelected ? null : ds)}
              className="relative flex flex-col cursor-pointer select-none"
              style={{
                minHeight: 44,
                backgroundColor: color ? color.bg : t.bg,
                outline: isSelected ? `2px solid ${t.accent}` : isToday ? `2px solid ${t.accent}88` : 'none',
                outlineOffset: -1,
                padding: '3px 4px',
              }}>
              <span style={{ fontSize: 11, lineHeight: 1, color: isToday ? t.accent : color ? color.accent : t.textMuted, fontWeight: isToday ? 700 : 400 }}>
                {day}
              </span>
              {latestRec && (
                <div className="flex-1 flex items-center justify-center">
                  <span style={{ fontSize: 18, lineHeight: 1 }}>
                    {getCategoryEmoji(latestRec.emotion_tags)}
                  </span>
                </div>
              )}
              {hasMultiple && (
                <div className="absolute bottom-1 right-1 rounded-full"
                  style={{ width: 5, height: 5, backgroundColor: color?.accent ?? t.accent }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedDate && (
        <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.borderLight}` }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: t.card, borderBottom: `1px solid ${t.borderLight}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{selectedDate}</span>
            <button onClick={() => onAddRecord(selectedDate)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 12, fontWeight: 600 }}>
              <Plus size={13} /> 기록 추가
            </button>
          </div>

          {selectedRecords.length === 0 ? (
            <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '20px 16px', backgroundColor: t.bg }}>
              이 날의 기록이 없어요
            </p>
          ) : (
            <div className="space-y-2 p-3" style={{ backgroundColor: t.bg }}>
              {selectedRecords.map(record => (
                <RecordCard key={record.id} record={record} onEdit={onEdit} onDelete={onDelete} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stats Section ─────────────────────────────────────────────────────────────

function StatsSection({ records, today }: { records: MoodRecord[]; today: string }) {
  const { t } = useTheme();

  // 이번 주 시작 (월요일)
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekRecords = records.filter(r => r.date >= weekStartStr);

  // TOP3 감정 태그
  const tagCounts: Record<string, number> = {};
  weekRecords.forEach(r => r.emotion_tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
  const top3Tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // 최근 7일 에너지
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return format(d, 'yyyy-MM-dd');
  });
  const dailyEnergy = last7Days.map(date => {
    const dayRecs = records.filter(r => r.date === date);
    const avg = dayRecs.length ? dayRecs.reduce((s, r) => s + r.energy_level, 0) / dayRecs.length : null;
    const d = new Date(date + 'T12:00:00');
    return { date, avg, label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] };
  });

  // 시간대별 평균 에너지
  const timeSlots: { label: string; emoji: string; key: TimeOfDay }[] = [
    { label: '아침', emoji: '🌅', key: '아침' },
    { label: '낮', emoji: '☀️', key: '낮' },
    { label: '저녁', emoji: '🌙', key: '저녁' },
    { label: '지금', emoji: '⏰', key: '지금' },
  ];
  const avgByTime = timeSlots.map(slot => {
    const recs = weekRecords.filter(r => r.time_of_day === slot.key);
    const avg = recs.length ? recs.reduce((s, r) => s + r.energy_level, 0) / recs.length : null;
    return { ...slot, avg, count: recs.length };
  });

  const cardStyle = { backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: 16, marginBottom: 12 };

  return (
    <div>
      <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
        이번 주 통계
      </p>

      {/* TOP3 */}
      <div style={cardStyle}>
        <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>감정 태그 TOP3</p>
        {top3Tags.length === 0 ? (
          <p style={{ fontSize: 12, color: t.textMuted }}>이번 주 기록이 없어요</p>
        ) : (
          <div className="space-y-2">
            {top3Tags.map(([tag, count], i) => {
              const color = getEmotionColor([tag]);
              return (
                <div key={tag} className="flex items-center gap-3">
                  <span style={{ fontSize: 12, color: color?.accent ?? t.accent, fontWeight: 700, width: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{tag}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 rounded-full"
                      style={{ width: `${Math.max(20, (count / (top3Tags[0]?.[1] || 1)) * 80)}px`, backgroundColor: color?.accent ?? t.accent, opacity: 0.7 }} />
                    <span style={{ fontSize: 11, color: t.textMuted }}>{count}회</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 에너지 그래프 */}
      <div style={cardStyle}>
        <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>에너지 레벨 (최근 7일)</p>
        <div className="flex items-end gap-1.5" style={{ height: 60 }}>
          {dailyEnergy.map(({ date, avg, label }) => {
            const isToday = date === today;
            return (
              <div key={date} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full rounded-t-sm transition-all"
                  style={{ height: avg !== null ? `${(avg / 5) * 100}%` : 2, backgroundColor: avg !== null ? (isToday ? t.accent : `${t.accent}88`) : t.borderLight, minHeight: 2 }} />
                <span style={{ fontSize: 9, color: isToday ? t.accent : t.textMuted, fontWeight: isToday ? 700 : 400 }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 시간대별 */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>시간대별 평균 에너지</p>
        <div className="grid grid-cols-4 gap-2">
          {avgByTime.map(({ label, emoji, avg, count }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-xl"
              style={{ backgroundColor: avg !== null ? t.accentLight : t.bgSub }}>
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <span style={{ fontSize: 10, color: t.textSub }}>{label}</span>
              {avg !== null ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{avg.toFixed(1)}</span>
                  <span style={{ fontSize: 9, color: t.textMuted }}>{count}회</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: t.textMuted }}>—</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main MoodView ─────────────────────────────────────────────────────────────

export function MoodView() {
  const { t } = useTheme();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [records, setRecords] = useState<MoodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'calendar'>('list');
  const [showSheet, setShowSheet] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MoodRecord | null>(null);
  const [newRecordDate, setNewRecordDate] = useState<string | undefined>(undefined);

  const loadRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mood_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRecords(data as MoodRecord[]);
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, []);

  const handleSave = async (data: Omit<MoodRecord, 'id' | 'created_at'>) => {
    if (editingRecord) {
      await supabase.from('mood_records').update(data).eq('id', editingRecord.id);
    } else {
      await supabase.from('mood_records').insert({ ...data, id: crypto.randomUUID() });
    }
    setEditingRecord(null);
    setNewRecordDate(undefined);
    await loadRecords();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    await supabase.from('mood_records').delete().eq('id', id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const openEdit = (record: MoodRecord) => {
    setEditingRecord(record);
    setNewRecordDate(undefined);
    setShowSheet(true);
  };

  const openNewForDate = (date: string) => {
    setEditingRecord(null);
    setNewRecordDate(date);
    setShowSheet(true);
  };

  const todayRecords = records.filter(r => r.date === today);
  const pastRecords = records.filter(r => r.date !== today);

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>
            감정 기록
          </h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>지금 이 순간의 감정을 기록해보세요</p>
        </div>
        <button
          onClick={() => { setEditingRecord(null); setNewRecordDate(undefined); setShowSheet(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          <Plus size={15} /> 기록
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 mb-4">
        {([['list', '기록'], ['calendar', '캘린더']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2 rounded-xl transition-all"
            style={{ fontSize: 13, fontWeight: tab === key ? 600 : 400, backgroundColor: tab === key ? t.accent : t.bgSub, color: tab === key ? '#fff' : t.textSub }}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-4">

        {/* ── 기록 탭 ── */}
        {tab === 'list' && (
          <>
            {/* 오늘 기록 */}
            <div>
              <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                오늘 기록 ({todayRecords.length}건)
              </p>
              {loading && <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: 24 }}>불러오는 중...</p>}
              {!loading && todayRecords.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8 rounded-2xl"
                  style={{ backgroundColor: t.card, border: `1px dashed ${t.borderLight}` }}>
                  <span style={{ fontSize: 36 }}>🌸</span>
                  <p style={{ fontSize: 13, color: t.textMuted }}>오늘의 첫 감정 기록을 남겨보세요</p>
                  <button onClick={() => { setEditingRecord(null); setNewRecordDate(undefined); setShowSheet(true); }}
                    className="px-5 py-2 rounded-xl"
                    style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}>
                    + 기록하기
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {todayRecords.map(record => (
                  <RecordCard key={record.id} record={record} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            </div>

            {/* 지난 기록 */}
            {pastRecords.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  지난 기록
                </p>
                <div className="space-y-3">
                  {pastRecords.slice(0, 10).map(record => (
                    <div key={record.id} className="rounded-xl overflow-hidden"
                      style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
                      <div className="px-3 py-1.5" style={{ backgroundColor: t.bgSub }}>
                        <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{record.date}</span>
                      </div>
                      <div className="p-3">
                        <RecordCard record={record} onEdit={openEdit} onDelete={handleDelete} compact />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 통계 */}
            <StatsSection records={records} today={today} />
          </>
        )}

        {/* ── 캘린더 탭 ── */}
        {tab === 'calendar' && (
          <CalendarView
            records={records}
            today={today}
            onAddRecord={openNewForDate}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        )}

      </div>

      {/* Record Sheet */}
      {showSheet && (
        <RecordSheet
          onClose={() => { setShowSheet(false); setEditingRecord(null); setNewRecordDate(undefined); }}
          onSave={handleSave}
          initialData={editingRecord}
          defaultDate={newRecordDate}
        />
      )}
    </div>
  );
}
