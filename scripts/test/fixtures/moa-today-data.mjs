// Isolated browser test/review data. Never imported by product code.
export const tables = {
  user_settings: [{ id: 'default', day_start_hour: 4, day_end_hour: 26 }],
  todos: [
    { id: 't1', text: '이번 주 프로젝트의 작은 첫 걸음 정리하기', date: '2027-01-01', end_date: '2027-01-01', status: 'active', is_top3: true, weekly_goal_id: 'w1', tags: ['work'], do_start: '09:00', do_end: '10:00' },
    { id: 't2', text: '책 읽고 마음에 남은 문장 적기', date: '2027-01-01', status: 'done', is_top3: true, weekly_goal_id: 'w1', tags: [] },
    { id: 'repeat', text: '매일 나를 위한 가벼운 정리', date: '2026-12-30', end_date: '2026-12-30', status: 'active', is_top3: true, recurrence_rule: 'daily', tags: [] },
    { id: 'undated', text: '날짜 미정 연결 할 일', date: null, status: 'active', is_top3: false, weekly_goal_id: 'w1', tags: [] },
    { id: 'cancel', text: '취소', date: '2027-01-01', status: 'cancelled', is_top3: true, weekly_goal_id: 'w1', tags: [] },
  ],
  weekly_goals: [{ id: 'w1', text: '나의 속도로 프로젝트 한 걸음 나아가기', done: true, week_key: '2027-W53', monthly_goal_id: 'm1' },
    { id: 'w2', text: '편안한 나만의 시간 만들기', done: true, week_key: '2026-W53' }],
  monthly_goals: [{ id: 'm1', text: '월간 목표', month: '2027-01' }],
  tags: [{ id: 'work', name: '업무', color: '#506c4c', track_time: true }],
  todo_time_blocks: [{ id: 'b1', todo_id: 't1', date: '2027-01-01', start_time: '09:00', end_time: '09:30', elapsed_sec: 1800 }],
  events: [{ id: 'e1', title: '반복되는 아침 일정', start_at: '2026-12-30T10:00:00+09:00', end_at: '2026-12-30T11:00:00+09:00', repeat_type: 'daily', tags: [], is_all_day: false },
    { id: 'e2', title: '기록한 실제 활동', start_at: '2027-01-01T14:00:00+09:00', end_at: '2027-01-01T15:00:00+09:00', do_start: '14:00', do_end: '14:15', repeat_type: 'none', tags: [], is_all_day: false }],
};
