import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { usePlanner, getLogicalToday, TOP3_LIMIT } from '../../store';
import { useTheme } from '../../ThemeContext';
import { TimePicker } from '../TimePicker';
import { timeToMinutes } from './timelineConstants';
import { isHaon, inputBg, segmentTrackStyle, segmentItemStyle } from '../../styles/haonStyles';

// 빈 타임라인 슬롯 → 추가 모달. 레인(PLAN/DO)·종류(할일/일정) 토글 + 시간/태그/카테고리/KEY.
export function TimelineAddModal({ date, initialStart, initialEnd, initialLane, onClose }: {
  date: string;
  initialStart: string;
  initialEnd: string;
  initialLane: 'plan' | 'do';
  onClose: () => void;
}) {
  const { addTodo, addEvent, tags, top3CountForDate } = usePlanner();
  const { t } = useTheme();
  const [lane, setLane] = useState<'plan' | 'do'>(initialLane);
  const [kind, setKind] = useState<'todo' | 'event'>('todo');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [isTop3, setIsTop3] = useState(false);

  const invalidTime = !start || !end || timeToMinutes(end) <= timeToMinutes(start);
  const canSave = title.trim().length > 0 && !invalidTime;

  // Top3 3개 제한 사전 반영 — 이 날 이미 3개면 KEY 토글 비활성(신규 추가라 자기 제외 불필요).
  const top3Disabled = !isTop3 && top3CountForDate(date) >= TOP3_LIMIT;

  const handleSave = () => {
    if (!canSave) return;
    const text = title.trim();
    if (kind === 'event') {
      addEvent({ title: text, date, startTime: start, endTime: end, tags: selectedTags, color: '#7B9ED9' });
    } else if (lane === 'plan') {
      addTodo({ text, date, status: 'active', isTop3, planStart: start, planEnd: end, category: category.trim() || undefined, tags: selectedTags });
    } else {
      // DO 직접 추가 = 이미 한(또는 할) 실적. 현재 시각(빨간 선) 이전이면 완료, 이후면 예정.
      const todayStr = getLogicalToday();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const isPast = date < todayStr || (date === todayStr && timeToMinutes(end) <= nowMin);
      addTodo({ text, date, status: isPast ? 'done' : 'active', isTop3, doStart: start, doEnd: end, category: category.trim() || undefined, tags: selectedTags });
    }
    onClose();
  };

  // 세그먼트 색: 비-H 는 기존 풀필 색을 그대로(legacyFill), H 는 §5 세그먼트(흰 pill + 코랄 언더라인).
  // planBlock/doBlock 토큰은 H 에서 세그먼트가 무채움이라 소비처가 없고, 비-H 는 픽셀 보존을 위해
  // 아래 하드코딩 값을 유지한다(V2 는 Stage 범위 밖 — 보고서 참조).
  const planClr = '#C4A882', doClr = '#6BAA7A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[360px] max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: t.card, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text }}>새 항목 추가</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* 종류 토글 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, marginBottom: 6, display: 'block' }}>종류</label>
            <div className="flex rounded-lg overflow-hidden" style={segmentTrackStyle(t)}>
              <button onClick={() => setKind('todo')} className="flex-1 py-2" style={segmentItemStyle(t, kind === 'todo', t.accent)}>할일</button>
              <button onClick={() => setKind('event')} className="flex-1 py-2" style={{ ...segmentItemStyle(t, kind === 'event', '#7B9ED9'), ...(isHaon(t) ? null : { borderLeft: `1px solid ${t.border}` }) }}>일정</button>
            </div>
          </div>
          {/* 레인 토글 (할일만) */}
          {kind === 'todo' && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, marginBottom: 6, display: 'block' }}>레인</label>
              <div className="flex rounded-lg overflow-hidden" style={segmentTrackStyle(t)}>
                <button onClick={() => setLane('plan')} className="flex-1 py-2" style={segmentItemStyle(t, lane === 'plan', planClr)}>PLAN</button>
                <button onClick={() => setLane('do')} className="flex-1 py-2" style={{ ...segmentItemStyle(t, lane === 'do', doClr), ...(isHaon(t) ? null : { borderLeft: `1px solid ${t.border}` }) }}>DO</button>
              </div>
            </div>
          )}
          {/* 제목 */}
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, marginBottom: 6, display: 'block' }}>제목</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder={kind === 'event' ? '일정 제목' : '할일 제목'}
              className="w-full rounded-lg px-3 py-2 outline-none"
              style={{ border: `1px solid ${t.border}`, backgroundColor: inputBg(t), color: t.text, fontSize: 14 }} />
          </div>
          {/* 시간 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, marginBottom: 6, display: 'block' }}>시작</label>
              <TimePicker value={start} onChange={setStart} placeholder="시작" size="md" minuteStep={5} />
            </div>
            <div className="flex-1">
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, marginBottom: 6, display: 'block' }}>종료</label>
              <TimePicker value={end} onChange={setEnd} placeholder="종료" size="md" minuteStep={5} />
            </div>
          </div>
          {invalidTime && <span style={{ fontSize: 11, color: t.danger }}>종료 시간이 시작보다 늦어야 합니다</span>}
          {/* 태그 */}
          {tags.length > 0 && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600, marginBottom: 6, display: 'block' }}>태그</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => {
                  const on = selectedTags.includes(tag.id);
                  return (
                    <button key={tag.id} type="button"
                      onClick={() => setSelectedTags(prev => prev.includes(tag.id) ? prev.filter(x => x !== tag.id) : [...prev, tag.id])}
                      className="px-2.5 py-1 rounded-full"
                      style={{
                        fontSize: 11, fontWeight: on ? 700 : 500,
                        backgroundColor: on ? tag.color : `${tag.color}1A`,
                        color: on ? '#fff' : tag.color,
                        border: `1px solid ${tag.color}${on ? '' : '40'}`,
                      }}>
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* 할일 전용: 카테고리 + KEY */}
          {kind === 'todo' && (
            <div>
              <div className="flex items-center gap-2">
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="카테고리 (선택)"
                  className="flex-1 rounded-lg px-3 py-2 outline-none"
                  style={{ border: `1px solid ${t.border}`, backgroundColor: inputBg(t), color: t.text, fontSize: 13 }} />
                <button type="button" onClick={() => { if (!top3Disabled) setIsTop3(v => !v); }}
                  disabled={top3Disabled}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg"
                  style={{
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    backgroundColor: isTop3 ? t.accentLight : t.bgSub,
                    color: isTop3 ? t.accent : t.textSub,
                    border: `1px solid ${isTop3 ? t.accent : t.border}`,
                    cursor: top3Disabled ? 'not-allowed' : 'pointer',
                    opacity: top3Disabled ? 0.45 : 1,
                  }}>
                  <Star size={13} fill={isTop3 ? t.accent : 'none'} color={isTop3 ? t.accent : t.textMuted} /> KEY
                </button>
              </div>
              {top3Disabled && (
                <span style={{ fontSize: 11, color: t.textMuted, marginTop: 4, display: 'block' }}>핵심 할일은 하루 {TOP3_LIMIT}개까지예요</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 14, fontWeight: 500, color: t.textSub, backgroundColor: t.bgSub, border: `1px solid ${t.border}` }}>취소</button>
          <button onClick={handleSave} disabled={!canSave} className="flex-1 py-2.5 rounded-xl"
            style={{ fontSize: 14, fontWeight: 600, backgroundColor: canSave ? t.accent : t.border, color: '#fff', opacity: canSave ? 1 : 0.6 }}>추가</button>
        </div>
      </div>
    </div>
  );
}
