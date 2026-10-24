import { saveFailure, SaveFailure } from './saveCoordinator';
/** Explicit pages avoid silently truncating personal time history at the REST row limit. */
export async function readAllRows<Row>(client: { from: (table: string) => any }, table: string, order = 'created_at'): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await client.from(table).select('*').order(order).order('id').range(offset, offset + pageSize - 1);
    if (result.error) throw saveFailure(result.error, result.status);
    if (!Array.isArray(result.data)) throw new SaveFailure('기록 조회 결과를 확인하지 못했어요.', false);
    rows.push(...result.data);
    if (result.data.length < pageSize) return [...new Map(rows.map((row: any) => [row.id, row])).values()] as Row[];
  }
}
