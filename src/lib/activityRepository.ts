import { actualWrites } from './actualWrites';
import { SaveFailure, saveFailure } from './saveCoordinator';
import type { ActivityEntry } from './activityEntries';

type ActivityRow = { id: string; user_id?: string; operation_id: string; date: string; name: string; elapsed_sec: number; category_id: string | null; classification_snapshot: ActivityEntry['classificationSnapshot']; memo: string | null; started_at: string | null; ended_at: string | null; created_at?: string; updated_at?: string };
const timestamp=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():value??null;
export const encodeActivity = (a: ActivityEntry): ActivityRow => ({ id: a.id, operation_id: a.operationId, date: a.date, name: a.name, elapsed_sec: a.elapsedSec, category_id: a.categoryId ?? null, classification_snapshot: a.classificationSnapshot, memo: a.memo ?? null, started_at: timestamp(a.startedAt), ended_at: timestamp(a.endedAt) });
export const decodeActivity = (r: ActivityRow): ActivityEntry => ({ id: r.id, userId: r.user_id, operationId: r.operation_id, date: r.date, name: r.name, elapsedSec: r.elapsed_sec, categoryId: r.category_id ?? undefined, classificationSnapshot: r.classification_snapshot, memo: r.memo ?? undefined, startedAt: r.started_at ?? undefined, endedAt: r.ended_at ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at });
export function activityRepository(client: { from: (name: string) => any }) {
  const writes = actualWrites<ActivityEntry, ActivityRow>(client, 'activity_entries', encodeActivity, decodeActivity);
  return { ...writes,
    async checkSchema() {
      for (const [table, columns] of [['activity_entries', 'id,operation_id,classification_snapshot'], ['todo_time_blocks', 'id,classification_snapshot']]) {
        const result = await client.from(table).select(columns).limit(0);
        if (result.error) {
          if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(result.error.code))
            throw new SaveFailure('독립 활동·분류 보존 스키마가 아직 준비되지 않았어요. DB 초안 승인·적용 후 사용할 수 있어요.', false);
          throw saveFailure(result.error, result.status);
        }
      }
    },
  };
}
