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

const TIME_OPTIONS: { value: TimeOfDay; emoji: string }[] = [
  { value: '아침', emoji: '🌅' },
  { value: '낮', emoji: '☀️' },
  { value: '저녁', emoji: '🌙' },
  { value: '지금', emoji: '⏰' },
];

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

// ─── VoiceInputButton ─────────────────────────────────────────────────────────

function VoiceInputButton({ onResult, disabled }: { onResult: (text: string) => void; disabled?: boolean }) {
  const { t } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) return null;

  const toggle = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const r = new SpeechRecognitionAPI();
    r.lang = 'ko-KR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => onResult(e.results[0][0].transcript);
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{
        width: 30, height: 30,
        backgroundColor: isListening ? '#fee2e2' : t.bgSub,
        border: `1px solid ${isListening ? '#fca5a5' : t.borderLight}`,
        color: isListening ? '#ef4444' : t.textMuted,
      }}
    >
      {isListening
        ? <span className="animate-pulse rounded-full" style={{ width: 9, height: 9, backgroundColor: '#ef4444', display: 'block' }} />
        : <Mic size={13} />}
    </button>
  );
}

// ─── Step-by-step Record Sheet ────────────────────────────────────────────────

interface RecordSheetProps {
  onClose: () => void;
  onSave: (data: Omit<MoodRecord, 'id' | 'created_at'>) => Promise<void>;
  initialData?: MoodRecord | null;
}

function RecordSheet({ onClose, onSave, initialData }: RecordSheetProps) {
  const { t } = useTheme();
  const [step, setStep] = useState(1);
  const [bodySignals, setBodySignals] = useState<string[]>(initialData?.body_signals ?? []);
  const [emotionTags, setEmotionTags] = useState<string[]>(initialData?.emotion_tags ?? []);
  const [energyLevel, setEnergyLevel] = useState(initialData?.energy_level ?? 3);
  const [memo, setMemo] = useState(initialData?.memo ?? '');
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const totalSteps = 4;

  const autoTimeOfDay = (): TimeOfDay => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return '아침';
    if (h >= 12 && h < 18) return '낮';
    if (h >= 18 && h < 23) return '저녁';
    return '지금';
  };

  const toggleBodySignal = (s: string) =>
    setBodySignals(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleEmotionTag = (tag: string) => {
    if (emotionTags.includes(tag)) {
      setEmotionTags(prev => prev.filter(x => x !== tag));
    } else if (emotionTags.length < 3) {
      setEmotionTags(prev => [...prev, tag]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      date: initialData?.date ?? today,
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
    padding: '6px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    backgroundColor: active ? t.accentLight : t.card,
    border: `1px solid ${active ? t.accent : t.borderLight}`,
    color: active ? t.accent : t.textSub,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="rounded-t-2xl"
        style={{ backgroundColor: t.bg, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div>
            <p style={{ fontSize: 11, color: t.textMuted }}>
              {step} / {totalSteps}단계
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              {step === 1 && '몸 상태는 어떤가요?'}
              {step === 2 && '감정 단어를 골라보세요 (최대 3개)'}
              {step === 3 && '에너지 레벨은 어느 정도인가요?'}
              {step === 4 && '이 감정이 든 이유 (선택)'}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}>
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-5 mb-5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-all"
              style={{ backgroundColor: i < step ? t.accent : t.borderLight }}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="px-5 pb-6">
          {/* Step 1: 몸 상태 */}
          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {BODY_SIGNALS.map(signal => (
                <button
                  key={signal}
                  onClick={() => toggleBodySignal(signal)}
                  style={chipStyle(bodySignals.includes(signal))}
                >
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
                선택됨: {emotionTags.length}/3
                {emotionTags.length > 0 && ` — ${emotionTags.join(', ')}`}
              </p>
              {EMOTION_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 6 }}>
                    {cat.emoji} {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.emotions.map(emotion => {
                      const selected = emotionTags.includes(emotion);
                      const maxed = emotionTags.length >= 3 && !selected;
                      return (
                        <button
                          key={emotion}
                          onClick={() => toggleEmotionTag(emotion)}
                          disabled={maxed}
                          style={{
                            ...chipStyle(selected),
                            opacity: maxed ? 0.4 : 1,
                          }}
                        >
                          {emotion}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: 에너지 레벨 */}
          {step === 3 && (
            <div>
              <div className="flex justify-center gap-4 mb-6">
                {[1, 2, 3, 4, 5].map(level => (
                  <button
                    key={level}
                    onClick={() => setEnergyLevel(level)}
                    className="flex flex-col items-center gap-1.5 transition-transform"
                    style={{ transform: energyLevel === level ? 'scale(1.1)' : 'scale(1)' }}
                  >
                    <div
                      className="rounded-full transition-all"
                      style={{
                        width: energyLevel === level ? 40 : 32,
                        height: energyLevel === level ? 40 : 32,
                        backgroundColor: energyLevel === level ? t.accent : t.bgSub,
                        border: `2px solid ${energyLevel === level ? t.accent : t.borderLight}`,
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: energyLevel === level ? 700 : 400, color: energyLevel === level ? t.accent : t.textMuted }}>
                      {level}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-center py-3 rounded-xl" style={{ backgroundColor: t.accentLight }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>
                  {ENERGY_LABELS[energyLevel]}
                </span>
              </div>
            </div>
          )}

          {/* Step 4: 이유 메모 */}
          {step === 4 && (
            <div>
              <div className="flex items-end gap-2">
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="어떤 일이 있었나요? (선택)"
                  rows={4}
                  className="flex-1 rounded-xl px-4 py-3 border outline-none resize-none"
                  style={{ borderColor: t.border, backgroundColor: t.card, color: t.text, fontSize: 14 }}
                  autoFocus
                />
                <VoiceInputButton onResult={text => setMemo(prev => prev ? `${prev} ${text}` : text)} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3 px-5 pb-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 px-5 py-3 rounded-xl transition-all"
              style={{ backgroundColor: t.bgSub, color: t.textSub, fontSize: 14, fontWeight: 600, border: `1px solid ${t.borderLight}` }}
            >
              <ChevronLeft size={16} /> 이전
            </button>
          ) : (
            <div className="flex-shrink-0 w-2" />
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl transition-all"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 600 }}
            >
              다음 <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl transition-all"
              style={{ backgroundColor: t.accent, color: '#fff', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? '저장 중...' : '저장하기'}
            </button>
          )}
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
  const [showSheet, setShowSheet] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MoodRecord | null>(null);

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
      const id = crypto.randomUUID();
      await supabase.from('mood_records').insert({ ...data, id });
    }
    setEditingRecord(null);
    await loadRecords();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    await supabase.from('mood_records').delete().eq('id', id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const openEdit = (record: MoodRecord) => {
    setEditingRecord(record);
    setShowSheet(true);
  };

  // ─── Stats ────────────────────────────────────────────────────────────────
  const todayRecords = records.filter(r => r.date === today);

  // 이번 주 시작 (월요일)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
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
  const avgByTime = TIME_OPTIONS.map(opt => {
    const recs = weekRecords.filter(r => r.time_of_day === opt.value);
    const avg = recs.length ? recs.reduce((s, r) => s + r.energy_level, 0) / recs.length : null;
    return { ...opt, avg, count: recs.length };
  });

  const cardStyle = {
    backgroundColor: t.card,
    border: `1px solid ${t.borderLight}`,
    borderRadius: 16,
    padding: 16,
  };

  const formatKoreanTime = (isoStr: string) => {
    const d = new Date(isoStr);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h < 12 ? '오전' : '오후';
    const hour = h % 12 || 12;
    return `${ampm} ${hour}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>
            감정 기록
          </h1>
          <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>
            지금 이 순간의 감정을 기록해보세요
          </p>
        </div>
        <button
          onClick={() => { setEditingRecord(null); setShowSheet(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={15} /> 기록
        </button>
      </div>

      <div className="px-5 space-y-4">

        {/* 오늘 기록 */}
        <div>
          <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            오늘 기록 ({todayRecords.length}건)
          </p>

          {loading && (
            <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: 24 }}>불러오는 중...</p>
          )}

          {!loading && todayRecords.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 py-8 rounded-2xl"
              style={{ backgroundColor: t.card, border: `1px dashed ${t.borderLight}` }}
            >
              <span style={{ fontSize: 36 }}>🌸</span>
              <p style={{ fontSize: 13, color: t.textMuted }}>오늘의 첫 감정 기록을 남겨보세요</p>
              <button
                onClick={() => { setEditingRecord(null); setShowSheet(true); }}
                className="px-5 py-2 rounded-xl"
                style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 13, fontWeight: 600 }}
              >
                + 기록하기
              </button>
            </div>
          )}

          <div className="space-y-3">
            {todayRecords.map(record => (
              <div key={record.id} style={cardStyle}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                      {formatKoreanTime(record.created_at)}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(record)} style={{ color: t.textMuted }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(record.id)} style={{ color: t.textMuted }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 몸 상태 */}
                {record.body_signals.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {record.body_signals.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-full"
                        style={{ fontSize: 10, backgroundColor: t.bgSub, color: t.textSub, border: `1px solid ${t.borderLight}` }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* 감정 태그 */}
                {record.emotion_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {record.emotion_tags.map(tag => (
                      <span key={tag} className="px-2.5 py-0.5 rounded-full"
                        style={{ fontSize: 11, backgroundColor: t.accentLight, color: t.accent, fontWeight: 600 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 에너지 + 메모 */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(l => (
                      <div
                        key={l}
                        className="rounded-full"
                        style={{
                          width: 10, height: 10,
                          backgroundColor: l <= record.energy_level ? t.accent : t.borderLight,
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{ENERGY_LABELS[record.energy_level]}</span>
                </div>

                {record.memo && (
                  <p className="mt-2" style={{ fontSize: 12, color: t.textSub, fontStyle: 'italic' }}>
                    "{record.memo}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 과거 기록 (오늘 제외) */}
        {records.filter(r => r.date !== today).length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              지난 기록
            </p>
            <div className="space-y-3">
              {records
                .filter(r => r.date !== today)
                .slice(0, 10)
                .map(record => (
                  <div key={record.id} style={cardStyle}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span style={{ fontSize: 12, color: t.textMuted }}>{record.date} </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{formatKoreanTime(record.created_at)}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(record)} style={{ color: t.textMuted }}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(record.id)} style={{ color: t.textMuted }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {record.emotion_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {record.emotion_tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full"
                            style={{ fontSize: 10, backgroundColor: t.accentLight, color: t.accent }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(l => (
                        <div key={l} className="rounded-full" style={{ width: 8, height: 8, backgroundColor: l <= record.energy_level ? t.accent : t.borderLight }} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── 통계 ─────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            이번 주 통계
          </p>

          {/* TOP3 감정 태그 */}
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>
              감정 태그 TOP3
            </p>
            {top3Tags.length === 0 ? (
              <p style={{ fontSize: 12, color: t.textMuted }}>이번 주 기록이 없어요</p>
            ) : (
              <div className="space-y-2">
                {top3Tags.map(([tag, count], i) => (
                  <div key={tag} className="flex items-center gap-3">
                    <span style={{ fontSize: 12, color: t.accent, fontWeight: 700, width: 16 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: t.text, flex: 1 }}>{tag}</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.max(20, (count / (top3Tags[0]?.[1] || 1)) * 80)}px`,
                          backgroundColor: t.accent,
                          opacity: 0.6 + i * -0.15,
                        }}
                      />
                      <span style={{ fontSize: 11, color: t.textMuted }}>{count}회</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 에너지 레벨 주간 그래프 */}
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>
              에너지 레벨 (최근 7일)
            </p>
            <div className="flex items-end gap-1.5" style={{ height: 60 }}>
              {dailyEnergy.map(({ date, avg, label }) => {
                const isToday = date === today;
                const heightPct = avg !== null ? (avg / 5) * 100 : 0;
                return (
                  <div key={date} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: avg !== null ? `${heightPct}%` : 2,
                        backgroundColor: avg !== null
                          ? isToday ? t.accent : `${t.accent}99`
                          : t.borderLight,
                        minHeight: 2,
                      }}
                    />
                    <span style={{ fontSize: 9, color: isToday ? t.accent : t.textMuted, fontWeight: isToday ? 700 : 400 }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 시간대별 평균 에너지 */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 10 }}>
              시간대별 평균 에너지
            </p>
            <div className="grid grid-cols-4 gap-2">
              {avgByTime.map(({ value, emoji, avg, count }) => (
                <div
                  key={value}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl"
                  style={{ backgroundColor: avg !== null ? t.accentLight : t.bgSub }}
                >
                  <span style={{ fontSize: 20 }}>{emoji}</span>
                  <span style={{ fontSize: 10, color: t.textSub }}>{value}</span>
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

      </div>

      {/* Record Sheet */}
      {showSheet && (
        <RecordSheet
          onClose={() => { setShowSheet(false); setEditingRecord(null); }}
          onSave={handleSave}
          initialData={editingRecord}
        />
      )}
    </div>
  );
}
