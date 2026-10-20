export class SaveFailure extends Error {
  constructor(message: string, public retryable: boolean) { super(message); }
}

/** Safe user messages only: never surface raw database errors or payloads. */
export function saveFailure(error: unknown, status?: number): SaveFailure {
  if (error instanceof SaveFailure) return error;
  const code = (error as { code?: string })?.code;
  const http = status ?? (error as { status?: number })?.status;
  if (http === 401 || http === 403 || code === '42501' || code === 'PGRST301') {
    return new SaveFailure('로그인 또는 저장 권한을 확인해주세요.', false);
  }
  if (http === 0 || http === 408 || http === 429 || (http != null && http >= 500)
      || (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))) {
    return new SaveFailure('저장 확인에 실패했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.', true);
  }
  return new SaveFailure('저장하지 못했어요. 입력 내용을 확인해주세요.', false);
}

export interface SaveState {
  key: string;
  label: string;
  status: 'saving' | 'saved' | 'error';
  message?: string;
  retryable?: boolean;
}

export function saveIntent(value: unknown): string {
  return JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
}

interface Request<T> {
  key: string; label: string; intent: string;
  execute: () => Promise<T>; commit: (record: T) => void;
  promise?: Promise<T | null>;
}

/** In-memory, explicit retry only. Confirmed records are committed after the server response. */
export class SaveCoordinator {
  private states = new Map<string, SaveState>();
  private requests = new Map<string, Request<any>>();
  private creations = new Map<string, string>();
  private listeners = new Set<() => void>();
  revision = 0;

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  snapshot() { return Array.from(this.states.values()); }
  private publish() { this.revision++; this.listeners.forEach(listener => listener()); }
  creationId(kind: string, value: unknown) {
    const fingerprint = `${kind}:${saveIntent(value)}`;
    let id = this.creations.get(fingerprint);
    if (!id) { id = crypto.randomUUID(); this.creations.set(fingerprint, id); }
    return id;
  }
  protectedIds(kind: string) {
    return new Set(Array.from(this.requests.keys()).filter(key => key.startsWith(`${kind}:`)).map(key => key.slice(kind.length + 1)));
  }
  run<T>(request: Request<T>): Promise<T | null> {
    const existing = this.requests.get(request.key);
    const state = this.states.get(request.key);
    if (existing && state?.status === 'saving') {
      if (existing.intent === request.intent) return existing.promise!;
      this.states.set('busy', { key: 'busy', label: request.label, status: 'error', retryable: false,
        message: '이 항목을 저장 중이에요. 완료 후 다시 시도해주세요.' });
      this.publish();
      return Promise.resolve(null);
    }
    // A repeated click must not bypass explicit retry or retry a permanent rejection.
    if (existing && state?.status === 'error' && existing.intent === request.intent) return Promise.resolve(null);
    this.requests.set(request.key, request);
    return this.attempt(request);
  }
  private attempt<T>(request: Request<T>): Promise<T | null> {
    for (const [key, state] of this.states) if (state.status === 'saved' || key === 'busy') this.states.delete(key);
    this.states.set(request.key, { key: request.key, label: request.label, status: 'saving' });
    // Defer execute to a microtask so duplicate synchronous calls see the same promise.
    request.promise = Promise.resolve().then(async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new SaveFailure('오프라인이에요. 저장되지 않았어요. 연결 후 다시 시도해주세요.', true);
        }
        const record = await request.execute();
        request.commit(record);
        this.requests.delete(request.key);
        const id = request.key.slice(request.key.indexOf(':') + 1);
        for (const [fingerprint, creationId] of this.creations) if (creationId === id) this.creations.delete(fingerprint);
        this.states.set(request.key, { key: request.key, label: request.label, status: 'saved' });
        return record;
      } catch (error) {
        const failure = saveFailure(error);
        this.states.set(request.key, { key: request.key, label: request.label, status: 'error',
          message: failure.message, retryable: failure.retryable });
        return null;
      } finally { this.publish(); }
    });
    this.publish();
    return request.promise;
  }
  retry(key: string) {
    const request = this.requests.get(key);
    const state = this.states.get(key);
    if (!request || state?.status !== 'error' || !state.retryable) return Promise.resolve(null);
    return this.attempt(request);
  }
  dismiss(key: string) {
    if (this.states.get(key)?.status === 'saving') return;
    this.requests.delete(key);
    this.states.delete(key);
    // Keep an uncertain creation's ID if the caller submits the same draft again.
    this.publish();
  }
}

/** Preserve confirmed local values while a save is pending/uncertain; accept other-device rows. */
export function mergeConfirmedRows<T extends { id: string }>(remote: T[], local: T[], protectedIds: Set<string>): T[] {
  return [...remote.filter(row => !protectedIds.has(row.id)), ...local.filter(row => protectedIds.has(row.id))];
}
