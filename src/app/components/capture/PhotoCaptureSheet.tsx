// 사진 AI 등록 — 촬영/확인 바텀시트 (Stage 6).
//  · 흐름: 사진 선택/촬영 → vision-extract 추출(로딩) → 편집 가능한 카드 리스트 → "이대로 등록".
//  · 등록은 onConfirm(items, photoUrl) 으로 부모(useBeauty/useHousekeeping 액션)에 위임 — db 직접 X.
//  · AI 호출은 extract() 1회뿐(이 시트). 조회/렌더 경로에서는 호출하지 않는다.
//  · 추출 실패/0건 → "직접 입력으로 추가"(기존 수동 시트)로 폴백.
//  · 컨셉: "찍으면 그게 카드 — 사진 그대로 저장돼요"
import React, { useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, Loader2, Plus, Trash2, Sparkles, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { useVisionExtract, type CaptureDomain, type ExtractedItem } from './useVisionExtract';

const LOW_CONF = 0.6; // 이 미만이면 "확인 필요" 시각 힌트

interface Draft {
  key: string;
  name: string;
  brand: string;
  category: string;
  quantity: string;       // household
  price: string;          // household
  purchasePlace: string;  // household
  confidence: number;
}

interface Props {
  domain: CaptureDomain;
  onConfirm: (items: ExtractedItem[], photoUrl: string | null) => void;
  onManualFallback: () => void;   // "직접 입력으로 추가" — 기존 수동 시트 연결
  onClose: () => void;
}

const newKey = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function PhotoCaptureSheet({ domain, onConfirm, onManualFallback, onClose }: Props) {
  const { t } = useTheme();
  const { extract, loading } = useVisionExtract();

  const [step, setStep] = useState<'pick' | 'review' | 'empty'>('pick');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const isHousehold = domain === 'household';

  const toDraft = (it: ExtractedItem): Draft => ({
    key: newKey(),
    name: it.name ?? '',
    brand: it.brand ?? '',
    category: it.category ?? '',
    quantity: it.quantity != null ? String(it.quantity) : '',
    price: it.price != null ? String(it.price) : '',
    purchasePlace: it.purchase_place ?? '',
    confidence: typeof it.confidence === 'number' ? it.confidence : 0.5,
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setErrMsg(null);
    const res = await extract(file, domain);
    setPhotoUrl(res.photoUrl);
    if (res.ok && res.items.length > 0) {
      setDrafts(res.items.map(toDraft));
      setStep('review');
    } else {
      setErrMsg(res.error ?? null);
      setStep('empty');
    }
  };

  const patch = (key: string, field: keyof Draft, value: string) =>
    setDrafts(prev => prev.map(d => (d.key === key ? { ...d, [field]: value } : d)));
  const removeDraft = (key: string) => setDrafts(prev => prev.filter(d => d.key !== key));
  const addDraft = () =>
    setDrafts(prev => [...prev, { key: newKey(), name: '', brand: '', category: '', quantity: '', price: '', purchasePlace: '', confidence: 1 }]);

  const confirm = () => {
    const items: ExtractedItem[] = drafts
      .filter(d => d.name.trim())
      .map(d => {
        const out: ExtractedItem = { name: d.name.trim(), confidence: d.confidence };
        if (d.brand.trim()) out.brand = d.brand.trim();
        if (d.category.trim()) out.category = d.category.trim();
        if (isHousehold) {
          if (d.quantity.trim() && Number.isFinite(Number(d.quantity))) out.quantity = Number(d.quantity);
          if (d.price.trim() && Number.isFinite(Number(d.price))) out.price = Number(d.price);
          if (d.purchasePlace.trim()) out.purchase_place = d.purchasePlace.trim();
        }
        return out;
      });
    if (items.length === 0) return;
    onConfirm(items, photoUrl);
  };

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: t.textSub, marginBottom: 4 };
  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 9, padding: '7px 9px', fontSize: 13.5,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };

  const title = step === 'review' ? '읽은 내용을 확인해요' : step === 'empty' ? '못 읽었어요' : (isHousehold ? '영수증/사진으로 추가' : '사진으로 추가');

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <style>{`@keyframes capUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.cap-sheet{animation:capUp .26s ease-out}}`}</style>
      <div className="cap-sheet shadow-2xl overflow-y-auto w-full max-w-full rounded-t-2xl
          lg:w-[460px] lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 숨김 파일 input — 촬영 / 갤러리 */}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => handleFile(e.target.files?.[0])} />
        <input ref={galRef} type="file" accept="image/*" hidden
          onChange={e => handleFile(e.target.files?.[0])} />

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          {step !== 'pick' ? (
            <button type="button" onClick={() => { setStep('pick'); setDrafts([]); setErrMsg(null); }}
              className="p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="뒤로" disabled={loading}>
              <ChevronLeft size={22} />
            </button>
          ) : <span style={{ width: 22 }} />}
          <h2 className="flex-1 text-center lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 lg:px-5 pb-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* ── 로딩 ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center text-center" style={{ padding: '36px 16px' }}>
              {photoUrl && <img src={photoUrl} alt="" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 14, marginBottom: 14 }} />}
              <Loader2 size={26} className="animate-spin" style={{ color: t.accent }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 10 }}>AI가 읽는 중…</p>
              <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>사진 속 항목을 정리하고 있어요</p>
            </div>
          )}

          {/* ── pick ── */}
          {!loading && step === 'pick' && (
            <div className="space-y-2.5">
              <p style={{ fontSize: 13, color: t.textSub, marginBottom: 2 }}>
                {isHousehold ? '생필품 사진이나 영수증을 찍으면 품목을 자동으로 읽어와요.' : '제품 사진을 찍으면 이름·브랜드를 자동으로 읽어와요.'}
                <br />찍은 사진은 그대로 카드 썸네일로 저장돼요.
              </p>
              <button onClick={() => camRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}><Camera size={20} /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>카메라로 촬영</span>
                  <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>{isHousehold ? '영수증/제품을 바로 찍기' : '제품을 바로 찍기'}</span>
                </span>
              </button>
              <button onClick={() => galRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}><ImageIcon size={20} /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>갤러리에서 선택</span>
                  <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>저장된 사진 고르기</span>
                </span>
              </button>
              <button onClick={onManualFallback}
                className="w-full text-center py-2.5 rounded-xl"
                style={{ fontSize: 13, fontWeight: 700, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                직접 입력으로 추가
              </button>
            </div>
          )}

          {/* ── empty / 실패 폴백 ── */}
          {!loading && step === 'empty' && (
            <div className="flex flex-col items-center text-center" style={{ padding: '20px 8px' }}>
              {photoUrl && <img src={photoUrl} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 14, marginBottom: 12, opacity: 0.7 }} />}
              <div className="flex items-center justify-center mb-2" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.dangerLight }}>
                <AlertTriangle size={20} style={{ color: t.danger }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: t.text }}>사진에서 항목을 찾지 못했어요</p>
              <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4, maxWidth: 300, lineHeight: 1.5 }}>
                {errMsg || '글자가 흐리거나 각도가 안 맞았을 수 있어요. 다시 찍거나 직접 입력해 주세요.'}
              </p>
              <div className="flex items-center gap-2 mt-4 w-full">
                <button onClick={() => { setStep('pick'); setErrMsg(null); }}
                  className="flex-1 py-2.5 rounded-xl" style={{ fontSize: 13.5, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  다시 찍기
                </button>
                <button onClick={onManualFallback}
                  className="flex-1 py-2.5 rounded-xl" style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', backgroundColor: t.accent }}>
                  직접 입력으로 추가
                </button>
              </div>
            </div>
          )}

          {/* ── review (편집) ── */}
          {!loading && step === 'review' && (
            <div className="space-y-3">
              {/* 사진 썸네일 */}
              {photoUrl && (
                <div className="flex items-center gap-2.5">
                  <img src={photoUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12 }} />
                  <p style={{ fontSize: 12.5, color: t.textSub, lineHeight: 1.4 }}>
                    찍은 사진이 그대로 카드에 저장돼요.<br />틀린 내용은 고치고, 필요 없는 항목은 지워주세요.
                  </p>
                </div>
              )}

              {drafts.map((d, idx) => {
                const lowConf = d.confidence < LOW_CONF;
                return (
                  <div key={d.key} className="rounded-2xl p-3"
                    style={{
                      backgroundColor: lowConf ? t.dangerLight : t.card,
                      border: lowConf ? `1.5px dashed ${t.danger}` : `1px solid ${t.border}`,
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: lowConf ? t.danger : t.textSub }}>
                        {lowConf ? <><AlertTriangle size={13} /> 확인 필요</> : `항목 ${idx + 1}`}
                      </span>
                      <button onClick={() => removeDraft(d.key)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, color: t.textMuted }} aria-label="항목 삭제">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div>
                      <label style={labelStyle}>이름 *</label>
                      <input value={d.name} onChange={e => patch(d.key, 'name', e.target.value)} placeholder="이름" style={fieldStyle} />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <div className="flex-1">
                        <label style={labelStyle}>브랜드</label>
                        <input value={d.brand} onChange={e => patch(d.key, 'brand', e.target.value)} placeholder="브랜드" style={fieldStyle} />
                      </div>
                      <div className="flex-1">
                        <label style={labelStyle}>카테고리</label>
                        <input value={d.category} onChange={e => patch(d.key, 'category', e.target.value)} placeholder="카테고리" style={fieldStyle} />
                      </div>
                    </div>
                    {isHousehold && (
                      <div className="flex gap-2 mt-2">
                        <div style={{ width: 80 }}>
                          <label style={labelStyle}>수량</label>
                          <input type="number" inputMode="numeric" value={d.quantity} onChange={e => patch(d.key, 'quantity', e.target.value)} placeholder="1" style={fieldStyle} />
                        </div>
                        <div className="flex-1">
                          <label style={labelStyle}>가격</label>
                          <input type="number" inputMode="numeric" value={d.price} onChange={e => patch(d.key, 'price', e.target.value)} placeholder="원" style={fieldStyle} />
                        </div>
                        <div className="flex-1">
                          <label style={labelStyle}>구매처</label>
                          <input value={d.purchasePlace} onChange={e => patch(d.key, 'purchasePlace', e.target.value)} placeholder="매장" style={fieldStyle} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 항목 추가 */}
              <button onClick={addDraft}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
                style={{ fontSize: 13, fontWeight: 700, color: t.accent, backgroundColor: t.accentLight, border: `1px dashed ${t.accent}` }}>
                <Plus size={15} /> 항목 추가
              </button>

              {/* 등록 */}
              <button onClick={confirm} disabled={drafts.filter(d => d.name.trim()).length === 0}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl active:scale-[0.99] transition-transform"
                style={{ fontSize: 15, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: drafts.filter(d => d.name.trim()).length === 0 ? 0.5 : 1 }}>
                <Sparkles size={16} /> 이대로 {drafts.filter(d => d.name.trim()).length}개 등록
              </button>
              <button onClick={onManualFallback} className="w-full text-center py-1.5" style={{ fontSize: 12.5, fontWeight: 600, color: t.textMuted }}>
                직접 입력으로 추가
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
