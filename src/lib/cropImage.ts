// 독서 구절 사진 캡처 — canvas 크롭 헬퍼 (Stage 2)
//  · react-easy-crop 의 croppedAreaPixels(원본 픽셀 좌표)로 영역만 잘라 JPEG Blob 으로 반환.
//  · 너무 큰 크롭은 OCR 정확도/용량 균형을 위해 긴 변 기준 2000px 로 다운스케일.
//  · imageSrc(createObjectURL) 의 생성/해제는 호출측 책임 — 여기서는 만들지도 해제하지도 않는다.

const MAX_EDGE = 2000;   // 긴 변 상한(px) — 이보다 크면 비율 유지하며 축소
const JPEG_QUALITY = 0.85;

interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

// imageSrc 를 HTMLImageElement 로 로드 (CORS 안전 — 로컬 objectURL 가정)
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.'));
    img.src = src;
  });
}

/**
 * canvas 로 크롭 영역을 잘라 Blob 으로 반환
 * @param imageSrc - 원본 이미지 URL (createObjectURL 등)
 * @param croppedAreaPixels - { x, y, width, height } from react-easy-crop
 * @returns Promise<Blob> (image/jpeg)
 */
export async function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: CropPixels,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const { x, y, width, height } = croppedAreaPixels;
  if (!(width > 0) || !(height > 0)) {
    throw new Error('크롭 영역이 올바르지 않아요.');
  }

  // 긴 변이 MAX_EDGE 를 넘으면 비율 유지하며 축소 (둘 다 이내면 1 = 원본 크기)
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 를 만들지 못했어요.');

  // 원본의 (x,y,width,height) 영역을 (0,0,outW,outH) 로 그린다 → 크롭 + 다운스케일 동시 처리
  ctx.drawImage(image, x, y, width, height, 0, 0, outW, outH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('크롭 이미지를 만들지 못했어요.'));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
