/** Isolated test transport. It never opens a socket or loads credentials. */
export function memorySupabase(initial: Record<string, any[]>) {
  const tables = structuredClone(initial);
  const requests: any[] = [];
  const faults: any[] = [];
  const held = new Set<string>();
  const releases = new Map<string, Array<() => void>>();
  const listeners = new Map<string, Set<() => void>>();
  const emit = (table: string) => listeners.get(table)?.forEach(callback => callback());
  const controls = {
    tables, requests,
    failNext: (table: string, fault: any) => faults.push({ table, ...fault }),
    hold: (table: string) => held.add(table),
    release: (table: string) => { held.delete(table); releases.get(table)?.forEach(release => release()); releases.delete(table); },
    emit,
  };
  const supabase = {
    from(table: string) {
      let kind = 'read'; let payload: any; let options: any = {}; let single = false; let offset = 0; let end = Infinity;
      const filters: Array<(row: any) => boolean> = [];
      const execute = async () => {
        const isWrite = kind !== 'read';
        if (isWrite) requests.push({ table, kind, payload: structuredClone(payload) });
        if (isWrite && held.has(table)) await new Promise<void>(resolve => {
          releases.set(table, [...releases.get(table) ?? [], resolve]);
        });
        const faultIndex = faults.findIndex(f => f.table === table && (f.read ? !isWrite : isWrite));
        const fault = faultIndex >= 0 ? faults.splice(faultIndex, 1)[0] : undefined;
        const failure = () => ({ data: null, error: { code: fault.code ?? 'TEST', message: 'isolated failure' }, status: fault.status });
        if (fault && !fault.afterCommit) return failure();
        const rows = tables[table] ?? (tables[table] = []);
        let data: any[];
        if (kind === 'upsert' || kind === 'insert') {
          const existing = rows.find(row => row.id === payload.id);
          if (existing && options.ignoreDuplicates) data = [];
          else if (existing) { Object.assign(existing, payload); data = [existing]; }
          else { rows.push(structuredClone(payload)); data = [rows[rows.length - 1]]; }
        } else if (kind === 'update') {
          data = rows.filter(row => filters.every(filter => filter(row)));
          data.forEach(row => Object.assign(row, structuredClone(payload)));
        } else if (kind === 'delete') {
          data = rows.filter(row => filters.every(filter => filter(row)));
          tables[table] = rows.filter(row => !data.includes(row));
        } else {
          data = rows.filter(row => filters.every(filter => filter(row)));
        }
        if (isWrite) queueMicrotask(() => emit(table));
        if (fault) return failure();
        if (!isWrite) data = data.slice(offset, end + 1);
        if (single && data.length !== 1) return { data: null, error: { code: 'PGRST116' }, status: 406 };
        return { data: structuredClone(single ? data[0] : data), error: null, status: 200 };
      };
      const query: any = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve: any, reject: any) => execute().then(resolve, reject);
        if (method === 'select' || method === 'order') return () => query;
        if (method === 'range') return (from: number, to: number) => { offset = from; end = to; return query; };
        if (method === 'limit') return (count: number) => { end = count - 1; return query; };
        if (method === 'single' || method === 'maybeSingle') return () => { single = true; return query; };
        if (method === 'contains') return (key: string, values: any[]) => { filters.push(row => values.every(value => (row[key] ?? []).includes(value))); return query; };
        if (method === 'eq' || method === 'is') return (key: string, value: any) => { filters.push(row => row[key] === value); return query; };
        if (method === 'gte') return (key: string, value: any) => { filters.push(row => row[key] >= value); return query; };
        if (method === 'lte') return (key: string, value: any) => { filters.push(row => row[key] <= value); return query; };
        if (method === 'delete') return () => { kind = 'delete'; return query; };
        if (method === 'upsert' || method === 'insert' || method === 'update') return (value: any, opts?: any) => {
          kind = String(method); payload = value; options = opts ?? {}; return query;
        };
        throw new Error(`Unsupported isolated query: ${String(method)}`);
      } });
      return query;
    },
    channel() {
      const subscriptions: Array<[string, () => void]> = [];
      return {
        on(_: unknown, config: { table: string }, callback: () => void) {
          if (!listeners.has(config.table)) listeners.set(config.table, new Set());
          listeners.get(config.table)!.add(callback); subscriptions.push([config.table, callback]); return this;
        },
        subscribe() { return this; },
        unsubscribe() { subscriptions.forEach(([table, cb]) => listeners.get(table)?.delete(cb)); },
      };
    },
    removeChannel(channel: { unsubscribe: () => void }) { channel.unsubscribe(); },
  };
  return { supabase, controls };
}
