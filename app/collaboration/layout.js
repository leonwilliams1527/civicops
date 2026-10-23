
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
  ['/collaboration/enterprise/dashboard', 'Executive Dashboard', '▥'],
  ['/collaboration/enterprise', 'Locations & Facilities', '▦'],
  ['/collaboration/enterprise/assets', 'Assets & Equipment', '◫'],
  ['/collaboration/enterprise/inspections', 'Inspections & Audits', '▤'],
  ['/collaboration/enterprise/contractors', 'Contractors & Vendors', '♧'],
];

export default function CollaborationLayout({ children }) {
  const path = usePathname() || '/collaboration';
  const [open, setOpen] = useState(false);

  const isEnterprise =
    path === '/collaboration/enterprise' ||
    path.startsWith('/collaboration/enterprise/');

  const sections = isEnterprise
    ? enterpriseSections
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
