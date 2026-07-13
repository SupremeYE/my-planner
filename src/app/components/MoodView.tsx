import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Mic, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '../ThemeContext';
import { useFabAction } from '../FabContext';
import { supabase } from '../../lib/supabase';
import { getLogicalToday } from '../store';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useVoiceInput } from '../hooks/useVoiceInput';

// ─── Types ───────────────────────────────────────────────────────────────────

type TimeOfDay = '아침' | '낮' | '저녁' | '지금';
type PeriodFilter = 'this-month' | 'last-month' | '14-days' | 'custom';

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

// ─── Emotion Color Constants (전역 관리) ────────────────────────────────────

export const EMOTION_CATEGORY_COLORS: Record<string, { bg: string; accent: string }> = {
  '행복':        { bg: '#FFF0F3', accent: '#E88CA0' },
  '사랑':        { bg: '#FFE4E8', accent: '#D4607A' },
  '분노':        { bg: '#FDE8E8', accent: '#C45A5A' },
  '두려움':      { bg: '#FFF4E0', accent: '#D4922A' },
  '부러움/질투': { bg: '#F2F2F2', accent: '#888888' },
  '슬픔':        { bg: '#E8EEF8', accent: '#6B8CC4' },
  '혐오':        { bg: '#FDE8E8', accent: '#C45A5A' },
  '수치/죄책감': { bg: '#E8EEF8', accent: '#6B8CC4' },
  '기타':        { bg: '#F0EEF8', accent: '#8B7EC8' },
};

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

export const ENERGY_LABELS: Record<number, string> = { 1: '매우 낮음', 2: '낮음', 3: '보통', 4: '높음', 5: '매우 높음' };

// 태그 → 카테고리 역방향 매핑
const TAG_CATEGORY: Record<string, string> = {};
EMOTION_CATEGORIES.forEach(cat => { cat.emotions.forEach(e => { TAG_CATEGORY[e] = cat.label; }); });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEmotionColor(tags: string[]): { bg: string; accent: string } | null {
  for (const tag of tags) {
    const cat = TAG_CATEGORY[tag];
    if (cat && EMOTION_CATEGORY_COLORS[cat]) return EMOTION_CATEGORY_COLORS[cat];
  }
  return null;
}

export function getCategoryEmoji(tags: string[]): string {
  for (const tag of tags) {
    const cat = EMOTION_CATEGORIES.find(c => c.emotions.includes(tag));
    if (cat) return cat.emoji;
  }
  return '🌸';
}

// 감정 태그 배열에서 대표 카테고리 한글 라벨(행복/슬픔 등). 없으면 빈 문자열.
export function getMoodCategoryLabel(tags: string[]): string {
  for (const tag of tags) {
    const cat = TAG_CATEGORY[tag];
    if (cat) return cat;
  }
  return '';
}

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

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T12:00:00');
  const endD = new Date(end + 'T12:00:00');
  while (cur <= endD) {
    days.push(format(cur, 'yyyy-MM-dd'));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── VoiceInputButton ─────────────────────────────────────────────────────────

function VoiceInputButton({ onResult, disabled }: { onResult: (text: string) => void; disabled?: boolean }) {
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
    <button type="button" onClick={toggle} disabled={disabled || isBusy}
      className="flex items-center justify-center rounded-lg flex-shrink-0"
      style={{ width: 30, height: 30, backgroundColor: isRec ? '#fee2e2' : t.bgSub, border: `1px solid ${isRec ? '#fca5a5' : t.borderLight}`, color: isRec ? '#ef4444' : t.textMuted }}>
      {isRec
        ? <span className="animate-pulse rounded-full" style={{ width: 9, height: 9, backgroundColor: '#ef4444', display: 'block' }} />
        : <Mic size={13} />}
    </button>
  );
}

// ─── RecordSheet ──────────────────────────────────────────────────────────────

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
  const today = getLogicalToday();
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        className="flex flex-col rounded-t-2xl overflow-hidden max-h-[90vh] lg:w-[min(900px,92vw)] lg:h-[86vh] lg:max-h-[860px] lg:rounded-2xl lg:shadow-2xl"
        style={{ backgroundColor: t.bg }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: t.border }} />
        </div>
        <div className="flex items-center justify-between px-5 lg:px-8 pb-3 pt-1 lg:pt-6">
          <div>
            <p style={{ fontSize: 11, color: t.textMuted }}>{step} / {totalSteps}단계</p>
            <h2 className="lg:text-xl" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              {step === 1 && '몸 상태는 어떤가요?'}
              {step === 2 && '감정 단어를 골라보세요 (최대 3개)'}
              {step === 3 && '에너지 레벨은 어느 정도인가요?'}
              {step === 4 && '이 감정이 든 이유 (선택)'}
            </h2>
          </div>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={20} /></button>
        </div>

        <div className="flex gap-1.5 px-5 lg:px-8 mb-5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full transition-all"
              style={{ backgroundColor: i < step ? t.accent : t.borderLight }} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 lg:px-8 pb-6">
          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {BODY_SIGNALS.map(s => (
                <button key={s} onClick={() => toggleBodySignal(s)} style={chipStyle(bodySignals.includes(s))}>{s}</button>
              ))}
              <p style={{ fontSize: 11, color: t.textMuted, width: '100%', marginTop: 8 }}>복수 선택 가능 · 없으면 건너뛰기 가능</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>
                선택됨: {emotionTags.length}/3{emotionTags.length > 0 && ` — ${emotionTags.join(', ')}`}
              </p>
              <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4">
              {EMOTION_CATEGORIES.map(cat => {
                const color = EMOTION_CATEGORY_COLORS[cat.label];
                return (
                  <div key={cat.label}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: color?.accent ?? t.textSub, marginBottom: 6 }}>{cat.emoji} {cat.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.emotions.map(emotion => {
                        const selected = emotionTags.includes(emotion);
                        const maxed = emotionTags.length >= 3 && !selected;
                        return (
                          <button key={emotion} onClick={() => toggleEmotionTag(emotion)} disabled={maxed}
                            style={{ padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: selected ? 600 : 400, backgroundColor: selected ? (color?.bg ?? t.accentLight) : t.card, border: `1px solid ${selected ? (color?.accent ?? t.accent) : t.borderLight}`, color: selected ? (color?.accent ?? t.accent) : t.textSub, cursor: maxed ? 'not-allowed' : 'pointer', opacity: maxed ? 0.4 : 1, transition: 'all 0.15s' }}>
                            {emotion}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex justify-center gap-4 mb-6">
                {[1, 2, 3, 4, 5].map(level => (
                  <button key={level} onClick={() => setEnergyLevel(level)}
                    className="flex flex-col items-center gap-1.5 transition-transform"
                    style={{ transform: energyLevel === level ? 'scale(1.1)' : 'scale(1)' }}>
                    <div className="rounded-full transition-all"
                      style={{ width: energyLevel === level ? 40 : 32, height: energyLevel === level ? 40 : 32, backgroundColor: energyLevel === level ? t.accent : t.bgSub, border: `2px solid ${energyLevel === level ? t.accent : t.borderLight}` }} />
                    <span style={{ fontSize: 12, fontWeight: energyLevel === level ? 700 : 400, color: energyLevel === level ? t.accent : t.textMuted }}>{level}</span>
                  </button>
                ))}
              </div>
              <div className="text-center py-3 rounded-xl" style={{ backgroundColor: t.accentLight }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.accent }}>{ENERGY_LABELS[energyLevel]}</span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex items-end gap-2">
              <textarea value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="어떤 일이 있었나요? (선택)" rows={4}
                className="flex-1 rounded-xl px-4 py-3 border outline-none resize-none"
                style={{ borderColor: t.border, backgroundColor: t.card, color: t.text, fontSize: 14 }}
                autoFocus />
              <VoiceInputButton onResult={text => setMemo(prev => prev ? `${prev} ${text}` : text)} />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 lg:px-8 pt-3 pb-8 lg:pb-6" style={{ borderTop: `1px solid ${t.borderLight}` }}>
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

// ─── RecordCard ───────────────────────────────────────────────────────────────

function RecordCard({ record, onEdit, onDelete, compact = false }: {
  record: MoodRecord; onEdit: (r: MoodRecord) => void; onDelete: (id: string) => void; compact?: boolean;
}) {
  const { t } = useTheme();
  const color = getEmotionColor(record.emotion_tags);
  const labelColor = color?.accent ? color.accent + 'AA' : t.textMuted;
  const dotSize = compact ? 8 : 9;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-2" style={{ minHeight: 22 }}>
      <span style={{ width: 56, flexShrink: 0, fontSize: 11, color: labelColor, paddingTop: 2, letterSpacing: '-0.01em' }}>{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );

  return (
    <div className="rounded-xl" style={{ backgroundColor: color?.bg ?? t.card, border: `1px solid ${color ? color.accent + '33' : t.borderLight}`, padding: compact ? 12 : 16 }}>
      <div className="flex items-start justify-between mb-3">
        <span style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: color?.accent ?? t.accent }}>{formatKoreanTime(record.created_at)}</span>
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(record)} style={{ color: t.textMuted }}><Pencil size={13} /></button>
          <button onClick={() => onDelete(record.id)} style={{ color: t.textMuted }}><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {record.body_signals.length > 0 && (
          <Row label="몸 상태">
            {record.body_signals.map(s => (
              <span key={s} className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.7)', color: t.textSub, border: `1px solid ${t.borderLight}` }}>{s}</span>
            ))}
          </Row>
        )}
        {record.emotion_tags.length > 0 && (
          <Row label="감정 상태">
            {record.emotion_tags.map(tag => (
              <span key={tag} className="px-2.5 py-0.5 rounded-full" style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.8)', color: color?.accent ?? t.accent, fontWeight: 600 }}>{tag}</span>
            ))}
          </Row>
        )}
        <Row label="에너지">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(l => (
              <div key={l} className="rounded-full" style={{ width: dotSize, height: dotSize, backgroundColor: l <= record.energy_level ? (color?.accent ?? t.accent) : t.borderLight }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: labelColor }}>{ENERGY_LABELS[record.energy_level]}</span>
        </Row>
        {record.memo && (
          <Row label="감정 원인">
            <span style={{ fontSize: 12, color: t.textSub }}>{record.memo}</span>
          </Row>
        )}
      </div>
    </div>
  );
}

// ─── PastRecordCard (지난 기록 미리보기 + 토글 펼침) ──────────────────────────

function PastRecordCard({ record, onEdit, onDelete }: {
  record: MoodRecord; onEdit: (r: MoodRecord) => void; onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const color = getEmotionColor(record.emotion_tags);
  const accent = color?.accent ?? t.accent;
  const labelColor = color?.accent ? color.accent + 'AA' : t.textMuted;

  return (
    <div className="rounded-xl overflow-hidden self-start" style={{ backgroundColor: color?.bg ?? t.card, border: `1px solid ${color ? color.accent + '33' : t.borderLight}` }}>
      {/* 헤더: 날짜 + 시간 · 펼침/접기 토글 */}
      <button onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left">
        <div className="flex items-baseline gap-2 min-w-0">
          <span style={{ fontSize: 13, lineHeight: 1 }}>{getCategoryEmoji(record.emotion_tags)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{record.date}</span>
          <span style={{ fontSize: 11, color: labelColor }}>{formatKoreanTime(record.created_at)}</span>
        </div>
        {expanded
          ? <ChevronUp size={15} style={{ color: t.textMuted, flexShrink: 0 }} />
          : <ChevronDown size={15} style={{ color: t.textMuted, flexShrink: 0 }} />}
      </button>

      {/* 배지 줄: 감정 / 컨디션 */}
      {(record.emotion_tags.length > 0 || record.body_signals.length > 0) && (
        <div className="px-3.5 flex flex-wrap items-center gap-1">
          {record.emotion_tags.map(tag => (
            <span key={tag} className="px-2.5 py-0.5 rounded-full" style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.8)', color: accent, fontWeight: 600 }}>{tag}</span>
          ))}
          {record.body_signals.map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.7)', color: t.textSub, border: `1px solid ${t.borderLight}` }}>{s}</span>
          ))}
        </div>
      )}

      {/* 본문 미리보기(2줄 클램프) / 펼침 시 전체 */}
      {record.memo && (
        <div className="px-3.5 pt-2">
          <p className={expanded ? '' : 'line-clamp-2'} style={{ fontSize: 12.5, lineHeight: 1.55, color: t.textSub }}>{record.memo}</p>
        </div>
      )}

      {/* 펼침: 에너지 + 액션 */}
      {expanded && (
        <div className="px-3.5 pt-2.5 mt-1 flex items-center justify-between" style={{ borderTop: `1px solid ${color ? color.accent + '22' : t.borderLight}`, marginTop: 10 }}>
          <div className="flex items-center gap-1.5 py-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(l => (
                <div key={l} className="rounded-full" style={{ width: 8, height: 8, backgroundColor: l <= record.energy_level ? accent : t.borderLight }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: labelColor }}>{ENERGY_LABELS[record.energy_level]}</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => onEdit(record)} style={{ color: t.textMuted }}><Pencil size={13} /></button>
            <button onClick={() => onDelete(record.id)} style={{ color: t.textMuted }}><Trash2 size={13} /></button>
          </div>
        </div>
      )}

      {/* 접힘 상태에서도 하단 여백 확보 */}
      {!expanded && <div className="pb-3" />}
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({ records, today, onAddRecord, onEdit, onDelete }: {
  records: MoodRecord[]; today: string;
  onAddRecord: (date: string) => void;
  onEdit: (r: MoodRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTheme();
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(today);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const dateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); setSelectedDate(null); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); setSelectedDate(null); };

  const selectedRecords = selectedDate ? records.filter(r => r.date === selectedDate) : [];

  const CalendarGrid = (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-2 rounded-lg" style={{ color: t.textSub }}><ChevronLeft size={18} /></button>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{viewYear}년 {viewMonth + 1}월</span>
        <button onClick={nextMonth} className="p-2 rounded-lg" style={{ color: t.textSub }}><ChevronRight size={18} /></button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '2px 0', color: i === 0 ? '#E88CA0' : i === 6 ? '#6B8CC4' : t.textMuted }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ backgroundColor: t.borderLight }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ backgroundColor: t.bgSub, minHeight: 44 }} />;
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
              style={{ minHeight: 44, backgroundColor: color ? color.bg : t.bgSub, outline: isSelected ? `2px solid ${t.accent}` : isToday ? `2px solid ${t.accent}88` : 'none', outlineOffset: -1, padding: '3px 4px' }}>
              <span style={{ fontSize: 11, lineHeight: 1, color: isToday ? t.accent : color ? color.accent : t.textMuted, fontWeight: isToday ? 700 : 400 }}>{day}</span>
              {latestRec && (
                <div className="flex-1 flex items-center justify-center">
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{getCategoryEmoji(latestRec.emotion_tags)}</span>
                </div>
              )}
              {hasMultiple && (
                <div className="absolute bottom-1 right-1 rounded-full" style={{ width: 5, height: 5, backgroundColor: color?.accent ?? t.accent }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const DetailPanel = selectedDate ? (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: t.card, borderBottom: `1px solid ${t.borderLight}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{selectedDate}</span>
        <button onClick={() => onAddRecord(selectedDate)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: t.accentLight, color: t.accent, fontSize: 12, fontWeight: 600 }}>
          <Plus size={13} /> 기록 추가
        </button>
      </div>
      {selectedRecords.length === 0 ? (
        <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '20px 16px', backgroundColor: t.bg }}>이 날의 기록이 없어요</p>
      ) : (
        <div className="space-y-2 p-3" style={{ backgroundColor: t.bg }}>
          {selectedRecords.map(r => <RecordCard key={r.id} record={r} onEdit={onEdit} onDelete={onDelete} compact />)}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {/* PC: 좌우 분할 (캘린더 60% / 상세 40%) */}
      <div className="hidden md:flex gap-4">
        <div style={{ flex: '0 0 58%' }}>{CalendarGrid}</div>
        <div style={{ flex: '0 0 40%' }}>
          {DetailPanel ?? (
            <div className="flex flex-col items-center justify-center h-full rounded-2xl"
              style={{ border: `1px dashed ${t.borderLight}`, minHeight: 200, backgroundColor: t.card }}>
              <span style={{ fontSize: 28, marginBottom: 8 }}>📅</span>
              <p style={{ fontSize: 13, color: t.textMuted }}>날짜를 클릭하면<br/>기록이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 모바일: 세로 스택 */}
      <div className="md:hidden space-y-3">
        {CalendarGrid}
        {DetailPanel}
      </div>
    </>
  );
}

// ─── StatsTab ─────────────────────────────────────────────────────────────────

// ─── EnergyLineChart ──────────────────────────────────────────────────────────

function EnergyLineChart({ dailyEnergy, today }: {
  dailyEnergy: { date: string; avg: number | null; label: string }[];
  today: string;
}) {
  const { t } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 130 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setSize({ width: w, height: 130 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ML = 20;
  const MR = 8;
  const MT = 10;
  const MB = 22;
  const CW = size.width - ML - MR;
  const CH = size.height - MT - MB;
  const N = dailyEnergy.length;
  const xOf = (i: number) => ML + (N <= 1 ? CW / 2 : (i / (N - 1)) * CW);
  const yOf = (v: number) => MT + ((5 - v) / 4) * CH;

  const nonNullIdx = dailyEnergy.map((d, i) => d.avg !== null ? i : -1).filter(i => i >= 0);
  const segments: { x1: number; y1: number; x2: number; y2: number; dashed: boolean }[] = [];
  for (let k = 0; k < nonNullIdx.length - 1; k++) {
    const a = nonNullIdx[k];
    const b = nonNullIdx[k + 1];
    segments.push({ x1: xOf(a), y1: yOf(dailyEnergy[a].avg!), x2: xOf(b), y2: yOf(dailyEnergy[b].avg!), dashed: b > a + 1 });
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100%' }}>
        <svg width={size.width} height={size.height} style={{ display: 'block', overflow: 'visible' }}>
          {/* 수평 가이드라인 */}
          {[5, 4, 3, 2, 1].map(v => (
            <g key={v}>
              <line x1={ML} y1={yOf(v)} x2={ML + CW} y2={yOf(v)} stroke={t.borderLight} strokeWidth={0.8} strokeDasharray="3 4" />
              <text x={ML - 4} y={yOf(v) + 3.5} textAnchor="end" fontSize={7} fill={t.textMuted}>{v}</text>
            </g>
          ))}
          {/* 선 세그먼트 */}
          {segments.map((seg, i) => (
            <line key={i}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke={t.accent}
              strokeWidth={seg.dashed ? 1 : 1.5}
              strokeDasharray={seg.dashed ? '3 3' : undefined}
              opacity={seg.dashed ? 0.35 : 1}
            />
          ))}
          {/* 데이터 포인트 + X축 레이블 */}
          {dailyEnergy.map(({ date, avg, label }, i) => {
            const isToday = date === today;
            const labelInterval = N <= 7 ? 1 : N <= 14 ? 2 : N <= 31 ? 5 : 7;
            const showLabel = i % labelInterval === 0 || isToday;
            const cx = xOf(i);
            return (
              <g key={date}>
                {avg !== null && (
                  isToday
                    ? <circle cx={cx} cy={yOf(avg)} r={4} fill="none" stroke={t.accent} strokeWidth={1.5} />
                    : <circle cx={cx} cy={yOf(avg)} r={3} fill={t.accent} opacity={0.85} />
                )}
                {showLabel && (
                  <text x={cx} y={size.height - 5} textAnchor="middle" fontSize={7}
                    fill={isToday ? t.accent : t.textMuted}
                    fontWeight={isToday ? 700 : 400}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        <div className="flex items-center gap-1.5">
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={t.accent} strokeWidth={1.5} /></svg>
          <span style={{ fontSize: 9, color: t.textMuted }}>기록 있는 날</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={t.accent} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} /></svg>
          <span style={{ fontSize: 9, color: t.textMuted }}>기록 없는 날 연결</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="none" stroke={t.accent} strokeWidth={1.5} /></svg>
          <span style={{ fontSize: 9, color: t.textMuted }}>오늘</span>
        </div>
      </div>
    </>
  );
}

function StatsTab({ records }: { records: MoodRecord[] }) {
  const { t } = useTheme();
  const today = getLogicalToday();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('this-month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(today);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'this-month': {
        const firstOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
        const totalDays = getDaysBetween(firstOfMonth, today).length;
        if (totalDays < 7) {
          const s = new Date(); s.setDate(s.getDate() - 6);
          return { startDate: format(s, 'yyyy-MM-dd'), endDate: today };
        }
        return { startDate: firstOfMonth, endDate: today };
      }
      case 'last-month': {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const e = new Date(now.getFullYear(), now.getMonth(), 0);
        return { startDate: format(s, 'yyyy-MM-dd'), endDate: format(e, 'yyyy-MM-dd') };
      }
      case '14-days': {
        const s = new Date(); s.setDate(s.getDate() - 13);
        return { startDate: format(s, 'yyyy-MM-dd'), endDate: today };
      }
      case 'custom':
        return { startDate: customStart || today, endDate: customEnd || today };
    }
  }, [periodFilter, customStart, customEnd, today]);

  const filtered = useMemo(
    () => records.filter(r => r.date >= startDate && r.date <= endDate),
    [records, startDate, endDate]
  );

  // 요약 수치
  const uniqueDays = new Set(filtered.map(r => r.date)).size;
  const totalCount = filtered.length;

  const tagCounts: Record<string, number> = {};
  filtered.forEach(r => r.emotion_tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
  const top2Tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 2);

  // 감정 카테고리 분포
  const catCounts: Record<string, number> = {};
  filtered.forEach(r => {
    for (const tag of r.emotion_tags) {
      const cat = TAG_CATEGORY[tag];
      if (cat) { catCounts[cat] = (catCounts[cat] || 0) + 1; break; }
    }
  });
  const maxCat = Math.max(...Object.values(catCounts), 1);
  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  // 태그 TOP
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // 에너지 일별 추이
  const days = useMemo(() => getDaysBetween(startDate, endDate), [startDate, endDate]);
  const dailyEnergy = useMemo(() => days.map(date => {
    const recs = filtered.filter(r => r.date === date);
    const avg = recs.length ? recs.reduce((s, r) => s + r.energy_level, 0) / recs.length : null;
    const d = new Date(date + 'T12:00:00');
    const day = d.getDate();
    return { date, avg, label: String(day) };
  }), [days, filtered]);

  const periodLabels: Record<PeriodFilter, string> = {
    'this-month': '이번 달', 'last-month': '지난달', '14-days': '최근 14일', 'custom': '직접 선택',
  };

  const chartPeriodLabel = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case 'this-month': return `${now.getMonth() + 1}월 1일 ~ 오늘`;
      case 'last-month': {
        const m = now.getMonth() === 0 ? 12 : now.getMonth();
        return `${m}월`;
      }
      case '14-days': return '최근 14일';
      case 'custom': {
        if (!customStart || !customEnd) return '직접 선택';
        const s = new Date(customStart + 'T12:00:00');
        const e = new Date(customEnd + 'T12:00:00');
        return `${s.getMonth() + 1}월 ${s.getDate()}일 ~ ${e.getMonth() + 1}월 ${e.getDate()}일`;
      }
    }
  }, [periodFilter, customStart, customEnd]);

  const cardBase = { backgroundColor: t.card, border: `1px solid ${t.borderLight}`, borderRadius: 16, padding: 16 };

  return (
    <div className="space-y-4">
      {/* 기간 필터 */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {(['this-month', 'last-month', '14-days', 'custom'] as PeriodFilter[]).map(key => (
            <button key={key} onClick={() => setPeriodFilter(key)}
              className="flex-shrink-0 px-4 py-2 rounded-full transition-all"
              style={{ fontSize: 12, fontWeight: periodFilter === key ? 700 : 400, backgroundColor: periodFilter === key ? t.accent : t.bgSub, color: periodFilter === key ? '#fff' : t.textSub, border: `1px solid ${periodFilter === key ? t.accent : t.borderLight}` }}>
              {periodLabels[key]}
            </button>
          ))}
        </div>
        {periodFilter === 'custom' && (
          <div className="flex items-center gap-2 mt-3">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} max={customEnd || today}
              className="flex-1 rounded-xl px-3 py-2 border outline-none"
              style={{ fontSize: 13, borderColor: t.border, backgroundColor: t.card, color: t.text }} />
            <span style={{ color: t.textMuted, fontSize: 13 }}>~</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} min={customStart} max={today}
              className="flex-1 rounded-xl px-3 py-2 border outline-none"
              style={{ fontSize: 13, borderColor: t.border, backgroundColor: t.card, color: t.text }} />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 rounded-2xl" style={{ backgroundColor: t.card, border: `1px dashed ${t.borderLight}` }}>
          <span style={{ fontSize: 36 }}>📊</span>
          <p style={{ fontSize: 13, color: t.textMuted }}>해당 기간에 기록이 없어요</p>
        </div>
      ) : (
        <>
          {/* 요약 수치 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: '기록 일수', value: `${uniqueDays}일`, sub: '기록한 날' },
              { label: '총 기록 수', value: `${totalCount}건`, sub: '감정 기록' },
            ].map((s, i) => (
              <div key={i} style={cardBase} className="flex flex-col items-center justify-center py-4 text-center">
                <span style={{ fontSize: 20, fontWeight: 700, color: t.text, fontFamily: 'var(--font-gmarket)', display: 'block' }}>{s.value}</span>
                <span style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{s.label}</span>
                <span style={{ fontSize: 10, color: t.accent, marginTop: 1 }}>{s.sub}</span>
              </div>
            ))}
            {/* 이번 달 분위기 */}
            <div style={cardBase} className="col-span-2 md:col-span-1 flex flex-col items-center justify-center py-4 text-center">
              {top2Tags.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mb-1">
                  {top2Tags.map(([tag]) => {
                    const emoji = getCategoryEmoji([tag]);
                    const tagColor = getEmotionColor([tag]);
                    return (
                      <span key={tag} style={{ fontSize: 15, fontWeight: 700, color: tagColor?.accent ?? t.text }}>
                        {emoji} {tag}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span style={{ fontSize: 16, fontWeight: 700, color: t.textMuted }}>—</span>
              )}
              <span style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>이번 달 분위기</span>
            </div>
          </div>

          {/* 감정 분포 */}
          <div style={cardBase}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>감정 분포</p>
            {catEntries.length === 0 ? (
              <p style={{ fontSize: 12, color: t.textMuted }}>기록 없음</p>
            ) : (
              <div className="space-y-2.5">
                {catEntries.map(([cat, count]) => {
                  const color = EMOTION_CATEGORY_COLORS[cat];
                  const catInfo = EMOTION_CATEGORIES.find(c => c.label === cat);
                  const pct = Math.round((count / filtered.length) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontSize: 12, color: color?.accent ?? t.text }}>
                          {catInfo?.emoji} {cat}
                        </span>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{count}건 ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(count / maxCat) * 100}%`, backgroundColor: color?.accent ?? t.accent }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 감정 태그 TOP */}
          {topTags.length > 0 && (
            <div style={cardBase}>
              <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>감정 태그 TOP</p>
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count], i) => {
                  const color = getEmotionColor([tag]);
                  return (
                    <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: color?.bg ?? t.bgSub, border: `1px solid ${color?.accent ? color.accent + '55' : t.borderLight}` }}>
                      {i < 3 && <span style={{ fontSize: 10, fontWeight: 700, color: color?.accent ?? t.accent }}>#{i + 1}</span>}
                      <span style={{ fontSize: 12, color: color?.accent ?? t.text, fontWeight: 600 }}>{tag}</span>
                      <span style={{ fontSize: 10, color: t.textMuted }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 에너지 레벨 추이 */}
          <div style={cardBase}>
            <p style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>
              에너지 레벨 추이{' '}
              <span style={{ fontWeight: 400, color: t.textMuted }}>{chartPeriodLabel}</span>
            </p>
            <EnergyLineChart dailyEnergy={dailyEnergy} today={today} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main MoodView ─────────────────────────────────────────────────────────────

export function MoodView() {
  const { t } = useTheme();
  const today = getLogicalToday();

  const [records, setRecords] = useState<MoodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'calendar' | 'stats'>('list');
  const [showSheet, setShowSheet] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MoodRecord | null>(null);
  const [newRecordDate, setNewRecordDate] = useState<string | undefined>(undefined);

  const loadRecords = async () => {
    setLoading(true);
    const { data } = await supabase.from('mood_records').select('*').order('created_at', { ascending: false });
    if (data) setRecords(data as MoodRecord[]);
    setLoading(false);
  };

  useEffect(() => { loadRecords(); }, []);
  useRealtimeSync('mood_records', loadRecords);

  const handleSave = async (data: Omit<MoodRecord, 'id' | 'created_at'>) => {
    if (editingRecord) await supabase.from('mood_records').update(data).eq('id', editingRecord.id);
    else await supabase.from('mood_records').insert({ ...data, id: crypto.randomUUID() });
    setEditingRecord(null); setNewRecordDate(undefined);
    await loadRecords();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return;
    await supabase.from('mood_records').delete().eq('id', id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const openEdit = (record: MoodRecord) => { setEditingRecord(record); setNewRecordDate(undefined); setShowSheet(true); };
  const openNewForDate = (date: string) => { setEditingRecord(null); setNewRecordDate(date); setShowSheet(true); };
  const openNew = () => { setEditingRecord(null); setNewRecordDate(undefined); setShowSheet(true); };

  // 전역 FAB — 감정 기록
  useFabAction({ kind: 'action', label: '감정 기록', icon: Plus, onPress: openNew });

  const todayRecords = records.filter(r => r.date === today);
  const pastRecords = records.filter(r => r.date !== today);

  const tabs = [
    { key: 'list', label: '기록' },
    { key: 'calendar', label: '캘린더' },
    { key: 'stats', label: '통계' },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto pb-20" style={{ fontFamily: 'var(--font-noto-sans)' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-3">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: t.fontPageTitle }}>감정 기록</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>지금 이 순간의 감정을 기록해보세요</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 mb-4">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2 rounded-xl transition-all"
            style={{ fontSize: 13, fontWeight: tab === key ? 600 : 400, backgroundColor: tab === key ? t.accent : t.bgSub, color: tab === key ? '#fff' : t.textSub }}>
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-4">

        {/* 기록 탭 */}
        {tab === 'list' && (
          <>
            <div>
              <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                오늘 기록 ({todayRecords.length}건)
              </p>

              {/* 퀵 입력 바 — 진입점 일원화. 기록 유무와 무관하게 항상 같은 자리. 클릭 시 기존 4단계 모달 */}
              <button onClick={openNew} aria-label="감정 기록 추가"
                className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 mb-3 transition-colors"
                style={{ backgroundColor: t.card, border: `1.5px dashed ${t.accent}` }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>지금 이 순간의 감정을 기록해보세요…</span>
                <span className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 32, height: 32, backgroundColor: t.danger, color: '#fff' }}>
                  <Plus size={18} />
                </span>
              </button>

              {loading && <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: 24 }}>불러오는 중...</p>}
              {!loading && todayRecords.length === 0 && (
                <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '4px 0 8px' }}>
                  오늘의 첫 감정 기록을 남겨보세요
                </p>
              )}
              <div className="space-y-3">
                {todayRecords.map(r => <RecordCard key={r.id} record={r} onEdit={openEdit} onDelete={handleDelete} />)}
              </div>
            </div>

            {pastRecords.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  지난 기록
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                  {pastRecords.slice(0, 10).map(r => (
                    <PastRecordCard key={r.id} record={r} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 캘린더 탭 */}
        {tab === 'calendar' && (
          <CalendarView records={records} today={today} onAddRecord={openNewForDate} onEdit={openEdit} onDelete={handleDelete} />
        )}

        {/* 통계 탭 */}
        {tab === 'stats' && <StatsTab records={records} />}
      </div>

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
