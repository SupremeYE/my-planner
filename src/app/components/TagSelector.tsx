import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePlanner } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { DEFAULT_TAG_COLORS, TAG_PALETTE_KEY, MAX_TAG_COLORS } from '../../lib/tagPalette';
import { inputBg, dangerText, dangerFill } from '../styles/haonStyles';

/**
 * 태그 선택 컴포넌트 — 할일 모달·일정 모달 공용.
 *
 * TodoModal 에 인라인이던 태그 UI(칩 토글 + "+ 새 태그" 생성 + 팔레트 + 편집/삭제)를
 * 그대로 추출한 것. **새로 만든 게 아니라 옮긴 것**이라 두 모달의 태그 UX 가 동일하다.
 * 선택 상태만 value/onChange 로 부모가 소유하고, 태그 CRUD·팔레트(localStorage)는 내부.
 */
export function TagSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { tags: allTags, addTag, updateTag, deleteTag } = usePlanner();
  const { t } = useTheme();

  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [newTagPaletteColor, setNewTagPaletteColor] = useState<string | null>(DEFAULT_TAG_COLORS[0]);
  const [paletteColors, setPaletteColors] = useState<string[]>(DEFAULT_TAG_COLORS);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [editingTagPaletteColor, setEditingTagPaletteColor] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
  const normalizeHexInput = (v: string) => `#${v.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()}`;
  const normalizeHex = (v: string) => {
    const trimmed = v.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return withHash.toUpperCase();
  };
  const normalizedNewTagColor = useMemo(() => normalizeHex(newTagColor), [newTagColor]);
  const normalizedEditingTagColor = useMemo(() => normalizeHex(editingTagColor), [editingTagColor]);
  const newTagColorValid = isValidHex(normalizedNewTagColor);
  const editingTagColorValid = isValidHex(normalizedEditingTagColor);
  const newTagNeedsCustomSlot = newTagColorValid && !paletteColors.includes(normalizedNewTagColor);
  const editingTagNeedsCustomSlot = editingTagColorValid && !paletteColors.includes(normalizedEditingTagColor);
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
    onChange(value.includes(tagId) ? value.filter(id => id !== tagId) : [...value, tagId]);
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

  return (
    <>
      {/* 태그 */}
      <div>
        <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>태그</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {allTags.map(tag => {
            const selected = value.includes(tag.id);
            return (
              <div key={tag.id} className="flex items-center gap-1">
                <button
                  onClick={() => toggleTag(tag.id)}
                  className="px-2.5 py-1 rounded-full transition-all"
                  style={{
                    fontSize: 11,
                    // 비선택 태그 칩 배경 = 흰색(§3 라일락 규칙). 선택 = 태그 hue(카테고리 hue 예외). 非-H 는 bgSub 유지.
                    backgroundColor: selected ? tag.color : inputBg(t),
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
            style={{ backgroundColor: inputBg(t), border: `1px solid ${t.border}` }}
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
                  borderColor: newTagColorValid ? normalizedNewTagColor : dangerText(t),
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
                  border: `1px solid ${newTagColorValid ? t.border : dangerText(t)}`,
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
                  border: `1px solid ${newTagPaletteColor ? dangerText(t, '#FCA5A5') : t.border}`,
                  backgroundColor: newTagPaletteColor ? dangerFill(t, '#FEF2F2') : t.card,
                  color: newTagPaletteColor ? dangerText(t) : t.textMuted,
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
                backgroundColor: newTagColorValid ? `${normalizedNewTagColor}22` : inputBg(t),
              }}
            >
              {newTagName.trim() || 'TAG'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: newTagColorLimitExceeded ? dangerText(t) : t.textSub,
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
            style={{ backgroundColor: inputBg(t), border: `1px solid ${t.border}` }}
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
                  borderColor: editingTagColorValid ? normalizedEditingTagColor : dangerText(t),
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
                  border: `1px solid ${editingTagColorValid ? t.border : dangerText(t)}`,
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
                  border: `1px solid ${editingTagPaletteColor ? dangerText(t, '#FCA5A5') : t.border}`,
                  backgroundColor: editingTagPaletteColor ? dangerFill(t, '#FEF2F2') : t.card,
                  color: editingTagPaletteColor ? dangerText(t) : t.textMuted,
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
                backgroundColor: editingTagColorValid ? `${normalizedEditingTagColor}22` : inputBg(t),
              }}
            >
              {editingTagName.trim() || 'TAG'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: editingTagColorLimitExceeded ? dangerText(t) : t.textSub,
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

      {deletingTagId && (
        <ConfirmModal
          message="태그를 삭제할까요? 연결된 할일에서는 태그만 제거됩니다."
          confirmText="삭제"
          confirmDanger
          onConfirm={() => {
            deleteTag(deletingTagId);
            onChange(value.filter(id => id !== deletingTagId));
            if (editingTagId === deletingTagId) cancelEditTag();
            setDeletingTagId(null);
          }}
          onCancel={() => setDeletingTagId(null)}
        />
      )}
    </>
  );
}
