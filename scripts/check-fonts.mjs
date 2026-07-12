#!/usr/bin/env node
/**
 * 폰트 grep 가드 (Stage 1.5)
 * ---------------------------------------------------------------------------
 * 목적: 폰트가 컴포넌트에 하드코딩되는 것을 막고, 역할 토큰(테마 필드 t.font* /
 *       CSS 변수 var(--font-*))만 쓰이도록 강제하기 위한 독립 실행 린터.
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
 *
 * 제외(스캔 안 함): ThemeContext.tsx(테마 정의 SSOT), src 하위 .css 파일.
 * 순수 주석 라인(// * /* 로 시작)은 오탐 방지를 위해 스캔에서 제외한다.
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
const EXCLUDED_FILES = new Set(['ThemeContext.tsx']);
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

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
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
