import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, X, ExternalLink, Youtube, Instagram, MessageCircle, Globe,
  Trash2, Plus, Sparkles, CheckSquare, BookOpen,
} from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { Scrap, ScrapNote, ScrapSource, ScrapStatus } from '../../store';
import MindmapTab from './MindmapTab';

// 토큰 hex → rgba (다른 모달과 동일 패턴)
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SOURCE_META: Record<ScrapSource, { label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  youtube:   { label: '유튜브', Icon: Youtube },
  instagram: { label: '인스타', Icon: Instagram },
  threads:   { label: '스레드', Icon: MessageCircle },
  web:       { label: '웹',     Icon: Globe },
};

const STATUS_OPTIONS: { value: ScrapStatus; label: string }[] = [
  { value: 'unread',  label: '미확인' },
  { value: 'revisit', label: '다시봄' },
  { value: 'done',    label: '소화완료' },
];

// 노트 타임라인 그룹용 — 'YYYY-MM-DD' → 한국어 라벨
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${wd})`;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  scrap: Scrap;
  onClose: () => void;
  onChanged: () => void; // 그리드 즉시 반영 트리거 (상태/코멘트/태그 갱신용)
  onNavigateScrap?: (scrapId: string) => void; // 마인드맵 칩 → 다른 스크랩 상세로 이동
}

export default function ScrapDetailSheet({ scrap: initialScrap, onClose, onChanged, onNavigateScrap }: Props) {
  const { t } = useTheme();

  // 로컬 사본 — 낙관적 업데이트로 즉시 반영, 백그라운드 저장
  const [scrap, setScrap] = useState<Scrap>(initialScrap);

  // 노트 상태
  const [notes, setNotes] = useState<ScrapNote[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [adding, setAdding] = useState(false);

  // 코멘트·태그 편집 — 인라인 편집 모드
  const [editingComment, setEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(scrap.comment ?? '');
  const [tagDraft, setTagDraft] = useState('');

  // 본문 탭 — 글 기록 / 마인드맵
  const [activeTab, setActiveTab] = useState<'notes' | 'mindmap'>('notes');

  // 진입 애니메이션
  const [isIn, setIsIn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setIsIn(true)); }, []);
  const handleClose = useCallback(() => { setIsIn(false); setTimeout(onClose, 220); }, [onClose]);

  // ESC 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // 시트 열릴 때 — last_viewed_at 갱신 (Stage 3 먼지 로직용)
  const touchedRef = useRef(false);
  useEffect(() => {
    if (touchedRef.current) return;
    touchedRef.current = true;
    db.scraps.touchViewed(initialScrap.id).then(onChanged);
  }, [initialScrap.id, onChanged]);

  // 노트 로드
  const refreshNotes = useCallback(async () => {
    const list = await db.scrapNotes.listByScrap(initialScrap.id);
    setNotes(list);
  }, [initialScrap.id]);
  useEffect(() => { refreshNotes(); }, [refreshNotes]);

  // Realtime — 시트 열려 있는 동안만 scrap_notes 구독
  useRealtimeSync('scrap_notes', refreshNotes);

  // 상태 전환 — 낙관적 + DB
  const handleStatusChange = async (next: ScrapStatus) => {
    if (next === scrap.status) return;
    setScrap(s => ({ ...s, status: next }));
    await db.scraps.updateStatus(initialScrap.id, next);
    onChanged();
  };

  // 노트 추가 — 추가 시 status='done' 자동 승격
  const handleAddNote = async () => {
    const content = noteInput.trim();
    if (!content || adding) return;
    setAdding(true);
    try {
      const created = await db.scrapNotes.create({ scrapId: initialScrap.id, content });
      if (created) {
        setNotes(prev => [...prev, created]);
        setNoteInput('');
        // 자동 승격 — 이미 done 이면 건너뜀
        if (scrap.status !== 'done') {
          setScrap(s => ({ ...s, status: 'done' }));
          await db.scraps.updateStatus(initialScrap.id, 'done');
          onChanged();
        }
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await db.scrapNotes.delete(id);
  };

  // 코멘트 저장
  const handleSaveComment = async () => {
    const next = commentDraft.trim() || null;
    setScrap(s => ({ ...s, comment: next }));
    setEditingComment(false);
    await db.scraps.update(initialScrap.id, { comment: next });
    onChanged();
  };

  // 태그 추가/삭제
  const handleAddTag = async () => {
    const value = tagDraft.trim().replace(/^#/, '');
    if (!value) return;
    if (scrap.tags.includes(value)) {
      setTagDraft('');
      return;
    }
    const nextTags = [...scrap.tags, value];
    setScrap(s => ({ ...s, tags: nextTags }));
    setTagDraft('');
    await db.scraps.update(initialScrap.id, { tags: nextTags });
    onChanged();
  };
  const handleRemoveTag = async (tag: string) => {
    const nextTags = scrap.tags.filter(x => x !== tag);
    setScrap(s => ({ ...s, tags: nextTags }));
    await db.scraps.update(initialScrap.id, { tags: nextTags });
    onChanged();
  };

  // 노트 → 날짜별 그룹화 (시간순)
  const grouped = useMemo(() => {
    const map = new Map<string, ScrapNote[]>();
    for (const n of notes) {
      const k = dayKey(n.createdAt);
      const arr = map.get(k) ?? [];
      arr.push(n);
      map.set(k, arr);
    }
    return Array.from(map.entries()); // [['2026-06-07', [...]], ...]
  }, [notes]);

  const meta = scrap.source ? SOURCE_META[scrap.source] : SOURCE_META.web;
  const SourceIcon = meta.Icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch lg:items-center lg:justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', opacity: isIn ? 1 : 0, transition: 'opacity 0.22s ease' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex flex-col w-full lg:w-[560px] lg:max-h-[92vh] lg:rounded-2xl overflow-hidden"
        style={{
          backgroundColor: t.card,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          transform: isIn ? 'translateY(0)' : 'translateY(24px)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '92vh',
        }}
      >
        {/* ── 헤더 ── */}
        <div
          className="flex items-center justify-between px-4 lg:px-5 py-3 border-b flex-shrink-0"
          style={{ borderColor: t.border, paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <button onClick={handleClose} className="p-1.5 rounded-lg" aria-label="닫기">
            <ArrowLeft size={20} color={t.text} className="lg:hidden" />
            <X size={20} color={t.text} className="hidden lg:block" />
          </button>
          <div className="flex items-center gap-1.5" style={{ color: t.textSub }}>
            <SourceIcon size={13} color={t.textSub} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{meta.label}</span>
          </div>
          <div style={{ width: 30 }} />
        </div>

        {/* ── 본문 (스크롤) ── */}
        <div className="flex-1 overflow-y-auto">
          {/* 썸네일 */}
          {scrap.thumbnailUrl ? (
            <div style={{ backgroundColor: t.bgSub }}>
              <img
                src={scrap.thumbnailUrl}
                alt={scrap.title ?? ''}
                style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                aspectRatio: '16 / 9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${t.accentLight} 0%, ${withAlpha(t.accent, 0.2)} 100%)`,
              }}
            >
              <SourceIcon size={48} color={t.accent} />
            </div>
          )}

          <div className="px-5 pt-4 pb-6 space-y-5">
            {/* 원본 열기 */}
            {scrap.url && (
              <a
                href={scrap.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.accent,
                  padding: '6px 12px',
                  borderRadius: 999,
                  backgroundColor: t.accentLight,
                }}
              >
                <ExternalLink size={12} />
                원본 열기
              </a>
            )}

            {/* 제목 */}
            {scrap.title && (
              <h2
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 22,
                  lineHeight: 1.25,
                  color: t.text,
                  wordBreak: 'break-word',
                }}
              >
                {scrap.title}
              </h2>
            )}

            {/* 코멘트(손글씨) — 인라인 편집 */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: 0.3 }}>
                  한 줄 코멘트
                </span>
                {!editingComment && (
                  <button
                    onClick={() => { setCommentDraft(scrap.comment ?? ''); setEditingComment(true); }}
                    style={{ fontSize: 11, color: t.accent, fontWeight: 700 }}
                  >
                    {scrap.comment ? '수정' : '추가'}
                  </button>
                )}
              </div>
              {editingComment ? (
                <div>
                  <textarea
                    value={commentDraft}
                    onChange={e => setCommentDraft(e.target.value)}
                    rows={2}
                    maxLength={200}
                    autoFocus
                    placeholder="왜 저장했는지, 어떤 영감이었는지"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${t.border}`,
                      backgroundColor: t.bgSub,
                      color: t.text,
                      fontSize: 16,
                      fontFamily: 'var(--font-nanum-pen)',
                      lineHeight: 1.4,
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setCommentDraft(scrap.comment ?? ''); setEditingComment(false); }}
                      style={{ fontSize: 12, color: t.textSub, padding: '6px 10px' }}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveComment}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#fff',
                        backgroundColor: t.accent,
                        padding: '6px 14px',
                        borderRadius: 8,
                      }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : scrap.comment ? (
                <p
                  style={{
                    fontFamily: 'var(--font-nanum-pen)',
                    fontSize: 18,
                    lineHeight: 1.4,
                    color: t.textSub,
                    wordBreak: 'break-word',
                  }}
                >
                  {scrap.comment}
                </p>
              ) : (
                <p style={{ fontSize: 12, color: t.textMuted }}>
                  코멘트 없음
                </p>
              )}
            </div>

            {/* 태그 — 인라인 추가/삭제 */}
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: 0.3 }}>
                태그
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {scrap.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      color: t.textSub,
                      backgroundColor: t.bgSub,
                      padding: '4px 8px 4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${t.borderLight}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`${tag} 태그 삭제`}
                      style={{ color: t.textMuted, padding: 0, display: 'inline-flex' }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagDraft}
                  onChange={e => setTagDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  onBlur={() => { if (tagDraft.trim()) handleAddTag(); }}
                  placeholder="+ 태그"
                  style={{
                    fontSize: 11,
                    color: t.text,
                    backgroundColor: 'transparent',
                    border: `1px dashed ${t.borderLight}`,
                    borderRadius: 999,
                    padding: '4px 10px',
                    minWidth: 80,
                    maxWidth: 120,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* 상태 세그먼트 — 미확인/다시봄/소화완료 */}
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: 0.3 }}>
                상태
              </span>
              <div
                className="flex mt-2"
                style={{
                  backgroundColor: t.bgSub,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: 12,
                  padding: 3,
                  gap: 2,
                }}
              >
                {STATUS_OPTIONS.map(opt => {
                  const active = scrap.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '8px 0',
                        borderRadius: 9,
                        backgroundColor: active ? t.card : 'transparent',
                        color: active ? t.text : t.textSub,
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'background-color .15s ease, color .15s ease',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 탭 바: 글 기록 / 마인드맵 ── */}
            <div
              className="flex"
              style={{
                backgroundColor: t.bgSub,
                border: `1px solid ${t.borderLight}`,
                borderRadius: 12,
                padding: 3,
                gap: 2,
              }}
            >
              {([
                { value: 'notes' as const, label: '글 기록' },
                { value: 'mindmap' as const, label: '마인드맵' },
              ]).map(tab => {
                const active = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '8px 0',
                      borderRadius: 9,
                      backgroundColor: active ? t.card : 'transparent',
                      color: active ? t.text : t.textSub,
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'background-color .15s ease, color .15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'mindmap' ? (
              <MindmapTab scrapId={initialScrap.id} onNavigateScrap={onNavigateScrap} />
            ) : (
            <>
            {/* ── 노트 패널 (핵심) ── */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: 0.3 }}>
                  글 기록
                </span>
                <span style={{ fontSize: 11, color: t.textMuted }}>
                  {notes.length > 0 ? `${notes.length}개` : ''}
                </span>
              </div>

              {/* 입력 + 추가 버튼(초록) */}
              <div className="flex gap-2">
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="이 영감에 대해 떠오른 생각을 적어보세요"
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    backgroundColor: t.bgSub,
                    color: t.text,
                    fontSize: 16,
                    fontFamily: 'var(--font-nanum-pen)',
                    lineHeight: 1.4,
                    outline: 'none',
                    resize: 'none',
                  }}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteInput.trim() || adding}
                  style={{
                    backgroundColor: noteInput.trim() && !adding ? t.success : t.bgSub,
                    color: noteInput.trim() && !adding ? '#fff' : t.textMuted,
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: 'none',
                    minWidth: 76,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    flex: '0 0 auto',
                    alignSelf: 'stretch',
                  }}
                >
                  <Plus size={14} />
                  글 추가
                </button>
              </div>

              {/* 기존 노트 타임라인 (시간순) */}
              <div className="mt-4 space-y-4">
                {grouped.length === 0 ? (
                  <div
                    style={{
                      border: `1.5px dashed ${withAlpha(t.accentLight, 0.9)}`,
                      borderRadius: 12,
                      padding: '24px 16px',
                      textAlign: 'center',
                      backgroundColor: withAlpha(t.card, 0.6),
                    }}
                  >
                    <p style={{ fontSize: 13, color: t.textSub, fontWeight: 600 }}>
                      아직 쌓인 기록이 없어요
                    </p>
                    <p style={{ fontSize: 11, color: t.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                      이 영감을 보고 떠오른 생각을 한 줄씩 쌓아보세요.
                    </p>
                  </div>
                ) : (
                  grouped.map(([day, items]) => (
                    <div key={day}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: t.textMuted,
                          marginBottom: 6,
                          letterSpacing: 0.3,
                        }}
                      >
                        {formatDateLabel(items[0].createdAt)}
                      </div>
                      <div className="space-y-2">
                        {items.map(n => (
                          <div
                            key={n.id}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 10,
                              backgroundColor: t.bgSub,
                              border: `1px solid ${t.borderLight}`,
                              display: 'flex',
                              gap: 10,
                              alignItems: 'flex-start',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                color: t.textMuted,
                                fontWeight: 700,
                                paddingTop: 4,
                                flex: '0 0 auto',
                              }}
                            >
                              {formatTime(n.createdAt)}
                            </span>
                            <p
                              style={{
                                flex: 1,
                                fontFamily: 'var(--font-nanum-pen)',
                                fontSize: 17,
                                lineHeight: 1.45,
                                color: t.text,
                                wordBreak: 'break-word',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {n.content}
                            </p>
                            <button
                              onClick={() => handleDeleteNote(n.id)}
                              aria-label="노트 삭제"
                              style={{ color: t.textMuted, padding: 4, flex: '0 0 auto' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── 연결 버튼 (Stage 4 placeholder) ── */}
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, letterSpacing: 0.3 }}>
                연결
              </span>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: '비전보드로', Icon: Sparkles },
                  { label: '할일로',     Icon: CheckSquare },
                  { label: '저널로',     Icon: BookOpen },
                ].map(({ label, Icon }) => (
                  <button
                    key={label}
                    disabled
                    title="곧 지원돼요"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '12px 6px',
                      borderRadius: 12,
                      backgroundColor: t.bgSub,
                      border: `1px dashed ${t.borderLight}`,
                      color: t.textMuted,
                      fontSize: 11,
                      fontWeight: 600,
                      opacity: 0.7,
                      cursor: 'not-allowed',
                    }}
                  >
                    <Icon size={16} color={t.textMuted} />
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: t.textMuted, marginTop: 6, textAlign: 'center' }}>
                연결 기능은 곧 추가돼요
              </p>
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
