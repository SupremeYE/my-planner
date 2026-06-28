import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BookOpenCheck, Plus, Trash2, Edit2, Check, X, ChevronLeft, ScrollText } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { getLogicalToday } from '../store';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// ── 타입 ─────────────────────────────────────────────────────────────────────
interface Question {
  id: string;
  content: string;
  is_custom: boolean;
  created_at: string;
}

interface QuestionAnswer {
  id: string;
  question_id: string;
  answer: string;
  answered_at: string;
}

// ── 질문별 모아보기 패널 ───────────────────────────────────────────────────────
function HistoryPanel({
  question,
  onClose,
}: {
  question: Question;
  onClose: () => void;
}) {
  const { t } = useTheme();
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnswers = useCallback(() => {
    setLoading(true);
    db.questionAnswers.fetchByQuestionId(question.id).then(data => {
      setAnswers(data);
      setLoading(false);
    });
  }, [question.id]);

  useEffect(() => { loadAnswers(); }, [loadAnswers]);
  useRealtimeSync('question_answers', loadAnswers);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 연도별로 그루핑
  const byYear = answers.reduce<Record<string, QuestionAnswer[]>>((acc, a) => {
    const year = a.answered_at.slice(0, 4);
    (acc[year] ??= []).push(a);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

  return (
    // 오버레이 — 배경 클릭 시 닫힘
    <div
      className="fixed inset-0 z-40 flex items-end lg:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={onClose}
    >
      {/* 패널 — 모바일: 화면 하단 90% 슬라이드업 / PC: 중앙 모달 */}
      <div
        className="relative w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
        style={{
          background: t.background,
          maxHeight: '90dvh',
          height: '90dvh',
          // PC에서는 높이 제한
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex-none px-5 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          {/* 드래그 핸들 (모바일) */}
          <div className="flex justify-center mb-3 lg:hidden">
            <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
          </div>

          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              className="flex-none p-1.5 rounded-lg mt-0.5"
              style={{ color: t.subtleText }}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold mb-1" style={{ color: t.gold }}>
                질문별 모아보기
              </p>
              <p className="text-base font-semibold leading-snug" style={{ color: t.text }}>
                {question.content}
              </p>
            </div>
          </div>

          {answers.length > 0 && (
            <p className="text-xs mt-3 ml-9" style={{ color: t.subtleText }}>
              총 {answers.length}번 답했어요
            </p>
          )}
        </div>

        {/* 내용 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: t.subtleText }}>
              불러오는 중...
            </div>
          ) : answers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: t.subtleText }}>
              <ScrollText size={36} strokeWidth={1.5} />
              <p className="text-sm text-center">아직 이 질문에 답한 기록이 없어요</p>
              <p className="text-xs text-center opacity-70">오늘의 질문으로 배정되면<br />답변이 여기에 쌓여요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {years.map(year => (
                <section key={year}>
                  {/* 연도 구분선 */}
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="text-xs font-bold tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: t.gold, color: '#fff' }}
                    >
                      {year}
                    </span>
                    <div className="flex-1 h-px" style={{ background: t.border }} />
                  </div>

                  <ul className="flex flex-col gap-3">
                    {byYear[year].map((a, idx) => (
                      <AnswerCard key={a.id} answer={a} isFirst={idx === 0 && year === years[0]} t={t} />
                    ))}
                  </ul>
                </section>
              ))}

              {/* 하단 여백 */}
              <div className="h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnswerCard({
  answer,
  isFirst,
  t,
}: {
  answer: QuestionAnswer;
  isFirst: boolean;
  t: ReturnType<typeof useTheme>['t'];
}) {
  const date = parseISO(answer.answered_at);
  const dayLabel = format(date, 'M월 d일 (EEE)', { locale: ko });

  return (
    <li
      className="rounded-2xl p-4 flex flex-col gap-2 relative"
      style={{
        background: t.card,
        borderLeft: isFirst ? `3px solid ${t.gold}` : `3px solid ${t.border}`,
      }}
    >
      {isFirst && (
        <span
          className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: t.gold + '22', color: t.gold }}
        >
          최신
        </span>
      )}
      <p className="text-xs font-semibold" style={{ color: t.subtleText }}>
        {dayLabel}
      </p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
        {answer.answer}
      </p>
    </li>
  );
}

// ── 오늘 질문 탭 ──────────────────────────────────────────────────────────────
function TodayTab() {
  const { t } = useTheme();
  const today = getLogicalToday();

  const [question, setQuestion]       = useState<Question | null>(null);
  const [answer, setAnswer]           = useState('');
  const [savedAnswer, setSavedAnswer] = useState<QuestionAnswer | null>(null);
  const [isEditing, setIsEditing]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let dq = await db.dailyQuestion.fetchByDate(today);
      if (!dq) {
        const qid = await db.dailyQuestion.assignRandom(today);
        if (qid) dq = { id: '', question_id: qid, date: today };
      }
      if (!dq) { setLoading(false); return; }

      const pool = await db.questionPool.fetchAll();
      setQuestion(pool.find(p => p.id === dq!.question_id) ?? null);

      const existing = await db.questionAnswers.fetchByDate(today);
      if (existing) {
        setSavedAnswer(existing);
        setAnswer(existing.answer);
        setIsEditing(false);
      } else {
        setSavedAnswer(null);
        setAnswer('');
        setIsEditing(true);
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync('daily_question', load);
  useRealtimeSync('question_answers', load);

  const handleSave = async () => {
    if (!question || !answer.trim()) return;
    setSaving(true);
    await db.questionAnswers.upsertByDate(question.id, answer.trim(), today);
    await load();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm" style={{ color: t.subtleText }}>
        질문을 불러오는 중...
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: t.subtleText }}>
        <BookOpenCheck size={40} strokeWidth={1.5} />
        <p className="text-sm">질문 탐색 탭에서 질문을 추가하면 오늘의 질문이 배정됩니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs font-medium" style={{ color: t.subtleText }}>
        {format(new Date(), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
      </p>

      {/* 질문 카드 */}
      <div
        className="rounded-2xl p-6 shadow-sm"
        style={{ background: t.card, borderLeft: `4px solid ${t.gold}` }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: t.gold }}>
          오늘의 질문
        </p>
        <p className="text-xl font-semibold leading-relaxed" style={{ color: t.text }}>
          {question.content}
        </p>
      </div>

      {/* 답변 영역 */}
      {savedAnswer && !isEditing ? (
        <div className="rounded-2xl p-5 shadow-sm relative" style={{ background: t.card }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
            {savedAnswer.answer}
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
            style={{ color: t.subtleText }}
            title="수정"
          >
            <Edit2 size={15} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            className="w-full rounded-2xl p-4 text-sm resize-none outline-none leading-relaxed"
            style={{
              background: t.card,
              color: t.text,
              border: `1.5px solid ${t.border}`,
              minHeight: 140,
            }}
            placeholder="오늘의 질문에 솔직하게 답해보세요..."
            value={answer}
            onChange={e => setAnswer(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            {savedAnswer && (
              <button
                onClick={() => { setAnswer(savedAnswer.answer); setIsEditing(false); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm"
                style={{ color: t.subtleText, background: t.background }}
              >
                <X size={14} /> 취소
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !answer.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: t.gold, color: '#fff' }}
            >
              <Check size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 질문 탐색 탭 ──────────────────────────────────────────────────────────────
function ExploreTab({ onViewHistory }: { onViewHistory: (q: Question) => void }) {
  const { t } = useTheme();
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadQuestions = useCallback(() => {
    db.questionPool.fetchAll().then(setQuestions);
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useRealtimeSync('question_pool', loadQuestions);

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setAdding(true);
    await db.questionPool.create(newContent.trim());
    setNewContent('');
    loadQuestions();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await db.questionPool.delete(id);
    loadQuestions();
    setDeletingId(null);
  };

  const builtIn = questions.filter(q => !q.is_custom);
  const customs = questions.filter(q => q.is_custom);

  return (
    <div className="flex flex-col gap-6">
      {/* 커스텀 질문 추가 */}
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: t.card }}>
        <p className="text-xs font-semibold mb-2" style={{ color: t.subtleText }}>나만의 질문 추가</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: t.background, color: t.text, border: `1.5px solid ${t.border}` }}
            placeholder="질문을 입력하세요..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newContent.trim()}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: t.gold, color: '#fff' }}
          >
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>

      {/* 커스텀 질문 목록 */}
      {customs.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-2 px-1" style={{ color: t.subtleText }}>나만의 질문</p>
          <ul className="flex flex-col gap-2">
            {customs.map(q => (
              <QuestionItem
                key={q.id}
                question={q}
                onDelete={() => handleDelete(q.id)}
                isDeleting={deletingId === q.id}
                onViewHistory={() => onViewHistory(q)}
                t={t}
              />
            ))}
          </ul>
        </section>
      )}

      {/* 내장 질문 목록 */}
      {builtIn.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-2 px-1" style={{ color: t.subtleText }}>기본 질문 ({builtIn.length}개)</p>
          <ul className="flex flex-col gap-2">
            {builtIn.map(q => (
              <QuestionItem
                key={q.id}
                question={q}
                onDelete={undefined}
                isDeleting={false}
                onViewHistory={() => onViewHistory(q)}
                t={t}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QuestionItem({
  question,
  onDelete,
  isDeleting,
  onViewHistory,
  t,
}: {
  question: Question;
  onDelete?: () => void;
  isDeleting: boolean;
  onViewHistory: () => void;
  t: ReturnType<typeof useTheme>['t'];
}) {
  return (
    <li
      className="flex items-start gap-3 rounded-xl px-4 py-3 group"
      style={{ background: t.card }}
    >
      <span className="text-lg leading-none mt-0.5 flex-none">
        {question.is_custom ? '✏️' : '💬'}
      </span>
      <p className="flex-1 text-sm leading-relaxed" style={{ color: t.text }}>
        {question.content}
      </p>
      <div className="flex items-center gap-1 flex-none">
        {/* 기록 보기 버튼 — 항상 표시 */}
        <button
          onClick={onViewHistory}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ background: t.background, color: t.subtleText }}
          title="기록 보기"
        >
          <ScrollText size={12} />
          <span>기록</span>
        </button>
        {/* 삭제 버튼 — hover 시 표시 */}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
            style={{ color: t.subtleText }}
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </li>
  );
}

// ── 메인 뷰 ──────────────────────────────────────────────────────────────────
export function QuestionJournalView() {
  const { t } = useTheme();
  const [tab, setTab]                     = useState<'today' | 'explore'>('today');
  const [historyQuestion, setHistoryQuestion] = useState<Question | null>(null);

  return (
    <div className="min-h-screen p-4 lg:p-6" style={{ background: t.background }}>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: t.text, fontFamily: 'var(--font-gmarket)' }}>질문일기</h1>
        <p className="text-sm mt-1" style={{ color: t.subtleText }}>
          매일 한 가지 질문으로 나 자신을 깊이 들여다보세요
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6">
        {([
          { key: 'today',   label: '오늘의 질문' },
          { key: 'explore', label: '질문 탐색' },
        ] as const).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={
              tab === item.key
                ? { background: t.gold, color: '#fff' }
                : { background: t.card, color: t.subtleText }
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'today'   && <TodayTab />}
      {tab === 'explore' && (
        <ExploreTab onViewHistory={q => setHistoryQuestion(q)} />
      )}

      {/* 모아보기 패널 */}
      {historyQuestion && (
        <HistoryPanel
          question={historyQuestion}
          onClose={() => setHistoryQuestion(null)}
        />
      )}
    </div>
  );
}
