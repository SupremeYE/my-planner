// 장소 추가/수정 시트 (지오코딩 없음 — 좌표/주소/region 은 Stage 3에서 채움)
// Stage 3 에서 이 폼에 '저장 시점 1회' 지오코딩을 끼워넣을 수 있게 save 흐름을 분리해 둠.
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { db } from '../../../lib/db';
import type { Place, PlaceFolder } from '../../../lib/db';
import { CONCEPTS } from '../../../constants/places';
import ConfirmModal from '../ConfirmModal';
import { PlaceSheet, Field } from './PlaceSheet';
import { SOURCE_OPTIONS, colorFromKey, withAlpha } from './placeHelpers';

interface Props {
  place?: Place | null;             // 있으면 편집
  folders: PlaceFolder[];
  currentFolderIds?: string[];      // 편집 시 현재 소속 폴더
  defaultFolderId?: string | null;  // 특정 폴더에서 추가할 때 기본 선택
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

const ENERGY_OPTS = [
  { v: 1, label: '가볍게' },
  { v: 2, label: '보통' },
  { v: 3, label: '제대로' },
];

export function PlaceFormSheet({ place, folders, currentFolderIds, defaultFolderId, onClose, onSaved, onDeleted }: Props) {
  const { t } = useTheme();
  const isEdit = !!place;

  const [name, setName] = useState(place?.name ?? '');
  const [category, setCategory] = useState(place?.category ?? '');
  const [source, setSource] = useState(place?.source ?? '');
  const [sourceUrl, setSourceUrl] = useState(place?.sourceUrl ?? '');
  const [memo, setMemo] = useState(place?.memo ?? '');
  const [concept, setConcept] = useState<string | null>(place?.concept ?? null);
  const [energy, setEnergy] = useState<number | null>(place?.energy ?? null);
  const [selFolders, setSelFolders] = useState<Set<string>>(
    new Set(currentFolderIds ?? (defaultFolderId ? [defaultFolderId] : [])),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 12px', borderRadius: 11,
    border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.text, fontSize: 14,
  };

  const toggleFolder = (id: string) => {
    setSelFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async (close: () => void) => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      source: source.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      memo: memo.trim() || null,
      concept,
      energy,
    };
    let placeId = place?.id;
    if (isEdit && place) {
      await db.places.update(place.id, payload);
    } else {
      const created = await db.places.create(payload);
      placeId = created?.id;
    }
    // 폴더 연결 동기화 (다대다)
    if (placeId) await db.placeFolderItems.setFoldersForPlace(placeId, [...selFolders]);
    onSaved();
    close();
  };

  const doDelete = async () => {
    if (!place) return;
    await db.places.delete(place.id);
    setConfirmDel(false);
    (onDeleted ?? onSaved)();
    onClose();
  };

  const chipStyle = (on: boolean, c: string): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5,
    border: `1.5px solid ${on ? c : t.border}`,
    backgroundColor: on ? withAlpha(c, 0.12) : t.bg,
    color: on ? c : t.textSub, fontWeight: on ? 700 : 500,
  });

  return (
    <>
      <PlaceSheet
        title={isEdit ? '장소 수정' : '장소 추가'}
        onClose={onClose}
        footer={close => (
          <button
            onClick={() => save(close)}
            disabled={!name.trim() || saving}
            className="w-full"
            style={{ padding: '14px 0', borderRadius: 13, border: 'none', cursor: 'pointer', backgroundColor: t.accent, color: '#fff', fontSize: 15, fontWeight: 700, opacity: !name.trim() || saving ? 0.45 : 1 }}
          >
            {isEdit ? '저장' : '추가하기'}
          </button>
        )}
      >
        {() => (
          <div className="pt-1">
            <Field label="이름">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 브라운핸즈 송도" style={inputStyle} autoFocus />
            </Field>

            <Field label="카테고리">
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 카페 · 맛집·냉면" style={inputStyle} />
            </Field>

            <Field label="출처">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SOURCE_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSource(s)} style={chipStyle(source === s, t.accent)}>{s}</button>
                ))}
              </div>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="직접 입력도 가능" style={inputStyle} />
            </Field>

            <Field label="링크 (선택)">
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." inputMode="url" style={inputStyle} />
            </Field>

            <Field label="뽑기 분류 (선택)">
              <div className="flex flex-wrap gap-1.5">
                {CONCEPTS.map(c => {
                  const col = colorFromKey(c.color, t);
                  const on = concept === c.key;
                  return (
                    <button key={c.key} onClick={() => setConcept(on ? null : c.key)} style={chipStyle(on, col)}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="에너지 (선택)">
              <div className="flex gap-2">
                {ENERGY_OPTS.map(o => {
                  const on = energy === o.v;
                  return (
                    <button key={o.v} onClick={() => setEnergy(on ? null : o.v)} className="flex-1" style={{ ...chipStyle(on, t.success), textAlign: 'center', borderRadius: 11 }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="메모 (선택)">
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="기억해 둘 한 줄" style={{ ...inputStyle, resize: 'none' }} />
            </Field>

            {folders.length > 0 && (
              <Field label="폴더 (여러 개 가능)">
                <div className="flex flex-wrap gap-1.5">
                  {folders.map(f => {
                    const on = selFolders.has(f.id);
                    const c = colorFromKey(f.color, t);
                    return (
                      <button key={f.id} onClick={() => toggleFolder(f.id)} style={chipStyle(on, c)}>
                        {f.icon ? `${f.icon} ` : ''}{f.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* 주소·좌표는 Stage 3 지오코딩에서 자동으로 채워져요 (입력 불필요) */}
            <p style={{ fontSize: 11.5, color: t.textMuted, marginTop: -4, marginBottom: 6 }}>
              위치(지도 핀)는 나중에 자동으로 채워져요.
            </p>

            {isEdit && (
              <button
                onClick={() => setConfirmDel(true)}
                className="flex items-center justify-center gap-1.5 w-full mt-2"
                style={{ padding: '11px 0', borderRadius: 11, border: `1.5px solid ${t.dangerLight}`, backgroundColor: t.dangerLight, color: t.danger, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
              >
                <Trash2 size={15} /> 장소 삭제
              </button>
            )}
          </div>
        )}
      </PlaceSheet>

      {confirmDel && (
        <ConfirmModal
          message="이 장소를 삭제할까요?"
          description="보관함에서 사라지고, 폴더 연결도 해제돼요. 방문 기록은 남아요."
          confirmText="삭제"
          confirmDanger
          onConfirm={doDelete}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}
