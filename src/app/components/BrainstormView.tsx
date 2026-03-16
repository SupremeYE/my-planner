import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { usePlanner, today } from '../store';
import { Plus, Trash2, ArrowRight, Calendar, Clock, MapPin } from 'lucide-react';

export function BrainstormView() {
  const { t } = useTheme();
  const {
    brainstormItems,
    tags,
    addBrainstormItem,
    deleteBrainstormItem,
    brainstormToTodo,
    brainstormToEvent,
  } = usePlanner();

  const [newItemText, setNewItemText] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertType, setConvertType] = useState<'todo' | 'event'>('todo');
  const [convertDate, setConvertDate] = useState(today);
  const [convertStartTime, setConvertStartTime] = useState('');
  const [convertEndTime, setConvertEndTime] = useState('');
  const [convertLocation, setConvertLocation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    addBrainstormItem(newItemText, today);
    setNewItemText('');
  };

  const handleConvert = () => {
    if (!convertingId) return;

    if (convertType === 'todo') {
      brainstormToTodo(convertingId, convertDate);
    } else {
      brainstormToEvent(convertingId, {
        date: convertDate,
        startTime: convertStartTime || undefined,
        endTime: convertEndTime || undefined,
        location: convertLocation || undefined,
        tags: selectedTags,
      });
    }

    setConvertingId(null);
    setConvertDate(today);
    setConvertStartTime('');
    setConvertEndTime('');
    setConvertLocation('');
    setSelectedTags([]);
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px',
      background: t.bg,
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '28px',
          color: t.text,
          marginBottom: '8px',
          fontWeight: '700',
        }}>
          브레인스토밍
        </h1>
        <p style={{
          fontSize: '14px',
          color: t.textSub,
          marginBottom: '32px',
        }}>
          자유롭게 아이디어를 기록하고, 할일이나 일정으로 변환하세요
        </p>

        {/* 입력 영역 */}
        <div style={{
          background: t.card,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: `1px solid ${t.border}`,
          boxShadow: t.shadow,
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder="아이디어를 입력하세요..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.bg,
                color: t.text,
                fontSize: '14px',
              }}
            />
            <button
              onClick={handleAddItem}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                background: t.accent,
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              <Plus size={16} />
              추가
            </button>
          </div>
        </div>

        {/* 아이디어 목록 */}
        <div style={{
          background: t.card,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${t.border}`,
          boxShadow: t.shadow,
        }}>
          <h2 style={{
            fontSize: '18px',
            color: t.text,
            marginBottom: '16px',
            fontWeight: '600',
          }}>
            아이디어 목록
          </h2>

          {brainstormItems.length === 0 ? (
            <p style={{ fontSize: '14px', color: t.textMuted, textAlign: 'center', padding: '40px 0' }}>
              아직 아이디어가 없습니다. 새로운 아이디어를 추가해보세요!
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {brainstormItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: t.bgSub,
                    border: `1px solid ${t.borderLight}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', color: t.text }}>{item.text}</p>
                    <p style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>
                      {item.date}
                    </p>
                  </div>
                  <button
                    onClick={() => setConvertingId(item.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${t.accent}`,
                      background: t.accentLight,
                      color: t.accent,
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ArrowRight size={14} />
                    변환
                  </button>
                  <button
                    onClick={() => deleteBrainstormItem(item.id)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${t.borderLight}`,
                      background: t.bg,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} style={{ color: t.danger }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 변환 모달 */}
      {convertingId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConvertingId(null)}
        >
          <div
            style={{
              background: t.card,
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', color: t.text, marginBottom: '16px', fontWeight: '600' }}>
              {brainstormItems.find(b => b.id === convertingId)?.text}
            </h3>

            {/* 변환 타입 선택 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setConvertType('todo')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${convertType === 'todo' ? t.accent : t.border}`,
                  background: convertType === 'todo' ? t.accentLight : t.bg,
                  color: t.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                할일로 변환
              </button>
              <button
                onClick={() => setConvertType('event')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${convertType === 'event' ? t.accent : t.border}`,
                  background: convertType === 'event' ? t.accentLight : t.bg,
                  color: t.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                일정으로 변환
              </button>
            </div>

            {/* 날짜 선택 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', color: t.textSub, display: 'block', marginBottom: '6px' }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                날짜
              </label>
              <input
                type="date"
                value={convertDate}
                onChange={(e) => setConvertDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '6px',
                  border: `1px solid ${t.border}`,
                  background: t.bg,
                  color: t.text,
                  fontSize: '14px',
                }}
              />
            </div>

            {/* 일정 전용 필드 */}
            {convertType === 'event' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', color: t.textSub, display: 'block', marginBottom: '6px' }}>
                      <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      시작 시간
                    </label>
                    <input
                      type="time"
                      value={convertStartTime}
                      onChange={(e) => setConvertStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '6px',
                        border: `1px solid ${t.border}`,
                        background: t.bg,
                        color: t.text,
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', color: t.textSub, display: 'block', marginBottom: '6px' }}>
                      <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      종료 시간
                    </label>
                    <input
                      type="time"
                      value={convertEndTime}
                      onChange={(e) => setConvertEndTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '6px',
                        border: `1px solid ${t.border}`,
                        background: t.bg,
                        color: t.text,
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: t.textSub, display: 'block', marginBottom: '6px' }}>
                    <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    위치 (선택)
                  </label>
                  <input
                    type="text"
                    value={convertLocation}
                    onChange={(e) => setConvertLocation(e.target.value)}
                    placeholder="위치를 입력하세요"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '6px',
                      border: `1px solid ${t.border}`,
                      background: t.bg,
                      color: t.text,
                      fontSize: '14px',
                    }}
                  />
                </div>

                {/* 태그 선택 */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', color: t.textSub, display: 'block', marginBottom: '6px' }}>
                    태그 (선택)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tags.map(tag => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => {
                            setSelectedTags(prev =>
                              isSelected
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: `1px solid ${isSelected ? tag.color : t.border}`,
                            background: isSelected ? `${tag.color}20` : t.bg,
                            color: isSelected ? tag.color : t.textSub,
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setConvertingId(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${t.border}`,
                  background: t.bg,
                  color: t.text,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConvert}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: t.accent,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                변환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
