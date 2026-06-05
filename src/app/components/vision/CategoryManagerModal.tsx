import React, { useEffect, useState } from 'react';
import { X, ArrowLeft, Plus, ChevronUp, ChevronDown, Pencil, Trash2, Check } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import ConfirmModal from '../ConfirmModal';

type Category = { id: string; name: string; sort_order: number; created_at: string };

interface Props {
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CategoryManagerModal({ categories, onClose, onChanged }: Props) {
  const { t } = useTheme();
  // 로컬 사본 — 순서 변경을 즉시 반영하고 일괄 저장
  const [local, setLocal] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  useEffect(() => {
    // 부모에서 들어온 카테고리를 정렬 기준으로 로컬에 복사
    setLocal([...categories].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)));
  }, [categories]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = async (id: string, dir: -1 | 1) => {
    const idx = local.findIndex(c => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= local.length) return;
    const next = [...local];
    [next[idx], next[target]] = [next[target], next[idx]];
    // sort_order 재할당 (0,1,2,...)
    const reindexed = next.map((c, i) => ({ ...c, sort_order: i }));
    setLocal(reindexed);
    await db.visionCategories.setSortOrders(reindexed.map(c => ({ id: c.id, sort_order: c.sort_order })));
    onChanged();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    await db.visionCategories.rename(id, name);
    setEditingId(null);
    onChanged();
  };

  const addNew = async () => {
    const name = newName.trim();
    if (!name) return;
    const nextOrder = (local[local.length - 1]?.sort_order ?? -1) + 1;
    await db.visionCategories.create(name, nextOrder);
    setNewName('');
    onChanged();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await db.visionCategories.delete(pendingDelete.id);
    setPendingDelete(null);
    onChanged();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-stretch lg:items-center lg:justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="flex flex-col w-full lg:w-[460px] lg:max-h-[85vh] lg:rounded-2xl overflow-hidden"
          style={{ backgroundColor: t.card, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center justify-between px-4 lg:px-5 py-3 border-b flex-shrink-0"
            style={{ borderColor: t.border, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
          >
            <button onClick={onClose} className="p-1.5 rounded-lg" aria-label="닫기">
              <ArrowLeft size={20} color={t.text} className="lg:hidden" />
              <X size={20} color={t.text} className="hidden lg:block" />
            </button>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: t.text, lineHeight: 1 }}>
              카테고리 관리
            </h2>
            <div style={{ width: 28 }} />
          </div>

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 space-y-3">
            <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
              카테고리를 삭제해도 그 안의 비전은 <strong style={{ color: t.text }}>미분류</strong>로 보존돼요.
            </p>

            <ul className="space-y-2">
              {local.map((c, i) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: t.bgSub, border: `1px solid ${t.borderLight}` }}
                >
                  {/* 순서 변경 */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(c.id, -1)}
                      disabled={i === 0}
                      style={{ color: i === 0 ? t.textMuted : t.textSub, opacity: i === 0 ? 0.4 : 1, padding: 2 }}
                      aria-label="위로"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(c.id, 1)}
                      disabled={i === local.length - 1}
                      style={{ color: i === local.length - 1 ? t.textMuted : t.textSub, opacity: i === local.length - 1 ? 0.4 : 1, padding: 2 }}
                      aria-label="아래로"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* 이름 / 편집 인풋 */}
                  <div className="flex-1">
                    {editingId === c.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); saveEdit(c.id); }
                          else if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: `1px solid ${t.accent}`,
                          backgroundColor: t.card,
                          color: t.text,
                          fontSize: 14,
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 14, color: t.text }}>{c.name}</span>
                    )}
                  </div>

                  {/* 액션 */}
                  {editingId === c.id ? (
                    <button
                      type="button"
                      onClick={() => saveEdit(c.id)}
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: t.accentLight, color: t.accent }}
                      aria-label="저장"
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="p-1.5 rounded-lg"
                        style={{ color: t.textSub }}
                        aria-label="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(c)}
                        className="p-1.5 rounded-lg"
                        style={{ color: t.danger }}
                        aria-label="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* 신규 추가 */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl mt-3"
              style={{ border: `1px dashed ${withAlpha(t.accent, 0.6)}`, backgroundColor: 'transparent' }}
            >
              <Plus size={16} color={t.accent} />
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
                placeholder="새 카테고리 이름"
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  backgroundColor: 'transparent',
                  color: t.text,
                  fontSize: 14,
                  outline: 'none',
                  border: 'none',
                }}
              />
              <button
                type="button"
                onClick={addNew}
                disabled={!newName.trim()}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: newName.trim() ? t.accent : t.textMuted,
                  padding: '4px 8px',
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmModal
          message={`'${pendingDelete.name}' 카테고리를 삭제할까요?`}
          description="이 카테고리의 비전은 삭제되지 않고 '미분류'로 옮겨져요."
          confirmText="삭제"
          confirmDanger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
