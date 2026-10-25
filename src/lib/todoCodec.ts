import type { Todo } from '../app/store';
import type { TodoRow } from './db';

export const toTodo = (r: TodoRow): Todo => ({
  id: r.id, text: r.text, date: r.date, dueDate: r.due_date ?? undefined,
  endDate: r.end_date ?? undefined,
  status: r.status as Todo['status'], isTop3: r.is_top3,
  planStart: r.plan_start ?? undefined, planEnd: r.plan_end ?? undefined,
  doStart: r.do_start ?? undefined, doEnd: r.do_end ?? undefined,
  doElapsedSec: r.do_elapsed_sec ?? undefined,
  category: r.category ?? undefined, projectId: r.project_id ?? undefined,
  weeklyGoalId: r.weekly_goal_id ?? undefined,
  milestoneId: r.milestone_id ?? undefined,
  mandalartCellId: r.mandalart_cell_id ?? undefined,
  tags: r.tags ?? [],
  recurrenceRule: r.recurrence_rule as Todo['recurrenceRule'] ?? undefined,
  recurrenceDays: r.recurrence_days ?? undefined,
  recurrenceEndDate: r.recurrence_end_date ?? undefined,
  recurrenceCount: r.recurrence_count ?? undefined,
  recurrenceParentId: r.recurrence_parent_id ?? undefined,
  isException: r.is_exception ?? undefined,
  recurrenceFreq: r.recurrence_freq as Todo['recurrenceFreq'] ?? undefined,
  recurrenceInterval: r.recurrence_interval ?? undefined,
  recurrencePreset: r.recurrence_preset as Todo['recurrencePreset'] ?? undefined,
  startedDate: r.started_date ?? undefined,
});

export const fromTodo = (t: Todo): TodoRow => ({
  id: t.id, text: t.text, date: t.date ?? null, due_date: t.dueDate ?? null,
  end_date: t.endDate ?? null,
  status: t.status, is_top3: t.isTop3,
  plan_start: t.planStart ?? null, plan_end: t.planEnd ?? null,
  do_start: t.doStart ?? null, do_end: t.doEnd ?? null,
  do_elapsed_sec: t.doElapsedSec ?? null,
  category: t.category ?? null, project_id: t.projectId ?? null,
  weekly_goal_id: t.weeklyGoalId ?? null,
  milestone_id: t.milestoneId ?? null,
  mandalart_cell_id: t.mandalartCellId ?? null,
  tags: t.tags ?? [],
  recurrence_rule: t.recurrenceRule ?? null,
  recurrence_days: t.recurrenceDays ?? null,
  recurrence_end_date: t.recurrenceEndDate ?? null,
  recurrence_count: t.recurrenceCount ?? null,
  recurrence_parent_id: t.recurrenceParentId ?? null,
  is_exception: t.isException ?? null,
  recurrence_freq: t.recurrenceFreq ?? null,
  // recurrence_interval 은 DB에서 NOT NULL DEFAULT 1 (20260714 통합 반복 마이그레이션).
  // 명시적 null 을 보내면 NOT NULL 위반(23502)으로 insert 전체가 실패 → 신규 할일이 저장 안 됨.
  // 비반복 할일은 의미상 interval 1(매 1 주기) 로 채워 제약을 만족시킨다.
  recurrence_interval: t.recurrenceInterval ?? 1,
  recurrence_preset: t.recurrencePreset ?? null,
  started_date: t.startedDate ?? null,
});
