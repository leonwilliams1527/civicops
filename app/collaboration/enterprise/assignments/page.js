
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function proxyFetch(input, init) {
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
}

const db = url && key
  ? createClient(url, key, {
      global: { fetch: proxyFetch },
    })
  : null;

const field = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  background: '#fff',
  color: '#17324d',
  boxSizing: 'border-box',
};

const button = {
  padding: '10px 14px',
  border: 0,
  borderRadius: 8,
  background: '#174b70',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondary = {
  ...button,
  background: '#e8eff5',
  color: '#17324d',
};

const panel = {
  background: '#fff',
  border: '1px solid #dbe4ee',
  borderRadius: 12,
  padding: 18,
};

const note = {
  color: '#64748b',
  fontSize: 13,
};

export default function EnterpriseAssignments() {
  const [userId, setUserId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationDepartments, setLocationDepartments] = useState([]);
  const [departmentStaff, setDepartmentStaff] = useState([]);

  const [facilityId, setFacilityId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [locationRole, setLocationRole] = useState('staff');
  const [departmentRole, setDepartmentRole] = useState('staff');

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!db) throw new Error('Supabase is not configured.');

        const result = await db.auth.getUser();
        if (result.error) throw result.error;

        const uid = result.data?.user?.id;
        if (!uid) throw new Error('Please sign in.');

        const memberships = await db
          .from('enterprise_members')
          .select('organization_id,role')
          .eq('user_id', uid)
          .eq('role', 'owner');

        if (memberships.error) throw memberships.error;

        const ids = (memberships.data || [])
          .map(m => m.organization_id);

        let orgs = [];

        if (ids.length) {
          const organizationsResult = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', ids)
            .order('name');

          if (organizationsResult.error) {
            throw organizationsResult.error;
          }

          orgs = organizationsResult.data || [];
        }

        if (!active) return;

        setUserId(uid);
        setOrganizations(orgs);
        setOrgId(orgs[0]?.id || '');
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => { active = false; };
  }, []);

  async function fetchCompany(id) {
    const queries = await Promise.all([
      db.from('enterprise_members')
        .select('organization_id,user_id,role')
        .eq('organization_id', id),

      db.from('enterprise_facilities')
        .select('id,name,region')
        .eq('organization_id', id)
        .order('name'),

      db.from('enterprise_departments')
        .select('id,name')
        .eq('organization_id', id)
        .order('name'),

      db.from('enterprise_location_assignments')
        .select('*')
        .eq('organization_id', id),

      db.from('enterprise_location_departments')
        .select('*')
        .eq('organization_id', id),

      db.from('enterprise_location_department_staff')
        .select('*')
        .eq('organization_id', id),
    ]);

    for (const result of queries) {
      if (result.error) throw result.error;
    }

    const memberRows = queries[0].data || [];
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
      facilities: queries[1].data || [],
      departments: queries[2].data || [],
      locations: queries[3].data || [],
      locationDepartments: queries[4].data || [],
      departmentStaff: queries[5].data || [],
      profiles: profileRows,
    };
  }

  function applyData(data) {
    setMembers(data.members);
    setProfiles(data.profiles);
    setFacilities(data.facilities);
    setDepartments(data.departments);
    setLocations(data.locations);
    setLocationDepartments(data.locationDepartments);
    setDepartmentStaff(data.departmentStaff);
  }

  useEffect(() => {
    if (!orgId) return;

    let active = true;
    setLoading(true);
    setError('');
    setFacilityId('');
    setDepartmentId('');
    setEmployeeId('');

    fetchCompany(orgId)
      .then(data => {
        if (!active) return;
        applyData(data);
        setFacilityId(data.facilities[0]?.id || '');
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [orgId]);

  const isOwner = members.some(m =>
    m.organization_id === orgId &&
    m.user_id === userId &&
    m.role === 'owner'
  );

  const employees = useMemo(() => {
    return members.map(member => {
      const profile = profiles.find(
        p => p.user_id === member.user_id
      );

      return {
        ...member,
        name: profile?.display_name ||
          `Employee ${member.user_id.slice(0, 8)}`,
        title: profile?.job_title || '',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, profiles]);

  const currentLocation = facilities.find(
    f => f.id === facilityId
  );

  const currentLocationAssignments = locations.filter(
    a => a.facility_id === facilityId
  );

  const activeDepartments = locationDepartments.filter(
    a => a.facility_id === facilityId
  );

  const currentDepartmentStaff = departmentStaff.filter(
    a => a.facility_id === facilityId &&
      a.department_id === departmentId
  );

  const selectedLocationAssignment = locations.find(
    a => a.facility_id === facilityId &&
      a.user_id === employeeId
  );

  const selectedDepartmentAssignment = departmentStaff.find(
    a => a.facility_id === facilityId &&
      a.department_id === departmentId &&
      a.user_id === employeeId
  );

  function employeeName(uid) {
    return employees.find(e => e.user_id === uid)?.name ||
      `Employee ${uid.slice(0, 8)}`;
  }

  function departmentName(id) {
    return departments.find(d => d.id === id)?.name ||
      'Unknown department';
  }

  async function perform(fn, successMessage) {
    if (!isOwner || busy) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await fn();
      const data = await fetchCompany(orgId);
      applyData(data);
      setMessage(successMessage);
    } catch (err) {
      setError(err.message || 'Unable to save changes.');

      try {
        const data = await fetchCompany(orgId);
        applyData(data);
      } catch (_) {}
    } finally {
      setBusy(false);
    }
  }

  async function callRpc(name, params) {
    const result = await db.rpc(name, params);
    if (result.error) throw result.error;
  }

  function saveLocation() {
    if (!facilityId || !employeeId) return;

    perform(
      () => callRpc('enterprise_set_location_assignment', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_user_id: employeeId,
        p_role: locationRole,
        p_enabled: true,
      }),
      'Location assignment saved.'
    );
  }

  function removeLocation() {
    if (!selectedLocationAssignment) return;

    if (!window.confirm(
      'Remove this employee from the location and its departments?'
    )) return;

    perform(
      () => callRpc('enterprise_set_location_assignment', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_user_id: employeeId,
        p_role: selectedLocationAssignment.assignment_role,
        p_enabled: false,
      }),
      'Location assignment removed.'
    );
  }

  function toggleDepartment(id, enabled) {
    if (!facilityId) return;

    if (!enabled && !window.confirm(
      'Remove this department from this location? Its local staff assignments will also be removed.'
    )) return;

    perform(
      () => callRpc('enterprise_set_location_department', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_department_id: id,
        p_enabled: enabled,
      }),
      enabled
        ? 'Department added to location.'
        : 'Department removed from location.'
    );
  }

  function saveDepartmentStaff() {
    if (!facilityId || !departmentId || !employeeId) return;

    perform(
      () => callRpc('enterprise_set_department_staff', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_department_id: departmentId,
        p_user_id: employeeId,
        p_role: departmentRole,
        p_enabled: true,
      }),
      'Department assignment saved.'
    );
  }

  function removeDepartmentStaff() {
    if (!selectedDepartmentAssignment) return;

    perform(
      () => callRpc('enterprise_set_department_staff', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_department_id: departmentId,
        p_user_id: employeeId,
        p_role: selectedDepartmentAssignment.assignment_role,
        p_enabled: false,
      }),
      'Department assignment removed.'
    );
  }

  const hasActiveDepartment = activeDepartments.some(
    d => d.department_id === departmentId
  );

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / ADMINISTRATION
          </div>
          <h1>Location & Department Assignments</h1>
          <p>
            Assign managers and employees across company locations.
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
        }}>
          <Link href="/collaboration/enterprise/access">
            Access Management
          </Link>
          <Link href="/collaboration/enterprise/employees">
            Employee Directory
          </Link>
          <Link href="/collaboration/enterprise/workspace">
            My Workspace
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
        <section className="ent-panel">Loading assignments…</section>
      ) : !orgId || !isOwner ? (
        <section className="ent-panel">
          This page requires Company Super Admin access.
        </section>
      ) : (
        <>
          <section style={{ ...panel, marginBottom: 16 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 16,
            }}>
              <label style={{ display: 'grid', gap: 7 }}>
                <strong>Company</strong>
                <select
                  style={field}
                  value={orgId}
                  disabled={busy}
                  onChange={e => setOrgId(e.target.value)}
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 7 }}>
                <strong>Location / Facility</strong>
                <select
                  style={field}
                  value={facilityId}
                  disabled={busy}
                  onChange={e => {
                    setFacilityId(e.target.value);
                    setDepartmentId('');
                  }}
                >
                  <option value="">Select a location</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {currentLocation && (
              <p style={{ ...note, marginBottom: 0 }}>
                {currentLocation.name}
                {currentLocation.region
                  ? ` — ${currentLocation.region}`
                  : ''}
              </p>
            )}
          </section>

          {!facilityId ? (
            <section className="ent-panel">
              Create or select a company facility to manage assignments.
            </section>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <section style={panel}>
                <h2>Employee & Location Access</h2>
                <p style={note}>
                  Assign an employee to this location before adding
                  them to a department.
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginBottom: 14,
                }}>
                  <label style={{ display: 'grid', gap: 7 }}>
                    <strong>Employee</strong>
                    <select
                      style={field}
                      value={employeeId}
                      disabled={busy}
                      onChange={e => {
                        const id = e.target.value;
                        setEmployeeId(id);

                        const existing = locations.find(a =>
                          a.facility_id === facilityId &&
                          a.user_id === id
                        );

                        setLocationRole(
                          existing?.assignment_role || 'staff'
                        );

                        const departmentExisting =
                          departmentStaff.find(a =>
                            a.facility_id === facilityId &&
                            a.department_id === departmentId &&
                            a.user_id === id
                          );

                        setDepartmentRole(
                          departmentExisting?.assignment_role || 'staff'
                        );
                      }}
                    >
                      <option value="">Select employee</option>
                      {employees.map(e => (
                        <option key={e.user_id} value={e.user_id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: 7 }}>
                    <strong>Location responsibility</strong>
                    <select
                      style={field}
                      value={locationRole}
                      disabled={busy}
                      onChange={e => setLocationRole(e.target.value)}
                    >
                      <option value="staff">Location Staff</option>
                      <option value="location_manager">
                        Location Manager
                      </option>
                    </select>
                  </label>
                </div>

                <div style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}>
                  <button
                    style={button}
                    disabled={!employeeId || busy}
                    onClick={saveLocation}
                  >
                    {busy ? 'Saving…' : 'Save location assignment'}
                  </button>

                  {selectedLocationAssignment && (
                    <button
                      style={secondary}
                      disabled={busy}
                      onClick={removeLocation}
                    >
                      Remove location access
                    </button>
                  )}
                </div>

                <h3 style={{ marginTop: 24 }}>
                  Assigned employees
                </h3>

                {!currentLocationAssignments.length ? (
                  <p style={note}>No employees assigned yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {currentLocationAssignments.map(a => (
                      <div key={a.id} style={{
                        padding: 12,
                        border: '1px solid #dbe4ee',
                        borderRadius: 9,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}>
                        <strong>{employeeName(a.user_id)}</strong>
                        <span style={note}>
                          {a.assignment_role === 'location_manager'
                            ? 'Location Manager'
                            : 'Staff'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={panel}>
                <h2>Departments at This Location</h2>
                <p style={note}>
                  Activate the departments operating at this facility.
                  The same department can be active at multiple locations.
                </p>

                <div style={{ display: 'grid', gap: 12 }}>
                  {departments.map(department => {
                    const enabled = activeDepartments.some(
                      d => d.department_id === department.id
                    );

                    return (
                      <label key={department.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        border: '1px solid #dbe4ee',
                        borderRadius: 9,
                      }}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={busy}
                          onChange={e =>
                            toggleDepartment(
                              department.id,
                              e.target.checked
                            )
                          }
                        />
                        <strong>{department.name}</strong>
                      </label>
                    );
                  })}
                </div>

                {!departments.length && (
                  <p style={note}>
                    No company departments have been created yet.
                  </p>
                )}
              </section>

              <section style={panel}>
                <h2>Department Managers & Staff</h2>
                <p style={note}>
                  Assign department responsibility within this
                  location only.
                </p>

                <label style={{ display: 'grid', gap: 7 }}>
                  <strong>Active department</strong>
                  <select
                    style={field}
                    value={departmentId}
                    disabled={busy}
                    onChange={e => {
                      const id = e.target.value;
                      setDepartmentId(id);

                      const existing = departmentStaff.find(a =>
                        a.facility_id === facilityId &&
                        a.department_id === id &&
                        a.user_id === employeeId
                      );

                      setDepartmentRole(
                        existing?.assignment_role || 'staff'
                      );
                    }}
                  >
                    <option value="">Select department</option>
                    {activeDepartments.map(d => (
                      <option
                        key={d.department_id}
                        value={d.department_id}
                      >
                        {departmentName(d.department_id)}
                      </option>
                    ))}
                  </select>
                </label>

                {departmentId && hasActiveDepartment && (
                  <>
                    <label style={{
                      display: 'grid',
                      gap: 7,
                      marginTop: 14,
                    }}>
                      <strong>Employee responsibility</strong>
                      <select
                        style={field}
                        value={departmentRole}
                        disabled={busy}
                        onChange={e =>
                          setDepartmentRole(e.target.value)
                        }
                      >
                        <option value="staff">
                          Department Staff
                        </option>
                        <option value="department_manager">
                          Department Manager
                        </option>
                      </select>
                    </label>

                    <div style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginTop: 14,
                    }}>
                      <button
                        style={button}
                        disabled={
                          busy ||
                          !employeeId ||
                          !selectedLocationAssignment
                        }
                        onClick={saveDepartmentStaff}
                      >
                        Save department assignment
                      </button>

                      {selectedDepartmentAssignment && (
                        <button
                          style={secondary}
                          disabled={busy}
                          onClick={removeDepartmentStaff}
                        >
                          Remove department assignment
                        </button>
                      )}
                    </div>

                    {!selectedLocationAssignment && (
                      <p style={note}>
                        Select an employee who has already been
                        assigned to this location.
                      </p>
                    )}

                    <h3 style={{ marginTop: 24 }}>
                      Department team
                    </h3>

                    {!currentDepartmentStaff.length ? (
                      <p style={note}>
                        No employees assigned to this department yet.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {currentDepartmentStaff.map(a => (
                          <div key={a.id} style={{
                            padding: 12,
                            border: '1px solid #dbe4ee',
                            borderRadius: 9,
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                          }}>
                            <strong>{employeeName(a.user_id)}</strong>
                            <span style={note}>
                              {a.assignment_role ===
                                'department_manager'
                                ? 'Department Manager'
                                : 'Staff'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
