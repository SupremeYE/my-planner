// Supabase Edge Function 공용 모듈: _shared/classify.ts
//
// 캡처 인박스 자동 분류기. money-parse 의 구조를 그대로 복제한다(새 패턴 만들지 않음):
//   gpt-4o-mini + temperature 0 + response_format json_object
//   → 코드펜스 제거 후 첫 { ~ 마지막 } JSON.parse
//   → 서버측 화이트리스트/타입 정규화(LLM 출력을 절대 그대로 믿지 않는다)
//
// 한 줄 입력을 4종 목적지 중 하나로 분류한다: todo / event / seed / money.
// 애매하면 type=null(정상 상태 — 오분류보다 낫다). 실패 시 throw 하지 않고 { type:null, error } 반환.
//
// 출력: { type, confidence, payload, error? }
//   payload 필드(정규화 후):
//     todo  → { text, date?(YYYY-MM-DD), important?(true), tags?[] }
//     event → { title, start_date(YYYY-MM-DD), start_time?(HH:MM), end_time?(HH:MM) }
//     seed  → { text, kind: 'none'|'do'|'be'|'build' }
//     money → { amount(양수 정수), type:'expense'|'income', currency:'KRW',
//               spent_at(YYYY-MM-DD), category_hint?, method_hint? }
//
// ⚠️ id 는 생성하지 않는다(todos/events 의 text id 는 클라가 만드는 규칙 — 서버로 옮기지 않는다).
// ⚠️ category_hint 는 힌트 문자열로만 둔다(category_id 변환은 Stage 2 승인 시 처리).

const TYPES = ['todo', 'event', 'seed', 'money'] as const;
type CaptureType = (typeof TYPES)[number];

export interface ClassifyResult {
  type: CaptureType | null;
  confidence: number; // 0~1
  payload: Record<string, unknown>;
  error?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SEED_KINDS = ['none', 'do', 'be', 'build'];

function systemPrompt(today: string): string {
  return [
    `오늘 날짜는 ${today}(Asia/Seoul 기준) 야. "오늘/내일/모레/다음 주" 같은 상대 표현은 이 기준으로 yyyy-MM-dd 로 변환해. 날짜를 특정 못 하면 그 필드를 생략해(지어내지 마).`,
    '',
    '사용자가 음성/텍스트로 던진 한 줄을 읽고, 아래 4종 중 하나로 분류해 구조화해줘.',
    '분류 기준:',
    '  - event: 특정 일시가 있고 "그 시각에 일어나는 것"(약속·회의·병원 예약 등). 반드시 날짜(start_date)가 잡혀야 event.',
    '  - todo: 해야 할 행동("~하기", "~사기", "~처리해야 함").',
    '  - money: 금액이 언급된 소비/수입("점심 8천원", "월급 300만원 들어옴").',
    '  - seed: "언젠가 / ~하면 좋겠다 / ~해봐야겠다" 식의 막연한 아이디어·바람.',
    '  - 애매하면 억지로 고르지 말고 type 을 null 로 둬. **null 이 오분류보다 낫다.**',
    '  - 문화기록·독서·일기·스크랩으로 보이는 입력도 이번 버전에서는 type=null 로 둬. 억지로 todo/seed 에 밀어넣지 마.',
    '',
    'payload 는 고른 type 에 맞춰 아래 필드만 채운다(모르면 생략):',
    '  todo  → { "text": 짧은 할 일 제목, "date": "yyyy-MM-dd"(날짜 언급 있을 때만), "important": true(중요·긴급 강조 있을 때만), "tags": [문자열] }',
    '  event → { "title": 일정 제목, "start_date": "yyyy-MM-dd", "start_time": "HH:MM"(24시간, 있을 때만), "end_time": "HH:MM"(있을 때만) }',
    '  seed  → { "text": 아이디어 한 줄, "kind": "none"|"do"(해보고 싶은)|"be"(되고 싶은)|"build"(만들고 싶은) }',
    '  money → { "amount": 양수 숫자, "type": "expense"|"income", "currency": "KRW", "spent_at": "yyyy-MM-dd", "category_hint": 분류 힌트 문자열(있을 때만), "method_hint": 결제수단 문자열(있을 때만) }',
    '',
    'money.amount 는 원화 정수로 변환해("8천원"→8000, "1,200원"→1200, "3만"→30000). 콤마·단위·통화기호 제거. 금액을 못 찾으면 money 아님.',
    'start_time/end_time 은 24시간 HH:MM 으로: "오후 3시"→"15:00", "아침 9시반"→"09:30".',
    '',
    '출력은 JSON 객체 하나만: {"type":"todo|event|seed|money|null","confidence":0.0~1.0,"payload":{...}}',
    'confidence 는 분류 확신도(뚜렷하면 높게, 추정이면 낮게). type=null 이면 payload 는 {}.',
    '마크다운/코드펜스/설명 없이 JSON 만.',
  ].join('\n');
}

// 코드펜스/잡텍스트를 걷어내고 첫 JSON 객체만 안전 파싱(money-parse 의 parseObj 그대로).
function parseObj(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(s.slice(first, last + 1));
  } catch {
    return null;
  }
}

function clampConf(v: unknown): number {
  const c = Number(v);
  return Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;
}

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
function optDate(v: unknown): string | undefined {
  return typeof v === 'string' && DATE_RE.test(v) ? v : undefined;
}
function optTime(v: unknown): string | undefined {
  return typeof v === 'string' && TIME_RE.test(v) ? v : undefined;
}
function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
}

// type 별 payload 정규화. 화이트리스트/타입 검증만 통과.
// 필수 조건을 못 채우면 type 을 null 로 강등한다(에러 아님 — 정상적인 "분류 불가").
function normalize(
  type: CaptureType,
  p: Record<string, unknown>,
  today: string,
): { type: CaptureType | null; payload: Record<string, unknown> } {
  if (type === 'todo') {
    const text = optStr(p.text);
    if (!text) return { type: null, payload: {} };
    const out: Record<string, unknown> = { text };
    const date = optDate(p.date); // 파싱 실패한 날짜는 필드 생략(에러 아님)
    if (date) out.date = date;
    if (p.important === true) out.important = true;
    const tags = strArray(p.tags);
    if (tags.length) out.tags = tags;
    return { type, payload: out };
  }

  if (type === 'event') {
    const title = optStr(p.title);
    const start_date = optDate(p.start_date);
    // event 는 제목 + 날짜가 반드시 있어야 한다. 하나라도 없으면 event 로 저장하지 않는다(→ null).
    if (!title || !start_date) return { type: null, payload: {} };
    const out: Record<string, unknown> = { title, start_date };
    const st = optTime(p.start_time);
    if (st) out.start_time = st;
    const et = optTime(p.end_time);
    if (et) out.end_time = et;
    return { type, payload: out };
  }

  if (type === 'seed') {
    const text = optStr(p.text);
    if (!text) return { type: null, payload: {} };
    const kind = typeof p.kind === 'string' && SEED_KINDS.includes(p.kind) ? p.kind : 'none';
    return { type, payload: { text, kind } };
  }

  // money — amount 가 숫자가 아니거나 <= 0 이면 type 을 null 로 강등.
  const amountRaw = Number(p.amount);
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) return { type: null, payload: {} };
  const out: Record<string, unknown> = {
    amount: Math.round(amountRaw), // 원화 정수 고정
    type: p.type === 'income' ? 'income' : 'expense',
    currency: 'KRW', // v1 원화 고정
    spent_at: optDate(p.spent_at) ?? today,
  };
  const ch = optStr(p.category_hint); // 힌트 문자열로만 — category_id 변환 안 함(Stage 2)
  if (ch) out.category_hint = ch;
  const mh = optStr(p.method_hint);
  if (mh) out.method_hint = mh;
  return { type: 'money', payload: out };
}

// 한 줄 입력을 분류한다. 실패해도 throw 하지 않고 { type:null, error } 반환.
export async function classify(text: string, today: string, openaiKey: string): Promise<ClassifyResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 512,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(today) },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[classify] openai 실패:', res.status, detail.slice(0, 300));
      return { type: null, confidence: 0, payload: {}, error: `openai_${res.status}` };
    }

    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content;
    const obj = typeof content === 'string' ? parseObj(content) : null;
    if (!obj) return { type: null, confidence: 0, payload: {}, error: 'parse_failed' };

    const confidence = clampConf(obj.confidence);
    const rawType = typeof obj.type === 'string' && (TYPES as readonly string[]).includes(obj.type)
      ? (obj.type as CaptureType)
      : null;
    if (!rawType) return { type: null, confidence, payload: {} }; // 화이트리스트 밖/명시적 null

    const rawPayload = obj.payload && typeof obj.payload === 'object'
      ? (obj.payload as Record<string, unknown>)
      : {};
    const { type, payload } = normalize(rawType, rawPayload, today);
    return { type, confidence, payload };
  } catch (e) {
    console.error('[classify] 예외:', String(e));
    return { type: null, confidence: 0, payload: {}, error: String(e) };
  }
}
