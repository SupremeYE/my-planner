import { useMemo, useState } from 'react';
import { CalendarDays, Link2, MapPinned, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanner, Event } from '../store';
import { useTheme } from '../ThemeContext';
import ConfirmModal from './ConfirmModal';
import { TimePicker } from './TimePicker';

interface EventModalProps {
  date?: string;
  event?: Event;
  onClose: () => void;
}

const REPEAT_OPTIONS: { value: Event['repeatType']; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
];

const ALERT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '없음' },
  { value: '10', label: '10분 전' },
  { value: '30', label: '30분 전' },
  { value: '60', label: '1시간 전' },
];

export function EventModal({ date, event, onClose }: EventModalProps) {
  const { addEvent, updateEvent, deleteEvent, projects } = usePlanner();
  const { t } = useTheme();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [title, setTitle] = useState(event?.title ?? '');
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay ?? false);
  const [startDate, setStartDate] = useState(event?.startDate ?? event?.date ?? date ?? todayStr);
  const [endDate, setEndDate] = useState(event?.endDate ?? event?.date ?? date ?? todayStr);
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(event?.endTime ?? '10:00');
  const [location, setLocation] = useState(event?.location ?? '');
  const [linkUrl, setLinkUrl] = useState(event?.linkUrl ?? '');
  const [repeatType, setRepeatType] = useState<Event['repeatType']>(event?.repeatType ?? 'none');
  const [repeatEndDate, setRepeatEndDate] = useState(event?.repeatEndDate ?? '');
  const [alertMinutes, setAlertMinutes] = useState<string>(event?.alertMinutes?.toString() ?? '');
  const [memo, setMemo] = useState(event?.memo ?? '');
  const [projectId, setProjectId] = useState(event?.projectId ?? '');
  const [color, setColor] = useState(event?.color ?? '#7B9ED9');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const mapsUrl = useMemo(
    () => location.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}` : '',
    [location],
  );
  const normalizedLink = useMemo(() => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }, [linkUrl]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    if (!startDate || !endDate) {
      setError('시작일과 종료일을 입력해 주세요.');
      return;
    }
    if (endDate < startDate) {
      setError('종료일은 시작일보다 빠를 수 없어요.');
      return;
    }
    if (!isAllDay && endDate === startDate && endTime < startTime) {
      setError('종료 시간은 시작 시간보다 늦어야 해요.');
      return;
    }

    const payload: Omit<Event, 'id'> = {
      title: title.trim(),
      date: startDate,
      startDate,
      endDate,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      isAllDay,
      location: location.trim() || undefined,
      linkUrl: normalizedLink || undefined,
      repeatType: repeatType ?? 'none',
      repeatEndDate: repeatType && repeatType !== 'none' ? (repeatEndDate || undefined) : undefined,
      alertMinutes: alertMinutes ? Number(alertMinutes) as Event['alertMinutes'] : undefined,
      memo: memo.trim() || undefined,
      projectId: projectId || undefined,
      color,
      tags: event?.tags ?? [],
    };

    if (event) {
      updateEvent(event.id, payload);
    } else {
      addEvent(payload);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-[460px] max-w-[95vw] max-h-[88vh] overflow-y-auto"
        style={{
          backgroundColor: t.card,
          border: `1px solid ${t.border}`,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            {event ? '일정 수정' : '일정 추가'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: t.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>제목</label>
            <input
              autoFocus
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="일정 제목을 입력하세요"
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={e => setIsAllDay(e.target.checked)}
              className="rounded"
            />
            <span style={{ fontSize: 12, color: t.text }}>종일</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              />
            </div>
          </div>

          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>시작시간</label>
                <div className="mt-1">
                  <TimePicker value={startTime} onChange={setStartTime} placeholder="시작 시간" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>종료시간</label>
                <div className="mt-1">
                  <TimePicker value={endTime} onChange={setEndTime} placeholder="종료 시간" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>장소</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="장소 입력"
                className="flex-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              />
              {mapsUrl && (
                <button
                  type="button"
                  onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: t.bgSub, color: t.info, border: `1px solid ${t.border}` }}
                >
                  <MapPinned size={15} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>링크 URL</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              />
              {normalizedLink && (
                <button
                  type="button"
                  onClick={() => window.open(normalizedLink, '_blank', 'noopener,noreferrer')}
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: t.bgSub, color: t.accent, border: `1px solid ${t.border}` }}
                >
                  <Link2 size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>반복</label>
              <select
                value={repeatType}
                onChange={e => setRepeatType(e.target.value as Event['repeatType'])}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              >
                {REPEAT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>알림</label>
              <select
                value={alertMinutes}
                onChange={e => setAlertMinutes(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              >
                {ALERT_OPTIONS.map(option => (
                  <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {repeatType && repeatType !== 'none' && (
            <div>
              <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>반복 종료일</label>
              <input
                type="date"
                value={repeatEndDate}
                onChange={e => setRepeatEndDate(e.target.value)}
                className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
                style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>프로젝트</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none"
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
            >
              <option value="">없음</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>색상</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="h-10 w-12 rounded-lg border"
                style={{ borderColor: t.border, backgroundColor: t.card }}
              />
              <span style={{ fontSize: 12, color: t.textSub }}>{color}</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: t.textSub, fontWeight: 600 }}>메모</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="메모를 남겨보세요"
              className="w-full mt-1 rounded-lg px-3 py-2 outline-none resize-none"
              rows={4}
              style={{ border: `1px solid ${t.border}`, backgroundColor: t.bgSub, color: t.text, fontSize: 13 }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: 12 }}>
              <CalendarDays size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          {event && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-xl transition-colors"
              style={{ fontSize: 12, color: '#DC2626', backgroundColor: '#FEE2E2' }}
            >
              삭제
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-xl" style={{ fontSize: 13, color: t.textSub, backgroundColor: t.bgSub }}>
            취소
          </button>
          <button onClick={handleSubmit} className="px-5 py-2 rounded-xl" style={{ fontSize: 13, fontWeight: 600, backgroundColor: t.accent, color: '#fff' }}>
            {event ? '저장' : '추가'}
          </button>
        </div>

        {showDeleteConfirm && event && (
          <ConfirmModal
            message="일정을 삭제할까요?"
            confirmText="삭제"
            confirmDanger
            onConfirm={() => {
              deleteEvent(event.id);
              setShowDeleteConfirm(false);
              onClose();
            }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    </div>
  );
}
