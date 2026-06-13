// 장소를 여러 폴더에 넣고 빼는 다중 선택 시트 (다대다)
import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { Place, PlaceFolder } from '../../../lib/db';
import { PlaceSheet } from './PlaceSheet';
import { colorFromKey, withAlpha } from './placeHelpers';

interface Props {
  place: Place;
  folders: PlaceFolder[];
  currentFolderIds: string[];
  onClose: () => void;
  onSaved: () => void;
  onCreateFolder: () => void;   // 새 폴더 만들기로 전환
}

export function FolderPickerSheet({ place, folders, currentFolderIds, onClose, onSaved, onCreateFolder }: Props) {
  const { t } = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentFolderIds));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async (close: () => void) => {
    if (saving) return;
    setSaving(true);
    await db.placeFolderItems.setFoldersForPlace(place.id, [...selected]);
    onSaved();
    close();
  };

  return (
    <PlaceSheet
      title={`'${place.name}' 폴더`}
      onClose={onClose}
      footer={close => (
        <button
          onClick={() => save(close)}
          disabled={saving}
          className="w-full"
          style={{ padding: '14px 0', borderRadius: 13, border: 'none', cursor: 'pointer', backgroundColor: t.accent, color: '#fff', fontSize: 15, fontWeight: 700, opacity: saving ? 0.5 : 1 }}
        >
          저장
        </button>
      )}
    >
      {() => (
        <div className="pt-1">
          <p style={{ fontSize: 12.5, color: t.textSub, marginBottom: 10 }}>
            여러 폴더에 동시에 넣을 수 있어요.
          </p>

          {folders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '18px 0', color: t.textSub, fontSize: 13 }}>
              아직 폴더가 없어요. 먼저 폴더를 만들어 주세요.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {folders.map(f => {
              const on = selected.has(f.id);
              const c = colorFromKey(f.color, t);
              return (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className="flex items-center gap-3"
                  style={{
                    padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `1.5px solid ${on ? c : t.borderLight}`,
                    backgroundColor: on ? withAlpha(c, 0.1) : t.bg,
                  }}
                >
                  <span
                    className="flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: 9, fontSize: 17, backgroundColor: withAlpha(c, 0.16), flexShrink: 0 }}
                  >
                    {f.icon || '📁'}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: t.text }}>{f.name}</span>
                  <span
                    className="flex items-center justify-center"
                    style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${on ? c : t.border}`, backgroundColor: on ? c : 'transparent' }}
                  >
                    {on && <Check size={14} color="#fff" />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onCreateFolder}
            className="flex items-center justify-center gap-1.5 w-full mt-2.5"
            style={{ padding: '11px 0', borderRadius: 12, border: `1.5px dashed ${t.border}`, backgroundColor: 'transparent', color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={15} /> 새 폴더 · 테마 만들기
          </button>
        </div>
      )}
    </PlaceSheet>
  );
}
