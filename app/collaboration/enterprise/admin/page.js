'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

export default function EnterpriseAdmin() {
  const [state, setState] = useState({ loading: true, authorized: false, organizations: [] });
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { data: auth, error: authError } = await db.auth.getUser();
        if (authError || !auth.user) throw new Error('Please sign in.');
        const { data: memberships, error } = await db.from('enterprise_members')
          .select('organization_id,role').eq('user_id', auth.user.id).in('role', ['owner','admin']);
        if (error) throw error;
        const ids = (memberships || []).map(m => m.organization_id);
        if (!ids.length) { if (mounted) setState({ loading: false, authorized: false, organizations: [] }); return; }
        const { data: organizations, error: orgError } = await db.from('enterprise_organizations')
          .select('id,name').in('id', ids);
        if (orgError) throw orgError;
        if (mounted) setState({ loading: false, authorized: true, organizations: organizations || [] });
      } catch (error) {
        if (mounted) setState({ loading: false, authorized: false, organizations: [], error: error.message });
      }
    }
    load();
    return () => { mounted = false; };
  }, []);
  if (state.loading) return <main className="ent-page"><p>Checking administrator access…</p></main>;
  if (!state.authorized) return <main className="ent-page"><h1>Access restricted</h1><p>Organization owner or administrator access is required.</p><Link href="/collaboration/enterprise/workspace">Return to My Workspace</Link></main>;
  return <main className="ent-page">
    <header className="ent-header"><div><div className="ent-eyebrow">CIVICOPS / ENTERPRISE</div><h1>Administration</h1><p>Manage your organization, employee access and operational oversight.</p></div></header>
    <section className="ent-panel" style={{ padding: 24, marginBottom: 20 }}>
      <h2>Your organizations</h2>
      {state.organizations.map(org => <p key={org.id}><strong>{org.name}</strong></p>)}
    </section>
    <section className="ent-panel" style={{ padding: 24 }}>
      <h2>Administration tools</h2>
      <p><Link href="/collaboration/enterprise/employees">Employee Directory and Invitations</Link> — invite employees, revoke pending invitations, manage departments and employee assignments.</p>
      <p><Link href="/collaboration/enterprise/dashboard">Executive Dashboard</Link> — organization-wide reporting for authorized leadership.</p>
      <p>Additional organization settings and granular role management are planned for the next administration phase.</p>
    </section>
  </main>;
}
