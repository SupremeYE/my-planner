// 독서 구절 사진 캡처 — OCR 문장 분리 → 문장 카드 탭 선택 → 편집·페이지 입력 (Stage 2, v3)
//  · 3-screen: ① 사진 촬영/갤러리 → vision-extract(reading) OCR(문장 배열) → ② 문장 카드를 탭으로 골라 담고
//    → ③ 합쳐진 텍스트를 자유 수정 + 페이지 입력 후 확정.
//  · 크롭(v1)·네이티브 텍스트 선택(v2) 모두 폐기. OCR이 문장 단위로 끊어 주면 카드 탭 선택만으로 구절을 모은다.
//  · "이어서 추가" → 다른 페이지를 더 찍어 문장 카드를 누적(기존 선택 유지) — 여러 쪽에 걸친 구절도 이어 담는다.
//  · "완료" → onConfirm({ text, page?, imageUrl }) 으로 부모 작성 폼에 위임(db 직접 X).
//  · AI(vision-extract) 호출은 "촬영 직후 OCR" 1회뿐(이어서 추가 시 추가 1회). 조회/렌더 경로에서는 호출하지 않는다.
//  · 컨셉: "책을 찍으면 문장으로 끊어 읽어와요. 담고 싶은 문장만 톡톡 골라요."
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, Camera, Image as ImageIcon, Loader2, Check, AlertTriangle, Plus } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';
import { prepImageForOcr } from '../../lib/imagePrep';

interface QuoteSentenceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: { text: string; page?: number; imageUrl: string }) => void;
  bookId: string; // uploadPhoto 경로용 임시 id
}

type Screen = 'pick' | 'select' | 'edit';
type Sentence = { id: string; text: string };

export function QuoteSentenceSelector({ isOpen, onClose, onConfirm, bookId }: QuoteSentenceSelectorProps) {
  const { t } = useTheme();

  const [screen, setScreen] = useState<Screen>('pick');
  const [busy, setBusy] = useState(false);                        // 업로드 + OCR 진행 중
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);  // 첫 촬영 사진 public url (확정 시 카드 썸네일)
  const [sentences, setSentences] = useState<Sentence[]>([]);     // OCR 문장 카드(이어서 추가 시 누적)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);   // 탭 순서대로 선택된 문장 id
  const [ocrPage, setOcrPage] = useState<number | null>(null);    // 자동 감지 페이지
  const [editedText, setEditedText] = useState('');               // Screen 3 편집 텍스트
  const [pageInput, setPageInput] = useState('');                 // Screen 3 페이지 입력
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const idSeq = useRef(0);                                          // 문장 id 시퀀스(append 안정성)

  // 열릴 때마다 처음 상태로 초기화
  useEffect(() => {
    if (isOpen) {
      setScreen('pick');
      setBusy(false);
      setPhotoUrl(null);
      setSentences([]);
      setSelectedIds([]);
      setOcrPage(null);
      setEditedText('');
      setPageInput('');
      setErrMsg(null);
      idSeq.current = 0;
    }
  }, [isOpen]);

  // 선택된 문장들을 탭 순서대로 공백으로 합친 텍스트
  const combinedText = selectedIds
    .map((id) => sentences.find((s) => s.id === id)?.text ?? '')
    .filter(Boolean)
    .join(' ');

  // ── 사진 선택 → 업로드 + OCR ──
  //  · append=false: 첫 촬영(문장/선택 초기화). append=true: 이어서 추가(기존 카드/선택 유지, 아래에 누적).
  const runOcr = useCallback(async (file: File, append: boolean) => {
    setBusy(true);
    setErrMsg(null);
    try {
      // 0) OCR 전처리 — HEIC→JPEG 변환 + 긴 변 2000px 다운스케일(iOS 원본 그대로면 비전이 못 읽음).
      const prepared = await prepImageForOcr(file);

      // 1) Storage 업로드 → publicUrl (첫 사진만 확정용으로 보관)
      const url = await db.bookQuotes.uploadPhoto(bookId, prepared);
      if (!url) {
        setErrMsg('사진 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.');
        setScreen(append ? 'select' : 'pick');
        return;
      }

      // 2) vision-extract(reading) 호출 — 문장 배열로 응답
      const { data, error } = await supabase.functions.invoke('vision-extract', {
        body: { image_url: url, domain: 'reading' },
      });
      if (error) {
        setErrMsg('연결이 불안정해요. 다시 시도해 주세요.');
        setScreen(append ? 'select' : 'pick');
        return;
      }
      const ocrSentences: string[] = Array.isArray(data?.sentences)
        ? (data.sentences as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
        : [];
      if (!data?.ok || ocrSentences.length === 0) {
        setErrMsg('텍스트가 감지되지 않았어요. 글자가 잘 보이도록 다시 촬영해 보세요.');
        setScreen(append ? 'select' : 'pick');
        return;
      }

      // 문장 카드 생성 (id 시퀀스로 안정적 키 부여)
      const items: Sentence[] = ocrSentences.map((text) => ({ id: `s${idSeq.current++}`, text }));
      const page = typeof data.page === 'number' && data.page > 0 ? data.page : null;

      if (append) {
        // 이어서 추가 — 기존 카드 아래에 누적, 선택 상태 유지. 페이지는 비어 있을 때만 채움.
        setSentences((prev) => [...prev, ...items]);
        setOcrPage((prev) => prev ?? page);
      } else {
        setPhotoUrl(url);
        setSentences(items);
        setSelectedIds([]);
        setOcrPage(page);
      }
      setScreen('select');
    } catch (e) {
      setErrMsg((e as Error).message || '구절을 읽어오지 못했어요. 다시 시도해 주세요.');
      setScreen(append ? 'select' : 'pick');
    } finally {
      setBusy(false);
    }
  }, [bookId]);

  // append 모드 추적용 ref (파일 input onChange 시점에 결정)
  const appendRef = useRef(false);
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    runOcr(file, appendRef.current);
  };
  const openPicker = (which: 'cam' | 'gal', append: boolean) => {
    appendRef.current = append;
    (which === 'cam' ? camRef : galRef).current?.click();
  };

  // 문장 카드 탭 → 선택 토글(탭 순서 유지)
  const toggleSentence = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Screen 2 "완료" → Screen 3 진입(편집 텍스트·페이지 초기화)
  const goEdit = () => {
    if (selectedIds.length === 0) return;
    setEditedText(combinedText);
    setPageInput(ocrPage != null ? String(ocrPage) : '');
    setScreen('edit');
  };

  // textarea auto-grow
  const autoGrow = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);
  useEffect(() => {
    if (screen === 'edit') {
      // 다음 페인트에서 높이 측정(텍스트 채워진 뒤)
      requestAnimationFrame(autoGrow);
    }
  }, [screen, autoGrow]);

  // Screen 3 확정
  const handleConfirm = () => {
    const text = editedText.trim();
    if (!text || !photoUrl) return;
    const p = parseInt(pageInput, 10);
    const page = Number.isFinite(p) && p > 0 ? p : undefined;
    onConfirm({ text, page, imageUrl: photoUrl });
    onClose();
  };

  if (!isOpen) return null;

  const hasSelection = selectedIds.length > 0;
  const title =
    screen === 'pick' ? '사진으로 구절 담기'
      : screen === 'select' ? '기록할 문장을 선택해주세요'
        : '터치해서 문장을 수정할 수 있어요';

  // 헤더 우측 "다시 촬영" — 처음부터 다시(문장/선택 초기화) → pick
  const reshoot = () => {
    setScreen('pick');
    setSentences([]);
    setSelectedIds([]);
    setOcrPage(null);
    setPhotoUrl(null);
    setErrMsg(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-center items-end p-0 lg:items-center lg:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <style>{`@keyframes qssUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @media (max-width:1023px){.qss-sheet{animation:qssUp .26s ease-out}}`}</style>
      <div className="qss-sheet shadow-2xl overflow-y-auto w-full max-w-full max-h-[92vh] rounded-t-2xl
          lg:w-[520px] lg:h-auto lg:max-h-[92vh] lg:rounded-2xl flex flex-col"
        style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}>

        {/* 숨김 파일 input — 촬영 / 갤러리 */}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={galRef} type="file" accept="image/*" hidden
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 px-4 lg:px-5 pb-3 sticky top-0 z-10 flex-shrink-0"
          style={{ backgroundColor: t.bg, paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
          {/* 좌측: pick=취소(닫기) / select·edit=뒤로 */}
          {screen === 'pick' || busy ? (
            <button type="button" onClick={onClose}
              className="rounded-lg px-1 py-1.5 -ml-1" style={{ fontSize: 14, fontWeight: 600, color: t.textSub }} aria-label="취소">
              취소
            </button>
          ) : (
            <button type="button" onClick={() => setScreen(screen === 'edit' ? 'select' : 'pick')}
              className="p-1.5 -ml-1.5 rounded-lg" style={{ color: t.textSub }} aria-label="뒤로">
              <ChevronLeft size={22} />
            </button>
          )}
          <h2 className="flex-1 text-center" style={{ fontSize: 15.5, fontWeight: 700, color: t.text }}>{title}</h2>
          {/* 우측: select·edit=다시 촬영 / pick=닫기(X) */}
          {(screen === 'select' || screen === 'edit') && !busy ? (
            <button type="button" onClick={reshoot}
              className="rounded-lg px-1 py-1.5 -mr-1" style={{ fontSize: 13, fontWeight: 600, color: t.accent }}>
              다시 촬영
            </button>
          ) : (
            <button type="button" onClick={onClose} className="p-1.5 -mr-1 rounded-lg" style={{ color: t.textMuted }} aria-label="닫기">
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── 로딩 (업로드 + OCR) ── */}
        {busy && (
          <div className="flex flex-col items-center justify-center" style={{ padding: '64px 0 80px' }}>
            <Loader2 size={30} className="animate-spin" style={{ color: t.accent }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text, marginTop: 14 }}>페이지 텍스트를 읽고 있어요…</p>
            <p style={{ fontSize: 12.5, color: t.textSub, marginTop: 4 }}>찍은 사진의 글자를 문장으로 끊는 중</p>
          </div>
        )}

        {/* ── Screen 1: pick ── */}
        {!busy && screen === 'pick' && (
          <div className="px-4 lg:px-5 pb-5 space-y-2.5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <p style={{ fontSize: 13, color: t.textSub, marginBottom: 2, lineHeight: 1.5 }}>
              책 페이지를 찍으면 문장 단위로 끊어 읽어와요.
              <br />그다음 담고 싶은 문장만 톡톡 골라 담으면 돼요.
            </p>

            {errMsg && (
              <div className="rounded-xl p-3" style={{ backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                <p className="flex items-start gap-1.5" style={{ fontSize: 12.5, color: t.danger, fontWeight: 600, lineHeight: 1.5 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {errMsg}
                </p>
              </div>
            )}

            <button onClick={() => openPicker('cam', false)}
              className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 active:scale-[0.98] transition-transform text-left"
              style={{ backgroundColor: t.card, border: `1px solid ${t.border}` }}>
              <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, backgroundColor: t.accentLight, color: t.accent }}><Camera size={20} /></span>
              <span className="min-w-0">
                <span className="block" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>촬영하기</span>
                <span className="block" style={{ fontSize: 12, color: t.textSub, marginTop: 1 }}>책 페이지를 바로 찍기</span>
              </span>
            </button>
            <button onClick={() => openPicker('gal', false)}
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

        {/* ── Screen 2: select ── */}
        {!busy && screen === 'select' && (
          <>
            {/* 선택 영역(상단 고정) */}
            <div className="px-4 lg:px-5 pb-3 flex-shrink-0">
              {errMsg && (
                <div className="rounded-xl p-3 mb-2.5" style={{ backgroundColor: t.dangerLight, border: `1px solid ${t.danger}` }}>
                  <p className="flex items-start gap-1.5" style={{ fontSize: 12.5, color: t.danger, fontWeight: 600, lineHeight: 1.5 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {errMsg}
                  </p>
                </div>
              )}
              <div className="rounded-xl" style={{
                backgroundColor: t.card, borderLeft: `3px solid ${t.accent}`, border: `0.5px solid ${t.border}`,
                borderLeftWidth: 3, borderLeftColor: t.accent, padding: '12px 14px', minHeight: 64,
              }}>
                {hasSelection ? (
                  <>
                    <p style={{ fontFamily: 'var(--font-reading)', fontSize: 14, color: t.text, lineHeight: 1.7,
                      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>
                      {combinedText}
                    </p>
                    <p style={{ fontSize: 11.5, color: t.textSub, fontWeight: 600, marginTop: 6, textAlign: 'right' }}>
                      {combinedText.length}자 선택됨
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>선택한 문장이 여기에 표시돼요</p>
                )}
              </div>
              {ocrPage != null && (
                <p style={{ fontSize: 12, color: t.textSub, marginTop: 6 }}>📖 자동 감지 <span style={{ color: t.text, fontWeight: 700 }}>p.{ocrPage}</span></p>
              )}
            </div>

            {/* 문장 카드 리스트(스크롤) */}
            <div className="px-4 lg:px-5 overflow-y-auto flex-1 space-y-2" style={{ paddingBottom: 12 }}>
              {sentences.map((s) => {
                const selected = selectedIds.includes(s.id);
                const order = selectedIds.indexOf(s.id) + 1;
                return (
                  <button key={s.id} type="button" onClick={() => toggleSentence(s.id)}
                    className="w-full text-left rounded-xl active:scale-[0.99] transition-transform flex gap-2.5"
                    style={{
                      backgroundColor: selected ? t.accentLight : t.card,
                      border: selected ? `1.5px solid ${t.accent}` : `0.5px solid ${t.border}`,
                      padding: '12px 14px',
                    }}>
                    <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{
                      width: 18, height: 18, marginTop: 2,
                      backgroundColor: selected ? t.accent : 'transparent',
                      border: selected ? 'none' : `1.5px solid ${t.border}`,
                      color: '#fff', fontSize: 10, fontWeight: 700,
                    }}>
                      {selected ? order : ''}
                    </span>
                    <span style={{ fontFamily: 'var(--font-reading)', fontSize: 14.5, lineHeight: 1.75, color: t.text }}>
                      {s.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 하단 고정 버튼 — 이어서 추가 / 완료 */}
            <div className="px-4 lg:px-5 pt-2.5 flex-shrink-0 flex items-center gap-2"
              style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: `0.5px solid ${t.border}`, backgroundColor: t.bg }}>
              <button onClick={() => openPicker('gal', true)}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl"
                style={{ flex: '0 0 auto', paddingInline: 14, fontSize: 13.5, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                <Plus size={15} /> 이어서 추가
              </button>
              <button onClick={goEdit} disabled={!hasSelection}
                className="flex-1 flex items-center justify-center py-3 rounded-xl active:scale-[0.99] transition-transform"
                style={{ fontSize: 15, fontWeight: 700, color: '#fff', backgroundColor: t.text, opacity: hasSelection ? 1 : 0.3, pointerEvents: hasSelection ? 'auto' : 'none' }}>
                완료
              </button>
            </div>
          </>
        )}

        {/* ── Screen 3: edit ── */}
        {!busy && screen === 'edit' && (
          <div className="px-4 lg:px-5 pb-5 space-y-4" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <textarea ref={taRef} value={editedText}
              onChange={(e) => { setEditedText(e.target.value); autoGrow(); }}
              placeholder="구절 내용"
              className="w-full rounded-xl resize-none focus:outline-none"
              style={{
                backgroundColor: t.card, border: `0.5px solid ${t.border}`, padding: 16,
                fontFamily: 'var(--font-reading)', fontSize: 15, lineHeight: 1.8, color: t.text,
                minHeight: 120, overflow: 'hidden',
              }} />

            <div className="flex flex-col items-center gap-2" style={{ paddingTop: 4 }}>
              <p style={{ fontSize: 12.5, color: t.textSub, fontWeight: 600 }}>페이지를 입력해주세요</p>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 15, fontWeight: 700, color: t.textSub }}>P.</span>
                <input type="number" inputMode="numeric" value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)} placeholder="0000"
                  className="text-center rounded-lg focus:outline-none"
                  style={{ width: 96, padding: '8px 10px', fontSize: 16, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }} />
              </div>
            </div>

            <div className="flex items-center gap-2" style={{ paddingTop: 4 }}>
              <button onClick={() => setScreen('select')}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl"
                style={{ flex: '0 0 auto', paddingInline: 16, fontSize: 14, fontWeight: 700, color: t.text, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>
                <ChevronLeft size={16} /> 다시 선택
              </button>
              <button onClick={handleConfirm} disabled={!editedText.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl active:scale-[0.99] transition-transform"
                style={{ fontSize: 15, fontWeight: 700, color: '#fff', backgroundColor: t.accent, opacity: editedText.trim() ? 1 : 0.35, pointerEvents: editedText.trim() ? 'auto' : 'none' }}>
                <Check size={16} /> 완료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
