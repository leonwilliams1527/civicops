
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const proxy = async (input, init) => {
  const raw = typeof input === 'string' ? input : input.url;
  const parsed = new URL(raw);

  if (
    url &&
    parsed.hostname === new URL(url).hostname &&
    /^\/(auth|rest|storage)\/v1\//.test(parsed.pathname)
  ) {
    return fetch(
      '/api/supabase-proxy?path=' +
        encodeURIComponent(parsed.pathname) +
        (parsed.search ? '&' + parsed.search.slice(1) : ''),
      init
    );
  }

  return fetch(input, init);
};

const db = url && key
  ? createClient(url, key, { global: { fetch: proxy } })
  : null;

const field = {
  padding: 10,
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#172b42'
};

const button = {
  background: '#174b70',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '10px 15px',
  cursor: 'pointer',
  fontWeight: 600
};

const card = {
  padding: 18,
  border: '1px solid #dce4ed',
  background: '#fff',
  borderRadius: 12
};

export default function EmployeeDirectory() {
  const [uid, setUid] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState('');

  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [facilityAssignments, setFacilityAssignments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [facilityMember, setFacilityMember] = useState('');
  const [facilityChoice, setFacilityChoice] = useState('');

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const [departmentName, setDepartmentName] = useState('');
  const [newMember, setNewMember] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteJobTitle, setInviteJobTitle] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        if (!db) {
          throw Error('Supabase is not configured.');
        }

        const auth = await db.auth.getUser();

        if (auth.error || !auth.data.user) {
          throw Error('Please sign in.');
        }

        const id = auth.data.user.id;

        const memberships = await db
          .from('enterprise_members')
          .select('organization_id')
          .eq('user_id', id);

        if (memberships.error) {
          throw memberships.error;
        }

        const ids = [
          ...new Set(
            (memberships.data || []).map(
              m => m.organization_id
            )
          )
        ];

        let organizations = [];

        if (ids.length) {
          const result = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', ids)
            .order('name');

          if (result.error) {
            throw result.error;
          }

          organizations = result.data || [];
        }

        if (!active) return;

        setUid(id);
        setOrgs(organizations);
        setOrg(organizations[0]?.id || '');
      } catch (e) {
        if (active) {
          setError(e.message || 'Unable to load organizations.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  async function loadDirectory(organizationId, currentUser) {
    const permission = await db.from('enterprise_members')
      .select('role').eq('organization_id', organizationId).eq('user_id', currentUser).maybeSingle();
    if (permission.error) throw permission.error;
    if (!['owner', 'admin'].includes(permission.data?.role)) {
      const visible = await db.rpc('enterprise_visible_colleagues', { p_organization_id: organizationId });
      if (visible.error) throw visible.error;
      const rows = visible.data || [];
      return {
        members: rows.map(row => ({ user_id: row.user_id, role: row.role })),
        departments: [], assignments: [],
        profiles: rows.map(row => ({ user_id: row.user_id, display_name: row.display_name, job_title: row.job_title })),
        facilities: [], facilityAssignments: [],
        mine: rows.find(row => row.user_id === currentUser) || null
      };
    }
    const [facilityResult, facilityMemberResult] = await Promise.all([
      db.from('enterprise_facilities').select('id,name').eq('organization_id', organizationId).order('name'),
      db.from('enterprise_facility_members').select('facility_id,user_id').eq('organization_id', organizationId)
    ]);
    if (facilityResult.error || facilityMemberResult.error) throw facilityResult.error || facilityMemberResult.error;
    const [m, d, a] = await Promise.all([
      db.from('enterprise_members')
        .select('user_id,role')
        .eq('organization_id', organizationId),

      db.from('enterprise_departments')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name'),

      db.from('enterprise_department_members')
        .select('*')
        .eq('organization_id', organizationId)
    ]);

    for (const result of [m, d, a]) {
      if (result.error) {
        throw result.error;
      }
    }

    const userIds = (m.data || []).map(
      item => item.user_id
    );

    let people = [];

    if (userIds.length) {
      const p = await db
        .from('enterprise_employee_profiles')
        .select('*')
        .in('user_id', userIds);

      if (p.error) {
        throw p.error;
      }

      people = p.data || [];
    }

    return {
      members: m.data || [],
      departments: d.data || [],
      assignments: a.data || [],
      facilities: facilityResult.data || [],
      facilityAssignments: facilityMemberResult.data || [],
      profiles: people,
      mine: people.find(
        p => p.user_id === currentUser
      )
    };
  }

  function applyDirectory(data) {
    setMembers(data.members);
    setDepartments(data.departments);
    setAssignments(data.assignments);
    setFacilities(data.facilities || []);
    setFacilityAssignments(data.facilityAssignments || []);
    setProfiles(data.profiles);
    setName(data.mine?.display_name || '');
    setJobTitle(data.mine?.job_title || '');
  }

  async function refresh(organizationId, currentUser) {
    const data = await loadDirectory(
      organizationId,
      currentUser
    );

    // Do not apply results for an organization
    // that is no longer selected.
    return data;
  }

  useEffect(() => {
    if (!org || !uid) return;

    let active = true;

    setLoading(true);
    setError('');
    setMessage('');
    setInviteError('');
    setInviteMessage('');

    loadDirectory(org, uid)
      .then(data => {
        if (active) {
          applyDirectory(data);
        }
      })
      .catch(e => {
        if (active) {
          setError(e.message || 'Unable to load employees.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [org, uid]);

  const role = members.find(
    m => m.user_id === uid
  )?.role;

  const manager = [
    'owner',
    'admin',
    'manager'
  ].includes(role);

  const canInvite = [
    'owner',
    'admin'
  ].includes(role);

  function personName(userId) {
    return profiles.find(
      p => p.user_id === userId
    )?.display_name || `Employee ${userId.slice(0, 8)}`;
  }

  async function perform(operation, successText) {
    if (busy) return;

    const currentOrg = org;
    const currentUid = uid;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await operation();

      if (result.error) {
        throw result.error;
      }

      const updated = await refresh(
        currentOrg,
        currentUid
      );

      if (currentOrg === org) {
        applyDirectory(updated);
      }

      setMessage(successText);
      return true;
    } catch (e) {
      setError(e.message || 'Unable to save changes.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();

    if (!name.trim()) return;

    await perform(
      () => db
        .from('enterprise_employee_profiles')
        .upsert({
          user_id: uid,
          display_name: name.trim(),
          job_title: jobTitle.trim() || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        }),
      'Your profile was saved.'
    );
  }

  async function assignFacility(e) {
    e.preventDefault();
    if (!canInvite || !facilityMember || !facilityChoice) return;
    await perform(() => db.from('enterprise_facility_members').insert({
      organization_id: org, user_id: facilityMember, facility_id: facilityChoice, assigned_by: uid
    }), 'Employee assigned to facility.');
  }

  async function removeFacilityAssignment(item) {
    if (!canInvite || !window.confirm('Remove this employee from this facility?')) return;
    await perform(() => db.from('enterprise_facility_members').delete()
      .eq('organization_id', org).eq('user_id', item.user_id).eq('facility_id', item.facility_id),
      'Facility access removed.');
  }

  async function createDepartment(e) {
    e.preventDefault();

    if (!manager || !departmentName.trim()) {
      return;
    }

    const saved = await perform(
      () => db
        .from('enterprise_departments')
        .insert({
          organization_id: org,
          name: departmentName.trim()
        }),
      'Department created.'
    );

    if (saved) {
      setDepartmentName('');
    }
  }

  async function assignMember(e) {
    e.preventDefault();

    if (
      !manager ||
      !newMember ||
      !newDepartment
    ) {
      return;
    }

    const saved = await perform(
      () => db
        .from('enterprise_department_members')
        .insert({
          organization_id: org,
          department_id: newDepartment,
          user_id: newMember
        }),
      'Employee assigned to department.'
    );

    if (saved) {
      setNewMember('');
      setNewDepartment('');
    }
  }

  async function removeAssignment(assignment) {
    if (
      !manager ||
      !window.confirm(
        'Remove this department assignment?'
      )
    ) {
      return;
    }

    await perform(
      () => db
        .from('enterprise_department_members')
        .delete()
        .eq('organization_id', org)
        .eq('department_id', assignment.department_id)
        .eq('user_id', assignment.user_id),
      'Department assignment removed.'
    );
  }

  async function loadPendingInvites(organizationId) {
    if (!db || !organizationId) return;
    setInvitesLoading(true);
    try {
      const { data } = await db.auth.getSession();
      if (!data.session?.access_token) throw Error('Sign in again to manage invitations.');
      const response = await fetch('/api/enterprise/invitations?organization_id=' + encodeURIComponent(organizationId), {
        headers: { Authorization: 'Bearer ' + data.session.access_token },
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to load invitations.');
      setPendingInvites(result.invitations || []);
    } catch (e) {
      setInviteError(e.message || 'Unable to load invitations.');
    } finally {
      setInvitesLoading(false);
    }
  }

  async function revokePendingInvitation(invitation) {
    if (!canInvite || revokeBusy || !window.confirm('Revoke invitation for ' + invitation.email + '? The activation link will stop working.')) return;
    setRevokeBusy(invitation.id);
    setInviteError('');
    setInviteMessage('');
    try {
      const { data } = await db.auth.getSession();
      if (!data.session?.access_token) throw Error('Sign in again to manage invitations.');
      const response = await fetch('/api/enterprise/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
        body: JSON.stringify({ organization_id: org, invitation_id: invitation.id, action: 'revoke' })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw Error(result.error || 'Unable to revoke invitation.');
      setPendingInvites(previous => previous.filter(item => item.id !== invitation.id));
      setInviteMessage('Invitation revoked. Its activation link can no longer be accepted.');
    } catch (e) {
      setInviteError(e.message || 'Unable to revoke invitation.');
    } finally {
      setRevokeBusy('');
    }
  }

  useEffect(() => {
    if (!org || !canInvite) {
      setPendingInvites([]);
      return;
    }
    loadPendingInvites(org);
  }, [org, canInvite]);

  async function inviteEmployee(e) {
    e.preventDefault();

    if (
      !canInvite ||
      !org ||
      inviteBusy
    ) {
      return;
    }

    setInviteBusy(true);
    setInviteError('');
    setInviteMessage('');

    try {
      if (!db) {
        throw Error('Authentication is not configured.');
      }

      const {
        data: sessionData,
        error: sessionError
      } = await db.auth.getSession();

      if (
        sessionError ||
        !sessionData.session?.access_token
      ) {
        throw Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const response = await fetch(
        '/api/enterprise/invitations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${sessionData.session.access_token}`
          },
          body: JSON.stringify({
            organization_id: org,
            email: inviteEmail.trim().toLowerCase(),
            display_name: inviteName.trim(),
            job_title: inviteJobTitle.trim(),
            role: inviteRole
          })
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok || !result.success) {
        throw Error(
          result.error ||
          'Unable to send employee invitation.'
        );
      }

      setInviteMessage(
        result.message ||
        'Employee invitation requested successfully.'
      );

      setInviteName('');
      setInviteEmail('');
      setInviteJobTitle('');
      setInviteRole('viewer');
      await loadPendingInvites(org);
    } catch (e) {
      setInviteError(
        e.message || 'Unable to invite employee.'
      );
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / PEOPLE
          </div>

          <h1>Employee Directory</h1>

          <p>
            Employee profiles, invitations,
            departments and team assignments.
          </p>
        </div>

        <Link href="/collaboration/enterprise/workspace">
          My Workspace →
        </Link>
      </header>

      {error && (
        <div className="ent-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <p role="status" style={{ color: '#176346' }}>
          {message}
        </p>
      )}

      <section
        className="ent-panel"
        style={{ marginBottom: 16 }}
      >
        <label>
          <strong>Organization</strong>

          <select
            value={org}
            onChange={e => setOrg(e.target.value)}
            style={{ ...field, marginTop: 8 }}
          >
            {orgs.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <section className="ent-panel">
          Loading employees…
        </section>
      ) : !org ? (
        <section className="ent-panel">
          No Enterprise organization is available.
        </section>
      ) : (
        <>
          <section
            className="ent-panel"
            style={{ marginBottom: 16 }}
          >
            <h2>My employee profile</h2>

            <form
              onSubmit={saveProfile}
              style={{
                display: 'grid',
                gap: 12,
                maxWidth: 540
              }}
            >
              <label>
                Display name *

                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={field}
                />
              </label>

              <label>
                Job title

                <input
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  style={field}
                />
              </label>

              <div>
                <button
                  disabled={busy || !name.trim()}
                  style={button}
                >
                  Save my profile
                </button>
              </div>
            </form>
          </section>

          {canInvite && (
            <section className="ent-panel" style={{ marginBottom: 16 }}>
              <h2>Pending invitations</h2>
              <p>Administrators can revoke invitations before employees accept them.</p>
              {invitesLoading ? <p>Loading invitations…</p> : pendingInvites.length === 0 ? (
                <p>No pending invitations.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {pendingInvites.map(invitation => (
                    <div key={invitation.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{invitation.display_name || invitation.email}</strong>
                        <div>{invitation.email}</div>
                        <small>Pending · {invitation.proposed_role} · Expires {new Date(invitation.expires_at).toLocaleDateString()}</small>
                      </div>
                      <button type="button" disabled={Boolean(revokeBusy)} onClick={() => revokePendingInvitation(invitation)}
                        style={{ ...button, background: '#9f2828' }}>
                        {revokeBusy === invitation.id ? 'Revoking…' : 'Revoke invitation'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {canInvite && (
            <section
              className="ent-panel"
              style={{ marginBottom: 16 }}
            >
              <div style={{ marginBottom: 16 }}>
                <h2>Invite employee</h2>

                <p>
                  Invite an employee to join this
                  Enterprise organization.
                  Company membership is assigned
                  only after verified invitation
                  acceptance.
                </p>
              </div>

              {inviteError && (
                <div
                  className="ent-error"
                  role="alert"
                  style={{ marginBottom: 14 }}
                >
                  {inviteError}
                </div>
              )}

              {inviteMessage && (
                <p
                  role="status"
                  style={{
                    color: '#176346',
                    marginBottom: 14
                  }}
                >
                  {inviteMessage}
                </p>
              )}

              <form
                onSubmit={inviteEmployee}
                style={{
                  display: 'grid',
                  gap: 14,
                  maxWidth: 700
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(220px,1fr))',
                    gap: 14
                  }}
                >
                  <label>
                    Employee full name *

                    <input
                      required
                      maxLength={150}
                      value={inviteName}
                      onChange={e =>
                        setInviteName(e.target.value)
                      }
                      placeholder="Employee name"
                      style={field}
                    />
                  </label>

                  <label>
                    Work email address *

                    <input
                      type="email"
                      required
                      maxLength={254}
                      value={inviteEmail}
                      onChange={e =>
                        setInviteEmail(e.target.value)
                      }
                      placeholder="employee@company.com"
                      style={field}
                    />
                  </label>

                  <label>
                    Job title

                    <input
                      maxLength={150}
                      value={inviteJobTitle}
                      onChange={e =>
                        setInviteJobTitle(e.target.value)
                      }
                      placeholder="Job title"
                      style={field}
                    />
                  </label>

                  <label>
                    Initial access role *

                    <select
                      value={inviteRole}
                      onChange={e =>
                        setInviteRole(e.target.value)
                      }
                      style={field}
                    >
                      <option value="viewer">
                        Viewer — read-only
                      </option>

                      <option value="operator">
                        Operator — standard staff
                      </option>
                    </select>
                  </label>
                </div>

                <p
                  style={{
                    fontSize: 13,
                    color: '#64748b',
                    margin: 0
                  }}
                >
                  Administrative and leadership
                  permissions are assigned separately
                  through Access Management.
                </p>

                <div>
                  <button
                    type="submit"
                    disabled={
                      inviteBusy ||
                      !inviteName.trim() ||
                      !inviteEmail.trim()
                    }
                    style={{
                      ...button,
                      opacity: inviteBusy ? 0.65 : 1
                    }}
                  >
                    {inviteBusy
                      ? 'Sending invitation…'
                      : 'Send employee invitation'}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section
            className="ent-panel"
            style={{ marginBottom: 16 }}
          >
            <h2>
              Departments ({departments.length})
            </h2>

            <div style={{ display: 'grid', gap: 10 }}>
              {departments.map(d => (
                <div key={d.id} style={card}>
                  <strong>{d.name}</strong>

                  <p style={{ marginBottom: 0 }}>
                    {assignments.filter(
                      a => a.department_id === d.id
                    ).length}{' '}
                    employees
                  </p>
                </div>
              ))}

              {!departments.length && (
                <p>No departments yet.</p>
              )}
            </div>

            {manager && (
              <form
                onSubmit={createDepartment}
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 16,
                  flexWrap: 'wrap'
                }}
              >
                <input
                  placeholder="New department name"
                  value={departmentName}
                  onChange={e =>
                    setDepartmentName(e.target.value)
                  }
                  style={{
                    ...field,
                    flex: '1 1 240px'
                  }}
                  required
                />

                <button
                  disabled={busy}
                  style={button}
                >
                  Add department
                </button>
              </form>
            )}
          </section>

          {canInvite && (
            <section className="ent-panel" style={{ marginBottom: 16, padding: 20 }}>
              <h2>Employee facility access</h2>
              <p>Assign employees only to the facilities they are authorized to access.</p>
              <form onSubmit={assignFacility} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <select required value={facilityMember} onChange={e => setFacilityMember(e.target.value)} style={field}>
                  <option value="">Select employee</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{personName(m.user_id)}</option>)}
                </select>
                <select required value={facilityChoice} onChange={e => setFacilityChoice(e.target.value)} style={field}>
                  <option value="">Select facility</option>
                  {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button type="submit" disabled={busy} style={button}>Assign facility</button>
              </form>
              <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
                {facilityAssignments.map(a => <div key={a.user_id + a.facility_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{personName(a.user_id)} — {facilities.find(f => f.id === a.facility_id)?.name || 'Facility'}</span>
                  <button type="button" disabled={busy} onClick={() => removeFacilityAssignment(a)}>Remove</button>
                </div>)}
              </div>
            </section>
          )}

          <section className="ent-panel">
            <h2>
              {canInvite ? 'Employees' : 'Colleagues at your locations'} ({members.length})
            </h2>

            <div
              style={{
                display: 'grid',
                gap: 12
              }}
            >
              {members.map(m => {
                const profile = profiles.find(
                  p => p.user_id === m.user_id
                );

                const assigned = assignments.filter(
                  a => a.user_id === m.user_id
                );

                return (
                  <article
                    key={m.user_id}
                    style={card}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap'
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: '0 0 5px'
                          }}
                        >
                          {personName(m.user_id)}

                          {m.user_id === uid
                            ? ' (You)'
                            : ''}
                        </h3>

                        <p style={{ margin: 0 }}>
                          {profile?.job_title ||
                            'Job title not set'}
                        </p>
                      </div>

                      <span
                        style={{
                          textTransform: 'capitalize'
                        }}
                      >
                        {m.role}
                      </span>
                    </div>

                    <p>
                      <strong>Departments:</strong>{' '}

                      {assigned
                        .map(a =>
                          departments.find(
                            d =>
                              d.id ===
                              a.department_id
                          )?.name
                        )
                        .filter(Boolean)
                        .join(', ') ||
                        'Not assigned'}
                    </p>

                    {manager && assigned.map(a => (
                      <button
                        key={a.department_id}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          removeAssignment(a)
                        }
                        style={{
                          ...button,
                          marginRight: 8,
                          marginBottom: 6,
                          background: '#edf2f7',
                          color: '#17314b'
                        }}
                      >
                        Remove from{' '}
                        {departments.find(
                          d =>
                            d.id === a.department_id
                        )?.name || 'department'}
                      </button>
                    ))}
                  </article>
                );
              })}

              {!members.length && (
                <p>No employees are assigned yet.</p>
              )}
            </div>

            {manager && (
              <form
                onSubmit={assignMember}
                style={{
                  ...card,
                  marginTop: 18
                }}
              >
                <h3>
                  Assign employee to department
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(190px,1fr))'
                  }}
                >
                  <select
                    required
                    value={newMember}
                    onChange={e =>
                      setNewMember(e.target.value)
                    }
                    style={field}
                  >
                    <option value="">
                      Select employee
                    </option>

                    {members.map(m => (
                      <option
                        key={m.user_id}
                        value={m.user_id}
                      >
                        {personName(m.user_id)}
                      </option>
                    ))}
                  </select>

                  <select
                    required
                    value={newDepartment}
                    onChange={e =>
                      setNewDepartment(e.target.value)
                    }
                    style={field}
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map(d => (
                      <option
                        key={d.id}
                        value={d.id}
                      >
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={busy}
                    style={button}
                  >
                    Assign to department
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
