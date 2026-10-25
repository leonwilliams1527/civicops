
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

const ROLES = [
  ['owner', 'Company Super Admin'],
  ['admin', 'Company Administrator'],
  ['board_director', 'Board Director'],
  ['executive', 'Executive Leadership'],
  ['location_manager', 'Location Manager'],
  ['department_manager', 'Department Manager'],
  ['manager', 'Manager (Legacy)'],
  ['operator', 'Employee / Operator'],
  ['viewer', 'Employee / Viewer'],
];

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
      ['settings.manage', 'Manage company settings'],
    ],
  },
];

const PERMISSION_KEYS = PERMISSIONS.flatMap(
  group => group.items.map(([key]) => key)
);

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
  border: 0,
  borderRadius: 9,
  background: '#174b70',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton = {
  ...buttonStyle,
  background: '#edf3f8',
  color: '#17324d',
  border: '1px solid #cbd5e1',
};

const cardStyle = {
  background: '#fff',
  border: '1px solid #dbe4ee',
  borderRadius: 12,
  padding: 18,
};

const muted = { color: '#64748b', fontSize: 13 };

function roleLabel(role) {
  return ROLES.find(([id]) => id === role)?.[1] || role;
}

function permissionLabel(key) {
  for (const group of PERMISSIONS) {
    const item = group.items.find(([id]) => id === key);
    if (item) return item[1];
  }
  return key;
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
  const [roleDraft, setRoleDraft] = useState('');
  const [scopeType, setScopeType] = useState('organization');
  const [scopeId, setScopeId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);

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

        const ids = [
          ...new Set(
            (membership.data || [])
              .filter(m => ['owner', 'admin'].includes(m.role))
              .map(m => m.organization_id)
          ),
        ];

        let orgs = [];

        if (ids.length) {
          const result = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', ids)
            .order('name');

          if (result.error) throw result.error;
          orgs = result.data || [];
        }

        if (!active) return;

        setUserId(uid);
        setOrganizations(orgs);
        setOrganizationId(orgs[0]?.id || '');
      } catch (err) {
        if (active) setError(err.message || 'Unable to initialize.');
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => { active = false; };
  }, []);

  async function loadCompany(orgId) {
    const results = await Promise.all([
      db.from('enterprise_members')
        .select('organization_id,user_id,role')
        .eq('organization_id', orgId),

      db.from('enterprise_facilities')
        .select('id,name')
        .eq('organization_id', orgId)
        .order('name'),

      db.from('enterprise_departments')
        .select('id,name')
        .eq('organization_id', orgId)
        .order('name'),

      db.from('enterprise_access_grants')
        .select('*')
        .eq('organization_id', orgId),
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    const memberRows = results[0].data || [];
    const ids = [...new Set(memberRows.map(m => m.user_id))];
    let profileRows = [];

    if (ids.length) {
      const result = await db
        .from('enterprise_employee_profiles')
        .select('user_id,display_name,job_title')
        .in('user_id', ids);

      if (result.error) throw result.error;
      profileRows = result.data || [];
    }

    return {
      members: memberRows,
      facilities: results[1].data || [],
      departments: results[2].data || [],
      grants: results[3].data || [],
      profiles: profileRows,
    };
  }

  function applyCompany(data) {
    setMembers(data.members);
    setFacilities(data.facilities);
    setDepartments(data.departments);
    setGrants(data.grants);
    setProfiles(data.profiles);
  }

  useEffect(() => {
    if (!organizationId) return;

    let active = true;
    setLoading(true);
    setError('');
    setSelectedUserId('');
    setSelectedPermissions([]);

    loadCompany(organizationId)
      .then(data => {
        if (active) applyCompany(data);
      })
      .catch(err => {
        if (active) setError(err.message || 'Unable to load company.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [organizationId]);

  const myRole = members.find(
    m => m.user_id === userId
  )?.role;

  const isOwner = myRole === 'owner';
  const isAdministrator = ['owner', 'admin'].includes(myRole);

  const employees = useMemo(() => {
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

  const employee = employees.find(
    m => m.user_id === selectedUserId
  );

  const employeeIsOwner = employee?.role === 'owner';

  const scopeOptions = scopeType === 'facility'
    ? facilities
    : scopeType === 'department'
      ? departments
      : [];

  const currentGrants = grants.filter(g =>
    g.user_id === selectedUserId &&
    g.scope_type === scopeType &&
    (g.scope_id || '') === (
      scopeType === 'organization' ? '' : scopeId
    )
  );

  const currentKeys = currentGrants.map(
    g => g.permission_key
  );

  const employeeGrants = grants.filter(
    g => g.user_id === selectedUserId
  );

  function chooseEmployee(id) {
    const next = employees.find(m => m.user_id === id);

    setSelectedUserId(id);
    setRoleDraft(next?.role || '');
    setScopeType('organization');
    setScopeId('');
    setSelectedPermissions(
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
    setSelectedPermissions(
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
    setSelectedPermissions(previous => checked
      ? [...new Set([...previous, key])]
      : previous.filter(value => value !== key)
    );
  }

  async function refreshCompany() {
    const data = await loadCompany(organizationId);
    applyCompany(data);
    return data;
  }

  async function saveRole() {
    if (!isOwner || !employee || saving) return;
    if (roleDraft === employee.role) return;

    if (!ROLES.some(([role]) => role === roleDraft)) {
      setError('Select a valid role.');
      return;
    }

    if (
      !window.confirm(
        `Change ${employee.name}'s role to ${roleLabel(roleDraft)}?`
      )
    ) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await db.rpc('enterprise_assign_member_role', {
        p_organization_id: organizationId,
        p_user_id: selectedUserId,
        p_new_role: roleDraft,
      });

      if (result.error) throw result.error;

      const data = await refreshCompany();
      const updated = data.members.find(
        m => m.user_id === selectedUserId
      );

      if (updated?.role !== roleDraft) {
        throw new Error('Role change could not be verified.');
      }

      setMessage('Employee role updated successfully.');
    } catch (err) {
      setError(err.message || 'Unable to change employee role.');
      try {
        const data = await refreshCompany();
        setRoleDraft(
          data.members.find(m => m.user_id === selectedUserId)?.role || ''
        );
      } catch (_) {}
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions() {
    if (!isAdministrator || !employee || saving) return;

    if (employeeIsOwner) {
      setError('Super Admin access is inherited and cannot be edited here.');
      return;
    }

    if (scopeType !== 'organization' && !scopeId) {
      setError('Select a location or department.');
      return;
    }

    const desired = [...new Set(selectedPermissions)]
      .filter(key => PERMISSION_KEYS.includes(key));

    const additions = desired.filter(
      key => !currentKeys.includes(key)
    );

    const removals = currentGrants.filter(
      grant => !desired.includes(grant.permission_key)
    );

    if (!additions.length && !removals.length) {
      setMessage('No changes to save.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      for (const grant of removals) {
        const result = await db
          .from('enterprise_access_grants')
          .delete()
          .eq('id', grant.id)
          .eq('organization_id', organizationId)
          .select('id');

        if (result.error) throw result.error;
        if (result.data?.length !== 1) {
          throw new Error('Revocation could not be verified.');
        }
      }

      if (additions.length) {
        const rows = additions.map(permission_key => ({
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
          throw new Error('Grant creation could not be verified.');
        }
      }

      const data = await refreshCompany();

      setSelectedPermissions(
        data.grants.filter(g =>
          g.user_id === selectedUserId &&
          g.scope_type === scopeType &&
          (g.scope_id || '') === (
            scopeType === 'organization' ? '' : scopeId
          )
        ).map(g => g.permission_key)
      );

      setMessage('Employee permissions saved.');
    } catch (err) {
      setError(
        (err.message || 'Permission save failed.') +
        ' Changes may be partial; reload the current grants.'
      );

      try {
        const data = await refreshCompany();
        setSelectedPermissions(
          data.grants.filter(g =>
            g.user_id === selectedUserId &&
            g.scope_type === scopeType &&
            (g.scope_id || '') === (
              scopeType === 'organization' ? '' : scopeId
            )
          ).map(g => g.permission_key)
        );
      } catch (_) {}
    } finally {
      setSaving(false);
    }
  }

  function scopeLabel(grant) {
    if (grant.scope_type === 'organization') return 'Entire company';

    const collection = grant.scope_type === 'facility'
      ? facilities
      : departments;

    return collection.find(item => item.id === grant.scope_id)?.name ||
      'Unknown scope';
  }

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / ADMINISTRATION
          </div>
          <h1>Access Management</h1>
          <p>
            Manage company roles, locations, departments and permissions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
        <div className="ent-error" role="alert">{error}</div>
      )}

      {message && (
        <p role="status" style={{ color: '#176346' }}>{message}</p>
      )}

      {loading ? (
        <section className="ent-panel">Loading access management…</section>
      ) : !organizationId || !isAdministrator ? (
        <section className="ent-panel">
          Access Management is restricted to company administrators.
        </section>
      ) : (
        <>
          <section className="ent-panel" style={{ marginBottom: 16 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <strong>Company</strong>
              <select
                style={fieldStyle}
                value={organizationId}
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

            {isOwner && (
              <div style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 10,
                background: '#eaf5ef',
                border: '1px solid #b9dec8',
                color: '#175b3c',
              }}>
                <strong>Super Admin — Full company authority</strong>
                <p style={{ margin: '5px 0 0', fontSize: 13 }}>
                  Your owner role grants company-level administrative
                  authority without requiring explicit permission
                  checkboxes. Operational modules must also enforce
                  this role in their database policies.
                </p>
              </div>
            )}
          </section>

          <div style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(310px, 1fr))',
            gap: 16,
            alignItems: 'start',
          }}>
            <section className="ent-panel">
              <h2>Select employee</h2>
              <p>Manage an employee within this company.</p>

              <select
                value={selectedUserId}
                style={fieldStyle}
                disabled={saving}
                onChange={e => chooseEmployee(e.target.value)}
              >
                <option value="">Select an employee</option>
                {employees.map(item => (
                  <option key={item.user_id} value={item.user_id}>
                    {item.name}
                  </option>
                ))}
              </select>

              {employee && (
                <>
                  <div style={{ ...cardStyle, marginTop: 16 }}>
                    <h3 style={{ margin: '0 0 6px' }}>
                      {employee.name}
                    </h3>

                    {employee.jobTitle && (
                      <p style={{ margin: '0 0 10px' }}>
                        {employee.jobTitle}
                      </p>
                    )}

                    <p style={{ margin: 0 }}>
                      <strong>Current role:</strong>{' '}
                      {roleLabel(employee.role)}
                    </p>

                    {employeeIsOwner && (
                      <p style={{
                        marginBottom: 0,
                        color: '#176346',
                        fontSize: 13,
                      }}>
                        Full company access is inherited from the
                        Super Admin role.
                      </p>
                    )}
                  </div>

                  <div style={{ ...cardStyle, marginTop: 16 }}>
                    <h3 style={{ marginTop: 0 }}>
                      Organizational role
                    </h3>

                    <label style={{ display: 'grid', gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>
                        Assign role
                      </strong>

                      <select
                        value={roleDraft}
                        style={fieldStyle}
                        disabled={!isOwner || saving}
                        onChange={e => setRoleDraft(e.target.value)}
                      >
                        {ROLES.map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      style={{ ...buttonStyle, marginTop: 12 }}
                      disabled={
                        !isOwner ||
                        saving ||
                        roleDraft === employee.role
                      }
                      onClick={saveRole}
                    >
                      {saving ? 'Saving…' : 'Update employee role'}
                    </button>

                    <p style={{ ...muted, marginBottom: 0 }}>
                      Only a Company Super Admin can assign roles.
                      The final Super Admin cannot be demoted.
                    </p>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <h3>Current explicit grants</h3>

                    {!employeeGrants.length ? (
                      <p style={muted}>
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
                            <div style={muted}>
                              {scopeLabel(grant)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="ent-panel">
              <h2>Permission editor</h2>

              {!employee ? (
                <p style={muted}>Select an employee to begin.</p>
              ) : employeeIsOwner ? (
                <div style={{
                  ...cardStyle,
                  background: '#f0f8f3',
                  borderColor: '#b9dec8',
                }}>
                  <h3 style={{ marginTop: 0 }}>
                    Full company access
                  </h3>
                  <p>
                    This employee is a Company Super Admin.
                    Their authority is inherited from their role.
                  </p>
                  <p style={muted}>
                    Individual checkboxes are not required.
                    This authority applies only within the
                    employee's own company.
                  </p>
                </div>
              ) : (
                <>
                  <label style={{ display: 'grid', gap: 8 }}>
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
                    <label style={{
                      display: 'grid',
                      gap: 8,
                      marginTop: 14,
                    }}>
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
                        <option value="">Select {scopeType}</option>
                        {scopeOptions.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {(scopeType === 'organization' || scopeId) && (
                    <>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        margin: '20px 0 12px',
                      }}>
                        <strong>Available permissions</strong>
                        <span style={muted}>
                          {selectedPermissions.length} selected
                        </span>
                      </div>

                      {PERMISSIONS.map(group => (
                        <div key={group.title} style={{
                          ...cardStyle,
                          marginBottom: 12,
                        }}>
                          <h3 style={{ marginTop: 0 }}>
                            {group.title}
                          </h3>

                          <div style={{
                            display: 'grid',
                            gap: 12,
                          }}>
                            {group.items.map(([key, label]) => (
                              <label key={key} style={{
                                display: 'flex',
                                gap: 10,
                                alignItems: 'center',
                              }}>
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(key)}
                                  disabled={saving}
                                  onChange={e =>
                                    togglePermission(
                                      key,
                                      e.target.checked
                                    )
                                  }
                                />
                                {label}
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

                      <p style={{ ...muted, marginTop: 12 }}>
                        These checkboxes manage explicit access grants.
                        Role-based permissions and older module policies
                        may also apply until the full authorization
                        integration is completed.
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
