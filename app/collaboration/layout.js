'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import './shell.css';

const sections=[
  ['/collaboration','Dashboard','▦'],
  ['/collaboration/projects','Projects & Requests','▤'],
  ['/collaboration/documents','Data & Documents','▣'],
  ['/collaboration/reports','Reports','▥'],
  ['/collaboration/bmap','BMAP & GIS','⌖'],
  ['/collaboration/management','Management','◫'],
  ['/collaboration/admin','Administration','⚙'],
];
export default function CollaborationLayout({children}){
  const path=usePathname()||'/collaboration';
  const [open,setOpen]=useState(false);
  const active=(href)=>href==='/collaboration'?path==='/collaboration':path===href||path.startsWith(href+'/');
  return <div className="civic-shell">
    <button className="civic-shell-mobile-toggle" aria-expanded={open} aria-controls="civic-shell-navigation" onClick={()=>setOpen(!open)}>☰ CivicOps navigation</button>
    {open&&<button className="civic-shell-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <aside id="civic-shell-navigation" className={'civic-shell-sidebar'+(open?' is-open':'')}>
      <Link className="civic-shell-brand" href="/collaboration" onClick={()=>setOpen(false)}><span className="civic-shell-mark">C</span><span><strong>CivicOps</strong><small>Department operations</small></span></Link>
      <div className="civic-shell-group-title">WORKSPACE</div>
      <nav aria-label="Primary navigation">{sections.map(([href,label,symbol])=><Link key={href} href={href} className={'civic-shell-nav-link'+(active(href)?' is-active':'')} aria-current={active(href)?'page':undefined} onClick={()=>setOpen(false)}><span aria-hidden="true">{symbol}</span>{label}</Link>)}</nav>
      <div className="civic-shell-footer">CivicOps · Connected workspace</div>
    </aside>
    <div className="civic-shell-content">{children}</div>
  </div>;
}
