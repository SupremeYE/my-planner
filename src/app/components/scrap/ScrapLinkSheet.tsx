import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Check, Youtube, Instagram, MessageCircle, Globe } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { Scrap, ScrapSource } from '../../store';

const SOURCE_META: Record<ScrapSource, { label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  youtube:   { label: '유튜브', Icon: Youtube },
  instagram: { label: '인스타', Icon: Instagram },
  threads:   { label: '스레드', Icon: MessageCircle },
  web:       { label: '웹',     Icon: Globe },
};

interface Props {
  nodeId: string;
  nodeLabel: string;
  scraps: Scrap[];               // 저장된 전체 스크랩(부모에서 전달 — 추가 로드 불필요)
  initialSelectedIds: string[];  // 기존 연결(미리 체크)
  onClose: () => void;
  onSaved: () => void;           // setNodeScraps 완료 후 트리/링크 갱신 트리거
}

// 스크랩 복수 연결 바텀 시트 (Phase 5-M [3])
//  - 저장된 스크랩 목록(썸네일+제목+출처) + 검색
//  - 체크박스 복수 선택, 기존 연결 미리 체크, 확인 → setNodeScraps
export default function ScrapLinkSheet({
  nodeId, nodeLabel, scraps, initialSelectedIds, onClose, onSaved,
}: Props) {
  const { t } = useTheme();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [isIn, setIsIn] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setIsIn(true)); }, []);
  const handleClose = () => { setIsIn(false); setTimeout(onClose, 200); };

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scraps;
    return scraps.filter(s =>
      (s.title ?? '').toLowerCase().includes(q) ||
      (s.comment ?? '').toLowerCase().includes(q) ||
      s.tags.some(tag => tag.toLowerCase().includes(q)),
    );
  }, [scraps, query]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    await db.mindmap.setNodeScraps(nodeId, [...selected]);
    setSaving(false);
    onSaved();
    handleClose();
  };

  const listRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end lg:items-center lg:justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', opacity: isIn ? 1 : 0, transition: 'opacity 0.2s ease' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex flex-col w-full lg:w-[480px] lg:rounded-2xl rounded-t-2xl overflow-hidden"
        style={{
          backgroundColor: t.card,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.2)',
          maxHeight: '80vh',
          transform: isIn ? 'translateY(0)' : 'translateY(28px)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: t.border }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: t.text }}>스크랩 연결</p>
            <p style={{ fontSize: 11, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              「{nodeLabel || '가지'}」에 연결할 스크랩 선택
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg" aria-label="닫기">
            <X size={20} color={t.text} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div
            className="flex items-center gap-2"
            style={{
              backgroundColor: t.bgSub,
              border: `1px solid ${t.borderLight}`,
              borderRadius: 10,
              padding: '8px 12px',
            }}
          >
            <Search size={15} color={t.textMuted} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="제목·태그로 검색"
              style={{
                flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
                color: t.text, fontSize: 14,
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="검색 지우기">
                <X size={14} color={t.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* 목록 */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', padding: '32px 0' }}>
              {scraps.length === 0 ? '저장된 스크랩이 없어요.' : '검색 결과가 없어요.'}
            </p>
          ) : (
            filtered.map(s => {
              const checked = selected.has(s.id);
              const meta = s.source ? SOURCE_META[s.source] : SOURCE_META.web;
              const SourceIcon = meta.Icon;
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-3 text-left"
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    backgroundColor: checked ? t.accentLight : 'transparent',
                    border: `1px solid ${checked ? t.accent : 'transparent'}`,
                    marginBottom: 4,
                  }}
                >
                  {/* 썸네일 */}
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flex: '0 0 auto',
                      backgroundColor: t.bgSub, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {s.thumbnailUrl ? (
                      <img src={s.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <SourceIcon size={18} color={t.textMuted} />
                    )}
                  </div>
                  {/* 제목 + 출처 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: t.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.title || '(제목 없음)'}
                    </p>
                    <span style={{ fontSize: 11, color: t.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <SourceIcon size={11} color={t.textMuted} /> {meta.label}
                    </span>
                  </div>
                  {/* 체크 */}
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: 7, flex: '0 0 auto',
                      border: `1.5px solid ${checked ? t.accent : t.border}`,
                      backgroundColor: checked ? t.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {checked && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 확인 */}
        <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: t.border, paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full"
            style={{
              backgroundColor: t.accent, color: '#fff', fontWeight: 800, fontSize: 14,
              padding: '12px 0', borderRadius: 12, border: 'none',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '저장 중…' : `${selected.size}개 연결`}
          </button>
        </div>
      </div>
    </div>
  );
}
