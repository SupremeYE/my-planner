// 하온 머니 — 카드 관리 전용 화면(별도 시트).
//  · 총 미결제액(자동) + 다가오는 결제 D-day 정렬 + 카드별 미청구 거래 내역.
//  · 미결제액 = 기준 이월액 + 카드명으로 태그된 미청구 거래 합(useMoney.cardUnpaid). 체크카드는 미청구 개념 없음.
import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../../app/ThemeContext';
import { MONEY_PALETTE, formatWon, formatManShort } from './tokens';
import { daysUntilDay } from './fx';
import type { UseMoney } from './useMoney';
import type { MoneyCard } from './types';
import { CardForm } from './MoneyForms';

export function CardManager({ m, onClose }: { m: UseMoney; onClose: () => void }) {
  const { t } = useTheme();
  const [editor, setEditor] = useState<{ item: MoneyCard | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const credit = m.cards.filter(c => c.type === 'credit');
  const totalUnpaid = credit.reduce((s, c) => s + m.cardUnpaid(c), 0);

  // 다가오는 결제: 결제일 있는 신용카드, D-day 임박순.
  const upcoming = credit
    .filter(c => c.billingDay != null)
    .map(c => ({ c, dday: daysUntilDay(c.billingDay)!, unpaid: m.cardUnpaid(c) }))
    .sort((a, b) => a.dday - b.dday);

  const card = { background: t.card, borderRadius: 16, padding: 16, boxShadow: t.shadow } as React.CSSProperties;

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center" style={{ background: 'rgba(58,53,46,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full lg:w-[480px] lg:max-w-[92vw] rounded-t-3xl lg:rounded-3xl"
        style={{ background: t.bg, padding: '20px 18px 28px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 헤더 */}
        <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>카드 관리</span>
          <button onClick={onClose} style={{ color: t.textMuted }}><X size={18} /></button>
        </div>

        {m.cards.length === 0 ? (
          <button onClick={() => setEditor({ item: null })} className="w-full flex flex-col items-center justify-center"
            style={{ padding: '28px 12px', borderRadius: 16, border: `1.5px dashed ${t.border}`, background: 'transparent', color: t.textMuted, fontSize: 13, gap: 6 }}>
            <span>등록된 카드가 없어요</span>
            <span style={{ color: MONEY_PALETTE.gold, fontWeight: 600, fontSize: 12 }}>+ 카드 추가하기</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {/* 총 미결제 요약 */}
            <div style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>신용카드 미결제 합계</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: MONEY_PALETTE.coral }}>{formatWon(totalUnpaid)}</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>신용 {credit.length}장 · 거래 태그 자동 집계</div>
            </div>

            {/* 다가오는 결제 */}
            {upcoming.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 12 }}>📅 다가오는 결제</div>
                <div className="flex flex-col gap-2.5">
                  {upcoming.map(({ c, dday, unpaid }) => {
                    const imminent = dday <= 3;
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c.color || MONEY_PALETTE.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>💳</div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>매월 {c.billingDay}일 결제</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{formatWon(unpaid)}</div>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: imminent ? MONEY_PALETTE.coral : t.textMuted }}>D-{dday}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 카드별 미청구 내역 */}
            <div>
              <div className="flex items-center justify-between" style={{ margin: '4px 2px 8px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>💳 카드별 내역</span>
                <button onClick={() => setEditor({ item: null })} className="flex items-center gap-1" style={{ fontSize: 12, color: MONEY_PALETTE.gold, fontWeight: 600 }}>
                  <Plus size={13} /> 추가
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {m.cards.map(c => {
                  const isCheck = c.type === 'check';
                  const unpaid = m.cardUnpaid(c);
                  const txs = m.cardUnbilledTxs(c);
                  const open = openId === c.id;
                  const canOpen = !isCheck && txs.length > 0;
                  return (
                    <div key={c.id} style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.borderLight}`, overflow: 'hidden' }}>
                      <div className="flex items-center gap-3" style={{ padding: '11px 13px' }}>
                        <button onClick={() => canOpen && setOpenId(open ? null : c.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${c.color || MONEY_PALETTE.gold}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>💳</div>
                          <div className="min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>
                              {isCheck ? '체크 · 즉시출금' : `신용${c.billingDay ? ` · 매월 ${c.billingDay}일` : ''}${txs.length ? ` · 미청구 ${txs.length}건` : ''}`}
                            </div>
                          </div>
                        </button>
                        {!isCheck && (
                          <span style={{ fontSize: 14, fontWeight: 700, color: MONEY_PALETTE.coral, flexShrink: 0 }}>-{formatManShort(unpaid)}</span>
                        )}
                        <button onClick={() => setEditor({ item: c })} className="flex items-center justify-center flex-shrink-0" style={{ fontSize: 11, color: t.textSub, fontWeight: 600, padding: '4px 6px' }}>편집</button>
                        {canOpen && (
                          <button onClick={() => setOpenId(open ? null : c.id)} className="flex items-center justify-center flex-shrink-0" style={{ width: 20, color: t.textMuted }}>
                            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        )}
                      </div>

                      {/* 미청구 거래 목록 */}
                      {open && canOpen && (
                        <div style={{ padding: '2px 13px 12px', borderTop: `1px solid ${t.borderLight}` }}>
                          {c.unpaidAmount > 0 && (
                            <div className="flex items-center justify-between" style={{ padding: '8px 2px', fontSize: 12 }}>
                              <span style={{ color: t.textMuted }}>기준 이월액</span>
                              <span style={{ color: t.textSub, fontWeight: 600 }}>{formatWon(c.unpaidAmount)}</span>
                            </div>
                          )}
                          {txs.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between" style={{ padding: '8px 2px' }}>
                              <span className="min-w-0" style={{ fontSize: 12, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tx.emoji ? `${tx.emoji} ` : ''}{tx.memo || '거래'}
                                <span style={{ color: t.textMuted, marginLeft: 6 }}>{format(parseISO(tx.spentAt), 'M.d')}</span>
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: t.text, flexShrink: 0 }}>-{tx.amount.toLocaleString('ko-KR')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, fontSize: 10.5, color: t.textMuted, lineHeight: 1.5 }}>
                채팅에 결제수단을 함께 적으면(예: "점심 9000 삼성카드") 그 카드의 미청구 거래로 자동 집계돼요.<br />
                미결제액 = 기준 이월액 + 마지막 결제일 이후 미청구 거래 합. 결제일이 지나면 다음 청구분으로 갱신됩니다.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 추가/편집 시트(형제로 띄움 — 바깥 클릭 전파 방지) */}
    {editor && <CardForm m={m} item={editor.item} onClose={() => setEditor(null)} />}
    </>
  );
}
