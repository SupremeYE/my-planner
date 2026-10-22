import { saveFailure, SaveFailure } from './saveCoordinator';

/** Additive persistence path for core entities and timer sessions; legacy writers keep their contract. */
export function confirmedWrites<T extends { id: string }, Row extends { id: string }>(
  client: { from: (table: string) => any }, table: string,
  encode: (record: T) => Row, decode: (row: Row) => T,
) {
  return {
    async createConfirmed(record: T): Promise<T> {
      // Stable primary key + DO NOTHING protects a committed row after an acknowledgement is lost.
      const result = await client.from(table).upsert(encode(record), { onConflict: 'id', ignoreDuplicates: true }).select('*');
      if (result.error) throw saveFailure(result.error, result.status);
      let row = result.data?.[0];
      if (!row) {
        const existing = await client.from(table).select('*').eq('id', record.id).single();
        if (existing.error) throw saveFailure(existing.error, existing.status);
        row = existing.data;
      }
      if (!row || row.id !== record.id) throw new SaveFailure('저장 결과를 확인하지 못했어요.', false);
      const confirmed = decode(row);
      const normalized = encode(confirmed);
      if (Object.entries(encode(record)).some(([key, value]) => JSON.stringify(value) !== JSON.stringify((normalized as any)[key]))) {
        throw new SaveFailure('같은 항목이 다른 내용으로 저장돼 있어요. 새로고침해 확인해주세요.', false);
      }
      return confirmed;
    },
    async updateConfirmed(before: T, after: T): Promise<T> {
      const oldRow = encode(before); const nextRow = encode(after);
      // Send only changed columns; do not overwrite unrelated fields changed on another device.
      const patch = Object.fromEntries(Object.entries(nextRow).filter(([key, value]) =>
        key !== 'id' && JSON.stringify(value) !== JSON.stringify((oldRow as any)[key])));
      if (!Object.keys(patch).length) return before;
      const result = await client.from(table).update(patch).eq('id', before.id).select('*').single();
      if (result.error) throw saveFailure(result.error, result.status);
      if (!result.data || result.data.id !== before.id) throw new SaveFailure('저장 결과를 확인하지 못했어요.', false);
      return decode(result.data);
    },
    async getConfirmed(id: string): Promise<T | null> {
      const result = await client.from(table).select('*').eq('id', id);
      if (result.error) throw saveFailure(result.error, result.status);
      if (!Array.isArray(result.data)) throw new SaveFailure('조회 결과를 확인하지 못했어요.', false);
      return result.data[0] ? decode(result.data[0]) : null;
    },
    async deleteConfirmed(id: string): Promise<void> {
      const result = await client.from(table).delete().eq('id', id).select('*');
      if (result.error) throw saveFailure(result.error, result.status);
      // Explicit absence read makes acknowledgement-loss retry idempotent.
      const check = await client.from(table).select('id').eq('id', id);
      if (check.error) throw saveFailure(check.error, check.status);
      if (!Array.isArray(check.data) || check.data.length) throw new SaveFailure('삭제 결과를 확인하지 못했어요.', false);
    },
    async fetchConfirmed(): Promise<T[]> {
      const result = await client.from(table).select('*').order('created_at');
      if (result.error) throw saveFailure(result.error, result.status);
      if (!Array.isArray(result.data)) throw new SaveFailure('조회 결과를 확인하지 못했어요.', false);
      return result.data.map(decode);
    },
  };
}
