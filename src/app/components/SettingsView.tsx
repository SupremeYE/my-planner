import { useState } from 'react';
import {
  Clock, Tag, Sparkles, SlidersHorizontal,
  Plus, Pencil, Trash2, Check, X, ChevronRight,
} from 'lucide-react';
import { usePlanner } from '../store';
import { useTheme } from '../ThemeContext';
import { TimePicker } from './TimePicker';
import ConfirmModal from './ConfirmModal';

// ─── 컬러 팔레트 (TodoModal과 동일) ───
const DEFAULT_TAG_COLORS = [
  '#E0795B', '#D4735A', '#E8A87C', '#F4A261',
  '#4A82CC', '#3B82F6', '#45B899', '#34D399',
  '#006b62', '#8B7CF8', '#22C55E', '#515f74', '#475569',
];

// ─── 섹션 래퍼 ───
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: `1px solid ${t.borderLight}` }}>
        <span style={{ color: t.accent }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{title}</span>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ─── 토글 행 ───
function ToggleRow({ label, desc, value, onChange }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  const { t } = useTheme();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 transition-colors"
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          backgroundColor: value ? '#515f74' : '#c7d5ee',
        }}
      >
        <span
          className="absolute top-1 transition-all"
          style={{
            left: value ? 20 : 4,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

// ─── 타임라인 설정 섹션 ───
function TimelineSection() {
  const { t } = useTheme();
  const { dayStartHour, dayEndHour, setDayHours } = usePlanner();

  const toTimeStr = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  const [startVal, setStartVal] = useState(toTimeStr(dayStartHour));
  const [endVal, setEndVal] = useState(toTimeStr(dayEndHour));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const sh = parseInt(startVal.split(':')[0]);
    const eh = parseInt(endVal.split(':')[0]);
    const finalEnd = eh <= sh ? eh + 24 : eh;
    setDayHours(sh, finalEnd);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const isNextDay = parseInt(endVal.split(':')[0]) <= parseInt(startVal.split(':')[0]);

  return (
    <Section title="타임라인 설정" icon={<Clock size={16} />}>
      <div>
        <label style={{ fontSize: 12, color: t.textSub, fontWeight: 500, display: 'block', marginBottom: 6 }}>시작 시간</label>
        <TimePicker value={startVal} onChange={setStartVal} placeholder="시작 시간" size="md" minuteStep={1} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: t.textSub, fontWeight: 500, display: 'block', marginBottom: 6 }}>종료 시간</label>
        <TimePicker value={endVal} onChange={setEndVal} placeholder="종료 시간" size="md" minuteStep={1} />
        {isNextDay && (
          <p style={{ fontSize: 11, color: t.accent, marginTop: 4 }}>다음날 새벽으로 설정됩니다</p>
        )}
      </div>
      <p style={{ fontSize: 11, color: t.textMuted, backgroundColor: t.bgSub, borderRadius: 8, padding: '6px 10px' }}>
        현재: {toTimeStr(dayStartHour)} – {toTimeStr(dayEndHour)}{dayEndHour >= 24 ? ' (다음날)' : ''}
      </p>
      <button
        onClick={handleSave}
        className="w-full py-2.5 rounded-xl transition-colors"
        style={{ fontSize: 13, fontWeight: 600, backgroundColor: saved ? '#006b62' : '#515f74', color: '#fff' }}
      >
        {saved ? '✓ 저장됨' : '적용'}
      </button>
    </Section>
  );
}

function ChoiceChipRow<T extends string | number>({ label, desc, value, options, onChange }: {
  label: string;
  desc?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { t } = useTheme();

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{label}</p>
      {desc && <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{desc}</p>}
      <div className="flex gap-2 mt-3">
        {options.map(option => {
          const active = value === option.value;
          return (
            <button
              key={String(option.value)}
              onClick={() => onChange(option.value)}
              className="px-3 py-2 rounded-xl transition-colors"
              style={{
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? '#fff' : t.textSub,
                backgroundColor: active ? t.accent : t.bgSub,
                border: `1px solid ${active ? t.accent : t.border}`,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarSection() {
  const { appSettings, updateAppSettings } = usePlanner();

  return (
    <Section title="캘린더 설정" icon={<ChevronRight size={16} />}>
      <ChoiceChipRow
        label="주 시작 요일"
        desc="주별과 월별 캘린더의 시작 요일을 정합니다."
        value={appSettings.weekStartsOn}
        options={[
          { value: 0, label: '일요일 시작' },
          { value: 1, label: '월요일 시작' },
        ]}
        onChange={(value) => updateAppSettings({ weekStartsOn: value as 0 | 1 })}
      />
    </Section>
  );
}

// ─── 태그 관리 섹션 ───
function TagsSection() {
  const { t } = useTheme();
  const { tags, addTag, updateTag, deleteTag } = usePlanner();
  const [showNewTag, setShowNewTag] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    addTag(newName.trim(), newColor);
    setNewName('');
    setNewColor(DEFAULT_TAG_COLORS[0]);
    setShowNewTag(false);
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
  };

  const handleUpdate = () => {
    if (!editingId || !editName.trim()) return;
    updateTag(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <Section title="태그 관리" icon={<Tag size={16} />}>
      {/* 태그 목록 */}
      <div className="space-y-2">
        {tags.length === 0 && (
          <p style={{ fontSize: 12, color: t.textMuted }}>태그가 없습니다.</p>
        )}
        {tags.map(tag => (
          <div key={tag.id}>
            {editingId === tag.id ? (
              <div className="space-y-2 p-3 rounded-xl" style={{ backgroundColor: t.bgSub }}>
                <div className="flex gap-1.5 flex-wrap">
                  {DEFAULT_TAG_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditColor(c)}
                      className="w-5 h-5 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: editColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: 2,
                        transform: editColor === c ? 'scale(1.2)' : 'scale(1)',
                      }} />
                  ))}
                </div>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
                  style={{ fontSize: 12, borderColor: t.border, backgroundColor: t.card, color: t.text }} />
                <div className="flex gap-1.5">
                  <button onClick={handleUpdate} className="flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1"
                    style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
                    <Check size={11} /> 저장
                  </button>
                  <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 rounded-lg"
                    style={{ fontSize: 11, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1" style={{ fontSize: 13, color: t.text }}>{tag.name}</span>
                <button onClick={() => startEdit(tag.id, tag.name, tag.color)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: t.textMuted }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => setDeleteTarget({ id: tag.id, name: tag.name })}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: t.textMuted }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 새 태그 추가 */}
      {showNewTag ? (
        <div className="space-y-2 p-3 rounded-xl" style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
          <div className="flex gap-1.5 flex-wrap">
            {DEFAULT_TAG_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className="w-5 h-5 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  outline: newColor === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 2,
                  transform: newColor === c ? 'scale(1.2)' : 'scale(1)',
                }} />
            ))}
          </div>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="태그 이름"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="w-full rounded-lg px-2.5 py-1.5 border outline-none"
            style={{ fontSize: 12, borderColor: t.border, backgroundColor: t.card, color: t.text }} />
          <div className="flex gap-1.5">
            <button onClick={handleCreate} className="flex-1 py-1.5 rounded-lg"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>만들기</button>
            <button onClick={() => { setShowNewTag(false); setNewName(''); }} className="flex-1 py-1.5 rounded-lg"
              style={{ fontSize: 11, color: t.textSub, backgroundColor: t.card, border: `1px solid ${t.border}` }}>취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowNewTag(true)}
          className="w-full py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          style={{ fontSize: 12, color: t.accent, border: `1px dashed ${t.accent}`, backgroundColor: t.accentLight }}>
          <Plus size={13} /> 태그 추가
        </button>
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`"${deleteTarget.name}" 태그를 삭제할까요?`}
          onConfirm={() => { deleteTag(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
          isDanger
        />
      )}
    </Section>
  );
}

// ─── 오늘의 확언 섹션 ───
function AffirmationSection() {
  const { t } = useTheme();
  const { appSettings, updateAppSettings } = usePlanner();
  const [draft, setDraft] = useState(appSettings.globalAffirmation);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateAppSettings({ globalAffirmation: draft.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Section title="오늘의 확언" icon={<Sparkles size={16} />}>
      <p style={{ fontSize: 12, color: t.textMuted }}>
        대시보드에 표시될 확언 문구를 입력하세요. 비워두면 랜덤 확언이 표시됩니다.
      </p>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="나만의 확언을 입력하세요..."
        rows={3}
        className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none"
        style={{ fontSize: 13, borderColor: t.border, backgroundColor: t.bgSub, color: t.text, lineHeight: 1.6 }}
      />
      <button
        onClick={handleSave}
        className="w-full py-2.5 rounded-xl"
        style={{ fontSize: 13, fontWeight: 600, backgroundColor: saved ? '#006b62' : '#515f74', color: '#fff' }}
      >
        {saved ? '✓ 저장됨' : '저장'}
      </button>
    </Section>
  );
}

// ─── 선택 기능 토글 섹션 ───
function FeatureTogglesSection() {
  const { appSettings, updateAppSettings } = usePlanner();

  const toggles: { key: keyof typeof appSettings; label: string; desc: string }[] = [
    { key: 'showQuarterlyGoals', label: '분기별 목표 탭 표시', desc: '목표관리 페이지에 분기 탭을 추가합니다' },
    { key: 'showWeeklyKpt', label: '주간 리뷰: KPT 섹션', desc: '주간 리뷰에 KPT 회고 입력란을 추가합니다' },
    { key: 'showWeeklyHappiness', label: '주간 리뷰: 행복했던 일 섹션', desc: '주간 리뷰에 행복 기록 입력란을 추가합니다' },
    { key: 'showMonthlyKpt', label: '월간 리뷰: KPT 섹션', desc: '월간 리뷰에 KPT 회고 입력란을 추가합니다' },
    { key: 'showHabitHeatmap', label: '패턴 히트맵 표시', desc: '습관 트래커에 연간 히트맵을 표시합니다' },
  ];

  return (
    <Section title="선택 기능 켜기/끄기" icon={<SlidersHorizontal size={16} />}>
      <div className="space-y-4">
        {toggles.map(item => (
          <ToggleRow
            key={item.key}
            label={item.label}
            desc={item.desc}
            value={appSettings[item.key] as boolean}
            onChange={v => updateAppSettings({ [item.key]: v })}
          />
        ))}
      </div>
    </Section>
  );
}

// ─── 메인 뷰 ───
export function SettingsView() {
  const { t } = useTheme();

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 헤더 */}
      <div className="px-4 lg:px-6 pt-6 pb-4">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Serif Display', serif" }}>설정</h1>
        <p style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>앱 환경을 내 취향에 맞게 설정하세요</p>
      </div>

      {/* 섹션들 */}
      <div className="px-4 lg:px-6 pb-8 space-y-4">
        <TimelineSection />
        <CalendarSection />
        <TagsSection />
        <AffirmationSection />
        <FeatureTogglesSection />
      </div>
    </div>
  );
}
