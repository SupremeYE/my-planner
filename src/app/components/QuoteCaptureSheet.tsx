// 독서 구절 사진 캡처 — 촬영/크롭/OCR 시트 (Stage 2-C)
//  · 3-step: ① 사진 선택 → ② 크롭(react-easy-crop) → ③ OCR 결과 확인.
//  · ② 확정 시: getCroppedImg → db.bookQuotes.uploadPhoto(bookId) → vision-extract(domain:'reading').
//  · ③ "이 구절 사용" → onConfirm({ text, page?, imageUrl }) 으로 부모 작성 폼에 위임(db 직접 X).
//  · AI(vision-extract) 호출은 "구절 추출" 1회뿐. 조회/렌더 경로에서는 호출하지 않는다.
//  · 컨셉: "책을 찍고, 원하는 구절만 잘라내면 글자가 자동으로 들어와요."
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { X, ChevronLeft, Camera, Image as ImageIcon, Loader2, Check, Crop as CropIcon, AlertTriangle } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';
import { getCroppedImg } from '../../lib/cropImage';

interface QuoteCaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: { text: string; page?: number; imageUrl: string }) => void;
  bookId: string; // uploadBookPhoto 경로용
}

type Step = 'pick' | 'crop' | 'review';

export function QuoteCaptureSheet({ isOpen, onClose, onConfirm, bookId }: QuoteCaptureSheetProps) {
  const { t } = useTheme();

  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);              // 업로드 + OCR 진행 중
  const [srcUrl, setSrcUrl] = useState<string | null>(null);    // 원본 objectURL (크롭용)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); // 업로드된 크롭 사진 public url
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // 크롭 상태
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  // 리뷰(편집) 상태
  const [quoteText, setQuoteText] = useState('');
  const [pageText, setPageText] = useState('');

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  // 원본 objectURL 해제 헬퍼
  const clearSrc = useCallback(() => {
    setSrcUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  // 열릴 때마다 처음 상태로 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('pick');
      setBusy(false);
      setPhotoUrl(null);
      setErrMsg(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAreaPixels(null);
      setQuoteText('');
      setPageText('');
      clearSrc();
    }
  }, [isOpen, clearSrc]);

  // 언마운트 시 objectURL 누수 방지
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  if (!isOpen) return null;

  // ── Step 1: 사진 선택 → 크롭으로 ──
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setErrMsg(null);
    clearSrc();
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
    setStep('crop');
  };

  // ── Step 2: 크롭 확정 → 업로드 + OCR → 리뷰로 ──
  const handleExtract = async () => {
    if (!srcUrl || !areaPixels) return;
    setBusy(true);
    setErrMsg(null);
    try {
      // 1) 크롭 Blob
      const blob = await getCroppedImg(srcUrl, areaPixels);
      const file = new File([blob], `quote_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // 2) Storage 업로드 → publicUrl
      const url = await db.bookQuotes.uploadPhoto(bookId, file);
      if (!url) {
        setErrMsg('사진 업로드에 실패했어요.');
        setBusy(false);
        return;
      }
      setPhotoUrl(url);

      // 3) vision-extract(reading) 호출
      const { data, error } = await supabase.functions.invoke('vision-extract', {
        body: { image_url: url, domain: 'reading' },
      });
      if (error) {
        setErrMsg('AI가 사진을 읽지 못했어요.');
        setBusy(false);
        return;
      }
      if (!data?.ok || typeof data.text !== 'string' || !data.text.trim()) {
        setErrMsg((data?.error as string) || '사진에서 글자를 읽지 못했어요.');
        setBusy(false);
        return;
      }

      setQuoteText(data.text);
      setPageText(typeof data.page === 'number' && data.page > 0 ? String(data.page) : '');
      setStep('review');
    } catch (e) {
      setErrMsg((e as Error).message || '구절 추출에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 3: 확정 ──
  const handleUse = () => {
    const text = quoteText.trim();
    if (!text || !photoUrl) return;
    const p = parseInt(pageText, 10);
    onConfirm({ text, page: Number.isFinite(p) && p > 0 ? p : undefined, imageUrl: photoUrl });
    onClose();
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', borderRadius: 9, padding: '9px 11px', fontSize: 14,
    border: `1px solid ${t.border}`, backgroundColor: t.card, color: t.text, outline: 'none',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: t.textSub, marginBottom: 5 };

  const title = step === 'crop' ? '구절 영역을 골라요' : step === 'review' ? '읽은 구절을 확인해요' : '사진으로 구절 담기';

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <style>{`@keyframes qcapUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.qcap-sheet{animation:qcapUp .26s ease-out}}`}</style>
      <div className="qcap-sheet shadow-2xl overflow-y-auto w-full max-w-full max-h-[92vh] rounded-t-2xl
          lg:w-[480px] lg:h-auto lg:max-h-[92vh] lg:rounded-2xl"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={e => e.stopPropagation()}>

        {/* 숨김 파일 input — 촬영 / 갤러리 */}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={galRef} type="file" accept="image/*" hidden
          onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          {step !== 'pick' && !busy ? (
            <button type="button" onClick={() => { clearSrc(); setStep('pick'); setErrMsg(null); }}
              className="p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="뒤로">
              <ChevronLeft size={22} />
            </button>
          ) : <span style={{ width: 22 }} />}
          <h2 className="flex-1 text-center lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 lg:px-5 pb-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* ── 로딩(업로드+OCR) ── */}
          {busy && (
            <div className="flex flex-col items-center justify-center text-center" style={{ padding: '40px 16px' }}>
              <Loader2 size={26} className="animate-spin" style={{ color: t.accent }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 10 }}>구절을 읽고 있어요…</p>
              <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>잘라낸 영역의 글자를 텍스트로 옮기는 중</p>
            </div>
          )}

          {/* ── Step 1: pick ── */}
          {!busy && step === 'pick' && (
            <div className="space-y-2.5">
              <p style={{ fontSize: 13, color: t.textSub, marginBottom: 2, lineHeight: 1.5 }}>
                책 페이지를 찍은 뒤, 원하는 구절 영역만 잘라내면 글자를 자동으로 읽어와요.
                <br />잘라낸 사진은 구절 카드에 그대로 남아요.
              </p>
              <button onClick={() => camRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}><Camera size={20} /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>촬영</span>
                  <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>책 페이지를 바로 찍기</span>
                </span>
              </button>
              <button onClick={() => galRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}><ImageIcon size={20} /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>갤러리</span>
                  <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>저장된 사진 고르기</span>
                </span>
              </button>
            </div>
          )}

          {/* ── Step 2: crop ── */}
          {!busy && step === 'crop' && srcUrl && (
            <div className="space-y-3">
              <div className="relative w-full rounded-2xl overflow-hidden"
                style={{ height: 360, backgroundColor: '#1a1a1a' }}>
                <Cropper
                  image={srcUrl}
                  crop={crop}
                  zoom={zoom}
                  minZoom={1}
                  maxZoom={4}
                  cropShape="rect"
                  showGrid={true}
                  restrictPosition={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              {errMsg && (
                <p className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: t.danger }}>
                  <AlertTriangle size={13} /> {errMsg}
                </p>
              )}
              <p style={{ fontSize: 12, color: t.textSub, textAlign: 'center' }}>
                두 손가락으로 확대/이동해 읽고 싶은 구절을 박스 안에 맞춰주세요.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => { clearSrc(); setStep('pick'); setErrMsg(null); }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl"
                  style={{ flex: '0 0 auto', paddingInline: 16, fontSize: 14, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <ChevronLeft size={16} /> 다시 찍기
                </button>
                <button onClick={handleExtract} disabled={!areaPixels}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl active:scale-[0.99] transition-transform"
                  style={{ fontSize: 15, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: areaPixels ? 1 : 0.5 }}>
                  <CropIcon size={16} /> 구절 추출
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: review ── */}
          {!busy && step === 'review' && (
            <div className="space-y-3">
              {/* 크롭 미리보기 (작게) */}
              {photoUrl && (
                <div className="flex justify-center">
                  <img src={photoUrl} alt="크롭한 구절" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 12, border: `1px solid ${t.border}` }} />
                </div>
              )}
              <div>
                <label style={labelStyle}>구절</label>
                <textarea value={quoteText} onChange={e => setQuoteText(e.target.value)} rows={7}
                  placeholder="읽어온 구절"
                  style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.7, fontFamily: 'Georgia, "Noto Serif KR", serif' }} />
              </div>
              <div style={{ width: 130 }}>
                <label style={labelStyle}>페이지 (선택)</label>
                <input type="number" inputMode="numeric" value={pageText} onChange={e => setPageText(e.target.value)} placeholder="페이지" style={fieldStyle} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setStep('crop'); setErrMsg(null); }}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl"
                  style={{ flex: '0 0 auto', paddingInline: 16, fontSize: 14, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <ChevronLeft size={16} /> 다시 크롭
                </button>
                <button onClick={handleUse} disabled={!quoteText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl active:scale-[0.99] transition-transform"
                  style={{ fontSize: 15, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: quoteText.trim() ? 1 : 0.5 }}>
                  <Check size={16} /> 이 구절 사용
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
