
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function proxyFetch(input, init) {
  const raw = typeof input === 'string' ? input : input.url;
  const parsed = new URL(raw);

  if (
    supabaseUrl &&
    parsed.hostname === new URL(supabaseUrl).hostname &&
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
}

const db = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      global: { fetch: proxyFetch },
    })
  : null;

const PERMISSIONS = [
  {
    title: 'Leadership & Reporting',
    items: [
      ['executive.view', 'Executive dashboards'],
      ['reports.view', 'Operational reports'],
    ],
  },
  {
    title: 'Facilities & Assets',
    items: [
      ['facilities.view', 'View facilities'],
      ['facilities.manage', 'Manage facilities'],
      ['assets.view', 'View assets'],
      ['assets.manage', 'Manage assets'],
    ],
  },
  {
    title: 'Inspections & Contractors',
    items: [
      ['inspections.view', 'View inspections'],
      ['inspections.manage', 'Manage inspections'],
      ['contractors.view', 'View contractors'],
      ['contractors.manage', 'Manage contractors'],
    ],
  },
  {
    title: 'Tasks & Employees',
    items: [
      ['tasks.view', 'View tasks'],
      ['tasks.manage', 'Manage tasks'],
      ['employees.view', 'View employees'],
      ['employees.manage', 'Manage employees'],
    ],
  },
  {
    title: 'Administration',
    items: [
      ['access.manage', 'Manage employee permissions'],
      ['settings.manage', 'Manage enterprise settings'],
    ],
  },
];

const ALL_KEYS = PERMISSIONS.flatMap(group =>
  group.items.map(item => item[0])
);

const ROLES = {
  owner: 'Company Owner / Super Admin',
  admin: 'Company Administrator',
  manager: 'Manager',
  member: 'Employee',
};

const fieldStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  background: '#fff',
  color: '#172b42',
  boxSizing: 'border-box',
  fontSize: 14,
};

const buttonStyle = {
  padding: '11px 18px',
  background: '#174b70',
  color: '#fff',
  border: 0,
  borderRadius: 9,
  fontWeight: 700,
  cursor: 'pointer',
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #dbe4ee',
  borderRadius: 12,
  padding: 18,
};

function grantKey(permission, scopeType, scopeId) {
  return `${permission}|${scopeType}|${scopeId || ''}`;
}

function roleLabel(role) {
  return ROLES[role] || role || 'Employee';
}

export default function EnterpriseAccessManagement() {
  const [userId, setUserId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');

  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [grants, setGrants] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [scopeType, setScopeType] = useState('organization');
  const [scopeId, setScopeId] = useState('');
  const [selected, setSelected] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!db) throw new Error('Supabase configuration missing.');

        const auth = await db.auth.getUser();
        if (auth.error) throw auth.error;

        const uid = auth.data?.user?.id;
        if (!uid) throw new Error('Please sign in.');

        const membership = await db
          .from('enterprise_members')
          .select('organization_id,role')
          .eq('user_id', uid);

        if (membership.error) throw membership.error;

        const adminOrgIds = [
          ...new Set(
            (membership.data || [])
              .filter(m => ['owner', 'admin'].includes(m.role))
              .map(m => m.organization_id)
          ),
        ];

        let orgs = [];

        if (adminOrgIds.length) {
          const result = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', adminOrgIds)
            .order('name');

          if (result.error) throw result.error;
          orgs = result.data || [];
        }

        if (!active) return;

        setUserId(uid);
        setOrganizations(orgs);
        setOrganizationId(orgs[0]?.id || '');
      } catch (err) {
        if (active) setError(err.message || 'Initialization failed.');
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      setSelectedUserId('');
      setSelected([]);
      setGrants([]);

      try {
        const results = await Promise.all([
          db.from('enterprise_members')
            .select('organization_id,user_id,role')
            .eq('organization_id', organizationId),

          db.from('enterprise_facilities')
            .select('id,name')
            .eq('organization_id', organizationId)
            .order('name'),

          db.from('enterprise_departments')
            .select('id,name')
            .eq('organization_id', organizationId)
            .order('name'),

          db.from('enterprise_access_grants')
            .select('id,organization_id,user_id,permission_key,scope_type,scope_id,granted_by,created_at')
            .eq('organization_id', organizationId),
        ]);

        for (const result of results) {
          if (result.error) throw result.error;
        }

        const orgMembers = results[0].data || [];
        const memberIds = [...new Set(orgMembers.map(m => m.user_id))];

        let profileRows = [];

        if (memberIds.length) {
          const result = await db
            .from('enterprise_employee_profiles')
            .select('user_id,display_name,job_title')
            .in('user_id', memberIds);

          if (result.error) throw result.error;
          profileRows = result.data || [];
        }

        if (!active) return;

        setMembers(orgMembers);
        setFacilities(results[1].data || []);
        setDepartments(results[2].data || []);
        setGrants(results[3].data || []);
        setProfiles(profileRows);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load access data.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [organizationId]);

  const myRole = members.find(
    m => m.user_id === userId
  )?.role;

  const isAdministrator = ['owner', 'admin'].includes(myRole);

  const employeeOptions = useMemo(() => {
    return members.map(member => {
      const profile = profiles.find(
        p => p.user_id === member.user_id
      );

      return {
        ...member,
        name: profile?.display_name ||
          `Employee ${member.user_id.slice(0, 8)}`,
        jobTitle: profile?.job_title || '',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, profiles]);

  const selectedEmployee = employeeOptions.find(
    m => m.user_id === selectedUserId
  );

  const scopeOptions = scopeType === 'facility'
    ? facilities
    : scopeType === 'department'
      ? departments
      : [];

  const effectiveScopeId = scopeType === 'organization'
    ? ''
    : scopeId;

  const currentGrants = grants.filter(g =>
    g.user_id === selectedUserId &&
    g.scope_type === scopeType &&
    (g.scope_id || '') === effectiveScopeId
  );

  const currentKeys = currentGrants.map(g => g.permission_key);

  function chooseEmployee(id) {
    setSelectedUserId(id);
    setScopeType('organization');
    setScopeId('');
    setSelected(
      grants.filter(g =>
        g.user_id === id &&
        g.scope_type === 'organization'
      ).map(g => g.permission_key)
    );
    setError('');
    setMessage('');
  }

  function chooseScope(type, id = '') {
    setScopeType(type);
    setScopeId(id);

    setSelected(
      grants.filter(g =>
        g.user_id === selectedUserId &&
        g.scope_type === type &&
        (g.scope_id || '') === id
      ).map(g => g.permission_key)
    );

    setError('');
    setMessage('');
  }

  function togglePermission(key, checked) {
    setSelected(previous => checked
      ? [...new Set([...previous, key])]
      : previous.filter(value => value !== key)
    );
  }

  async function reloadGrants() {
    const result = await db
      .from('enterprise_access_grants')
      .select('id,organization_id,user_id,permission_key,scope_type,scope_id,granted_by,created_at')
      .eq('organization_id', organizationId);

    if (result.error) throw result.error;
    setGrants(result.data || []);
    return result.data || [];
  }

  async function savePermissions() {
    if (!isAdministrator || !selectedEmployee || saving) return;

    if (scopeType !== 'organization' && !scopeId) {
      setError('Select a location or department first.');
      return;
    }

    if (!organizations.some(o => o.id === organizationId)) {
      setError('Organization access is not authorized.');
      return;
    }

    const desired = [...new Set(selected)]
      .filter(key => ALL_KEYS.includes(key));

    const toAdd = desired.filter(key => !currentKeys.includes(key));

    const toDelete = currentGrants.filter(
      grant => !desired.includes(grant.permission_key)
    );

    if (!toAdd.length && !toDelete.length) {
      setMessage('No permission changes to save.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      // Deletions and additions are separate database operations.
      // Refresh from the server after any partial failure.
      for (const grant of toDelete) {
        const result = await db
          .from('enterprise_access_grants')
          .delete()
          .eq('id', grant.id)
          .eq('organization_id', organizationId)
          .select('id');

        if (result.error) throw result.error;
        if (result.data?.length !== 1) {
          throw new Error('Permission revocation was not confirmed.');
        }
      }

      if (toAdd.length) {
        const rows = toAdd.map(permission_key => ({
          organization_id: organizationId,
          user_id: selectedUserId,
          permission_key,
          scope_type: scopeType,
          scope_id: scopeType === 'organization' ? null : scopeId,
          granted_by: userId,
        }));

        const result = await db
          .from('enterprise_access_grants')
          .insert(rows)
          .select('id');

        if (result.error) throw result.error;
        if (result.data?.length !== rows.length) {
          throw new Error('Some permission grants were not confirmed.');
        }
      }

      const refreshed = await reloadGrants();
      setSelected(
        refreshed.filter(g =>
          g.user_id === selectedUserId &&
          g.scope_type === scopeType &&
          (g.scope_id || '') === effectiveScopeId
        ).map(g => g.permission_key)
      );

      setMessage('Permissions saved successfully.');
    } catch (err) {
      setError(
        (err.message || 'Permission update failed.') +
        ' Some changes may have been applied. Reloading current access.'
      );

      try {
        const refreshed = await reloadGrants();
        setSelected(
          refreshed.filter(g =>
            g.user_id === selectedUserId &&
            g.scope_type === scopeType &&
            (g.scope_id || '') === effectiveScopeId
          ).map(g => g.permission_key)
        );
      } catch (_) {
        // Keep the original error visible.
      }
    } finally {
      setSaving(false);
    }
  }

  function permissionLabel(key) {
    for (const group of PERMISSIONS) {
      const found = group.items.find(item => item[0] === key);
      if (found) return found[1];
    }
    return key;
  }

  function scopeLabel(grant) {
    if (grant.scope_type === 'organization') {
      return 'Entire company';
    }

    const items = grant.scope_type === 'facility'
      ? facilities
      : departments;

    return items.find(item => item.id === grant.scope_id)?.name ||
      'Unknown scope';
  }

  const employeeGrants = grants.filter(
    g => g.user_id === selectedUserId
  );

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / ADMINISTRATION
          </div>
          <h1>Access Management</h1>
          <p>
            Assign and revoke employee permissions within your company.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <Link href="/collaboration/enterprise/employees">
            Employee Directory →
          </Link>
          <Link href="/collaboration/enterprise/workspace">
            My Workspace →
          </Link>
          <Link href="/collaboration/enterprise/dashboard">
            Executive Dashboard →
          </Link>
        </div>
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

      {loading ? (
        <section className="ent-panel">
          Loading access management…
        </section>
      ) : !organizationId ? (
        <section className="ent-panel">
          You do not have company administrator access.
        </section>
      ) : !isAdministrator ? (
        <section className="ent-panel">
          Access Management is restricted to company administrators.
        </section>
      ) : (
        <>
          <section className="ent-panel" style={{ marginBottom: 16 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <strong>Company</strong>
              <select
                value={organizationId}
                style={fieldStyle}
                disabled={saving}
                onChange={e => {
                  setOrganizationId(e.target.value);
                  setMessage('');
                  setError('');
                }}
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 16,
            alignItems: 'start',
          }}>
            <section className="ent-panel">
              <h2>Select employee</h2>
              <p>
                Choose a company employee to manage their access.
              </p>

              <select
                value={selectedUserId}
                style={fieldStyle}
                disabled={saving}
                onChange={e => chooseEmployee(e.target.value)}
              >
                <option value="">Select an employee</option>
                {employeeOptions.map(employee => (
                  <option
                    key={employee.user_id}
                    value={employee.user_id}
                  >
                    {employee.name}
                  </option>
                ))}
              </select>

              {selectedEmployee && (
                <div style={{ ...cardStyle, marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 6px' }}>
                    {selectedEmployee.name}
                  </h3>

                  {selectedEmployee.jobTitle && (
                    <p>{selectedEmployee.jobTitle}</p>
                  )}

                  <p style={{ marginBottom: 0 }}>
                    <strong>Current role:</strong>{' '}
                    {roleLabel(selectedEmployee.role)}
                  </p>

                  <p style={{
                    color: '#64748b',
                    fontSize: 13,
                    marginBottom: 0,
                  }}>
                    Role editing will be introduced after
                    delegated-role security validation.
                  </p>
                </div>
              )}

              {selectedEmployee && (
                <div style={{ marginTop: 20 }}>
                  <h3>Current explicit grants</h3>

                  {!employeeGrants.length ? (
                    <p style={{ color: '#64748b' }}>
                      No additional permissions granted.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {employeeGrants.map(grant => (
                        <div key={grant.id} style={{
                          padding: 11,
                          background: '#f1f5f9',
                          borderRadius: 8,
                          fontSize: 13,
                        }}>
                          <strong>
                            {permissionLabel(grant.permission_key)}
                          </strong>
                          <div style={{ color: '#64748b' }}>
                            {scopeLabel(grant)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="ent-panel">
              <h2>Permission editor</h2>

              {!selectedEmployee ? (
                <p style={{ color: '#64748b' }}>
                  Select an employee to begin.
                </p>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 7 }}>
                      <strong>Access scope</strong>
                      <select
                        value={scopeType}
                        style={fieldStyle}
                        disabled={saving}
                        onChange={e => chooseScope(e.target.value)}
                      >
                        <option value="organization">
                          Entire company
                        </option>
                        <option value="facility">
                          Specific location / facility
                        </option>
                        <option value="department">
                          Specific department
                        </option>
                      </select>
                    </label>

                    {scopeType !== 'organization' && (
                      <label style={{ display: 'grid', gap: 7 }}>
                        <strong>
                          {scopeType === 'facility'
                            ? 'Location / Facility'
                            : 'Department'}
                        </strong>
                        <select
                          value={scopeId}
                          style={fieldStyle}
                          disabled={saving}
                          onChange={e =>
                            chooseScope(scopeType, e.target.value)
                          }
                        >
                          <option value="">
                            Select {scopeType}
                          </option>
                          {scopeOptions.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {(scopeType === 'organization' || scopeId) && (
                    <>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'center',
                        margin: '20px 0 12px',
                      }}>
                        <strong>Available permissions</strong>
                        <span style={{
                          fontSize: 13,
                          color: '#64748b',
                        }}>
                          {selected.length} selected
                        </span>
                      </div>

                      {PERMISSIONS.map(group => (
                        <div
                          key={group.title}
                          style={{ ...cardStyle, marginBottom: 12 }}
                        >
                          <h3 style={{ marginTop: 0 }}>
                            {group.title}
                          </h3>

                          <div style={{
                            display: 'grid',
                            gap: 12,
                          }}>
                            {group.items.map(([key, label]) => (
                              <label
                                key={key}
                                style={{
                                  display: 'flex',
                                  gap: 10,
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.includes(key)}
                                  disabled={saving}
                                  onChange={e =>
                                    togglePermission(
                                      key,
                                      e.target.checked
                                    )
                                  }
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={saving}
                        onClick={savePermissions}
                      >
                        {saving
                          ? 'Saving permissions…'
                          : 'Save permissions'}
                      </button>

                      <p style={{
                        fontSize: 13,
                        color: '#64748b',
                      }}>
                        Unchecking a permission removes the explicit
                        grant for the selected scope. Existing role
                        privileges may still apply.
                      </p>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
