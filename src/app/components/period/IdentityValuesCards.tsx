import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useTheme } from '../../ThemeContext';
import { getAnnualProfileForYear } from '../../store';
import type { ThemeTokens } from '../../ThemeContext';

interface Props {
  year: number;
  appSettings: {
    annualProfiles: Record<string, { identity: string; values: string[] }>;
  };
  updateAppSettings: (patch: { annualProfiles: Record<string, { identity: string; values: string[] }> }) => void;
}

export function IdentityCard({ year, appSettings, updateAppSettings }: Props) {
  const { t } = useTheme();
  const yk = String(year);
  const saved = appSettings.annualProfiles[yk]?.identity ?? '';
  const [draft, setDraft] = useState(saved);
  const touched = useRef(false);
  const profilesRef = useRef(appSettings.annualProfiles);
  profilesRef.current = appSettings.annualProfiles;
  useEffect(() => { if (!touched.current) setDraft(saved); }, [saved]);
  useEffect(() => {
    if (draft === saved) return;
    const id = window.setTimeout(() => {
      const all = profilesRef.current;
      const p = getAnnualProfileForYear(all, year);
      updateAppSettings({ annualProfiles: { ...all, [yk]: { identity: draft.trim(), values: p.values } } });
    }, 600);
    return () => window.clearTimeout(id);
  }, [draft, saved, year, yk, updateAppSettings]);
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} color={t.accent} />
        <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>
          {year}년에 되고 싶은 나
        </span>
      </div>
      <textarea
        rows={2}
        value={draft}
        onChange={e => { touched.current = true; setDraft(e.target.value); }}
        placeholder="한 문장으로..."
        className="w-full rounded-lg px-2 py-1.5 border outline-none resize-none"
        style={{ fontSize: 12, lineHeight: 1.5, borderColor: t.border, backgroundColor: t.card, color: t.text }}
      />
    </div>
  );
}

export function ValuesCard({ year, appSettings, updateAppSettings }: Props) {
  const { t } = useTheme();
  const yk = String(year);
  const yearValues = getAnnualProfileForYear(appSettings.annualProfiles, year).values;
  const [draft, setDraft] = useState('');
  const addValue = () => {
    const v = draft.trim(); if (!v) return;
    const p = getAnnualProfileForYear(appSettings.annualProfiles, year);
    if (p.values.length >= 3 || p.values.includes(v)) return;
    updateAppSettings({
      annualProfiles: { ...appSettings.annualProfiles, [yk]: { identity: p.identity, values: [...p.values, v] } },
    });
    setDraft('');
  };
  const removeValue = (v: string) => {
    const p = getAnnualProfileForYear(appSettings.annualProfiles, year);
    updateAppSettings({
      annualProfiles: { ...appSettings.annualProfiles, [yk]: { identity: p.identity, values: p.values.filter(x => x !== v) } },
    });
  };
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: t.card, border: `1px solid ${t.borderLight}` }}>
      <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, letterSpacing: '0.06em' }}>
        핵심 가치 (최대 3)
      </span>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {yearValues.map((v: string) => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ fontSize: 11, backgroundColor: t.accentLight, color: t.accent, border: `1px solid ${t.borderLight}` }}>
            {v}
            <button onClick={() => removeValue(v)} style={{ color: t.textMuted, lineHeight: 1 }}>×</button>
          </span>
        ))}
        {yearValues.length < 3 && (
          <div className="flex items-center gap-1">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addValue()}
              placeholder="가치..."
              className="px-2 py-0.5 rounded-full border outline-none"
              style={{ fontSize: 11, width: 70, borderColor: t.border, backgroundColor: t.card, color: t.text }}
            />
            <button onClick={addValue} className="p-0.5 rounded-full" style={{ backgroundColor: t.accent, color: '#fff' }}>
              <Plus size={9} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ThemeTokens 외부 노출(이 파일을 import 한 쪽에서 쓰지 않아도 의존성 정리용)
export type { ThemeTokens };
