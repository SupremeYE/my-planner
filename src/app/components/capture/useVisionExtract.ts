// 사진 AI 등록 — 클라이언트 호출 유틸 (Stage 6).
//  · transcribe.ts 의 invoke 패턴 + 기존 db uploadPhoto 패턴을 그대로 따른다.
//  · extract(file, domain):
//      1) 사진을 해당 버킷(beauty-photos / household-photos)에 업로드 → public url 획득.
//         (등록 확정 시 이 url 을 그대로 photo_url 로 재사용 → "찍은 사진이 그대로 카드")
//      2) Edge Function 'vision-extract' 호출 → 항목 추출.
//      3) { ok, items, photoUrl } 반환. 실패하면 ok:false + 빈 items (호출부가 수동 입력 폴백).
//  · ⚠️ AI 호출은 이 extract() — 즉 등록 흐름에서만. 보유함/재고 "조회" 경로에서는 절대 호출 금지.
import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { db } from '../../../lib/db';

export type CaptureDomain = 'beauty' | 'household';

export interface ExtractedItem {
  name: string;
  brand?: string;
  category?: string;
  quantity?: number;        // household only
  price?: number;           // household only
  purchase_place?: string;  // household only
  confidence: number;       // 0~1
}

export interface ExtractResult {
  ok: boolean;
  items: ExtractedItem[];
  photoUrl: string | null;  // 촬영/선택한 사진의 public url (등록 시 카드 썸네일로 재사용)
  error?: string;
}

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useVisionExtract() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(async (file: File, domain: CaptureDomain): Promise<ExtractResult> => {
    setLoading(true);
    setError(null);
    try {
      // 1) 사진 업로드 → public url (기존 uploadPhoto 시그니처 (recordId, file) 그대로 사용)
      const uploadId = newId();
      const photoUrl = domain === 'beauty'
        ? await db.beautyProducts.uploadPhoto(uploadId, file)
        : await db.householdItems.uploadPhoto(uploadId, file);

      if (!photoUrl) {
        const msg = '사진 업로드에 실패했어요.';
        setError(msg);
        return { ok: false, items: [], photoUrl: null, error: msg };
      }

      // 2) Edge Function 호출
      const { data, error: invokeErr } = await supabase.functions.invoke('vision-extract', {
        body: { image_url: photoUrl, domain },
      });

      if (invokeErr) {
        console.error('[vision-extract] invoke error:', invokeErr.message);
        const msg = 'AI가 사진을 읽지 못했어요.';
        setError(msg);
        // 업로드는 성공했으니 photoUrl 은 살려서 수동 입력 폴백에 그대로 쓰게 한다.
        return { ok: false, items: [], photoUrl, error: msg };
      }
      if (!data?.ok) {
        const msg = (data?.error as string) || 'AI가 항목을 찾지 못했어요.';
        setError(msg);
        return { ok: false, items: [], photoUrl, error: msg };
      }

      const items: ExtractedItem[] = Array.isArray(data.items) ? data.items : [];
      return { ok: true, items, photoUrl };
    } catch (e) {
      const msg = (e as Error).message || '알 수 없는 오류가 났어요.';
      console.error('[vision-extract] 예외:', msg);
      setError(msg);
      return { ok: false, items: [], photoUrl: null, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { extract, loading, error };
}
