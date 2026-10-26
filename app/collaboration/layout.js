
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import './shell.css';

const municipalSections = [
  ['/collaboration', 'Dashboard', '▦'],
  ['/collaboration/projects', 'Projects & Requests', '▤'],
  ['/collaboration/documents', 'Data & Documents', '▣'],
  ['/collaboration/reports', 'Reports', '▥'],
  ['/collaboration/bmap', 'BMAP & GIS', '⌖'],
  ['/collaboration/management', 'Management', '◫'],
  ['/collaboration/admin', 'Administration', '⚙'],
  ['/collaboration/access-management', 'User Access Management', '♙'],
];





const enterpriseSections = [
  ['/collaboration/enterprise/workspace', 'My Workspace', '☑'],
  ['/collaboration/enterprise/dashboard', 'Executive Dashboard', '▣'],
  ['/collaboration/enterprise/employees', 'Employee Directory', '♙'],
  ['/collaboration/enterprise', 'Locations & Facilities', '▦'],
  ['/collaboration/enterprise/assets', 'Assets & Equipment', '◫'],
  ['/collaboration/enterprise/inspections', 'Inspections & Audits', '▤'],
  ['/collaboration/enterprise/contractors', 'Contractors & Vendors', '♧'],
  ['/collaboration/enterprise/admin', 'Administration', '⚙'],
];


export default function CollaborationLayout({ children }) {
  const path = usePathname() || '/collaboration';
  const [open, setOpen] = useState(false);
  const [executiveAccess, setExecutiveAccess] = useState(false);
  useEffect(() => {
    if (!path.startsWith('/collaboration/enterprise')) return;
    let active = true;
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    db.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await db.from('enterprise_members').select('role').eq('user_id', data.user.id).in('role', ['owner', 'admin']).limit(1);
      if (active) setExecutiveAccess(Boolean(rows?.length));
    }).catch(() => {});
    return () => { active = false; };
  }, [path]);

  const isEnterprise =
    path === '/collaboration/enterprise' ||
    path.startsWith('/collaboration/enterprise/');

  const sections = isEnterprise
    ? enterpriseSections.filter(item => !['Executive Dashboard', 'Administration'].includes(item[1]) || executiveAccess)
    : municipalSections;

  
const active = (href) => {
  if (
    href === '/collaboration' ||
    href === '/collaboration/enterprise'
  ) {
    return path === href;
  }

  return path === href || path.startsWith(href + '/');
};


  return (
    <div className="civic-shell">
      <button
        className="civic-shell-mobile-toggle"
        aria-expanded={open}
        aria-controls="civic-shell-navigation"
        onClick={() => setOpen(!open)}
      >
        ☰ CivicOps {isEnterprise ? 'Enterprise' : 'Municipal'} navigation
      </button>

      {open && (
        <button
          className="civic-shell-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="civic-shell-navigation"
        className={'civic-shell-sidebar' + (open ? ' is-open' : '')}
      >
        <Link
          className="civic-shell-brand"
          href={isEnterprise ? '/collaboration/enterprise' : '/collaboration'}
          onClick={() => setOpen(false)}
        >
          <span className="civic-shell-mark">C</span>
          <span>
            <strong>CivicOps</strong>
            <small>
              {isEnterprise
                ? 'Enterprise Operations'
                : 'Department operations'}
            </small>
          </span>
        </Link>

        <div className="civic-shell-group-title">
          {isEnterprise ? 'ENTERPRISE WORKSPACE' : 'WORKSPACE'}
        </div>

        <nav aria-label="Primary navigation">
          {sections.map(([href, label, symbol]) => (
            <Link
              key={href}
              href={href}
              className={
                'civic-shell-nav-link' +
                (active(href) ? ' is-active' : '')
              }
              aria-current={active(href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">{symbol}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="civic-shell-footer">
          {isEnterprise
            ? 'CivicOps · Enterprise Operations'
            : 'CivicOps · Connected workspace'}
        </div>
      </aside>

      <div className="civic-shell-content">{children}</div>
    </div>
  );
}
