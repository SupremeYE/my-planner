// 하온 머니 — 카테고리 관리(대분류 > 소분류 2단계 브라우저).
//  · 지출/수입 토글 → 대분류 목록 → 소분류 add/edit, 대분류 add/edit.
//  · 모바일: 대분류 탭하면 소분류 인라인 펼침(아코디언). PC(lg): 좌 대분류 / 우 소분류 마스터-디테일(UI-Stage 2).
//  · 편집/추가는 CategoryForm(MoneyForms) 시트를 위에 띄움. 색/이모지 하드코딩 없음(tokens 경유).
import React, { useState } from 'react';
import { X, Plus, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { useMediaQuery } from '../../app/hooks/useMediaQuery';
import { MoneySheet } from './MoneySheet';
import { MONEY_PALETTE, resolveCategoryColor, subcategoryShade, categoryInitial } from './tokens';
import type { UseMoney } from './useMoney';
import type { MoneyCategory, TxType } from './types';
import { CategoryForm } from './MoneyForms';

// 추가/편집 시트 대상 — 대분류/소분류 공용.
type CatEditor =
  | { item: MoneyCategory | null; parentId: string | null; parentName?: string }
  | null;

export function CategoryManager({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [type, setType] = useState<TxType>('expense');
  const [openId, setOpenId] = useState<string | null>(null);   // 모바일: 펼친 대분류 / PC: 선택된 대분류
  const [editor, setEditor] = useState<CatEditor>(null);

  const roots = type === 'expense' ? m.expenseCategories : m.incomeCategories;
  const selectedRoot = roots.find(r => r.id === openId) ?? null;

  const typeBtn = (val: TxType, label: string) => {
    const active = type === val;
    return (
      <button onClick={() => { setType(val); setOpenId(null); }}
        style={{ flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: t.font,
          border: `1.5px solid ${active ? MONEY_PALETTE.gold : t.border}`,
          background: active ? `${MONEY_PALETTE.gold}18` : 'transparent',
          color: active ? t.text : t.textSub, fontWeight: active ? 700 : 400 }}>
        {label}
      </button>
    );
  };

  // 소분류 1행(편집 진입) — 모바일/PC 공용.
  const subRow = (sub: MoneyCategory, i: number, color: string, count: number) => (
    <button key={sub.id} onClick={() => setEditor({ item: sub, parentId: selectedRootForSub(sub), parentName: rootNameOf(sub) })}
      className="flex items-center gap-2.5 w-full text-left active:scale-[0.99] transition-transform"
      style={{ padding: '9px 4px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: subcategoryShade(color, i, count), flexShrink: 0, marginLeft: 4 }} />
      <span style={{ fontSize: 12.5, color: t.text, flex: 1 }}>{sub.emoji ? `${sub.emoji} ` : ''}{sub.name}</span>
      <Pencil size={13} style={{ color: t.textMuted }} />
    </button>
  );
  const rootNameOf = (sub: MoneyCategory) => roots.find(r => r.id === sub.parentId)?.name;
  const selectedRootForSub = (sub: MoneyCategory) => sub.parentId;

  const footerNote = (
    <div style={{ marginTop: 12, fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
      · 대분류를 삭제하면 소속 소분류도 함께 삭제되고, 관련 거래는 '미분류'로 바뀝니다.<br />
      · 소분류는 채팅 입력 시 자동으로 추론돼 붙어요(예: "오리고기 배달" → 식비 · 배달).
    </div>
  );

  return (
    <>
    <MoneySheet onClose={onClose} size="wide" maxVh={88}>
      {/* 헤더 */}
      <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>카테고리 관리</span>
        <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
      </div>

      {/* 지출/수입 토글 */}
      <div className="flex gap-1.5" style={{ marginBottom: 16, maxWidth: isDesktop ? 320 : undefined }}>
        {typeBtn('expense', '지출')}
        {typeBtn('income', '수입')}
      </div>

      {isDesktop ? (
        /* ── PC: 좌(대분류 리스트) + 우(선택 대분류의 소분류) 마스터-디테일 ── */
        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1.2fr', alignItems: 'start' }}>
          {/* 좌: 대분류 */}
          <div className="flex flex-col gap-1.5">
            {roots.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: t.textMuted, fontSize: 13 }}>대분류가 없어요. 아래에서 추가해보세요.</div>
            )}
            {roots.map(root => {
              const subs = m.subcategoriesOf(root.id);
              const color = resolveCategoryColor(root);
              const selected = openId === root.id;
              return (
                <div key={root.id} onClick={() => setOpenId(root.id)}
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ padding: '9px 10px', borderRadius: 12,
                    background: selected ? `${MONEY_PALETTE.gold}14` : t.card,
                    border: `1px solid ${selected ? `${MONEY_PALETTE.gold}66` : t.borderLight}` }}>
                  <div className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 30, height: 30, borderRadius: 9, background: `${color}20`, fontSize: 15 }}>
                    {root.emoji || <span style={{ fontSize: 12, fontWeight: 700, color }}>{categoryInitial(root.name)}</span>}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{root.name}</span>
                    <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 6 }}>{subs.length > 0 ? `소분류 ${subs.length}` : '소분류 없음'}</span>
                  </span>
                  <button onClick={e => { e.stopPropagation(); setEditor({ item: root, parentId: null }); }}
                    className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 8, color: t.textMuted }}>
                    <Pencil size={14} />
                  </button>
                </div>
              );
            })}
            <button onClick={() => setEditor({ item: null, parentId: null })}
              className="flex items-center justify-center gap-1 w-full" style={{ marginTop: 4, padding: '11px 12px', borderRadius: 12, border: `1.5px dashed ${t.border}`, color: MONEY_PALETTE.gold, fontSize: 13, fontWeight: 600 }}>
              <Plus size={15} /> 대분류 추가
            </button>
          </div>

          {/* 우: 선택된 대분류의 소분류 */}
          <div>
            {selectedRoot ? (() => {
              const color = resolveCategoryColor(selectedRoot);
              const subs = m.subcategoriesOf(selectedRoot.id);
              return (
                <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.borderLight}`, padding: '12px 14px' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{selectedRoot.emoji ? `${selectedRoot.emoji} ` : ''}{selectedRoot.name}</span>
                    <span style={{ fontSize: 11.5, color: t.textMuted }}>소분류 {subs.length}</span>
                  </div>
                  {subs.length === 0 && (
                    <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 4px' }}>아직 소분류가 없어요.</div>
                  )}
                  {subs.map((sub, i) => subRow(sub, i, color, subs.length))}
                  <button onClick={() => setEditor({ item: null, parentId: selectedRoot.id, parentName: selectedRoot.name })}
                    className="flex items-center gap-1 w-full" style={{ padding: '9px 4px', marginTop: 2, color: MONEY_PALETTE.gold, fontSize: 12, fontWeight: 600 }}>
                    <Plus size={13} /> 소분류 추가
                  </button>
                </div>
              );
            })() : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: t.textMuted, fontSize: 13, background: t.bgSub, borderRadius: 14 }}>
                왼쪽에서 대분류를 선택하면<br />소분류가 여기에 보여요.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── 모바일: 대분류 목록(탭하면 소분류 인라인 펼침) — 기존 그대로 ── */
        <>
        <div className="flex flex-col gap-2">
          {roots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: t.textMuted, fontSize: 13 }}>대분류가 없어요. 아래에서 추가해보세요.</div>
          )}
          {roots.map(root => {
            const subs = m.subcategoriesOf(root.id);
            const open = openId === root.id;
            const color = resolveCategoryColor(root);
            return (
              <div key={root.id} style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.borderLight}`, overflow: 'hidden' }}>
                {/* 대분류 행 */}
                <div className="flex items-center gap-2" style={{ padding: '11px 12px' }}>
                  <button onClick={() => setOpenId(open ? null : root.id)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 32, height: 32, borderRadius: 9, background: `${color}20`, fontSize: 16 }}>
                      {root.emoji || <span style={{ fontSize: 12, fontWeight: 700, color }}>{categoryInitial(root.name)}</span>}
                    </div>
                    <span className="min-w-0">
                      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{root.name}</span>
                      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 6 }}>{subs.length > 0 ? `소분류 ${subs.length}` : '소분류 없음'}</span>
                    </span>
                  </button>
                  <button onClick={() => setEditor({ item: root, parentId: null })}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 30, height: 30, borderRadius: 8, color: t.textMuted }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setOpenId(open ? null : root.id)}
                    className="flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 30, color: t.textMuted }}>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>

                {/* 소분류 목록(펼침) */}
                {open && (
                  <div style={{ padding: '2px 12px 12px', borderTop: `1px solid ${t.borderLight}` }}>
                    {subs.map((sub, i) => (
                      <button key={sub.id} onClick={() => setEditor({ item: sub, parentId: root.id, parentName: root.name })}
                        className="flex items-center gap-2.5 w-full text-left active:scale-[0.99] transition-transform"
                        style={{ padding: '9px 4px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: subcategoryShade(color, i, subs.length), flexShrink: 0, marginLeft: 4 }} />
                        <span style={{ fontSize: 12.5, color: t.text, flex: 1 }}>{sub.emoji ? `${sub.emoji} ` : ''}{sub.name}</span>
                        <Pencil size={13} style={{ color: t.textMuted }} />
                      </button>
                    ))}
                    <button onClick={() => setEditor({ item: null, parentId: root.id, parentName: root.name })}
                      className="flex items-center gap-1 w-full" style={{ padding: '9px 4px', marginTop: 2, color: MONEY_PALETTE.gold, fontSize: 12, fontWeight: 600 }}>
                      <Plus size={13} /> 소분류 추가
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 대분류 추가 */}
        <button onClick={() => setEditor({ item: null, parentId: null })}
          className="flex items-center justify-center gap-1 w-full" style={{ marginTop: 14, padding: '13px 12px', borderRadius: 12, border: `1.5px dashed ${t.border}`, color: MONEY_PALETTE.gold, fontSize: 13, fontWeight: 600 }}>
          <Plus size={15} /> 대분류 추가
        </button>
        </>
      )}

      {footerNote}
    </MoneySheet>

    {/* 추가/편집 시트(위에 겹침) — 매니저 백드롭의 형제로 띄워 바깥 클릭이 부모로 전파되지 않게 함 */}
    {editor && (
      <CategoryForm
        m={m}
        item={editor.item}
        type={type}
        parentId={editor.parentId}
        parentName={editor.parentName}
        onClose={() => setEditor(null)}
      />
    )}
    </>
  );
}
