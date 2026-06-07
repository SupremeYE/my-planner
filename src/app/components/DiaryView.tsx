import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Plus, ExternalLink } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { db } from '../../lib/db';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import type { DiaryEntry } from '../store';

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${wd})`;
}

function excerpt(s: string, n = 120): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n) + '…' : clean;
}

export function DiaryView() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await db.diaryEntries.listByUser();
    setEntries(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtimeSync('diary_entries', refresh);

  const handleNew = async () => {
    const created = await db.diaryEntries.create({});
    if (created) navigate(`/journal/${created.id}`);
  };

  return (
    <div className="px-3 lg:px-8 pt-4 lg:pt-8 pb-24 lg:pb-12 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 lg:mb-7">
        <div className="flex items-center gap-2">
          <BookOpen size={20} color={t.accent} />
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 26,
              color: t.text,
              lineHeight: 1.1,
            }}
          >
            저널
          </h1>
        </div>
        <button
          onClick={handleNew}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            backgroundColor: t.accent,
            padding: '8px 14px',
            borderRadius: 999,
          }}
        >
          <Plus size={14} />
          새 일기
        </button>
      </div>

      {/* 리스트 */}
      {loading ? (
        <p style={{ fontSize: 13, color: t.textMuted, textAlign: 'center', padding: '40px 0' }}>
          불러오는 중…
        </p>
      ) : entries.length === 0 ? (
        <div
          style={{
            border: `1.5px dashed ${withAlpha(t.accentLight, 0.9)}`,
            borderRadius: 14,
            padding: '36px 18px',
            textAlign: 'center',
            backgroundColor: withAlpha(t.card, 0.6),
          }}
        >
          <p style={{ fontSize: 14, color: t.textSub, fontWeight: 600 }}>
            아직 쓴 일기가 없어요
          </p>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.5 }}>
            오른쪽 위 "새 일기" 버튼으로 한 줄부터 시작해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => navigate(`/journal/${entry.id}`)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 14,
                backgroundColor: t.card,
                border: `1px solid ${t.borderLight}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>
                {formatDateLabel(entry.createdAt)}
              </div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 18,
                  color: t.text,
                  lineHeight: 1.3,
                  marginBottom: 6,
                }}
              >
                {entry.title?.trim() || '제목 없음'}
              </div>
              {entry.content.trim() && (
                <p style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {excerpt(entry.content)}
                </p>
              )}
              {entry.sourceType === 'scrap' && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.accent,
                    backgroundColor: t.accentLight,
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  <ExternalLink size={10} />
                  스크랩에서
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
