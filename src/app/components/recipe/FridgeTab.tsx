import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Refrigerator, Snowflake, Package, Minus, Mic, MicOff, Sparkles, Check, Trash2, X } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import type { FridgeItem, FridgeCategory } from '../../store';
import { FridgeItemSheet } from './FridgeItemSheet';
import { FridgeQuickAddSheet, draftsFromParsed } from './FridgeQuickAddSheet';
import { parseFridgeQuickInput } from './recipeUtils';
import ConfirmModal from '../ConfirmModal';

const CATEGORY_ORDER: FridgeCategory[] = ['냉장', '냉동', '실온'];
const CATEGORY_ICON: Record<FridgeCategory, React.ComponentType<{ size?: number; color?: string }>> = {
  냉장: Refrigerator, 냉동: Snowflake, 실온: Package,
};

// yyyy-MM-dd → 오늘 기준 남은 일수(로컬 자정 기준). null이면 유통기한 없음.
function daysUntil(expiry?: string | null): number | null {
  if (!expiry) return null;
  const [y, m, d] = expiry.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - todayMid) / 86400000);
}

function dDayLabel(days: number): string {
  if (days === 0) return 'D-day';
  if (days > 0) return `D-${days}`;
  return `D+${-days}`;
}

// 품목 행
function FridgeRow({ item, onEdit, onQty, selectMode, selected, onToggleSelect }: {
  item: FridgeItem;
  onEdit: () => void;
  onQty: (delta: number) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useTheme();
  const days = daysUntil(item.expiryDate);
  const urgent = days != null && days <= 2;     // D-2 이내(만료 포함) 강조
  const empty = item.quantity <= 0;

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        backgroundColor: selectMode && selected ? t.accentLight : urgent ? t.dangerLight : t.card,
        border: `1px solid ${selectMode && selected ? t.accent : urgent ? t.danger : t.border}`,
        opacity: empty && !(selectMode && selected) ? 0.6 : 1,
      }}>
      {/* 선택 모드 체크박스 */}
      {selectMode && (
        <button onClick={onToggleSelect} aria-label={selected ? '선택 해제' : '선택'}
          className="flex-shrink-0 rounded-full flex items-center justify-center"
          style={{ width: 24, height: 24,
            backgroundColor: selected ? t.accent : 'transparent',
            border: `2px solid ${selected ? t.accent : t.border}` }}>
          {selected && <Check size={14} color="#fff" />}
        </button>
      )}

      {/* 이름 + D-day (탭 → 선택 모드면 선택 토글, 아니면 수정) */}
      <button onClick={selectMode ? onToggleSelect : onEdit} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: t.text,
            textDecoration: empty ? 'line-through' : 'none' }}>{item.name}</span>
          {days != null && (
            <span className="flex-shrink-0 px-1.5 py-0.5 rounded-md"
              style={{ fontSize: 11, fontWeight: 700,
                backgroundColor: urgent ? t.danger : t.bgSub,
                color: urgent ? '#fff' : t.textSub }}>
              {dDayLabel(days)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: empty ? t.danger : t.textMuted, marginTop: 2 }}>
          {empty ? '다 떨어짐' : `${item.quantity}${item.unit ?? ''}`}
        </div>
      </button>

      {/* 수량 스테퍼 (선택 모드에서는 숨김) */}
      {!selectMode && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onQty(-1)} className="rounded-lg flex items-center justify-center active:scale-95"
            style={{ width: 32, height: 32, border: `1px solid ${t.border}`, backgroundColor: t.bg, color: t.text }}
            aria-label="수량 감소">
            <Minus size={15} />
          </button>
          <span style={{ minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: 600, color: t.text }}>{item.quantity}</span>
          <button onClick={() => onQty(1)} className="rounded-lg flex items-center justify-center active:scale-95"
            style={{ width: 32, height: 32, border: `1px solid ${t.border}`, backgroundColor: t.bg, color: t.text }}
            aria-label="수량 증가">
            <Plus size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// 요약 카드
function SummaryCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <div className="flex-1 rounded-xl px-3 py-2.5 text-center"
      style={{ backgroundColor: t.card, border: `1px solid ${danger && value > 0 ? t.danger : t.border}` }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: danger && value > 0 ? t.danger : t.text }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function FridgeTab() {
  const { t } = useTheme();
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FridgeItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 다중 선택 삭제
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // 토스트 피드백
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  // 빠른 입력 상태
  const [quickText, setQuickText] = useState('');
  const [quickDrafts, setQuickDrafts] = useState<ReturnType<typeof draftsFromParsed> | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speech = useSpeechRecognition(
    (text) => setQuickText(prev => (prev.trim() ? `${prev.trim()}, ${text}` : text)),
    (code) => {
      // not-allowed: 마이크 권한 거부, audio-capture: 마이크 없음 등
      setSpeechError(code === 'not-allowed' ? '마이크 권한이 필요해요' : '음성 인식 오류');
      setTimeout(() => setSpeechError(null), 2500);
    },
  );

  const refresh = useCallback(() => {
    db.fridgeItems.fetchAll().then(rs => { setItems(rs); setLoading(false); });
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('fridge_items', refresh);

  // 빠른 입력 → 파싱 → 확인 시트 오픈
  const handleQuickParse = () => {
    const parsed = parseFridgeQuickInput(quickText);
    if (parsed.length === 0) return;
    setQuickDrafts(draftsFromParsed(parsed));
  };
  const handleQuickSave = async (newItems: FridgeItem[]) => {
    if (newItems.length === 0) {
      setQuickDrafts(null);
      return;
    }
    await db.fridgeItems.insertMany(newItems);
    setQuickDrafts(null);
    setQuickText('');
    refresh();
    notify(`${newItems.length}개 품목을 저장했어요`);
  };

  // 요약
  const summary = useMemo(() => {
    let near = 0, out = 0;
    for (const it of items) {
      const d = daysUntil(it.expiryDate);
      if (d != null && d <= 2) near++;
      if (it.quantity <= 0) out++;
    }
    return { total: items.length, near, out };
  }, [items]);

  // 카테고리별 그룹 + 유통기한 빠른 순(없으면 뒤로)
  const grouped = useMemo(() => {
    const byCat: Record<FridgeCategory, FridgeItem[]> = { 냉장: [], 냉동: [], 실온: [] };
    for (const it of items) (byCat[it.category] ?? byCat['냉장']).push(it);
    for (const cat of CATEGORY_ORDER) {
      byCat[cat].sort((a, b) => {
        const da = daysUntil(a.expiryDate);
        const dbb = daysUntil(b.expiryDate);
        if (da == null && dbb == null) return 0;
        if (da == null) return 1;
        if (dbb == null) return -1;
        return da - dbb;
      });
    }
    return byCat;
  }, [items]);

  const openAdd = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (it: FridgeItem) => { setEditing(it); setSheetOpen(true); };

  const handleQty = (it: FridgeItem, delta: number) => {
    const next = Math.max(0, Math.round((it.quantity + delta) * 10) / 10);
    setItems(prev => prev.map(p => (p.id === it.id ? { ...p, quantity: next } : p))); // optimistic
    db.fridgeItems.updateQuantity(it.id, next);
  };
  const handleSave = async (item: FridgeItem) => {
    const wasEdit = !!editing;
    await db.fridgeItems.upsert(item);
    setSheetOpen(false); setEditing(null); refresh();
    notify(wasEdit ? '수정했어요' : '저장했어요');
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await db.fridgeItems.delete(deleteId);
    setDeleteId(null); setSheetOpen(false); setEditing(null); refresh();
    notify('삭제했어요');
  };

  // ── 다중 선택 ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map(i => i.id)));
  };
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setItems(prev => prev.filter(p => !selectedIds.has(p.id))); // optimistic
    await db.fridgeItems.deleteMany(ids);
    setBulkConfirm(false);
    exitSelectMode();
    refresh();
    notify(`${ids.length}개 삭제했어요`);
  };

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-4 lg:py-6">
        {/* 빠른 입력 — 텍스트 + 음성 */}
        <div className="mb-4 rounded-2xl p-3"
          style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              <Sparkles size={14} color={t.accent} />
              빠른 입력
            </h3>
            <span style={{ fontSize: 11, color: t.textMuted }}>예: 계란 12, 사과 3개</span>
          </div>
          <div className="flex items-start gap-2">
            <textarea value={quickText} onChange={e => setQuickText(e.target.value)}
              rows={2} placeholder={speech.isListening ? '🎙️ 듣고 있어요…' : '쉼표로 구분해서 적어주세요'}
              className="flex-1 rounded-xl outline-none"
              style={{ padding: '9px 11px', fontSize: 14, lineHeight: 1.4, resize: 'none',
                border: `1px solid ${speech.isListening ? t.accent : t.border}`,
                backgroundColor: t.bg, color: t.text }} />
            {speech.supported && (
              <button type="button" onClick={() => (speech.isListening ? speech.stop() : speech.start())}
                aria-label={speech.isListening ? '음성 인식 정지' : '음성 입력 시작'}
                className="flex-shrink-0 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                style={{ width: 44, height: 44,
                  backgroundColor: speech.isListening ? t.danger : t.bgSub,
                  color: speech.isListening ? '#fff' : t.textSub,
                  border: `1px solid ${speech.isListening ? t.danger : t.border}` }}>
                {speech.isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <span style={{ fontSize: 11, color: speechError ? t.danger : t.textMuted, minHeight: 14 }}>
              {speechError ?? (speech.isListening ? '말씀이 끝나면 자동으로 멈춰요' : '')}
            </span>
            <button type="button" onClick={handleQuickParse}
              disabled={!quickText.trim()}
              className="px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
              style={{ fontSize: 13, fontWeight: 700,
                color: quickText.trim() ? '#fff' : t.textMuted,
                backgroundColor: quickText.trim() ? t.accent : t.bgSub,
                opacity: quickText.trim() ? 1 : 0.6 }}>
              확인하기
            </button>
          </div>
        </div>

        {/* 요약 */}
        <div className="flex gap-2 mb-4">
          <SummaryCard label="전체 품목" value={summary.total} />
          <SummaryCard label="임박 (D-2 이내)" value={summary.near} danger />
          <SummaryCard label="다 떨어짐" value={summary.out} danger />
        </div>

        {/* 선택/액션 바 */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between mb-3" style={{ minHeight: 34 }}>
            {selectMode ? (
              <>
                <button onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <span className="rounded-full flex items-center justify-center"
                    style={{ width: 18, height: 18, backgroundColor: allSelected ? t.accent : 'transparent', border: `2px solid ${allSelected ? t.accent : t.border}` }}>
                    {allSelected && <Check size={11} color="#fff" />}
                  </span>
                  전체 선택
                </button>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 13, color: t.textSub }}>{selectedIds.size}개 선택</span>
                  <button onClick={() => selectedIds.size > 0 && setBulkConfirm(true)} disabled={selectedIds.size === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                    style={{ fontSize: 13, fontWeight: 700,
                      color: selectedIds.size > 0 ? '#fff' : t.textMuted,
                      backgroundColor: selectedIds.size > 0 ? t.danger : t.bgSub,
                      opacity: selectedIds.size > 0 ? 1 : 0.6 }}>
                    <Trash2 size={14} /> 삭제
                  </button>
                  <button onClick={exitSelectMode}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                    style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                    <X size={14} /> 취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, color: t.textMuted }}>탭하면 수정 · 길게 모아 삭제하려면 선택</span>
                <button onClick={() => setSelectMode(true)}
                  className="px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 13, fontWeight: 600, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  선택
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl" style={{ height: 56, backgroundColor: t.bgSub }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-6">
            <div className="rounded-full flex items-center justify-center mb-4"
              style={{ width: 72, height: 72, backgroundColor: t.accentLight }}>
              <Refrigerator size={32} color={t.accent} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: t.text }}>냉장고가 비어 있어요</p>
            <p style={{ fontSize: 13, color: t.textSub, marginTop: 6 }}>+ 버튼으로 보관 중인 식재료를 추가해 보세요</p>
            <button onClick={openAdd} className="mt-5 flex items-center gap-1.5 px-4 py-2.5 rounded-xl"
              style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
              <Plus size={16} /> 품목 추가
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {CATEGORY_ORDER.map(cat => {
              const list = grouped[cat];
              if (list.length === 0) return null;
              const Icon = CATEGORY_ICON[cat];
              return (
                <section key={cat}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={15} color={t.textSub} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: t.textSub }}>{cat}</h3>
                    <span style={{ fontSize: 12, color: t.textMuted }}>{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map(it => (
                      <FridgeRow key={it.id} item={it} onEdit={() => openEdit(it)} onQty={(d) => handleQty(it, d)}
                        selectMode={selectMode} selected={selectedIds.has(it.id)} onToggleSelect={() => toggleSelect(it.id)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB (선택 모드에서는 숨김) */}
      {!selectMode && (
        <button onClick={openAdd} aria-label="냉장고 품목 추가"
          className="recipe-mod-fab fixed right-4 z-40 flex items-center justify-center rounded-full active:scale-95 transition-transform"
          style={{ width: 56, height: 56, backgroundColor: t.accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.28)' }}>
          <Plus size={26} />
        </button>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="recipe-mod-fab fixed left-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg pointer-events-none"
          style={{ transform: 'translateX(-50%)', backgroundColor: t.text, color: t.bg, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {sheetOpen && (
        <FridgeItemSheet
          item={editing}
          onSave={handleSave}
          onDelete={editing ? (id) => setDeleteId(id) : undefined}
          onClose={() => { setSheetOpen(false); setEditing(null); }}
        />
      )}
      {quickDrafts && (
        <FridgeQuickAddSheet
          initialDrafts={quickDrafts}
          onSave={handleQuickSave}
          onClose={() => setQuickDrafts(null)}
        />
      )}
      {deleteId && (
        <ConfirmModal
          message="이 품목을 삭제할까요?"
          confirmText="삭제"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
      {bulkConfirm && (
        <ConfirmModal
          message={`선택한 ${selectedIds.size}개 품목을 삭제할까요?`}
          confirmText="삭제"
          confirmDanger
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkConfirm(false)}
        />
      )}
    </>
  );
}
