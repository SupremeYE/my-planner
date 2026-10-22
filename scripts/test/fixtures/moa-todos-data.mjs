// Isolated TODO review/test fixture. Never imported by product modules.
import { tables as baseTables } from './moa-today-data.mjs';
export const tables = structuredClone(baseTables);
tables.todos[0].category = 'work'; tables.todos[1].category = 'life';
tables.todos.push(
  { id: 'legacy-split', text: '기존 두 카테고리의 할 일', date: '2027-01-01', status: 'active', category: 'project', is_top3: false, tags: ['work', 'life'], do_elapsed_sec: 5400 },
  { id: 'legacy-clock', text: '기존 실적을 지켜야 하는 할 일', date: '2027-01-01', status: 'active', category: 'work', is_top3: false, tags: ['work'], do_start: '08:00', do_end: '09:00', do_elapsed_sec: 3600 },
  { id: 'plain', text: '물 마시기', date: '2027-01-01', status: 'active', category: 'life', is_top3: false, tags: [] });
tables.tags.push({ id: 'life', name: '생활', color: '#afc5a0', track_time: true }, { id: 'blog', name: '블로그', color: '#b7866b', track_time: false }, { id: 'read', name: '독서', color: '#67815c', track_time: false }, { id: 'old-event-tag', name: '옛 일정 태그', color: '#67815c', track_time: false });
tables.events.push({ id: 'old-event', title: 'Provider 범위 밖의 옛 일정', start_at: '2015-01-01T10:00:00+09:00', end_at: '2015-01-01T11:00:00+09:00', tags: ['old-event-tag'], repeat_type: 'none' });
