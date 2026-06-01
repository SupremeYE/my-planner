import { useEffect, useMemo, useState } from 'react';
import { format, getDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { usePlanner, Todo } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { TimePicker } from './TimePicker';
import { RecurrenceBranchModal } from './RecurrenceBranchModal';
import { isVirtualTodoId, parseVirtualTodoId, DOW_LABELS } from '../../lib/recurrenceExpansion';

const DEFAULT_TAG_COLORS = [
  '#E0795B', '#D4735A', '#E8A87C', '#F4A261',
  '#4A82CC', '#3B82F6', '#45B899', '#34D399',
  '#006b62', '#8B7CF8', '#22C55E', '#515f74', '#475569',
];
const TAG_PALETTE_KEY = 'tagPaletteColors';
const MAX_TAG_COLORS = 13;

interface TodoModalProps {
  /** date prop은 기본 날짜로 사용되며, 모달 안에서 변경/해제할 수 있다. */
  date?: string;
  todo?: Todo;
  initialPlanStart?: string;
  initialPlanEnd?: string;
  onClose: () => void;
}

export function TodoModal({ date, todo, initialPlanStart, initialPlanEnd, onClose }: TodoModalProps) {
  const { addTodo, updateTodo, deleteTodo, deleteRecurringTodo, updateRecurringTodo, tags: allTags, projects, addTag, updateTag, deleteTag } = usePlanner();
  const { t } = useTheme();

  // ── 반복 관련 ───────────────────────────────────────────────────────────────
  const isVirtual = todo ? isVirtualTodoId(todo.id) : false;
  const virtualInfo = isVirtual && todo ? parseVirtualTodoId(todo.id) : null;
  // 반복 편집/삭제 로직 분기 트리거 (부모 포함)
  const isRecurringInstance = !!(isVirtual || (todo?.recurrenceRule && !todo?.isException) || todo?.recurrenceParentId);
  // 반복에서 분리된 단일 예외 레코드(이 날짜만의 일정) — 반복 주기 설정이 의미 없으므로 안내 배너만 표시
  const isDetachedException = !!todo?.recurrenceParentId;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [modalDate, setModalDate] = useState<string>(
    date ?? todo?.date ?? '',
  );

  const effectiveDate = modalDate;
  const dateLabel = effectiveDate
    ? format(new Date(`${effectiveDate}T12:00:00`), 'M월 d일 (EEEE)', { locale: ko })
    : '미지정';

  // 폼 fields
  const [text, setText] = useState(todo?.text ?? '');
  const [planStart, setPlanStart] = useState(todo?.planStart ?? initialPlanStart ?? '');
  const [planEnd, setPlanEnd] = useState(todo?.planEnd ?? initialPlanEnd ?? '');
  const [isTop3, setIsTop3] = useState(todo?.isTop3 ?? false);
  const [selectedTags, setSelectedTags] = useState<string[]>(todo?.tags ?? []);
  const [projectId, setProjectId] = useState(todo?.projectId ?? '');
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [newTagPaletteColor, setNewTagPaletteColor] = useState<string | null>(DEFAULT_TAG_COLORS[0]);
  const [paletteColors, setPaletteColors] = useState<string[]>(DEFAULT_TAG_COLORS);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [editingTagPaletteColor, setEditingTagPaletteColor] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  // 반복 일정 state
  const [recurrenceRule, setRecurrenceRule] = useState<Todo['recurrenceRule']>(todo?.recurrenceRule ?? undefined);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(todo?.recurrenceDays ?? []);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(todo?.recurrenceEndDate ?? '');
  const [recurrenceBranchFor, setRecurrenceBranchFor] = useState<'save' | 'delete' | null>(null);

  // "매주" 선택 시 기준 요일 (편집 중인 todo의 날짜, 또는 선택한 날짜)
  const baseDow = useMemo(() => {
    const d = todo?.date ?? effectiveDate;
    return d ? getDay(parseISO(d)) : getDay(new Date());
  }, [todo?.date, effectiveDate]);

  const isValidHex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);
  const normalizeHexInput = (value: string) => `#${value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()}`;
  const normalizeHex = (value: string) => {
    const trimmed = value.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return withHash.toUpperCase();
  };
  const normalizedNewTagColor = useMemo(() => {
    return normalizeHex(newTagColor);
  }, [newTagColor]);
  const normalizedEditingTagColor = useMemo(() => {
    return normalizeHex(editingTagColor);
  }, [editingTagColor]);
  const newTagColorValid = isValidHex(normalizedNewTagColor);
  const editingTagColorValid = isValidHex(normalizedEditingTagColor);
  const newTagNeedsCustomSlot =
    newTagColorValid &&
    !paletteColors.includes(normalizedNewTagColor);
  const editingTagNeedsCustomSlot =
    editingTagColorValid &&
    !paletteColors.includes(normalizedEditingTagColor);
  const newTagColorLimitExceeded = newTagNeedsCustomSlot && paletteColors.length >= MAX_TAG_COLORS;
  const editingTagColorLimitExceeded = editingTagNeedsCustomSlot && paletteColors.length >= MAX_TAG_COLORS;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TAG_PALETTE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const filtered = parsed
        .map((v: string) => normalizeHex(v))
        .filter((v: string) => isValidHex(v))
        .slice(0, MAX_TAG_COLORS);
      if (filtered.length > 0) setPaletteColors(filtered);
    } catch {
      setPaletteColors(DEFAULT_TAG_COLORS);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TAG_PALETTE_KEY, JSON.stringify(paletteColors));
    } catch {
      // noop
    }
  }, [paletteColors]);

  const addColorToPalette = (color: string): boolean => {
    const normalized = normalizeHex(color);
    if (!isValidHex(normalized)) return false;
    if (paletteColors.includes(normalized)) return true;
    if (paletteColors.length >= MAX_TAG_COLORS) return false;
    setPaletteColors(prev => [normalized, ...prev].slice(0, MAX_TAG_COLORS));
    return true;
  };

  const replacePaletteColor = (fromColor: string, toColor: string): boolean => {
    const from = normalizeHex(fromColor);
    const to = normalizeHex(toColor);
    if (!paletteColors.includes(from) || !isValidHex(to)) return false;
    setPaletteColors(prev => {
      const withoutFrom = prev.filter(c => c !== from);
      if (withoutFrom.includes(to)) return withoutFrom;
      return [to, ...withoutFrom].slice(0, MAX_TAG_COLORS);
    });
    return true;
  };

  const removePaletteColor = (color: string) => {
    const normalized = normalizeHex(color);
    const nextPalette = paletteColors.filter(c => c !== normalized);
    setPaletteColors(nextPalette);
    if (newTagPaletteColor === normalized) {
      setNewTagPaletteColor(nextPalette[0] ?? null);
      setNewTagColor(nextPalette[0] ?? normalized);
    }
    if (editingTagPaletteColor === normalized) {
      setEditingTagPaletteColor(nextPalette[0] ?? null);
      setEditingTagColor(nextPalette[0] ?? normalized);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId],
    );
  };

  const handleCreateTag = () => {
    if (!newTagName.trim() || !newTagColorValid || newTagColorLimitExceeded) return;
    if (!addColorToPalette(normalizedNewTagColor)) return;
    addTag(newTagName.trim(), normalizedNewTagColor);
    setNewTagName('');
    setNewTagColor(paletteColors[0] || DEFAULT_TAG_COLORS[0]);
    setNewTagPaletteColor(paletteColors[0] || DEFAULT_TAG_COLORS[0]);
    setShowNewTag(false);
  };

  const startEditTag = (id: string, name: string, color: string) => {
    const normalizedColor = normalizeHex(color);
    setEditingTagId(id);
    setEditingTagName(name);
    setEditingTagColor(normalizedColor);
    setEditingTagPaletteColor(paletteColors.includes(normalizedColor) ? normalizedColor : null);
  };

  const cancelEditTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagColor(paletteColors[0] || DEFAULT_TAG_COLORS[0]);
    setEditingTagPaletteColor(null);
  };

  const handleUpdateTag = () => {
    if (!editingTagId || !editingTagName.trim() || !editingTagColorValid || editingTagColorLimitExceeded) return;
    if (!addColorToPalette(normalizedEditingTagColor)) return;
    updateTag(editingTagId, {
      name: editingTagName.trim(),
      color: normalizedEditingTagColor,
    });
    cancelEditTag();
  };

  const buildChanges = () => ({
    text: text.trim(),
    date: effectiveDate || null,
    planStart: planStart || undefined,
    planEnd: planEnd || undefined,
    isTop3,
    tags: selectedTags,
    projectId: projectId || undefined,
    recurrenceRule: recurrenceRule ?? undefined,
    recurrenceDays: recurrenceRule === 'custom' ? recurrenceDays : undefined,
    recurrenceEndDate: recurrenceEndDate || undefined,
  });

  const executeSubmit = (scope?: 'this' | 'future' | 'all') => {
    const changes = buildChanges();
    if (isVirtual && virtualInfo && scope) {
      updateRecurringTodo(virtualInfo.parentId, virtualInfo.instanceDate, changes, scope);
    } else if (todo?.recurrenceParentId) {
      // 예외 레코드 - 직접 수정
      updateTodo(todo.id, changes);
    } else if (isRecurringInstance && todo && scope) {
      // 부모 반복 일정 수정
      const instanceDate = todo.date ?? format(new Date(), 'yyyy-MM-dd');
      updateRecurringTodo(todo.id, instanceDate, changes, scope);
    } else if (todo) {
      updateTodo(todo.id, changes);
    } else {
      addTodo({ ...changes, status: 'active' });
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (isRecurringInstance && todo && !todo.recurrenceParentId) {
      setRecurrenceBranchFor('save');
      return;
    }
    executeSubmit();
  };

  const executeDelete = (scope?: 'this' | 'future' | 'all') => {
    if (!todo) return;
    if (isVirtual && virtualInfo && scope) {
      deleteRecurringTodo(virtualInfo.parentId, virtualInfo.instanceDate, scope);
    } else if (todo.recurrenceParentId) {
      deleteTodo(todo.id);
    } else if (isRecurringInstance && scope) {
      const instanceDate = todo.date ?? format(new Date(), 'yyyy-MM-dd');
      deleteRecurringTodo(todo.id, instanceDate, scope);
    } else {
      deleteTodo(todo.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (isRecurringInstance && todo && !todo.recurrenceParentId) {
      setRecurrenceBranchFor('delete');
      return;
    }
    setShowDeleteConfirm(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-[420px] max-w-[95vw] max-h-[85vh] overflow-y-auto"
        style={{
          backgroundColor: t.card,
          border: `1px solid ${t.border}`,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            {todo ? '할일 수정' : '할일 추가'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="pb-4 space-y-2" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="flex items-center gap-2">
              <CalendarDays size={14} color={t.accent} />
              <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>날짜</span>
              <span style={{ fontSize: 11, color: t.textMuted }}>{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={effectiveDate}
                onChange={e => setModalDate(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 outline-none"
                style={{
                  border: `1px solid ${t.border}`,
                  backgroundColor: t.bgSub,
                  color: t.text,
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={() => setModalDate(todayStr)}
                className="px-3 py-2 rounded-lg"
                style={{ fontSize: 11, fontWeight: 600, color: t.accent, backgroundColor: t.accentLight }}
              >
                오늘
              </button>
              <button
                type="button"
                onClick={() => setModalDate('')}
                className="px-3 py-2 rounded-lg"
                style={{ fontSize: 11, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub }}
              >
                미지정
              </button>
            </div>
          </div>

          {/* 할일 텍스트 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>할일</label>
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="할 일을 입력하세요"
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 13,
              }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* 시작/종료 시간 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작</label>
              <div className="mt-1">
                <TimePicker value={planStart} onChange={setPlanStart} placeholder="시작 시간" />
              </div>
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>종료</label>
              <div className="mt-1">
                <TimePicker value={planEnd} onChange={setPlanEnd} placeholder="종료 시간" />
              </div>
            </div>
          </div>

          {/* 반복 일정 — 신규/일반/부모 반복/반복 인스턴스 모두 현재 값으로 채워 편집 가능;
              반복에서 분리된 단일 예외 레코드만 설정 UI 숨김 */}
          {!isDetachedException && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <RefreshCw size={13} color={t.accent} />
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>반복</label>
              </div>
              {/* 반복 옵션 칩 */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {([
                  { value: undefined,   label: '반복 없음' },
                  { value: 'daily',     label: '매일' },
                  { value: 'weekly',    label: `매주 ${DOW_LABELS[baseDow]}요일` },
                  { value: 'weekdays',  label: '평일 (월~금)' },
                  { value: 'custom',    label: '직접 설정' },
                ] as const).map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setRecurrenceRule(opt.value)}
                    className="px-3 py-1 rounded-full"
                    style={{
                      fontSize: 11, fontWeight: recurrenceRule === opt.value ? 700 : 500,
                      backgroundColor: recurrenceRule === opt.value ? t.accent : t.bgSub,
                      color: recurrenceRule === opt.value ? '#fff' : t.textSub,
                      border: `1.5px solid ${recurrenceRule === opt.value ? t.accent : t.border}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* custom 요일 선택 */}
              {recurrenceRule === 'custom' && (
                <div className="flex gap-1.5 mb-2">
                  {DOW_LABELS.map((label, dow) => (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => setRecurrenceDays(prev =>
                        prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow]
                      )}
                      className="w-8 h-8 rounded-full"
                      style={{
                        fontSize: 11, fontWeight: 700,
                        backgroundColor: recurrenceDays.includes(dow) ? t.accent : t.bgSub,
                        color: recurrenceDays.includes(dow) ? '#fff' : t.textSub,
                        border: `1.5px solid ${recurrenceDays.includes(dow) ? t.accent : t.border}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {/* 종료일 */}
              {recurrenceRule && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: t.textSub, fontWeight: 600, whiteSpace: 'nowrap' }}>종료일</span>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={e => setRecurrenceEndDate(e.target.value)}
                    placeholder="없으면 무기한"
                    className="flex-1 rounded-lg px-3 py-1.5 outline-none"
                    style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 12 }}
                  />
                  {recurrenceEndDate && (
                    <button type="button" onClick={() => setRecurrenceEndDate('')}
                      style={{ fontSize: 11, color: t.textMuted }}>지우기</button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* 반복에서 분리된 단일 예외 레코드임을 표시 */}
          {isDetachedException && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ backgroundColor: '#EEF6FF', border: '1px solid #C0D8F8' }}>
              <RefreshCw size={12} color="#5B8FD8" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#5B8FD8' }}>이 날짜만 분리된 일정입니다</span>
            </div>
          )}

          {/* Top3 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button onClick={() => setIsTop3(!isTop3)} className="p-0.5">
              <Star
                size={16}
                fill={isTop3 ? t.accent : 'none'}
                color={isTop3 ? t.accent : t.textMuted}
              />
            </button>
            <span style={{ fontSize: 12, color: t.text }}>Top 3 중요 할일</span>
          </label>

          {/* 프로젝트 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>프로젝트</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{
                border: `1px solid ${t.border}`,
                backgroundColor: t.bgSub,
                color: t.text,
                fontSize: 13,
              }}
            >
              <option value="">없음</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 태그 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>태그</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {allTags.map(tag => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <div key={tag.id} className="flex items-center gap-1">
                    <button
                      onClick={() => toggleTag(tag.id)}
                      className="px-2.5 py-1 rounded-full transition-all"
                      style={{
                        fontSize: 11,
                        backgroundColor: selected ? tag.color : t.bgSub,
                        color: selected ? '#fff' : t.textSub,
                        border: `1px solid ${selected ? tag.color : t.border}`,
                      }}
                    >
                      {tag.name}
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => setShowNewTag(!showNewTag)}
                className="px-2.5 py-1 rounded-full"
                style={{ fontSize: 11, color: t.accent, border: `1px dashed ${t.accent}` }}
              >
                + 새 태그
              </button>
            </div>

            {showNewTag && (
              <div
                className="mt-2 p-3 rounded-xl space-y-2"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
              >
                <input
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="태그 이름"
                  autoFocus
                  className="w-full rounded-lg px-2.5 py-1.5 outline-none mb-3"
                  style={{
                    border: `1px solid ${t.border}`,
                    fontSize: 12,
                    backgroundColor: t.card,
                    color: t.text,
                  }}
                />
                <div className="flex flex-nowrap gap-1 overflow-x-auto overflow-y-visible px-1 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {paletteColors.map(c => (
                    <div key={`new-${c}`} className="relative shrink-0">
                      <button
                        onClick={() => {
                          setNewTagColor(c);
                          setNewTagPaletteColor(c);
                        }}
                        className="h-5 w-5 rounded-full transition-transform"
                        style={{
                          backgroundColor: c,
                          outline: newTagPaletteColor === c ? `2px solid ${c}` : 'none',
                          outlineOffset: 1,
                          transform: newTagPaletteColor === c ? 'scale(1.06)' : 'scale(1)',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{
                      backgroundColor: newTagColorValid ? normalizedNewTagColor : 'transparent',
                      borderColor: newTagColorValid ? normalizedNewTagColor : '#DC2626',
                    }}
                  />
                  <input
                    value={newTagColor}
                    onChange={e => {
                      const next = normalizeHexInput(e.target.value);
                      setNewTagColor(next);
                      setNewTagPaletteColor(paletteColors.includes(next) ? next : null);
                    }}
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !newTagColorValid || !newTagPaletteColor) return;
                      if (!paletteColors.includes(newTagPaletteColor)) return;
                      e.preventDefault();
                      const replaced = replacePaletteColor(newTagPaletteColor, normalizedNewTagColor);
                      if (replaced) setNewTagPaletteColor(normalizedNewTagColor);
                    }}
                    placeholder="#FF5733"
                    className="flex-1 rounded-lg px-2.5 py-1.5 outline-none"
                    style={{
                      border: `1px solid ${newTagColorValid ? t.border : '#DC2626'}`,
                      fontSize: 12,
                      backgroundColor: t.card,
                      color: t.text,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => newTagPaletteColor && removePaletteColor(newTagPaletteColor)}
                    disabled={!newTagPaletteColor}
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      border: `1px solid ${newTagPaletteColor ? '#FCA5A5' : t.border}`,
                      backgroundColor: newTagPaletteColor ? '#FEF2F2' : t.card,
                      color: newTagPaletteColor ? '#DC2626' : t.textMuted,
                      opacity: newTagPaletteColor ? 1 : 0.5,
                      cursor: newTagPaletteColor ? 'pointer' : 'not-allowed',
                    }}
                    aria-label="선택한 팔레트 색상 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div
                  className="inline-flex items-center rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 11,
                    border: `1px solid ${newTagColorValid ? normalizedNewTagColor : t.border}`,
                    color: newTagColorValid ? normalizedNewTagColor : t.textSub,
                    backgroundColor: newTagColorValid ? `${normalizedNewTagColor}22` : t.bgSub,
                  }}
                >
                  {newTagName.trim() || 'TAG'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: newTagColorLimitExceeded ? '#DC2626' : t.textSub,
                  }}
                >
                  팔레트는 최대 13개까지 저장됩니다. 새 색을 추가하려면 기존 색을 삭제하세요.
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || !newTagColorValid || newTagColorLimitExceeded}
                    className="flex-1 py-1 rounded-lg"
                    style={{
                      backgroundColor: t.accent,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      opacity: newTagName.trim() && newTagColorValid && !newTagColorLimitExceeded ? 1 : 0.5,
                      cursor: newTagName.trim() && newTagColorValid && !newTagColorLimitExceeded ? 'pointer' : 'not-allowed',
                    }}
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setShowNewTag(false)}
                    className="flex-1 py-1 rounded-lg"
                    style={{
                      backgroundColor: t.card,
                      color: t.textSub,
                      fontSize: 11,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {editingTagId && (
              <div
                className="mt-2 p-3 rounded-xl space-y-2"
                style={{ backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}
              >
                <div style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>태그 편집</div>
                <input
                  value={editingTagName}
                  onChange={e => setEditingTagName(e.target.value)}
                  placeholder="태그 이름"
                  className="w-full rounded-lg px-2.5 py-1.5 outline-none mb-3"
                  style={{
                    border: `1px solid ${t.border}`,
                    fontSize: 12,
                    backgroundColor: t.card,
                    color: t.text,
                  }}
                />
                <div className="flex flex-nowrap gap-1 overflow-x-auto overflow-y-visible px-1 pt-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {paletteColors.map(c => (
                    <div key={`edit-${c}`} className="relative shrink-0">
                      <button
                        onClick={() => {
                          setEditingTagColor(c);
                          setEditingTagPaletteColor(c);
                        }}
                        className="h-5 w-5 rounded-full transition-transform"
                        style={{
                          backgroundColor: c,
                          outline: editingTagPaletteColor === c ? `2px solid ${c}` : 'none',
                          outlineOffset: 1,
                          transform: editingTagPaletteColor === c ? 'scale(1.06)' : 'scale(1)',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{
                      backgroundColor: editingTagColorValid ? normalizedEditingTagColor : 'transparent',
                      borderColor: editingTagColorValid ? normalizedEditingTagColor : '#DC2626',
                    }}
                  />
                  <input
                    value={editingTagColor}
                    onChange={e => {
                      const next = normalizeHexInput(e.target.value);
                      setEditingTagColor(next);
                      setEditingTagPaletteColor(paletteColors.includes(next) ? next : null);
                    }}
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !editingTagColorValid || !editingTagPaletteColor) return;
                      if (!paletteColors.includes(editingTagPaletteColor)) return;
                      e.preventDefault();
                      const replaced = replacePaletteColor(editingTagPaletteColor, normalizedEditingTagColor);
                      if (replaced) setEditingTagPaletteColor(normalizedEditingTagColor);
                    }}
                    placeholder="#FF5733"
                    className="flex-1 rounded-lg px-2.5 py-1.5 outline-none"
                    style={{
                      border: `1px solid ${editingTagColorValid ? t.border : '#DC2626'}`,
                      fontSize: 12,
                      backgroundColor: t.card,
                      color: t.text,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => editingTagPaletteColor && removePaletteColor(editingTagPaletteColor)}
                    disabled={!editingTagPaletteColor}
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      border: `1px solid ${editingTagPaletteColor ? '#FCA5A5' : t.border}`,
                      backgroundColor: editingTagPaletteColor ? '#FEF2F2' : t.card,
                      color: editingTagPaletteColor ? '#DC2626' : t.textMuted,
                      opacity: editingTagPaletteColor ? 1 : 0.5,
                      cursor: editingTagPaletteColor ? 'pointer' : 'not-allowed',
                    }}
                    aria-label="선택한 팔레트 색상 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div
                  className="inline-flex items-center rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 11,
                    border: `1px solid ${editingTagColorValid ? normalizedEditingTagColor : t.border}`,
                    color: editingTagColorValid ? normalizedEditingTagColor : t.textSub,
                    backgroundColor: editingTagColorValid ? `${normalizedEditingTagColor}22` : t.bgSub,
                  }}
                >
                  {editingTagName.trim() || 'TAG'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: editingTagColorLimitExceeded ? '#DC2626' : t.textSub,
                  }}
                >
                  팔레트는 최대 13개까지 저장됩니다. 새 색을 추가하려면 기존 색을 삭제하세요.
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleUpdateTag}
                    disabled={!editingTagName.trim() || !editingTagColorValid || editingTagColorLimitExceeded}
                    className="flex-1 py-1 rounded-lg"
                    style={{
                      backgroundColor: t.accent,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      opacity: editingTagName.trim() && editingTagColorValid && !editingTagColorLimitExceeded ? 1 : 0.5,
                      cursor: editingTagName.trim() && editingTagColorValid && !editingTagColorLimitExceeded ? 'pointer' : 'not-allowed',
                    }}
                  >
                    저장
                  </button>
                  <button
                    onClick={cancelEditTag}
                    className="flex-1 py-1 rounded-lg"
                    style={{
                      backgroundColor: t.card,
                      color: t.textSub,
                      fontSize: 11,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderTop: `1px solid ${t.border}` }}
        >
          {todo && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl transition-colors"
              style={{ fontSize: 12, color: '#DC2626', backgroundColor: '#FEE2E2' }}
            >
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl"
            style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}
          >
            {todo ? '저장' : '추가'}
          </button>
        </div>
      </div>
      {showDeleteConfirm && todo && (
        <ConfirmModal
          message="할일을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            executeDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {recurrenceBranchFor && (
        <RecurrenceBranchModal
          mode={recurrenceBranchFor === 'save' ? 'edit' : 'delete'}
          onConfirm={scope => {
            if (recurrenceBranchFor === 'save') executeSubmit(scope);
            else executeDelete(scope);
            setRecurrenceBranchFor(null);
          }}
          onCancel={() => setRecurrenceBranchFor(null)}
        />
      )}
      {deletingTagId && (
        <ConfirmModal
          message="태그를 삭제할까요? 연결된 할일에서는 태그만 제거됩니다."
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            deleteTag(deletingTagId);
            setSelectedTags(prev => prev.filter(id => id !== deletingTagId));
            if (editingTagId === deletingTagId) cancelEditTag();
            setDeletingTagId(null);
          }}
          onCancel={() => setDeletingTagId(null)}
        />
      )}
    </div>
  );
}
