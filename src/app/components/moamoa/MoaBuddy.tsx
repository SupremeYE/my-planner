// Pure visual shared with the isolated concept; no sample data or state.
export function MoaBuddy({ small = false }: { small?: boolean }) {
  return <svg className={`mo-buddy ${small ? 'mo-buddy-small' : ''}`} viewBox="0 0 230 190" fill="none" role="img" aria-label="새싹을 머리에 올린 모아 캐릭터">
    <ellipse cx="117" cy="171" rx="73" ry="9" fill="var(--mo-shadow-ink)" opacity=".10" />
    <path d="M54 129C33 110 45 79 69 71C72 41 99 37 117 54C139 35 165 51 164 73C192 86 193 114 175 132C175 159 150 170 115 169C79 170 52 159 54 129Z" fill="var(--mo-buddy-fill)" stroke="var(--mo-buddy-line)" strokeWidth="2.5" />
    <path d="M114 57C114 37 119 22 133 14" stroke="var(--mo-green)" strokeWidth="4" strokeLinecap="round" />
    <path d="M119 35C104 36 92 28 93 17C109 14 121 22 119 35Z" fill="var(--mo-sage)" stroke="var(--mo-green)" strokeWidth="2" />
    <path d="M123 25C126 10 143 7 152 12C150 27 136 33 123 25Z" fill="var(--mo-sage)" stroke="var(--mo-green)" strokeWidth="2" />
    <ellipse cx="88" cy="116" rx="12" ry="7" fill="var(--mo-peach)" /><ellipse cx="147" cy="116" rx="12" ry="7" fill="var(--mo-peach)" />
    <ellipse cx="99" cy="105" rx="3" ry="4" fill="var(--mo-ink)" /><ellipse cx="136" cy="105" rx="3" ry="4" fill="var(--mo-ink)" />
    <path d="M111 114C113 119 121 119 124 114" stroke="var(--mo-ink)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M62 131L74 137M163 136L176 129" stroke="var(--mo-buddy-line)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M28 61L31 52L34 61L43 64L34 67L31 76L28 67L19 64Z" fill="var(--mo-gold)" />
    <path d="M196 121L198 115L200 121L206 123L200 125L198 131L196 125L190 123Z" fill="var(--mo-gold)" />
  </svg>;
}
