// 폴더(=테마) 생성/수정 시트 — 이름 · 이모지 · 색(토큰 키) · (편집 시)순서·삭제
import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { PlaceFolder } from '../../../lib/db';
import ConfirmModal from '../ConfirmModal';
import { PlaceSheet, Field } from './PlaceSheet';
import { COLOR_KEYS, COLOR_KEY_LABEL, colorFromKey, withAlpha, type ColorKey } from './placeHelpers';

interface Props {
  folder?: PlaceFolder | null;     // 있으면 편집
  folders: PlaceFolder[];          // 정렬(순서 이동)용 전체 목록
  onClose: () => void;
  onSaved: () => void;
}

export function FolderFormSheet({ folder, folders, onClose, onSaved }: Props) {
  const { t } = useTheme();
  const isEdit = !!folder;

  const [name, setName] = useState(folder?.name ?? '');
  const [icon, setIcon] = useState(folder?.icon ?? '');
  const [color, setColor] = useState<ColorKey>((folder?.color as ColorKey) || 'coral');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', borderRadius: 11,
    border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.text, fontSize: 14,
  };

  const save = async (close: () => void) => {
    if (!name.trim() || saving) return;
    setSaving(true);
    if (isEdit && folder) {
      await db.placeFolders.update(folder.id, { name: name.trim(), icon: icon.trim() || null, color });
    } else {
      await db.placeFolders.create({ name: name.trim(), icon: icon.trim() || null, color });
    }
    onSaved();
    close();
  };

  // 순서 이동 (편집 모드) — 현재 정렬된 folders 기준 swap 후 reorder 호출
  const move = async (dir: -1 | 1) => {
    if (!folder) return;
    const idx = folders.findIndex(f => f.id === folder.id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= folders.length) return;
    const ordered = [...folders];
    [ordered[idx], ordered[next]] = [ordered[next], ordered[idx]];
    await db.placeFolders.reorder(ordered.map(f => f.id));
    onSaved();
  };

  const doDelete = async () => {
    if (!folder) return;
    await db.placeFolders.delete(folder.id);
    setConfirmDel(false);
    onSaved();
    onClose();
  };

  const idx = folder ? folders.findIndex(f => f.id === folder.id) : -1;

  return (
    <>
      <PlaceSheet
        title={isEdit ? '폴더 수정' : '새 폴더 · 테마'}
        onClose={onClose}
        footer={close => (
          <button
            onClick={() => save(close)}
            disabled={!name.trim() || saving}
            className="w-full"
            style={{
              padding: '14px 0', borderRadius: 13, border: 'none', cursor: 'pointer',
              backgroundColor: t.accent, color: '#fff', fontSize: 15, fontWeight: 700,
              opacity: !name.trim() || saving ? 0.45 : 1,
            }}
          >
            {isEdit ? '저장' : '폴더 만들기'}
          </button>
        )}
      >
        {() => (
          <div className="pt-1">
            <div className="flex gap-3">
              <div style={{ width: 76 }}>
                <Field label="이모지">
                  <input
                    value={icon}
                    onChange={e => setIcon(e.target.value.slice(0, 2))}
                    placeholder="☕"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: 22, padding: '8px 0' }}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="이름">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="예: 카공지도"
                    style={inputStyle}
                    autoFocus
                  />
                </Field>
              </div>
            </div>

            <Field label="색">
              <div className="flex gap-2">
                {COLOR_KEYS.map(key => {
                  const c = colorFromKey(key, t);
                  const sel = color === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setColor(key)}
                      className="flex items-center gap-2"
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 11, justifyContent: 'center',
                        border: `1.5px solid ${sel ? c : t.border}`,
                        backgroundColor: sel ? withAlpha(c, 0.12) : t.bg,
                        color: sel ? c : t.textSub, fontSize: 12.5, fontWeight: sel ? 700 : 500, cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c }} />
                      {COLOR_KEY_LABEL[key]}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* 미리보기 */}
            <div
              className="flex items-center gap-3 mt-1 mb-2"
              style={{ padding: '10px 12px', borderRadius: 13, backgroundColor: t.bgSub }}
            >
              <div
                className="flex items-center justify-center"
                style={{ width: 40, height: 40, borderRadius: 11, fontSize: 20, backgroundColor: withAlpha(colorFromKey(color, t), 0.16) }}
              >
                {icon || '📁'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{name || '폴더 이름'}</div>
            </div>

            {isEdit && (
              <div style={{ borderTop: `1px solid ${t.borderLight}`, marginTop: 10, paddingTop: 12 }}>
                {/* 순서 */}
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSub }}>순서</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => move(-1)} disabled={idx <= 0}
                      style={{ padding: '7px 10px', borderRadius: 9, border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.textSub, cursor: idx <= 0 ? 'default' : 'pointer', opacity: idx <= 0 ? 0.4 : 1 }}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => move(1)} disabled={idx < 0 || idx >= folders.length - 1}
                      style={{ padding: '7px 10px', borderRadius: 9, border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.textSub, cursor: idx >= folders.length - 1 ? 'default' : 'pointer', opacity: idx < 0 || idx >= folders.length - 1 ? 0.4 : 1 }}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
                {/* 삭제 */}
                <button
                  onClick={() => setConfirmDel(true)}
                  className="flex items-center justify-center gap-1.5 w-full"
                  style={{ padding: '11px 0', borderRadius: 11, border: `1.5px solid ${t.dangerLight}`, backgroundColor: t.dangerLight, color: t.danger, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Trash2 size={15} /> 폴더 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </PlaceSheet>

      {confirmDel && (
        <ConfirmModal
          message="폴더를 삭제할까요?"
          description="폴더만 사라지고, 장소들은 보관함에 그대로 남아요. (다른 폴더 연결도 유지)"
          confirmText="삭제"
          confirmDanger
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}
