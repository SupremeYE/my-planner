import { useMemo, useState } from 'react';
import { useParams, NavLink } from 'react-router';
import {
  Plus, ChevronLeft, CheckCircle2, Flag, Trash2,
  Calendar, Clock, FolderKanban, X,
  TrendingUp, Circle, Target,
} from 'lucide-react';
import { usePlanner, Project, Milestone, Todo } from '../store';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';
import { TodoModal } from './TodoModal';
import { useTheme } from '../ThemeContext';

// ── Project color palette ──
export const PROJECT_COLORS = [
  '#5B8FE0', '#E05C7B', '#5BC8AF', '#A07BE0',
  '#506076', '#515f74', '#9f403d', '#5BB8E0',
];

// ── Helpers ──
function hexAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── New Project Modal ──
function NewProjectModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (p: Omit<Project, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: desc.trim() || undefined, color, startDate: startDate || undefined, endDate: endDate || undefined, status: 'active' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="rounded-2xl p-6 shadow-2xl w-[420px] max-w-[90vw]" style={{ backgroundColor: '#f6fafe', border: '1px solid #d5e5ef' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#26343d' }}>새 프로젝트</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#eef4fa]">
            <X size={16} color="#888" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Color picker */}
          <div>
            <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>색상</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>프로젝트 이름 *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="프로젝트명을 입력하세요"
              className="w-full rounded-xl px-3 py-2.5 border outline-none"
              style={{ borderColor: '#d5e5ef', fontSize: 14, backgroundColor: '#fff', color: '#26343d' }}
            />
          </div>
          {/* Description */}
          <div>
            <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>설명</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="프로젝트에 대한 간략한 설명"
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 border outline-none resize-none"
              style={{ borderColor: '#d5e5ef', fontSize: 13, backgroundColor: '#fff', color: '#26343d' }}
            />
          </div>
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ borderColor: '#d5e5ef', fontSize: 13, backgroundColor: '#fff', color: '#26343d' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>마감일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ borderColor: '#d5e5ef', fontSize: 13, backgroundColor: '#fff', color: '#26343d' }} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl"
              style={{ backgroundColor: '#eef4fa', color: '#888', fontSize: 14 }}>취소</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl"
              style={{ backgroundColor: '#515f74', color: '#fff', fontSize: 14, fontWeight: 600 }}>만들기</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 연결 목표 라벨 — Project.goalKind + goalId 를 해석해 표시용 텍스트 반환
function useProjectGoalLabel(project: Project): string | null {
  const { annualGoals, quarterlyGoals, monthlyGoals } = usePlanner();
  if (!project.goalKind || !project.goalId) return null;
  if (project.goalKind === 'annual') return annualGoals.find(g => g.id === project.goalId)?.text ?? null;
  if (project.goalKind === 'quarterly') return quarterlyGoals.find(g => g.id === project.goalId)?.text ?? null;
  if (project.goalKind === 'monthly') return monthlyGoals.find(g => g.id === project.goalId)?.text ?? null;
  return null;
}

// ── Project Card (in list) ──
function ProjectCard({ project }: { project: Project }) {
  const { t } = useTheme();
  const { todos, milestones } = usePlanner();
  const projectTodos = todos.filter(td => td.projectId === project.id && td.status !== 'cancelled');
  const doneTodos = projectTodos.filter(td => td.status === 'done');
  const progress = projectTodos.length ? Math.round((doneTodos.length / projectTodos.length) * 100) : 0;
  const projectMilestones = milestones
    .filter(m => m.projectId === project.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextMilestone = projectMilestones.find(m => !m.done);
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;
  const goalLabel = useProjectGoalLabel(project);

  return (
    <NavLink
      to={`/projects/${project.id}`}
      className="block rounded-2xl p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: hexAlpha(project.color, 0.15) }}>
            <FolderKanban size={20} color={project.color} />
          </div>
          <div className="min-w-0">
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>{project.name}</div>
            {project.description && (
              <div className="truncate" style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>{project.description}</div>
            )}
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: hexAlpha(project.color, 0.12), color: project.color, fontWeight: 600, fontSize: 11 }}>
          {project.status === 'active' ? '진행중' : project.status === 'completed' ? '완료' : '일시중단'}
        </span>
      </div>

      {/* 🎯 연결 목표 배지 */}
      {goalLabel && (
        <div className="flex items-center gap-1.5 mb-2.5 px-2 py-1 rounded-lg"
          style={{ backgroundColor: t.accentLight, border: `1px solid ${t.accent}22` }}>
          <Target size={11} color={t.accent} />
          <span className="truncate" style={{ fontSize: 11, color: t.accent, fontWeight: 600 }} title={goalLabel}>
            {project.goalKind === 'annual' ? '연간' : project.goalKind === 'quarterly' ? '분기' : '월간'} · {goalLabel}
          </span>
        </div>
      )}

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span style={{ fontSize: 11, color: t.textMuted }}>할일 {doneTodos.length}/{projectTodos.length}</span>
          <span style={{ fontSize: 12, color: project.color, fontWeight: 700 }}>{progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: project.color }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {nextMilestone ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Flag size={11} color={project.color} />
            <span className="truncate" style={{ fontSize: 11, color: t.textMuted }}>다음: {nextMilestone.title}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: t.textMuted }}>마일스톤 없음</span>
        )}
        {daysLeft !== null && (
          <span className="flex-shrink-0" style={{
            fontSize: 11,
            color: daysLeft < 0 ? t.danger : daysLeft < 7 ? t.danger : t.textMuted,
            fontWeight: daysLeft < 7 ? 600 : 400,
          }}>
            {daysLeft < 0 ? '마감 초과' : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
          </span>
        )}
      </div>
    </NavLink>
  );
}

// ── Project List Page ──
export function ProjectsView() {
  const { t } = useTheme();
  const { projects, addProject } = usePlanner();
  const [showNewModal, setShowNewModal] = useState(false);

  const activeProjects = projects.filter(p => p.status === 'active');
  const otherProjects = projects.filter(p => p.status !== 'active');

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 lg:px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: t.bg, borderBottom: `1px solid ${t.borderLight}` }}>
        <div className="flex items-center gap-3">
          <FolderKanban size={20} color={t.accent} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: t.text }}>프로젝트</h1>
            <p style={{ fontSize: 12, color: t.textMuted }}>총 {projects.length}개의 프로젝트</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ backgroundColor: t.accent, color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={14} />
          새 프로젝트
        </button>
      </div>

      <div className="px-4 lg:px-6 py-5 space-y-6">
        {/* Active Projects */}
        {activeProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={13} color={t.accent} />
              <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                진행 중 ({activeProjects.length})
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {activeProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {/* Other Projects */}
        {otherProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Circle size={13} color={t.textMuted} />
              <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                기타 ({otherProjects.length})
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {otherProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban size={40} color={t.borderLight} />
            <p style={{ fontSize: 15, color: t.textMuted, marginTop: 12 }}>아직 프로젝트가 없어요</p>
            <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>새 프로젝트를 만들어 보세요</p>
            <button onClick={() => setShowNewModal(true)}
              className="mt-4 px-4 py-2 rounded-xl"
              style={{ backgroundColor: t.bgSub, color: t.accent, fontSize: 13, fontWeight: 600 }}>
              + 프로젝트 만들기
            </button>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onSave={addProject}
        />
      )}
    </div>
  );
}

// ── 마일스톤 진행률: 연결된 할일 done/total. 자식 없으면 마일스톤 자체 done 로 폴백
function milestoneProgress(milestoneId: string, todos: Todo[]): { done: number; total: number; pct: number } {
  const linked = todos.filter(td => td.milestoneId === milestoneId && td.status !== 'cancelled');
  if (linked.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = linked.filter(td => td.status === 'done').length;
  return { done, total: linked.length, pct: Math.round((done / linked.length) * 100) };
}

// ── 마일스톤 카드 (PC 좌측 / 모바일 마일스톤 탭 본문) ──
function MilestoneCard({ milestone, projectId, projectColor }: {
  milestone: Milestone; projectId: string; projectColor: string;
}) {
  const { t } = useTheme();
  const { todos, toggleMilestone, deleteMilestone, updateTodo } = usePlanner();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [addTodoOpen, setAddTodoOpen] = useState(false);

  const linkedTodos = todos
    .filter(td => td.milestoneId === milestone.id && td.status !== 'cancelled')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const { done, total, pct } = milestoneProgress(milestone.id, todos);
  const auto100 = total > 0 && pct === 100;
  const isPastDue = differenceInDays(new Date(), parseISO(milestone.date)) > 0 && !milestone.done && !auto100;

  return (
    <>
      <div className="rounded-2xl p-4" style={{
        backgroundColor: t.card,
        border: `1px solid ${milestone.done || auto100 ? t.success + '55' : t.borderLight}`,
      }}>
        {/* Header */}
        <div className="flex items-start gap-2.5 mb-2">
          <button
            onClick={() => toggleMilestone(milestone.id)}
            className="flex-shrink-0 mt-0.5"
            title={milestone.done ? '미완료로' : '수동 완료 표시'}
          >
            <Flag size={15}
              color={milestone.done || auto100 ? t.success : isPastDue ? t.danger : projectColor}
              fill={milestone.done || auto100 ? t.success : 'none'} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: milestone.done ? t.textMuted : t.text,
                textDecoration: milestone.done ? 'line-through' : 'none',
                wordBreak: 'break-word',
              }}>{milestone.title}</span>
              {auto100 && !milestone.done && (
                <span className="px-1.5 py-px rounded-full" style={{
                  fontSize: 10, fontWeight: 700, color: t.success, backgroundColor: t.success + '18',
                }}>완료</span>
              )}
            </div>
            <span style={{ fontSize: 11, color: isPastDue ? t.danger : t.textMuted }}>
              {format(parseISO(milestone.date), 'M월 d일', { locale: ko })}
              {isPastDue && ' · 지났음'}
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: projectColor }}>{pct}%</span>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <Trash2 size={11} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: t.bgSub }}>
          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: auto100 ? t.success : projectColor }} />
        </div>

        {/* Inline todos */}
        <div className="space-y-1.5">
          {linkedTodos.map(td => (
            <div key={td.id} className="flex items-center gap-2 group">
              <button
                onClick={() => updateTodo(td.id, { status: td.status === 'done' ? 'active' : 'done' })}
                className="flex-shrink-0"
              >
                <CheckCircle2 size={14}
                  color={td.status === 'done' ? projectColor : t.borderLight}
                  fill={td.status === 'done' ? projectColor : 'none'} />
              </button>
              <span className="flex-1 min-w-0 truncate" style={{
                fontSize: 12,
                color: td.status === 'done' ? t.textMuted : t.text,
                textDecoration: td.status === 'done' ? 'line-through' : 'none',
              }}>{td.text}</span>
              {td.date && (
                <span className="flex-shrink-0" style={{ fontSize: 10, color: t.textMuted }}>
                  {format(parseISO(td.date), 'M/d', { locale: ko })}
                </span>
              )}
              <button
                onClick={() => updateTodo(td.id, { milestoneId: undefined })}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="이 마일스톤에서 연결 해제"
                style={{ color: t.textMuted }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {linkedTodos.length === 0 && (
            <p style={{ fontSize: 11, color: t.textMuted, padding: '4px 0' }}>연결된 할일이 없어요</p>
          )}
        </div>

        {/* + 할일 추가 */}
        <button
          onClick={() => setAddTodoOpen(true)}
          className="mt-2 w-full text-left flex items-center gap-1 px-2 py-1.5 rounded-lg"
          style={{ fontSize: 11, color: t.accent, backgroundColor: t.bgSub }}
        >
          <Plus size={11} /> 할일 추가
        </button>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          message="마일스톤을 삭제할까요?"
          description="연결된 할일은 미지정 상태로 보존됩니다."
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { deleteMilestone(milestone.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {addTodoOpen && (
        <TodoModal
          initialProjectId={projectId}
          initialMilestoneId={milestone.id}
          onClose={() => setAddTodoOpen(false)}
        />
      )}
    </>
  );
}

// ── 할일 패널 행 (🚩 마일스톤 태그 포함) ──
function ProjectTodoRow({ todo, projectColor, milestones, onEdit }: {
  todo: Todo; projectColor: string; milestones: Milestone[]; onEdit: () => void;
}) {
  const { t } = useTheme();
  const { updateTodo } = usePlanner();
  const milestone = todo.milestoneId ? milestones.find(m => m.id === todo.milestoneId) : null;
  const done = todo.status === 'done';

  return (
    <div
      className="flex items-start gap-2.5 p-3 rounded-xl group cursor-pointer"
      style={{
        backgroundColor: done ? t.bgSub : t.card,
        border: `1px solid ${t.borderLight}`,
      }}
      onClick={onEdit}
    >
      <button
        onClick={(e) => { e.stopPropagation(); updateTodo(todo.id, { status: done ? 'active' : 'done' }); }}
        className="flex-shrink-0 mt-0.5"
      >
        <CheckCircle2 size={17}
          color={done ? projectColor : t.borderLight}
          fill={done ? projectColor : 'none'} />
      </button>
      <div className="flex-1 min-w-0">
        <p style={{
          fontSize: 13, color: t.text,
          textDecoration: done ? 'line-through' : 'none',
          opacity: done ? 0.6 : 1, wordBreak: 'break-word',
        }}>{todo.text}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {milestone ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{
              fontSize: 10, backgroundColor: projectColor + '18', color: projectColor, fontWeight: 600,
            }}>
              🚩 <span className="truncate" style={{ maxWidth: 120 }} title={milestone.title}>{milestone.title}</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full" style={{
              fontSize: 10, backgroundColor: t.bgSub, color: t.textMuted,
            }}>🚩 미지정</span>
          )}
          {todo.date && (
            <span className="flex items-center gap-1" style={{ fontSize: 10, color: t.textMuted }}>
              <Calendar size={9} /> {format(parseISO(todo.date), 'M/d', { locale: ko })}
            </span>
          )}
          {todo.planStart && (
            <span className="flex items-center gap-1" style={{ fontSize: 10, color: t.textMuted }}>
              <Clock size={9} /> {todo.planStart}{todo.planEnd ? `–${todo.planEnd}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 🎯 목표 연결 편집 행 ──
function GoalLinkEditor({ project }: { project: Project }) {
  const { t } = useTheme();
  const { annualGoals, quarterlyGoals, monthlyGoals, updateProject } = usePlanner();
  const [editing, setEditing] = useState(false);
  const goalLabel = useProjectGoalLabel(project);

  const options = useMemo(() => {
    if (project.goalKind === 'annual') return annualGoals.map(g => ({ id: g.id, label: g.text }));
    if (project.goalKind === 'quarterly') return quarterlyGoals.map(g => ({ id: g.id, label: `Q${g.quarter} ${g.text}` }));
    if (project.goalKind === 'monthly') return monthlyGoals.map(g => ({ id: g.id, label: `[${g.month}] ${g.text}` }));
    return [];
  }, [project.goalKind, annualGoals, quarterlyGoals, monthlyGoals]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
        style={{ backgroundColor: t.accentLight, border: `1px solid ${t.accent}33`, color: t.accent }}
      >
        <Target size={11} />
        <span style={{ fontSize: 11, fontWeight: 600 }}>
          {goalLabel
            ? `${project.goalKind === 'annual' ? '연간' : project.goalKind === 'quarterly' ? '분기' : '월간'} · ${goalLabel}`
            : '🎯 목표 연결'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <select
        value={project.goalKind ?? ''}
        onChange={e => updateProject(project.id, { goalKind: (e.target.value || undefined) as Project['goalKind'], goalId: undefined })}
        className="rounded-lg px-2 py-1 border outline-none"
        style={{ fontSize: 11, borderColor: t.borderLight, backgroundColor: t.card, color: t.text }}
      >
        <option value="">종류 선택</option>
        <option value="annual">연간</option>
        <option value="quarterly">분기</option>
        <option value="monthly">월간</option>
      </select>
      {project.goalKind && (
        <select
          value={project.goalId ?? ''}
          onChange={e => updateProject(project.id, { goalId: e.target.value || undefined })}
          className="rounded-lg px-2 py-1 border outline-none"
          style={{ fontSize: 11, borderColor: t.borderLight, backgroundColor: t.card, color: t.text, maxWidth: 200 }}
        >
          <option value="">목표 선택</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )}
      <button
        onClick={() => { updateProject(project.id, { goalKind: undefined, goalId: undefined }); setEditing(false); }}
        className="px-2 py-1 rounded-lg" style={{ fontSize: 11, color: t.textMuted, backgroundColor: t.bgSub }}
      >해제</button>
      <button
        onClick={() => setEditing(false)}
        className="px-2 py-1 rounded-lg" style={{ fontSize: 11, color: '#fff', backgroundColor: t.accent }}
      >완료</button>
    </div>
  );
}

// ── Project Detail Page ──
export function ProjectDetailView() {
  const { t } = useTheme();
  const { id } = useParams<{ id: string }>();
  const {
    projects, todos, milestones, updateProject, deleteProject, addMilestone,
  } = usePlanner();

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'done'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tab, setTab] = useState<'milestones' | 'todos'>('milestones');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [addingTodoForProject, setAddingTodoForProject] = useState(false);

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: t.bg }}>
        <div className="text-center">
          <FolderKanban size={40} color={t.borderLight} />
          <p style={{ fontSize: 15, color: t.textMuted, marginTop: 12 }}>프로젝트를 찾을 수 없어요</p>
          <NavLink to="/projects" className="mt-3 inline-block px-4 py-2 rounded-xl"
            style={{ backgroundColor: t.bgSub, color: t.accent, fontSize: 13, fontWeight: 600 }}>
            목록으로
          </NavLink>
        </div>
      </div>
    );
  }

  const projectTodos = todos.filter(td => td.projectId === id && td.status !== 'cancelled');
  const filteredTodos = projectTodos.filter(td => {
    if (statusFilter === 'active') return td.status !== 'done';
    if (statusFilter === 'done') return td.status === 'done';
    return true;
  });
  const doneTodos = projectTodos.filter(td => td.status === 'done');
  const progress = projectTodos.length ? Math.round((doneTodos.length / projectTodos.length) * 100) : 0;
  const projectMilestones = milestones
    .filter(m => m.projectId === id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !newMilestoneDate) return;
    addMilestone({ projectId: id!, title: newMilestoneTitle.trim(), date: newMilestoneDate, done: false });
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
    setShowAddMilestone(false);
  };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: t.bg }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 lg:px-6 py-4"
        style={{ backgroundColor: t.bg, borderBottom: `1px solid ${t.borderLight}` }}>
        <div className="flex items-center gap-3">
          <NavLink to="/projects" className="p-1.5 rounded-lg"
            style={{ color: t.textMuted }}>
            <ChevronLeft size={16} />
          </NavLink>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: hexAlpha(project.color, 0.15) }}>
            <FolderKanban size={16} color={project.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: t.text, wordBreak: 'break-word' }}>{project.name}</h1>
            {project.description && (
              <p className="truncate" style={{ fontSize: 12, color: t.textMuted }}>{project.description}</p>
            )}
          </div>
          <select
            value={project.status}
            onChange={e => updateProject(project.id, { status: e.target.value as Project['status'] })}
            className="px-3 py-1.5 rounded-lg border outline-none flex-shrink-0"
            style={{ borderColor: t.borderLight, backgroundColor: hexAlpha(project.color, 0.08), color: project.color, fontWeight: 600, fontSize: 11 }}
          >
            <option value="active">진행중</option>
            <option value="paused">일시중단</option>
            <option value="completed">완료</option>
          </select>
        </div>
      </div>

      <div className="px-4 lg:px-6 py-5 space-y-5">
        {/* Stats Row + 🎯 Goal */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>진행률</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: project.color, marginTop: 4 }}>{progress}%</p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: t.bgSub }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color }} />
              </div>
            </div>
            <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>할 일</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: t.text, marginTop: 4 }}>
                {doneTodos.length}<span style={{ fontSize: 14, color: t.textMuted, fontWeight: 400 }}>/{projectTodos.length}</span>
              </p>
              <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>완료</p>
            </div>
            <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <p style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>마감</p>
              {daysLeft !== null ? (
                <>
                  <p style={{
                    fontSize: 26, fontWeight: 700,
                    color: daysLeft < 0 ? t.danger : daysLeft < 7 ? t.danger : t.text,
                    marginTop: 4,
                  }}>
                    {daysLeft < 0 ? '초과' : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
                  </p>
                  <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                    {project.endDate ? format(parseISO(project.endDate), 'M월 d일', { locale: ko }) : ''}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 14, color: t.textMuted, marginTop: 8 }}>미정</p>
              )}
            </div>
          </div>
          <div><GoalLinkEditor project={project} /></div>
        </div>

        {/* Mobile tabs */}
        <div className="lg:hidden flex gap-1.5 rounded-xl p-1" style={{ backgroundColor: t.bgSub }}>
          {(['milestones', 'todos'] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="flex-1 py-2 rounded-lg"
              style={{
                fontSize: 13, fontWeight: 600,
                backgroundColor: tab === k ? t.card : 'transparent',
                color: tab === k ? t.text : t.textMuted,
                boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {k === 'milestones' ? `마일스톤 ${projectMilestones.length}` : `할일 ${projectTodos.length}`}
            </button>
          ))}
        </div>

        {/* PC 2-col / Mobile single (tab) */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Milestones panel */}
          <div className={tab === 'milestones' ? '' : 'hidden lg:block'}>
            <div className="rounded-2xl p-5" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flag size={14} color={project.color} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>마일스톤</span>
                  <span className="px-1.5 py-0.5 rounded-full" style={{
                    fontSize: 10, backgroundColor: hexAlpha(project.color, 0.12), color: project.color, fontWeight: 600,
                  }}>
                    {projectMilestones.filter(m => m.done || milestoneProgress(m.id, todos).pct === 100).length}/{projectMilestones.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowAddMilestone(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                  style={{ backgroundColor: t.bgSub, color: t.accent, fontSize: 12 }}
                >
                  <Plus size={11} /> 추가
                </button>
              </div>

              {/* Add form */}
              {showAddMilestone && (
                <form onSubmit={handleAddMilestone} className="mb-3 p-3 rounded-xl space-y-2" style={{ backgroundColor: t.bgSub }}>
                  <input
                    autoFocus value={newMilestoneTitle}
                    onChange={e => setNewMilestoneTitle(e.target.value)}
                    placeholder="마일스톤 제목"
                    className="w-full rounded-lg px-3 py-2 border outline-none"
                    style={{ borderColor: t.borderLight, fontSize: 13, backgroundColor: t.card, color: t.text }}
                  />
                  <div className="flex gap-2">
                    <input type="date" value={newMilestoneDate}
                      onChange={e => setNewMilestoneDate(e.target.value)}
                      className="flex-1 rounded-lg px-3 py-2 border outline-none"
                      style={{ borderColor: t.borderLight, fontSize: 13, backgroundColor: t.card, color: t.text }}
                    />
                    <button type="submit" className="px-3 py-2 rounded-lg"
                      style={{ backgroundColor: project.color, color: '#fff', fontSize: 12, fontWeight: 600 }}>추가</button>
                    <button type="button" onClick={() => setShowAddMilestone(false)} className="px-3 py-2 rounded-lg"
                      style={{ backgroundColor: t.card, color: t.textMuted, fontSize: 12 }}>취소</button>
                  </div>
                </form>
              )}

              {/* Milestone cards (각자 자체 진행률·todos inline) */}
              <div className="space-y-3">
                {projectMilestones.map(m => (
                  <MilestoneCard key={m.id} milestone={m} projectId={id!} projectColor={project.color} />
                ))}
                {projectMilestones.length === 0 && !showAddMilestone && (
                  <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', padding: '8px 0' }}>
                    마일스톤을 추가해 진행 상황을 추적하세요
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Todos panel */}
          <div className={tab === 'todos' ? '' : 'hidden lg:block'}>
            <div className="rounded-2xl p-5" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} color={project.color} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>할 일</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: t.borderLight }}>
                    {(['all', 'active', 'done'] as const).map(f => (
                      <button key={f} onClick={() => setStatusFilter(f)} className="px-2.5 py-1"
                        style={{
                          fontSize: 11,
                          backgroundColor: statusFilter === f ? t.text : t.card,
                          color: statusFilter === f ? t.card : t.textMuted,
                          fontWeight: statusFilter === f ? 600 : 400,
                        }}
                      >
                        {f === 'all' ? '전체' : f === 'active' ? '진행' : '완료'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setAddingTodoForProject(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: t.bgSub, color: t.accent, fontSize: 12 }}
                  >
                    <Plus size={11} /> 추가
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredTodos.map(td => (
                  <ProjectTodoRow
                    key={td.id} todo={td} projectColor={project.color}
                    milestones={projectMilestones}
                    onEdit={() => setEditingTodo(td)}
                  />
                ))}
                {filteredTodos.length === 0 && (
                  <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', padding: '12px 0' }}>
                    {statusFilter === 'done' ? '완료된 할 일이 없어요' : '할 일을 추가해 보세요'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2"
            style={{ color: t.danger, fontSize: 13 }}
          >
            <Trash2 size={13} />
            프로젝트 삭제
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          message={`'${project.name}' 프로젝트를 삭제할까요?`}
          description="삭제하면 복구할 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={() => { deleteProject(project.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {editingTodo && (
        <TodoModal todo={editingTodo} onClose={() => setEditingTodo(null)} />
      )}
      {addingTodoForProject && (
        <TodoModal
          initialProjectId={id}
          onClose={() => setAddingTodoForProject(false)}
        />
      )}
    </div>
  );
}
