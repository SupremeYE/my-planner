import { Link } from 'react-router';
export function MoaRecordsNav({ active }: { active: 'time' | 'food' }) {
  const items = [{id:'time',to:'/__moamoa-records',label:'시간 분석'},{id:'reviews',to:'/reviews',label:'회고·일기'},{id:'food',to:'/__moamoa-food',label:'음식'},{id:'culture',to:'/culture',label:'문화·음악'},{id:'books',to:'/books',label:'독서'},{id:'health',to:'/health',label:'건강'}];
  return <nav className="ma-record-nav" aria-label="기록 종류">{items.map(item => item.id === active ? <span key={item.id} aria-current="page">{item.label}</span> : <Link key={item.id} to={item.to}>{item.label}</Link>)}</nav>;
}
