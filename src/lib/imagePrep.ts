// 사진 전처리 — 업로드 전에 canvas 로 JPEG 재인코딩(HEIC→JPEG + 긴 변 다운스케일).
//  · drawImage → JPEG 재인코딩으로 ① HEIC→JPEG 변환(iOS Safari 가 HEIC 디코드 가능) ② 긴 변 maxEdge 로 다운스케일.
//  · EXIF 회전은 최신 브라우저가 <img> 디코드 시 자동 적용(image-orientation: from-image 기본) → 방향 정상.
//  · 어떤 단계든 실패하면 원본 File 을 그대로 반환(회귀 방지).
//  · 소비처: OCR 업로드(prepImageForOcr 래퍼) · 눈바디 사진 업로드(prepImage 직접) 등 공용.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

export interface PrepImageOpts {
  /** 긴 변 최대 px (기본 2000 — 정확도·용량 균형) */
  maxEdge?: number;
  /** JPEG 품질 0~1 (기본 0.85) */
  quality?: number;
}

/**
 * 사진 File 을 JPEG(긴 변 ≤ maxEdge)로 재인코딩한다. 실패 시 원본 File.
 * 범용 전처리 — OCR·눈바디 등 업로드 경로가 공용으로 쓴다.
 */
export async function prepImage(file: File, opts: PrepImageOpts = {}): Promise<File> {
  const maxEdge = opts.maxEdge ?? 2000;
  const quality = opts.quality ?? 0.85;
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

/**
 * OCR 친화 JPEG 재인코딩 — 기존 소비처 무회귀용 래퍼. 동작·기본값 동일(2000 / 0.85), prepImage 로 위임.
 */
export async function prepImageForOcr(file: File, maxEdge = 2000, quality = 0.85): Promise<File> {
  return prepImage(file, { maxEdge, quality });
}
