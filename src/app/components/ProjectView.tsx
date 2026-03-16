import { useState } from 'react';
import { useParams, NavLink } from 'react-router';
import {
  Plus, ChevronLeft, CheckCircle2, Flag, Trash2,
  Calendar, Clock, FolderKanban, MoreHorizontal, X,
  TrendingUp, Circle,
} from 'lucide-react';
import { usePlanner, Project, Milestone, Todo } from '../store';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';

// ── Project color palette ──
export const PROJECT_COLORS = [
  '#5B8FE0', '#E05C7B', '#5BC8AF', '#A07BE0',
  '#E0A05B', '#C8A97E', '#E05C5C', '#5BB8E0',
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
      <div className="rounded-2xl p-6 shadow-2xl w-[420px] max-w-[90vw]" style={{ backgroundColor: '#FAF8F5', border: '1px solid #E8E0D4' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#2D2D2D' }}>새 프로젝트</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F0EBE3]">
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
              style={{ borderColor: '#E8E0D4', fontSize: 14, backgroundColor: '#fff', color: '#2D2D2D' }}
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
              style={{ borderColor: '#E8E0D4', fontSize: 13, backgroundColor: '#fff', color: '#2D2D2D' }}
            />
          </div>
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ borderColor: '#E8E0D4', fontSize: 13, backgroundColor: '#fff', color: '#2D2D2D' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>마감일</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border outline-none"
                style={{ borderColor: '#E8E0D4', fontSize: 13, backgroundColor: '#fff', color: '#2D2D2D' }} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl"
              style={{ backgroundColor: '#F0EBE3', color: '#888', fontSize: 14 }}>취소</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl"
              style={{ backgroundColor: '#C8A97E', color: '#fff', fontSize: 14, fontWeight: 600 }}>만들기</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Project Card (in list) ──
function ProjectCard({ project }: { project: Project }) {
  const { todos, milestones } = usePlanner();
  const projectTodos = todos.filter(t => t.projectId === project.id && t.status !== 'cancelled');
  const doneTodos = projectTodos.filter(t => t.status === 'done');
  const progress = projectTodos.length ? Math.round((doneTodos.length / projectTodos.length) * 100) : 0;
  const projectMilestones = milestones.filter(m => m.projectId === project.id);
  const nextMilestone = projectMilestones.find(m => !m.done);
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;

  return (
    <NavLink
      to={`/projects/${project.id}`}
      className="block rounded-2xl p-5 transition-all hover:shadow-md"
      style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: hexAlpha(project.color, 0.15) }}>
            <FolderKanban size={20} color={project.color} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D2D2D' }}>{project.name}</div>
            {project.description && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{project.description}</div>
            )}
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: hexAlpha(project.color, 0.12), color: project.color, fontWeight: 600 }}>
          {project.status === 'active' ? '진행중' : project.status === 'completed' ? '완료' : '일시중단'}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span style={{ fontSize: 11, color: '#888' }}>{doneTodos.length}/{projectTodos.length} 완료</span>
          <span style={{ fontSize: 12, color: project.color, fontWeight: 700 }}>{progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F0EBE3' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: project.color }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {nextMilestone ? (
          <div className="flex items-center gap-1.5">
            <Flag size={11} color={project.color} />
            <span style={{ fontSize: 11, color: '#888' }}>다음: {nextMilestone.title}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: '#ccc' }}>마일스톤 없음</span>
        )}
        {daysLeft !== null && (
          <span style={{ fontSize: 11, color: daysLeft < 7 ? '#E05C5C' : '#aaa', fontWeight: daysLeft < 7 ? 600 : 400 }}>
            {daysLeft < 0 ? '마감 초과' : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
          </span>
        )}
      </div>
    </NavLink>
  );
}

// ── Project List Page ──
export function ProjectsView() {
  const { projects, addProject } = usePlanner();
  const [showNewModal, setShowNewModal] = useState(false);

  const activeProjects = projects.filter(p => p.status === 'active');
  const otherProjects = projects.filter(p => p.status !== 'active');

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #F0EBE3' }}>
        <div className="flex items-center gap-3">
          <FolderKanban size={20} color="#C8A97E" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2D2D2D' }}>프로젝트</h1>
            <p style={{ fontSize: 12, color: '#aaa' }}>총 {projects.length}개의 프로젝트</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ backgroundColor: '#C8A97E', color: '#fff', fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={14} />
          새 프로젝트
        </button>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Active Projects */}
        {activeProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={13} color="#C8A97E" />
              <span style={{ fontSize: 11, color: '#C8A97E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                진행 중 ({activeProjects.length})
              </span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {/* Other Projects */}
        {otherProjects.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Circle size={13} color="#aaa" />
              <span style={{ fontSize: 11, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                기타 ({otherProjects.length})
              </span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {otherProjects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban size={40} color="#E8E0D4" />
            <p style={{ fontSize: 15, color: '#aaa', marginTop: 12 }}>아직 프로젝트가 없어요</p>
            <p style={{ fontSize: 12, color: '#ccc', marginTop: 4 }}>새 프로젝트를 만들어 보세요</p>
            <button onClick={() => setShowNewModal(true)}
              className="mt-4 px-4 py-2 rounded-xl"
              style={{ backgroundColor: '#F0EBE3', color: '#C8A97E', fontSize: 13, fontWeight: 600 }}>
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

// ── Milestone Item ──
function MilestoneItem({ milestone }: { milestone: Milestone }) {
  const { toggleMilestone, deleteMilestone } = usePlanner();
  const isPast = differenceInDays(new Date(), parseISO(milestone.date)) > 0;

  return (
    <div className="flex items-center gap-3 group">
      <button onClick={() => toggleMilestone(milestone.id)} className="flex-shrink-0">
        <Flag size={14} color={milestone.done ? '#C8A97E' : isPast ? '#E05C5C' : '#ddd'}
          fill={milestone.done ? '#C8A97E' : 'none'} />
      </button>
      <div className="flex-1 min-w-0">
        <span style={{
          fontSize: 13, color: milestone.done ? '#aaa' : '#2D2D2D',
          textDecoration: milestone.done ? 'line-through' : 'none',
        }}>
          {milestone.title}
        </span>
        <span style={{ fontSize: 11, color: isPast && !milestone.done ? '#E05C5C' : '#aaa', marginLeft: 8 }}>
          {format(parseISO(milestone.date), 'M월 d일', { locale: ko })}
        </span>
      </div>
      <button onClick={() => deleteMilestone(milestone.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#F0EBE3] transition-opacity">
        <Trash2 size={11} color="#ccc" />
      </button>
    </div>
  );
}

// ── Project Task Item ──
function ProjectTodoItem({ todo, projectColor }: { todo: Todo; projectColor: string }) {
  const { updateTodo, deleteTodo } = usePlanner();

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl group"
      style={{ backgroundColor: todo.status === 'done' ? '#FAF8F5' : '#fff', border: '1px solid #F0EBE3' }}>
      <button
        onClick={() => updateTodo(todo.id, { status: todo.status === 'done' ? 'active' : 'done' })}
        className="flex-shrink-0 mt-0.5"
      >
        <CheckCircle2 size={17} color={todo.status === 'done' ? projectColor : '#ddd'}
          fill={todo.status === 'done' ? projectColor : 'none'} />
      </button>
      <div className="flex-1 min-w-0">
        <p style={{
          fontSize: 13, color: '#2D2D2D',
          textDecoration: todo.status === 'done' ? 'line-through' : 'none',
          opacity: todo.status === 'done' ? 0.6 : 1,
        }}>
          {todo.text}
        </p>
        {(todo.planStart || todo.date) && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {todo.date && (
              <span className="flex items-center gap-1" style={{ fontSize: 10, color: '#aaa' }}>
                <Calendar size={9} color="#ccc" />
                {format(parseISO(todo.date), 'M/d', { locale: ko })}
              </span>
            )}
            {todo.planStart && (
              <span className="flex items-center gap-1" style={{ fontSize: 10, color: '#aaa' }}>
                <Clock size={9} color="#ccc" />
                {todo.planStart}–{todo.planEnd}
              </span>
            )}
          </div>
        )}
      </div>
      <button onClick={() => deleteTodo(todo.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#F0EBE3] transition-opacity flex-shrink-0">
        <Trash2 size={12} color="#ccc" />
      </button>
    </div>
  );
}

// ── Project Detail Page ──
export function ProjectDetailView() {
  const { id } = useParams<{ id: string }>();
  const {
    projects, todos, milestones, updateProject, deleteProject,
    addTodo, addMilestone, selectedDate,
  } = usePlanner();

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'done'>('all');

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FolderKanban size={40} color="#E8E0D4" />
          <p style={{ fontSize: 15, color: '#aaa', marginTop: 12 }}>프로젝트를 찾을 수 없어요</p>
          <NavLink to="/projects" className="mt-3 inline-block px-4 py-2 rounded-xl"
            style={{ backgroundColor: '#F0EBE3', color: '#C8A97E', fontSize: 13, fontWeight: 600 }}>
            목록으로
          </NavLink>
        </div>
      </div>
    );
  }

  const projectTodos = todos.filter(t => t.projectId === id && t.status !== 'cancelled');
  const filteredTodos = projectTodos.filter(t => {
    if (statusFilter === 'active') return t.status === 'active';
    if (statusFilter === 'done') return t.status === 'done';
    return true;
  });
  const doneTodos = projectTodos.filter(t => t.status === 'done');
  const progress = projectTodos.length ? Math.round((doneTodos.length / projectTodos.length) * 100) : 0;
  const projectMilestones = milestones.filter(m => m.projectId === id).sort((a, b) => a.date.localeCompare(b.date));

  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    addTodo({ text: newTaskText.trim(), date: selectedDate, status: 'active', isTop3: false, projectId: id });
    setNewTaskText('');
    setShowAddTask(false);
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim() || !newMilestoneDate) return;
    addMilestone({ projectId: id!, title: newMilestoneTitle.trim(), date: newMilestoneDate, done: false });
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
    setShowAddMilestone(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-4"
        style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #F0EBE3' }}>
        <div className="flex items-center gap-3 mb-1">
          <NavLink to="/projects" className="p-1.5 rounded-lg hover:bg-[#F0EBE3] transition-colors">
            <ChevronLeft size={16} color="#888" />
          </NavLink>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: hexAlpha(project.color, 0.15) }}>
            <FolderKanban size={16} color={project.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#2D2D2D' }}>{project.name}</h1>
            {project.description && (
              <p style={{ fontSize: 12, color: '#888' }}>{project.description}</p>
            )}
          </div>
          {/* Status selector */}
          <select
            value={project.status}
            onChange={e => updateProject(project.id, { status: e.target.value as Project['status'] })}
            className="px-3 py-1.5 rounded-lg border outline-none text-xs"
            style={{ borderColor: '#E8E0D4', backgroundColor: hexAlpha(project.color, 0.08), color: project.color, fontWeight: 600 }}
          >
            <option value="active">진행중</option>
            <option value="paused">일시중단</option>
            <option value="completed">완료</option>
          </select>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>진행률</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: project.color, marginTop: 4 }}>{progress}%</p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F0EBE3' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: project.color }} />
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>할 일</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#2D2D2D', marginTop: 4 }}>
              {doneTodos.length}<span style={{ fontSize: 14, color: '#aaa', fontWeight: 400 }}>/{projectTodos.length}</span>
            </p>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>완료</p>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}>
            <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>마감</p>
            {daysLeft !== null ? (
              <>
                <p style={{ fontSize: 28, fontWeight: 700, color: daysLeft < 7 ? '#E05C5C' : '#2D2D2D', marginTop: 4 }}>
                  {daysLeft < 0 ? '초과' : daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`}
                </p>
                <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                  {project.endDate ? format(parseISO(project.endDate), 'M월 d일', { locale: ko }) : ''}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: '#ccc', marginTop: 8 }}>미정</p>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flag size={14} color={project.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2D2D2D' }}>마일스톤</span>
              <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: hexAlpha(project.color, 0.12), color: project.color, fontWeight: 600 }}>
                {projectMilestones.filter(m => m.done).length}/{projectMilestones.length}
              </span>
            </div>
            <button
              onClick={() => setShowAddMilestone(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: '#F0EBE3', color: '#C8A97E', fontSize: 12 }}
            >
              <Plus size={11} /> 추가
            </button>
          </div>

          {/* Milestone timeline */}
          {projectMilestones.length > 0 && (
            <div className="relative mb-3">
              {/* Track */}
              <div className="flex items-center gap-0 mb-3">
                {projectMilestones.map((m, i) => (
                  <div key={m.id} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-3 h-3 rounded-full border-2"
                        style={{
                          backgroundColor: m.done ? project.color : '#fff',
                          borderColor: m.done ? project.color : '#E8E0D4',
                        }} />
                      <span style={{ fontSize: 9, color: '#aaa', marginTop: 2, whiteSpace: 'nowrap', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                        {m.title.length > 6 ? m.title.slice(0, 6) + '…' : m.title}
                      </span>
                    </div>
                    {i < projectMilestones.length - 1 && (
                      <div className="flex-1 h-0.5 mx-1"
                        style={{ backgroundColor: m.done ? project.color : '#E8E0D4' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {projectMilestones.map(m => <MilestoneItem key={m.id} milestone={m} />)}
            {projectMilestones.length === 0 && !showAddMilestone && (
              <p style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '8px 0' }}>마일스톤을 추가해 진행 상황을 추적하세요</p>
            )}
          </div>

          {showAddMilestone && (
            <form onSubmit={handleAddMilestone} className="mt-3 p-3 rounded-xl space-y-2" style={{ backgroundColor: '#FAF8F5' }}>
              <input
                autoFocus
                value={newMilestoneTitle}
                onChange={e => setNewMilestoneTitle(e.target.value)}
                placeholder="마일스톤 제목"
                className="w-full rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: '#E8E0D4', fontSize: 13, backgroundColor: '#fff', color: '#2D2D2D' }}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newMilestoneDate}
                  onChange={e => setNewMilestoneDate(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 border outline-none"
                  style={{ borderColor: '#E8E0D4', fontSize: 13, backgroundColor: '#fff', color: '#2D2D2D' }}
                />
                <button type="submit" className="px-3 py-2 rounded-lg"
                  style={{ backgroundColor: project.color, color: '#fff', fontSize: 12, fontWeight: 600 }}>추가</button>
                <button type="button" onClick={() => setShowAddMilestone(false)} className="px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#F0EBE3', color: '#888', fontSize: 12 }}>취소</button>
              </div>
            </form>
          )}
        </div>

        {/* Task List */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} color={project.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2D2D2D' }}>할 일</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter */}
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#E8E0D4' }}>
                {(['all', 'active', 'done'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className="px-2.5 py-1"
                    style={{
                      fontSize: 11,
                      backgroundColor: statusFilter === f ? '#2D2D2D' : '#fff',
                      color: statusFilter === f ? '#fff' : '#888',
                      fontWeight: statusFilter === f ? 600 : 400,
                    }}
                  >
                    {f === 'all' ? '전체' : f === 'active' ? '진행' : '완료'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAddTask(v => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: '#F0EBE3', color: '#C8A97E', fontSize: 12 }}
              >
                <Plus size={11} /> 추가
              </button>
            </div>
          </div>

          {showAddTask && (
            <form onSubmit={handleAddTask} className="mb-3 flex gap-2">
              <input
                autoFocus
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                placeholder="할 일 입력..."
                className="flex-1 rounded-xl px-3 py-2 border outline-none"
                style={{ borderColor: '#E8E0D4', fontSize: 13, backgroundColor: '#FAF8F5', color: '#2D2D2D' }}
              />
              <button type="submit" className="px-3 py-2 rounded-xl"
                style={{ backgroundColor: project.color, color: '#fff', fontSize: 12, fontWeight: 600 }}>추가</button>
              <button type="button" onClick={() => setShowAddTask(false)} className="px-3 py-2 rounded-xl"
                style={{ backgroundColor: '#F0EBE3', color: '#888', fontSize: 12 }}>취소</button>
            </form>
          )}

          <div className="space-y-2">
            {filteredTodos.map(todo => (
              <ProjectTodoItem key={todo.id} todo={todo} projectColor={project.color} />
            ))}
            {filteredTodos.length === 0 && (
              <p style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '12px 0' }}>
                {statusFilter === 'done' ? '완료된 할 일이 없어요' : '할 일을 추가해 보세요'}
              </p>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1px solid #F0EBE3' }}>
          <button
            onClick={() => {
              if (window.confirm(`'${project.name}' 프로젝트를 삭제하시겠어요?`)) {
                deleteProject(project.id);
              }
            }}
            className="flex items-center gap-2 text-sm"
            style={{ color: '#E05C5C' }}
          >
            <Trash2 size={13} />
            프로젝트 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
