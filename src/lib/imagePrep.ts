// 사진 OCR 전처리 — 업로드 전에 canvas 로 재인코딩한다.
//  · 목적: OpenAI 비전은 HEIC 를 지원하지 않고(JPEG/PNG/WEBP 만) 대용량 원본은 디코딩에 실패한다.
//    iOS 카메라/갤러리 사진은 보통 HEIC 이거나 10MB+ 라서, 원본을 그대로 보내면 "텍스트 인식 실패" 가 난다.
//  · drawImage → JPEG 재인코딩으로 ① HEIC→JPEG 변환(iOS Safari 가 HEIC 디코드 가능) ② 긴 변 maxEdge 로 다운스케일.
//  · EXIF 회전은 최신 브라우저가 <img> 디코드 시 자동 적용(image-orientation: from-image 기본) → OCR 방향 정상.
//  · 어떤 단계든 실패하면 원본 File 을 그대로 반환(회귀 방지) — 최악의 경우라도 v2 기존 동작과 동일.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

/**
 * 사진 File 을 OCR 친화 JPEG(긴 변 ≤ maxEdge)로 재인코딩한다.
 * @param file       사용자가 촬영/선택한 원본
 * @param maxEdge    긴 변 최대 px (기본 2000 — OCR 정확도·용량 균형, v1 크롭과 동일)
 * @param quality    JPEG 품질 0~1 (기본 0.85)
 * @returns          재인코딩한 JPEG File. 실패 시 원본 File.
 */
export async function prepImageForOcr(file: File, maxEdge = 2000, quality = 0.85): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return file;

    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    // HEIC 디코드 불가(구형/비 iOS 일부) 등 — 원본 그대로 폴백
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
