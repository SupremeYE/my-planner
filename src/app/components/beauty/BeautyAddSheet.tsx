// 뷰티 케어 — 수동 추가 종류 선택 시트 (Stage 5, 모바일).
//  · FAB → 화장품(보유함) / 스페셜케어 선택 → 부모가 해당 입력 시트를 연다.
//  · 입력 폼 자체는 BeautyProductSheet / SpecialCareSheet 가 담당(여기선 분기만).
//  · ⚠️ 사진/AI 추가 경로는 만들지 않는다(S6). 수동 입력만.
import React from 'react';
import { X, Sparkles, Flower2, Camera } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface Props {
  onPickProduct: () => void;
  onPickCare: () => void;
  onPickPhoto: () => void;   // 📸 사진으로 (vision-extract)
  onClose: () => void;
}

export function BeautyAddSheet({ onPickProduct, onPickCare, onPickPhoto, onClose }: Props) {
  const { t } = useTheme();

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
      <style>{`@keyframes bcAddUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.bc-add-sheet{animation:bcAddUp .26s ease-out}}`}</style>
      <div className="bc-add-sheet shadow-2xl overflow-y-auto w-full max-w-full rounded-t-2xl
          lg:w-[440px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          <span style={{ width: 22 }} />
          <h2 className="flex-1 text-center lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>무엇을 추가할까요?</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 lg:px-5 pb-5 space-y-2.5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          <PickButton icon={<Camera size={20} />} title="📸 사진으로" desc="제품 사진 한 장이면 이름·브랜드 자동 입력"
            onClick={() => { onClose(); onPickPhoto(); }} />
          <PickButton icon={<Flower2 size={20} />} title="화장품" desc="보유함에 등록 · 개봉일/사용기한 관리"
            onClick={() => { onClose(); onPickProduct(); }} />
          <PickButton icon={<Sparkles size={20} />} title="스페셜케어" desc="모공팩·발각질처럼 주기로 챙기는 케어"
            onClick={() => { onClose(); onPickCare(); }} />
        </div>
      </div>
    </div>
  );
}
