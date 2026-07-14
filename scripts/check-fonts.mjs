#!/usr/bin/env node
/**
 * 폰트 grep 가드 (Stage 1.5)
 * ---------------------------------------------------------------------------
 * 목적: 폰트가 컴포넌트에 하드코딩되는 것을 막고, 테마 게이트된 역할 필드(t.font*)만
 *       쓰이도록 강제하기 위한 독립 실행 린터.
 *       ※ var(--font-*) CSS 변수 직접 소비도 위반이다(규칙 D). CSS 변수는 테마
 *         비의존이라 A/B/C/D/H 전 테마에서 동일 렌더 → §4/§8 테마별 폰트 계약을
 *         우회한다. 컴포넌트는 반드시 t.font* 역할 필드를 거쳐야 한다.
 *         (일기 본문 --font-diary 는 DiaryView.tsx 내에서만 예외.)
 *
 * 현재는 하드코딩 폰트가 다수 남아 있어 대량 위반을 출력한다. 이 목록을
 * Stage 2(하드코딩 → 역할 필드 치환) 작업 체크리스트로 사용한다.
 *
 * ⚠️ CI/build/test 파이프라인에 연결하지 않는다(독립 실행). `npm run lint:fonts`.
 *
 * 규칙 (src 하위 .ts/.tsx 파일 대상):
 *   A. 폰트명 리터럴 매치 → 위반
 *      /(DM Serif|Gaegu|Nanum Pen|NanumSquare|Nanum Square|Caveat|Gowun|
 *        Gmarket|Noto Sans|Noto Serif|Ownglyph|Sora|Pretendard)/
 *      (토큰 var(--font-gaegu) 등 소문자 표기는 매치되지 않아 통과)
 *   B. fontFamily 값이 문자열 리터럴이면서 var(--font-*) 형태가 아니면 위반
 *      (t.font* 같은 식별자 참조는 리터럴이 아니므로 자동 통과)
 *   C. --font-diary / Ownglyph 를 DiaryView.tsx 외 파일에서 사용 시 위반 (§4/§8)
 *   D. fontFamily 문맥의 var(--font-*) 직접 소비 → 위반 [var-font-bypass]
 *      문자열 리터럴 'var(--font-*)' / "var(--font-*)" (style 객체·SVG 속성·const
 *      정의 형태 모두 포함). 예외: --font-diary 는 DiaryView.tsx 내에서만 허용
 *      (규칙 C 와 정합 — 일기 본문 정상 경로).
 *
 * 제외(스캔 안 함): ThemeContext.tsx(테마 정의 SSOT), src 하위 .css 파일.
 * 순수 주석 라인(슬래시-슬래시, 블록 주석 시작/끝/이어지는 라인, JSX 주석
 * 시작 형태)은 오탐 방지를 위해 스캔에서 제외한다. 자세한 프리픽스 목록은
 * 아래 isCommentLine 참고.
 * (코드 뒤 트레일링 주석은 제외하지 않는다 — 실제 폰트 리터럴이면 여전히 위반.)
 *
 * 출력: 파일:라인:매치값 [사유] 목록 + 파일별/총 위반 수. 위반 있으면 exit 1.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const FONT_NAME_RE =
  /(DM Serif|Gaegu|Nanum Pen|NanumSquare|Nanum Square|Caveat|Gowun|Gmarket|Noto Sans|Noto Serif|Ownglyph|Sora|Pretendard)/;
// fontFamily: '...'  또는  fontFamily="..."  의 문자열 리터럴 값 캡처
const FONT_FAMILY_RE = /fontFamily\s*[:=]\s*(['"])(.*?)\1/;
const ALLOWED_FONTFAMILY_PREFIX = 'var(--font-';

// 스캔 제외 파일 (basename 기준)
//  - ThemeContext.tsx: 테마 정의 SSOT (역할별 폰트 리터럴 보유)
//  - brand.ts: 하온 브랜드 마크 전용 폰트 상수 SSOT (테마 독립). 브랜드 폰트명
//    리터럴은 이 파일에만 허용하고, 다른 파일에서의 하드코딩은 계속 위반으로 잡는다.
const EXCLUDED_FILES = new Set(['ThemeContext.tsx', 'brand.ts']);
// 규칙 C 예외 파일 (일기 본문 전용 폰트 허용)
const DIARY_ALLOWED = 'DiaryView.tsx';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !EXCLUDED_FILES.has(entry)) {
      out.push(full);
    }
  }
  return out;
}

// 라인 '전체'가 주석인 경우에만 스킵한다(코드 뒤 트레일링 주석은 스킵 아님).
//   - //          한 줄 주석
//   - /*  */  *   블록 주석 시작/끝/이어지는 라인
//   - {/*         JSX 주석 라인 ( {/* ... */} )
// 라인 '시작'만 검사하므로 `fontFamily: X, // 메모` 같은 트레일링 주석은
// 스킵되지 않고, 그 라인에 실제 폰트 리터럴이 있으면 여전히 위반으로 잡힌다.
function isCommentLine(line) {
  const t = line.trim();
  return (
    t.startsWith('//') ||
    t.startsWith('/*') ||
    t.startsWith('*/') ||
    t.startsWith('*') ||
    t.startsWith('{/*')
  );
}

const violations = []; // { file, line, value, reasons: [] }

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const base = basename(file);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((raw, i) => {
    if (isCommentLine(raw)) return;
    const lineNo = i + 1;
    const reasons = [];
    let value = null;

    // B. fontFamily 리터럴
    const ff = raw.match(FONT_FAMILY_RE);
    if (ff && !ff[2].startsWith(ALLOWED_FONTFAMILY_PREFIX)) {
      reasons.push('raw-fontFamily');
      value = ff[2];
    }

    // A. 폰트명 리터럴
    const nameMatch = raw.match(FONT_NAME_RE);
    if (nameMatch) {
      reasons.push('font-literal');
      if (!value) value = nameMatch[1];
    }

    // C. 일기 폰트 스코프
    if (base !== DIARY_ALLOWED && /(--font-diary|Ownglyph)/.test(raw)) {
      reasons.push('diary-scope');
      if (!value) value = raw.match(/(--font-diary|Ownglyph[\w-]*)/)[1];
    }

    // D. var(--font-*) 직접 소비 (CSS 변수 우회 — 역할 필드 t.font* 를 거치지 않음).
    //    'var(--font-*)' / "var(--font-*)" 문자열 리터럴 (style 객체·SVG fontFamily
    //    속성·const 정의 모두 해당). 예외: --font-diary 는 DiaryView.tsx 내에서만 허용.
    const varFontMatches = raw.match(/(['"])var\(--font-[\w-]+\)\1/g);
    if (varFontMatches) {
      for (const m of varFontMatches) {
        const varName = m.match(/--font-[\w-]+/)[0];
        const diaryAllowed = varName === '--font-diary' && base === DIARY_ALLOWED;
        if (!diaryAllowed) {
          reasons.push('var-font-bypass');
          if (!value) value = m.replace(/^['"]|['"]$/g, '');
          break; // 한 라인 1회만 기록
        }
      }
    }

    if (reasons.length) {
      violations.push({ file: rel, line: lineNo, value, reasons });
    }
  });
}

// ── 출력 ──
const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

const sortedFiles = [...byFile.keys()].sort();
for (const f of sortedFiles) {
  const vs = byFile.get(f);
  console.log(`\n${f}  (${vs.length})`);
  for (const v of vs) {
    console.log(`  ${v.line}: ${String(v.value).trim()}  [${v.reasons.join(', ')}]`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`폰트 하드코딩 위반: ${violations.length}건 / 파일 ${byFile.size}개`);

if (violations.length > 0) {
  process.exit(1);
}
