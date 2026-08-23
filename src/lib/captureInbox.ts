// 캡처 인박스 — 데이터 계층 (Stage 2-B)
//
// Stage 1 에서 서버(Edge Function `capture`)가 자동 분류해 쌓은 capture_inbox 제안을
// 인박스 화면(InboxView)이 읽고, 사용자가 승인/수정/폐기할 때 상태를 갱신하는 헬퍼.
//
// 설계 원칙:
//  - **레코드를 절대 DELETE 하지 않는다 — 소프트 아카이브만.** 버리기=status 'discarded',
//    승인=status 'routed'(+ routed_* 흔적 보존). 되돌리기는 status 를 'pending' 으로 되돌린다.
//  - user_id 는 서버가 넣는다. 이 클라 계층은 status/proposal 갱신만(insert 경로 없음 — RLS insert 정책도 없음).
//  - moneyDb 와 동일하게 supabase 를 직접 쓰고, row(snake) ↔ domain(camel) 매핑.
//  - Realtime 구독은 표준 훅 useRealtimeSync('capture_inbox', refresh) 로 소비처가 붙인다(새 패턴 없음).
import { supabase } from './supabase';

export type CaptureType = 'todo' | 'event' | 'seed' | 'money';
export type CaptureStatus = 'pending' | 'routed' | 'discarded';
export type CaptureSource = 'shortcut' | 'web' | 'manual';

// 제안 payload — 서버 classify 가 정규화해 넣은 목적지별 필드(느슨한 형태, 소비처에서 좁힌다).
export type CapturePayload = Record<string, unknown>;

export type CaptureItem = {
  id: string;
  rawText: string;
  source: CaptureSource;
  status: CaptureStatus;
  proposedType: CaptureType | null;
  proposedPayload: CapturePayload | null;
  confidence: number | null;
  classifierError: string | null;
  routedTable: string | null;
  routedRefId: string | null;
  routedAt: string | null;
  capturedAt: string;
  createdAt: string;
};

type CaptureRow = {
  id: string;
  raw_text: string;
  source: CaptureSource;
  status: CaptureStatus;
  proposed_type: CaptureType | null;
  proposed_payload: CapturePayload | null;
  confidence: number | null;
  classifier_error: string | null;
  routed_table: string | null;
  routed_ref_id: string | null;
  routed_at: string | null;
  captured_at: string;
  created_at: string;
};

const toItem = (r: CaptureRow): CaptureItem => ({
  id: r.id,
  rawText: r.raw_text,
  source: r.source,
  status: r.status,
  proposedType: r.proposed_type,
  proposedPayload: r.proposed_payload,
  confidence: r.confidence != null ? Number(r.confidence) : null,
  classifierError: r.classifier_error,
  routedTable: r.routed_table,
  routedRefId: r.routed_ref_id,
  routedAt: r.routed_at,
  capturedAt: r.captured_at,
  createdAt: r.created_at,
});

export const captureInbox = {
  // 미처리(pending) 목록 — 최신 캡처순. (인박스 인덱스 (user_id,status,captured_at desc) 활용)
  listPending: async (): Promise<CaptureItem[]> => {
    const { data, error } = await supabase
      .from('capture_inbox')
      .select('*')
      .eq('status', 'pending')
      .order('captured_at', { ascending: false });
    if (error) console.error('[captureInbox] listPending:', error.message);
    return (data ?? []).map(toItem);
  },

  // pending 건수(배지용). head+count 로 행을 받지 않고 개수만.
  countPending: async (): Promise<number> => {
    const { count, error } = await supabase
      .from('capture_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) console.error('[captureInbox] countPending:', error.message);
    return count ?? 0;
  },

  // 사용자가 목적지(타입)를 바꾸거나 payload 를 편집할 때. type=null(미분류로 되돌리기)도 허용.
  updateProposal: async (id: string, type: CaptureType | null, payload: CapturePayload | null): Promise<void> => {
    const { error } = await supabase
      .from('capture_inbox')
      .update({ proposed_type: type, proposed_payload: payload })
      .eq('id', id);
    if (error) console.error('[captureInbox] updateProposal:', error.message);
  },

  // 승인 성공(목적지 저장 완료) 후에만 호출 — 소프트 아카이브(routed) + 흔적 보존.
  markRouted: async (id: string, table: string, refId: string): Promise<void> => {
    const { error } = await supabase
      .from('capture_inbox')
      .update({ status: 'routed', routed_table: table, routed_ref_id: refId, routed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('[captureInbox] markRouted:', error.message);
  },

  // 버리기 — 소프트 아카이브(discarded). 레코드는 지우지 않는다.
  markDiscarded: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('capture_inbox')
      .update({ status: 'discarded' })
      .eq('id', id);
    if (error) console.error('[captureInbox] markDiscarded:', error.message);
  },

  // 되돌리기 — 승인/버리기 직후 3초 토스트에서. status 를 pending 으로 되돌리고 routed_* 흔적을 지운다.
  // (승인 되돌리기 시 목적지 레코드 삭제는 소비처가 별도로 처리한다 — 여기선 인박스 상태만 복구.)
  restoreToPending: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('capture_inbox')
      .update({ status: 'pending', routed_table: null, routed_ref_id: null, routed_at: null })
      .eq('id', id);
    if (error) console.error('[captureInbox] restoreToPending:', error.message);
  },
};
