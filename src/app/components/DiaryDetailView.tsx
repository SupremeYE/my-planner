import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import type { DiaryEntry } from '../store';
import ConfirmModal from './ConfirmModal';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${wd})`;
}

export function DiaryDetailView() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // debounced auto-save (600ms)
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const e = await db.diaryEntries.fetchById(id);
      if (cancelled) return;
      if (!e) {
        navigate('/journal', { replace: true });
        return;
      }
      setEntry(e);
      setTitle(e.title ?? '');
      setContent(e.content ?? '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, navigate]);

  // 변경 시 디바운스 저장
  useEffect(() => {
    if (loading || !id || !entry) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await db.diaryEntries.update(id, { title: title.trim() || null, content });
      setSavedAt(new Date().toISOString());
    }, 600);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [title, content, id, loading, entry]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    await db.diaryEntries.delete(id);
    navigate('/journal', { replace: true });
  }, [id, navigate]);

  if (loading || !entry) {
    return (
      <div className="px-4 lg:px-8 py-10" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: t.textMuted }}>불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className="px-3 lg:px-8 pt-3 lg:pt-8 pb-24 lg:pb-12 max-w-3xl mx-auto">
      {/* 상단 바 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/journal')}
          className="inline-flex items-center gap-1"
          style={{ fontSize: 13, color: t.textSub, padding: '6px 0' }}
        >
          <ArrowLeft size={16} />
          저널
        </button>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span style={{ fontSize: 11, color: t.textMuted }}>
              저장됨
            </span>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="일기 삭제"
            style={{ color: t.textMuted, padding: 4 }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 날짜 */}
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.3, marginBottom: 6 }}>
        {formatDateLabel(entry.createdAt)}
      </div>

      {/* 제목 */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="제목 (선택)"
        style={{
          width: '100%',
          fontFamily: "'DM Serif Display', serif",
          fontSize: 26,
          lineHeight: 1.2,
          color: t.text,
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '4px 0',
          marginBottom: 10,
        }}
      />

      {/* 스크랩에서 온 경우 — 출처 배지 */}
      {entry.sourceType === 'scrap' && entry.sourceUrl && (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            color: t.accent,
            backgroundColor: t.accentLight,
            padding: '4px 10px',
            borderRadius: 999,
            marginBottom: 14,
            maxWidth: '100%',
          }}
        >
          <ExternalLink size={11} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 240,
            }}
          >
            {entry.sourceLabel || '스크랩 원본'}
          </span>
        </a>
      )}

      {/* 본문 */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="떠오른 생각을 자유롭게 적어보세요"
        rows={18}
        style={{
          width: '100%',
          minHeight: '60vh',
          fontFamily: 'var(--font-nanum-pen)',
          fontSize: 20,
          lineHeight: 1.6,
          color: t.text,
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          padding: 0,
        }}
      />

      {confirmDelete && (
        <ConfirmModal
          message="일기를 삭제할까요?"
          description="삭제한 일기는 되돌릴 수 없어요."
          confirmText="삭제"
          confirmDanger
          onConfirm={async () => { setConfirmDelete(false); await handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
