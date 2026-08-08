#!/usr/bin/env node
/**
 * 색(라일락) grep 가드 — lint:colors
 * ---------------------------------------------------------------------------
 * 목적: 라벤더(라일락)가 "의미 없는 곳에 무심코 칠해지는 것"을 막는다. 전면 금지가
 *       아니다 — 라일락은 하온 정체성의 하나이며 선택·활성·강조에는 의도적으로 쓴다.
 *       가드의 목표는 **새로운 라벤더 소비처가 늘면 눈에 띄게 만들어**, "의도적 선택이었음을
 *       증명하게" 하는 것이다. (check-fonts.mjs 와 같은 구조의 독립 실행 린터.)
 *
 * 배경: 라일락은 지금까지 "이미 있는 화면 청소"로 잡아왔지만 실제 발생 경로는
 *       **새 화면이 새로 심는 것**이었다(목표 A-2). 사람 주의력에 의존하는 규칙은 샌다.
 *       정적 가드가 필요하다.
 *
 * ── 검출 대상 ──────────────────────────────────────────────────────────────
 *   R1. t.lavenderTint / t.lavenderHover 소비 (라인 기준)
 *       → 파일별 baseline(scripts/color-baseline.json) 초과분만 위반.
 *         baseline 에 없는 파일에서 소비가 생기면(=신규 소비처) 전부 초과로 잡힌다.
 *   R2. 라벤더 계열 hex 하드코딩: #F4E7FB #EFE3FA #EDE4F7 #E8E0F6 (대소문자 무시)
 *       → 토큰 우회. 항상 위반(baseline 없음 — 현재 0건).
 *   R3. purple-* / violet-* / fuchsia-* Tailwind 유틸 클래스
 *       → 토큰 체계 우회. 항상 위반(현재 0건).
 *
 * ── 정당한 라일락(검출 대상 아님) ──────────────────────────────────────────
 *   - 카테고리 색(--cat-todo #9E6FD6 / #C8A8E9 등)은 .css 에만 있고 스캔 대상(.ts/.tsx)이
 *     아니므로 구조적으로 안전. R2 밴 목록에도 넣지 않는다.
 *   - t.surfaceMuted(중립)·t.lavenderTint(의도적) 토큰 참조 자체는 정상. R1 은 "늘어남"만 본다.
 *
 * ── 예외 등록(의도적 액센트) ───────────────────────────────────────────────
 *   라인 끝(혹은 그 라인)에  // lint-colors-ok: <사유>  주석을 달면 그 라인은 전 규칙에서
 *   면제된다. **사유는 필수** — `lint-colors-ok:` 뒤에 내용이 없으면 면제되지 않는다.
 *   예:  backgroundColor: t.lavenderTint,  // lint-colors-ok: 선택된 칩 강조
 *
 * ── baseline 갱신 ──────────────────────────────────────────────────────────
 *   페이지를 청소해 소비가 줄면(또는 예외주석으로 뺐으면) baseline 을 낮춘다:
 *       npm run lint:colors -- --update
 *   초과 없이 줄기만 했다면 검사는 통과하되 "조여 달라"는 안내를 출력한다.
 *
 * 제외(스캔 안 함): ThemeContext.tsx(토큰 정의 SSOT), src 하위 .css.
 * 출력: 위반 목록 + 조치 제안. 위반 있으면 exit 1.
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'color-baseline.json');
const UPDATE = process.argv.includes('--update');

// R1: 라벤더 토큰 소비 (dot-access 만 존재 — 구조분해 사용처 없음)
const TOKEN_RE = /\.(lavenderTint|lavenderHover)\b/;
// R2: 라벤더 계열 hex (카테고리색 #9E6FD6/#C8A8E9, PLAN 라일락 #EAE4FB 는 제외)
const HEX_RE = /#(?:F4E7FB|EFE3FA|EDE4F7|E8E0F6)\b/i;
// R3: purple/violet/fuchsia Tailwind 유틸
const TW_RE = /\b(?:bg|text|border|from|via|to|ring|fill|stroke|decoration|outline|divide|placeholder|accent|caret|shadow)-(?:purple|violet|fuchsia)-\d{2,3}\b/;
// 예외 주석: 사유 필수 (뒤에 비공백 1자 이상)
const OK_RE = /lint-colors-ok:\s*\S/;

const EXCLUDED_FILES = new Set(['ThemeContext.tsx']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !EXCLUDED_FILES.has(entry)) out.push(full);
  }
  return out;
}

// 라인 '전체'가 주석이면 스킵(코드 뒤 트레일링 주석은 스킵 아님). check-fonts.mjs 와 동일.
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

// ── 파일 스캔 → 파일별 토큰 소비 라인 + hex/tailwind 하드 위반 수집 ──
const tokenCount = new Map();   // file(rel) → 소비 라인 수 (비면제)
const tokenLines = new Map();   // file(rel) → [{line, value}]
const hardViolations = [];      // { file, line, value, rule }

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((raw, i) => {
    if (isCommentLine(raw)) return;
    const lineNo = i + 1;
    const exempt = OK_RE.test(raw);

    // R1 토큰 소비
    const tok = raw.match(TOKEN_RE);
    if (tok && !exempt) {
      tokenCount.set(rel, (tokenCount.get(rel) || 0) + 1);
      if (!tokenLines.has(rel)) tokenLines.set(rel, []);
      tokenLines.get(rel).push({ line: lineNo, value: tok[0].replace(/^\./, 't.') });
    }

    if (exempt) return; // 면제 라인은 하드 규칙에서도 제외

    // R2 라벤더 hex
    const hex = raw.match(HEX_RE);
    if (hex) hardViolations.push({ file: rel, line: lineNo, value: hex[0], rule: 'lavender-hex' });

    // R3 purple/violet/fuchsia Tailwind
    const tw = raw.match(TW_RE);
    if (tw) hardViolations.push({ file: rel, line: lineNo, value: tw[0], rule: 'tailwind-purple' });
  });
}

// ── --update: 현재 소비를 baseline 으로 스냅샷 ──
if (UPDATE) {
  const files = {};
  for (const f of [...tokenCount.keys()].sort()) files[f] = tokenCount.get(f);
  const payload = {
    '//': 'lint:colors 파일별 baseline. t.lavenderTint/t.lavenderHover 소비 라인 수(파일별). ' +
          '청소로 줄면 `npm run lint:colors -- --update` 로 낮춘다. 늘면 가드가 실패한다. ' +
          '의도적 액센트는 소스에 `// lint-colors-ok: 사유` 주석으로 면제.',
    generatedFrom: 'scripts/check-colors.mjs --update',
    total: Object.values(files).reduce((a, b) => a + b, 0),
    files,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(`baseline 갱신 완료 → ${relative(ROOT, BASELINE_PATH)}`);
  console.log(`  파일 ${Object.keys(files).length}개 / 총 ${payload.total} 라인`);
  process.exit(0);
}

// ── 검사 모드 ──
if (!existsSync(BASELINE_PATH)) {
  console.error('❌ baseline 파일이 없습니다. 먼저 생성하세요:');
  console.error('   npm run lint:colors -- --update');
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files || {};

const exceeded = [];  // { file, base, cur, lines }
const decreased = []; // { file, base, cur }

const allFiles = new Set([...Object.keys(baseline), ...tokenCount.keys()]);
for (const f of [...allFiles].sort()) {
  const base = baseline[f] || 0;
  const cur = tokenCount.get(f) || 0;
  if (cur > base) exceeded.push({ file: f, base, cur, lines: tokenLines.get(f) || [] });
  else if (cur < base) decreased.push({ file: f, base, cur });
}

let failed = false;

// R1 baseline 초과
if (exceeded.length) {
  failed = true;
  console.log('\n■ 라벤더 토큰 소비가 baseline 을 초과했습니다 (R1)');
  console.log('  라일락(t.lavenderTint/lavenderHover)이 새 자리에 칠해졌습니다. 아래 중 하나로 조치하세요:');
  console.log('    · 기능면(트랙·컨테이너·미선택 칩·2차 버튼·빈 상태) → t.surfaceMuted');
  console.log('    · 입력칸(<input>/<textarea>) 배경          → inputBg(t)');
  console.log('    · 정말 "선택·활성·강조"라면 유지하되 라인에 // lint-colors-ok: 사유  주석');
  console.log('    · 정당한 청소로 줄인 경우                     → npm run lint:colors -- --update');
  for (const e of exceeded) {
    console.log(`\n  ${e.file}  (baseline ${e.base} → 현재 ${e.cur}, +${e.cur - e.base})`);
    for (const l of e.lines) console.log(`    ${l.line}: ${l.value}`);
  }
}

// R2/R3 하드 위반
if (hardViolations.length) {
  failed = true;
  const byRule = { 'lavender-hex': [], 'tailwind-purple': [] };
  for (const v of hardViolations) byRule[v.rule].push(v);
  if (byRule['lavender-hex'].length) {
    console.log('\n■ 라벤더 hex 하드코딩 (R2) — 토큰을 우회했습니다');
    console.log('  → 의도적 라일락이면 t.lavenderTint, 중립 면이면 t.surfaceMuted 를 쓰세요.');
    for (const v of byRule['lavender-hex']) console.log(`    ${v.file}:${v.line}: ${v.value}`);
  }
  if (byRule['tailwind-purple'].length) {
    console.log('\n■ purple/violet/fuchsia Tailwind 클래스 (R3) — 토큰 체계를 우회했습니다');
    console.log('  → 인라인 t.* 토큰(lavenderTint/surfaceMuted 등)으로 바꾸세요.');
    for (const v of byRule['tailwind-purple']) console.log(`    ${v.file}:${v.line}: ${v.value}`);
  }
}

// 감소 안내(실패 아님)
if (decreased.length) {
  console.log('\nℹ 청소 진척 — 아래 파일이 baseline 아래로 내려갔습니다. baseline 을 조여주세요:');
  console.log('   npm run lint:colors -- --update');
  for (const d of decreased) console.log(`    ${d.file}: ${d.base} → ${d.cur}`);
}

// 요약
console.log('\n' + '─'.repeat(60));
const curTotal = [...tokenCount.values()].reduce((a, b) => a + b, 0);
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(`라벤더 토큰 소비: 현재 ${curTotal} / baseline ${baseTotal}` +
  `  | 초과 파일 ${exceeded.length}개, hex/tailwind 위반 ${hardViolations.length}건`);

if (failed) {
  console.log('lint:colors 실패 — 위 조치 후 다시 실행하세요.');
  process.exit(1);
}
console.log('lint:colors 통과 ✓');
