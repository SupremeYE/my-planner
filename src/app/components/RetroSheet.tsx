import { useMemo, useState } from 'react';
import { Plus, X, Trash2, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePlanner } from '../store';
import { useTheme } from '../ThemeContext';
import { SheetShell } from './workout/SheetShell';
import { VoiceInputButton, LabelRow } from './VoiceInputButton';
import { inputBg, buttonStyle } from '../styles/haonStyles';

// ─── RetroSheet — 하루 회고 공용 시트 (PC 모달 / 모바일 바텀시트) ───
// 진입점: 일간 '오늘 기록' 회고 카드, 리뷰&기록 일간 탭. 저장소는 하나(review_records + happy_moments).
// · 🙏 감사(review_records.gratitude text[]) — 기본 3줄, +추가/삭제, 한 줄만 써도 저장
// · ✨ 좋았던 순간(happy_moments, 하루 복수행) — add/remove/edit
// · 🔄 KPT(review_records.kpt_*) — 기본 접힘, 값 있으면 펼침
// 부분 저장 허용(감사만 쓰고 닫아도 저장). 날짜 인자로 과거도 열람·수정.
// 색: 입력칸=inputBg(흰색), 기능면=surfaceMuted. 라벤더 미사용(baseline 0). --font-diary 미적용.

interface RetroSheetProps {
  date: string;            // 'yyyy-MM-dd'
  onClose: () => void;
  onSaved?: () => void;    // 저장 후 호출 화면 갱신 훅(선택)
}

export function RetroSheet({ date, onClose, onSaved }: RetroSheetProps) {
  const { t } = useTheme();
  const {
    reviewRecords, happyMoments,
    addReviewRecord, updateReviewRecord,
    addHappyMoment, deleteHappyMoment,
  } = usePlanner();

  const dayRecord = useMemo(() => reviewRecords.find(r => r.date === date), [reviewRecords, date]);
  const existingHappy = useMemo(
    () => happyMoments.filter(m => m.date === date),
    [happyMoments, date],
  );

  // ── 감사 ── 기본 3줄, 저장값 있으면 그 줄, 최소 1줄 유지
  const [gratitude, setGratitude] = useState<string[]>(
    dayRecord?.gratitude && dayRecord.gratitude.length ? [...dayRecord.gratitude] : ['', '', ''],
  );

  // ── 좋았던 순간 ── {id: 기존행 id | null(신규), content}
  const [happyList, setHappyList] = useState<{ id: string | null; content: string }[]>(
    existingHappy.map(m => ({ id: m.id, content: m.content })),
  );

  // ── KPT ── 값 있는 날은 펼친 채로 연다
  const [kptKeep, setKptKeep] = useState(dayRecord?.kptKeep ?? '');
  const [kptProblem, setKptProblem] = useState(dayRecord?.kptProblem ?? '');
  const [kptTry, setKptTry] = useState(dayRecord?.kptTry ?? '');
  const [kptOpen, setKptOpen] = useState(
    !!(dayRecord?.kptKeep || dayRecord?.kptProblem || dayRecord?.kptTry),
  );

  const dateLabel = date && isValid(parseISO(date))
    ? format(parseISO(date), 'M월 d일 (EEEE)', { locale: ko })
    : '오늘';

  // 음성 결과 이어붙이기 (인라인 리뷰 탭과 동일 패턴)
  const appendText = (cur: string, add: string) => (cur ? `${cur} ${add}` : add);

  // ── 감사 조작 ──
  const setGratLine = (i: number, v: string) => setGratitude(prev => prev.map((g, idx) => idx === i ? v : g));
  const appendGratVoice = (i: number, text: string) => setGratitude(prev => prev.map((g, idx) => idx === i ? appendText(g, text) : g));
  const addGratLine = () => setGratitude(prev => [...prev, '']);
  const removeGratLine = (i: number) => setGratitude(prev => prev.length <= 1 ? [''] : prev.filter((_, idx) => idx !== i));

  // ── 좋았던 순간 조작 ──
  const setHappyLine = (i: number, v: string) => setHappyList(prev => prev.map((h, idx) => idx === i ? { ...h, content: v } : h));
  const appendHappyVoice = (i: number, text: string) => setHappyList(prev => prev.map((h, idx) => idx === i ? { ...h, content: appendText(h.content, text) } : h));
  const addHappyLine = () => setHappyList(prev => [...prev, { id: null, content: '' }]);
  const removeHappyLine = (i: number) => setHappyList(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    // 1) review_records — 감사 + KPT 부분 저장(머지)
    const cleanG = gratitude.map(g => g.trim()).filter(Boolean);
    const hasG = cleanG.length > 0;
    const hasK = !!(kptKeep.trim() || kptProblem.trim() || kptTry.trim());
    const otherTypes = (dayRecord?.types ?? []).filter(ty => ty !== 'gratitude' && ty !== 'kpt');
    const types = [...otherTypes, ...(hasG ? ['gratitude'] : []), ...(hasK ? ['kpt'] : [])];
    const reviewFields = {
      types,
      gratitude: cleanG,
      kptKeep: kptKeep.trim(),
      kptProblem: kptProblem.trim(),
      kptTry: kptTry.trim(),
    };
    if (dayRecord) {
      updateReviewRecord(dayRecord.id, reviewFields);
    } else if (hasG || hasK) {
      addReviewRecord({ date, ...reviewFields });
    }

    // 2) happy_moments — 추가/삭제/수정(수정=삭제 후 재추가) 반영
    const keptIds = new Set(happyList.filter(h => h.id).map(h => h.id as string));
    existingHappy.forEach(row => {
      const cur = happyList.find(h => h.id === row.id);
      if (!cur || !cur.content.trim()) {
        deleteHappyMoment(row.id);                // 제거 또는 비움
      } else if (cur.content.trim() !== row.content) {
        deleteHappyMoment(row.id);                // 수정 = 삭제 후 재추가
        addHappyMoment(cur.content.trim(), date);
      }
      keptIds.delete(row.id);
    });
    happyList.filter(h => h.id === null && h.content.trim()).forEach(h => addHappyMoment(h.content.trim(), date));

    onSaved?.();
    onClose();
  };

  const sectionLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: t.text };
  const numBadge: React.CSSProperties = {
    width: 20, height: 20, borderRadius: 999, flexShrink: 0,
    background: t.surfaceMuted, color: t.textSub,
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const textInput: React.CSSProperties = {
    flex: 1, minWidth: 0, borderRadius: 10, padding: '8px 12px',
    background: inputBg(t), border: `1px solid ${t.border}`, color: t.text, fontSize: 14, outline: 'none',
  };
  const iconBtn: React.CSSProperties = {
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none',
    color: t.textMuted, cursor: 'pointer',
  };
  const addBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2,
    fontSize: 12, fontWeight: 600, color: t.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 2px',
  };

  return (
    <SheetShell
      title={<span>회고 · <span style={{ color: t.textSub, fontWeight: 600 }}>{dateLabel}</span></span>}
      onClose={onClose}
      footer={
        <button type="button" onClick={handleSave}
          style={{ ...buttonStyle(t, 'primary'), width: '100%', padding: '11px 0', fontSize: 14 }}>
          저장
        </button>
      }
    >
      <div className="px-4 py-4" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* 1. 🙏 감사한 것 */}
        <section>
          <div style={sectionLabel}>🙏 감사한 것</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {gratitude.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={numBadge}>{i + 1}</span>
                <input
                  value={g}
                  onChange={e => setGratLine(i, e.target.value)}
                  placeholder="오늘 감사한 것"
                  style={textInput}
                />
                <VoiceInputButton onResult={text => appendGratVoice(i, text)} />
                <button type="button" aria-label="줄 삭제" onClick={() => removeGratLine(i)} style={iconBtn}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addGratLine} style={addBtn}>
            <Plus size={14} /> 한 줄 더 추가
          </button>
        </section>

        {/* 2. ✨ 좋았던 순간 */}
        <section>
          <div style={sectionLabel}>✨ 좋았던 순간</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {happyList.length === 0 && (
              <p style={{ fontSize: 12, color: t.textMuted }}>좋았던 순간을 자유롭게 남겨보세요.</p>
            )}
            {happyList.map((h, i) => (
              <div key={h.id ?? `new-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>✨</span>
                <input
                  value={h.content}
                  onChange={e => setHappyLine(i, e.target.value)}
                  placeholder="좋았던 순간"
                  style={textInput}
                />
                <VoiceInputButton onResult={text => appendHappyVoice(i, text)} />
                <button type="button" aria-label="삭제" onClick={() => removeHappyLine(i)} style={iconBtn}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addHappyLine} style={addBtn}>
            <Plus size={14} /> 순간 추가
          </button>
        </section>

        {/* 3. 🔄 KPT — 기본 접힘, 값 있으면 펼침 */}
        <section>
          <button
            type="button"
            onClick={() => setKptOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              background: t.surfaceMuted, border: 'none', borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
            }}
          >
            <ChevronRight size={15} color={t.textSub}
              style={{ transform: kptOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
            <span style={{ ...sectionLabel, fontSize: 13 }}>🔄 KPT 회고</span>
            <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 2 }}>{kptOpen ? '' : '쓰고 싶은 날만'}</span>
          </button>
          {kptOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {([
                ['Keep · 계속할 것', kptKeep, setKptKeep, '잘돼서 이어가고 싶은 것'],
                ['Problem · 아쉬운 것', kptProblem, setKptProblem, '아쉬웠던 것'],
                ['Try · 시도할 것', kptTry, setKptTry, '다음에 시도해볼 것'],
              ] as const).map(([label, val, setter, ph]) => (
                <div key={label}>
                  <LabelRow label={label} onVoiceResult={text => setter(prev => appendText(prev, text))} />
                  <textarea
                    value={val}
                    onChange={e => setter(e.target.value)}
                    placeholder={ph}
                    rows={2}
                    style={{ ...textInput, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </SheetShell>
  );
}
