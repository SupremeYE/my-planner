// PWA 아이콘 일괄 생성 스크립트
// 사용법: node scripts/generate-icons.mjs
// 원본: scripts/icon-source.png (정사각 권장, 투명 배경 허용)
// 결과: public/icons/icon-*.png, apple-touch-icon.png, public/favicon-32x32.png
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SRC = resolve(__dirname, 'icon-source.png');
const ICONS_DIR = resolve(root, 'public/icons');

// iOS/maskable는 투명 미지원 → 투명 모서리를 흰색으로 평탄화
const BG = '#ffffff';
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  // 바깥 투명 여백 제거 → 스퀴클이 프레임을 꽉 채우도록
  const base = await sharp(SRC).trim().png().toBuffer();

  for (const s of SIZES) {
    await sharp(base)
      .resize(s, s, { fit: 'cover', position: 'center' })
      .flatten({ background: BG })
      .png()
      .toFile(resolve(ICONS_DIR, `icon-${s}x${s}.png`));
    console.log(`✓ icon-${s}x${s}.png`);
  }

  // iOS 홈 화면 아이콘 (180×180)
  await sharp(base)
    .resize(180, 180, { fit: 'cover', position: 'center' })
    .flatten({ background: BG })
    .png()
    .toFile(resolve(ICONS_DIR, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // 브라우저 탭 favicon (32×32)
  await sharp(base)
    .resize(32, 32, { fit: 'cover', position: 'center' })
    .flatten({ background: BG })
    .png()
    .toFile(resolve(root, 'public/favicon-32x32.png'));
  console.log('✓ favicon-32x32.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
