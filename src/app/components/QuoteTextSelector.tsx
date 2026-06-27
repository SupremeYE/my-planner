// 독서 구절 사진 캡처 — OCR 먼저 → 네이티브 텍스트 선택 (Stage 2, v2)
//  · 2-step: ① 사진 촬영/갤러리 → vision-extract(reading) OCR → ② 추출된 전문에서 원하는 구절만 손가락/마우스로 선택.
//  · 크롭 단계 없음(v1 react-easy-crop 폐기). 사진 원본을 그대로 OCR에 보내고, 선택은 브라우저 네이티브 selection 사용.
//  · "이 구절 사용" → onConfirm({ text, page?, imageUrl }) 으로 부모 작성 폼에 위임(db 직접 X).
//  · AI(vision-extract) 호출은 "촬영 직후 OCR" 1회뿐. 조회/렌더 경로에서는 호출하지 않는다.
//  · 컨셉: "책을 찍으면 글자를 읽어와요. 원하는 구절만 길게 눌러 골라요."
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, Loader2, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';

interface QuoteTextSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: { text: string; page?: number; imageUrl: string }) => void;
  bookId: string; // uploadPhoto 경로용 임시 id
}

type Step = 'pick' | 'select';
type ErrKind = 'ocr' | 'network';

export function QuoteTextSelector({ isOpen, onClose, onConfirm, bookId }: QuoteTextSelectorProps) {
  const { t } = useTheme();

  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);                         // 업로드 + OCR 진행 중
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);   // 업로드된 사진 public url
  const [ocrText, setOcrText] = useState('');                      // OCR 추출 전문
  const [ocrPage, setOcrPage] = useState<number | null>(null);     // 자동 감지 페이지
  const [selectedQuote, setSelectedQuote] = useState('');          // 네이티브 선택된 구절
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [errKind, setErrKind] = useState<ErrKind | null>(null);

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const ocrTextRef = useRef<HTMLDivElement>(null);

  // 열릴 때마다 처음 상태로 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('pick');
      setBusy(false);
      setPhotoUrl(null);
      setOcrText('');
      setOcrPage(null);
      setSelectedQuote('');
      setErrMsg(null);
      setErrKind(null);
    }
  }, [isOpen]);

  // 네이티브 텍스트 선택 감지 (Step 2에서만 활성)
  useEffect(() => {
    if (step !== 'select') return;

    const readSelection = () => {
      const sel = window.getSelection();
      setSelectedQuote(sel?.toString().trim() || '');
    };
    document.addEventListener('selectionchange', readSelection);

    // iOS Safari 에서 selectionchange 가 불안정할 수 있어 touchend 백업 (선택 확정까지 약간 딜레이)
    const textEl = ocrTextRef.current;
    const onTouchEnd = () => { setTimeout(readSelection, 100); };
    textEl?.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('selectionchange', readSelection);
      textEl?.removeEventListener('touchend', onTouchEnd);
    };
  }, [step]);

  // ── Step 1: 사진 선택 → 업로드 + OCR → Step 2 ──
  const runOcr = useCallback(async (file: File) => {
    setBusy(true);
    setErrMsg(null);
    setErrKind(null);
    setSelectedQuote('');
    try {
      // 1) Storage 업로드 → publicUrl (찍은 원본 그대로 보관)
      const url = await db.bookQuotes.uploadPhoto(bookId, file);
      if (!url) {
        setErrMsg('사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.');
        setErrKind('network');
        return;
      }
      setPhotoUrl(url);

      // 2) vision-extract(reading) 호출 — 사진 원본을 그대로 OCR
      const { data, error } = await supabase.functions.invoke('vision-extract', {
        body: { image_url: url, domain: 'reading' },
      });
      if (error) {
        setErrMsg('연결이 불안정해요. 다시 시도해 주세요.');
        setErrKind('network');
        return;
      }
      if (!data?.ok || typeof data.text !== 'string' || !data.text.trim()) {
        setErrMsg('텍스트를 인식하지 못했어요. 다시 촬영해 보세요.');
        setErrKind('ocr');
        return;
      }

      setOcrText(data.text);
      setOcrPage(typeof data.page === 'number' && data.page > 0 ? data.page : null);
      setStep('select');
    } catch (e) {
      setErrMsg((e as Error).message || '구절을 읽어오지 못했어요. 다시 시도해 주세요.');
      setErrKind('network');
    } finally {
      setBusy(false);
    }
  }, [bookId]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    runOcr(file);
  };

  // ── Step 2: 확정 ──
  const handleUse = () => {
    const text = selectedQuote.trim();
    if (!text || !photoUrl) return;
    onConfirm({ text, page: ocrPage ?? undefined, imageUrl: photoUrl });
    onClose();
  };

  const retryPick = () => {
    setStep('pick');
    setErrMsg(null);
    setErrKind(null);
    setSelectedQuote('');
  };

  if (!isOpen) return null;

  const title = step === 'select' ? '구절 영역을 골라요' : '사진으로 구절 담기';
  const hasSelection = selectedQuote.trim().length > 0;
  // 골드 반투명 ::selection — 토큰 색(t.accent)에 0x59(≈0.35) 알파를 붙여 사용(하드코딩 색 0)
  const selectionBg = `${t.accent}59`;

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <style>{`@keyframes qtsUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.qts-sheet{animation:qtsUp .26s ease-out}}
        .qts-ocr-text{ -webkit-user-select:text; user-select:text; -webkit-touch-callout:default; }
        .qts-ocr-text::selection{ background:${selectionBg}; }
        .qts-ocr-text ::selection{ background:${selectionBg}; }`}</style>
      <div className="qts-sheet shadow-2xl overflow-y-auto w-full max-w-full max-h-[92vh] rounded-t-2xl
          lg:w-[520px] lg:h-auto lg:max-h-[92vh] lg:rounded-2xl"
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
            <button type="button" onClick={retryPick}
              className="p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="뒤로">
              <ChevronLeft size={22} />
            </button>
          ) : <span style={{ width: 22 }} />}
          <h2 className="flex-1 text-center lg:text-left" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-2 px-4 pb-3">
          {[1, 2].map((n, i) => {
            const active = (step === 'pick' ? 1 : 2) >= n;
            return (
              <React.Fragment key={n}>
                <span className="rounded-full" style={{
                  width: 8, height: 8,
                  backgroundColor: active ? t.accent : t.border,
                }} />
                {i === 0 && <span style={{ width: 28, height: 2, backgroundColor: (step === 'select') ? t.accent : t.border, borderRadius: 2 }} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="px-4 lg:px-5 pb-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

          {/* ── 로딩 (업로드 + OCR) ── */}
          {busy && (
            <div className="flex flex-col items-center justify-center" style={{ padding: '48px 0' }}>
              <Loader2 size={30} className="animate-spin" style={{ color: t.accent }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: t.text, marginTop: 14 }}>페이지 텍스트를 읽고 있어요…</p>
              <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>찍은 사진의 글자를 옮기는 중</p>
            </div>
          )}

          {/* ── Step 1: pick ── */}
          {!busy && step === 'pick' && (
            <div className="space-y-2.5">
              <p style={{ fontSize: 13, color: t.textSub, marginBottom: 2, lineHeight: 1.5 }}>
                책 페이지를 찍으면 글자를 자동으로 읽어와요.
                <br />그다음 원하는 구절만 손가락으로 골라 담으면 돼요.
              </p>

              {/* 에러 배너 (촬영 실패 후 재시도용) */}
              {errMsg && (
                <div className="rounded-xl p-3" style={{ backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                  <p className="flex items-start gap-1.5" style={{ fontSize: 12.5, color: t.danger, fontWeight: 600, lineHeight: 1.5 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {errMsg}
                  </p>
                </div>
              )}

              <button onClick={() => camRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
                style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
                <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}><Camera size={20} /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>촬영하기</span>
                  <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>책 페이지를 바로 찍기</span>
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
            </div>
          )}

          {/* ── Step 2: select ── */}
          {!busy && step === 'select' && (
            <div className="space-y-3">
              {/* 에러 배너 — 종류별 액션 (드물게 select 중 재시도 불가하면 다시 촬영) */}
              {errMsg && (
                <div className="rounded-xl p-3" style={{ backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                  <p className="flex items-start gap-1.5" style={{ fontSize: 12.5, color: t.danger, fontWeight: 600, lineHeight: 1.5 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {errMsg}
                  </p>
                  <button onClick={retryPick}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg mt-2.5"
                    style={{ fontSize: 13, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                    <Camera size={14} /> 다시 촬영
                  </button>
                </div>
              )}

              <p style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>
                글자를 길게 눌러 원하는 구절만 선택하세요.
              </p>

              {/* OCR 추출 전문 — 네이티브 선택 영역 */}
              <div ref={ocrTextRef} className="qts-ocr-text"
                style={{
                  backgroundColor: t.card,
                  borderRadius: 12,
                  padding: 20,
                  border: `0.5px solid ${t.border}`,
                  fontFamily: 'var(--font-reading)',
                  fontSize: 15,
                  lineHeight: 2,
                  color: t.text,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '46vh',
                  overflowY: 'auto',
                }}>
                {ocrText}
              </div>

              {/* 자동 감지 페이지 */}
              {ocrPage != null && (
                <p style={{ fontSize: 12.5, color: t.textSub }}>📖 자동 감지 <span style={{ color: t.text, fontWeight: 700 }}>p.{ocrPage}</span></p>
              )}

              {/* 선택된 텍스트 미리보기 — 선택 시에만 */}
              {hasSelection && (
                <div className="rounded-r-lg" style={{ borderLeft: `3px solid ${t.accent}`, paddingLeft: 12, paddingTop: 2, paddingBottom: 2 }}>
                  <p style={{
                    fontSize: 13.5, color: t.text, lineHeight: 1.5,
                    display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
                  }}>
                    “{selectedQuote.trim()}”
                  </p>
                  <p style={{ fontSize: 11.5, color: t.textSub, fontWeight: 600, marginTop: 4 }}>{selectedQuote.trim().length}자 선택됨</p>
                </div>
              )}

              {/* 액션 */}
              <div className="flex items-center gap-2">
                <button onClick={retryPick}
                  className="flex items-center justify-center gap-1.5 py-3 rounded-xl"
                  style={{ flex: '0 0 auto', paddingInline: 16, fontSize: 14, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                  <ChevronLeft size={16} /> 다시 찍기
                </button>
                <button onClick={handleUse} disabled={!hasSelection}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl active:scale-[0.99] transition-transform"
                  style={{ fontSize: 15, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: hasSelection ? 1 : 0.35, pointerEvents: hasSelection ? 'auto' : 'none' }}>
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
