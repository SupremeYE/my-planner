// 살림 — 수동 추가 바텀시트 (Stage 4, 모바일).
//  · FAB → 추가 종류 선택(재고 / 소모품 주기 / 청소구역) → 각 입력 폼.
//  · 재고는 별도 HouseholdStockSheet 를 부모가 열도록 onPickStock 만 호출.
//  · 소모품주기/청소구역은 간단해서 이 시트 안에서 폼 처리 → 부모 액션(add*) 호출.
//  · ⚠️ 사진/영수증 AI 추가 경로는 만들지 않는다(S6). 수동 입력만.
import React, { useState } from 'react';
import { X, ChevronLeft, Package, RefreshCw, SprayCan, Receipt } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import type { ConsumableCycle, CleaningZone } from '../../store';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Step = 'pick' | 'cycle' | 'zone';

interface Props {
  onPickStock: () => void;                    // 재고 추가는 부모가 HouseholdStockSheet 오픈
  onPickPhoto: () => void;                    // 🧾 영수증/사진으로 (vision-extract)
  onAddCycle: (item: ConsumableCycle) => void;
  onAddZone: (item: CleaningZone) => void;
  onClose: () => void;
}

export function HousekeepingAddSheet({ onPickStock, onPickPhoto, onAddCycle, onAddZone, onClose }: Props) {
  const { t } = useTheme();
  const [step, setStep] = useState<Step>('pick');

  // 폼 상태
  const [name, setName] = useState('');
  const [cycleDays, setCycleDays] = useState<string>('30');

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 10, padding: '9px 11px', fontSize: 14,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  const submitCycle = (e: React.FormEvent) => {
    e.preventDefault();
    const days = Math.round(Number(cycleDays));
    if (!name.trim() || !(days > 0)) return;
    onAddCycle({ id: newId(), name: name.trim(), cycleDays: days, replacedDates: [] });
    onClose();
  };
  const submitZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddZone({ id: newId(), name: name.trim(), cleanedDates: [] });
    onClose();
  };

  const PickButton = ({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) => (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
      style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
      <span className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}>{icon}</span>
      <span className="min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{title}</span>
        <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>{desc}</span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes hkAddUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.hk-add-sheet{animation:hkAddUp .26s ease-out}}`}</style>
      <div className="hk-add-sheet shadow-2xl overflow-y-auto w-full max-w-full rounded-t-2xl
          lg:w-[440px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          {step !== 'pick' ? (
            <button type="button" onClick={() => { setStep('pick'); setName(''); }} className="p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="뒤로">
              <ChevronLeft size={22} />
            </button>
          ) : <span style={{ width: 22 }} />}
          <h2 className="flex-1 text-center lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {step === 'pick' ? '무엇을 추가할까요?' : step === 'cycle' ? '소모품 주기 추가' : '청소구역 추가'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 lg:px-5 pb-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {step === 'pick' && (
            <div className="space-y-2.5">
              <PickButton icon={<Receipt size={20} />} title="🧾 영수증/사진으로" desc="영수증·사진 한 장이면 품목 자동 입력"
                onClick={() => { onClose(); onPickPhoto(); }} />
              <PickButton icon={<Package size={20} />} title="생필품 재고" desc="휴지·세제처럼 수량을 챙기는 물건"
                onClick={() => { onClose(); onPickStock(); }} />
              <PickButton icon={<RefreshCw size={20} />} title="소모품 교체주기" desc="수세미·칫솔처럼 주기로 교체하는 것"
                onClick={() => setStep('cycle')} />
              <PickButton icon={<SprayCan size={20} />} title="청소구역" desc="화장실·주방처럼 청소를 챙길 곳"
                onClick={() => setStep('zone')} />
            </div>
          )}

          {step === 'cycle' && (
            <form onSubmit={submitCycle} className="space-y-4">
              <div>
                <label style={labelStyle}>이름 *</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 수세미" style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>교체 주기 (일) *</label>
                <input type="number" inputMode="numeric" min={1} value={cycleDays} onChange={e => setCycleDays(e.target.value)} style={fieldStyle} />
              </div>
              <button type="submit" className="w-full px-5 py-2.5 rounded-xl"
                style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>추가</button>
            </form>
          )}

          {step === 'zone' && (
            <form onSubmit={submitZone} className="space-y-4">
              <div>
                <label style={labelStyle}>구역 이름 *</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예: 화장실" style={fieldStyle} />
              </div>
              <button type="submit" className="w-full px-5 py-2.5 rounded-xl"
                style={{ fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>추가</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
