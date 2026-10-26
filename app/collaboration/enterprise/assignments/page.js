
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function proxyFetch(input, init) {
  const raw = typeof input === 'string' ? input : input.url;
  const parsed = new URL(raw);

  if (
    SUPABASE_URL &&
    parsed.hostname === new URL(SUPABASE_URL).hostname &&
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

const db = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { fetch: proxyFetch },
    })
  : null;

const styles = {
  panel: {
    padding: 20,
    borderRadius: 12,
    border: '1px solid #dbe4ee',
    background: '#fff',
  },
  input: {
    width: '100%',
    minHeight: 42,
    padding: '10px 12px',
    borderRadius: 9,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#17324d',
    boxSizing: 'border-box',
  },
  primary: {
    padding: '11px 15px',
    border: 0,
    borderRadius: 8,
    background: '#174b70',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondary: {
    padding: '11px 15px',
    border: 0,
    borderRadius: 8,
    background: '#e7eef5',
    color: '#17324d',
    fontWeight: 700,
    cursor: 'pointer',
  },
  muted: {
    color: '#60748b',
    fontSize: 13,
  },
  field: {
    display: 'grid',
    gap: 7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
  },
  actions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 15,
  },
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString();
}

function displayRole(role) {
  const labels = {
    owner: 'Company Super Admin',
    admin: 'Company Administrator',
    board_director: 'Board Director',
    executive: 'Executive Leadership',
    location_manager: 'Location Manager',
    department_manager: 'Department Manager',
    manager: 'Manager (Legacy)',
    operator: 'Employee / Operator',
    viewer: 'Employee / Viewer',
    staff: 'Staff',
  };
  return labels[role] || role || 'Employee';
}

function eventLabel(row) {
  const type = {
    location: 'Location assignment',
    department_staff: 'Department assignment',
    location_department: 'Location department',
  }[row.assignment_type] || 'Assignment';

  const action = {
    assigned: 'added',
    updated: 'updated',
    removed: 'removed',
  }[row.action] || row.action;

  return `${type} ${action}`;
}

export default function EnterpriseAssignmentsPage() {
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
  const [audit, setAudit] = useState([]);

  const [facilityId, setFacilityId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [locationRole, setLocationRole] = useState('staff');
  const [departmentRole, setDepartmentRole] = useState('staff');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAudit, setShowAudit] = useState(true);

  const read = useCallback(async (table, org, columns = '*') => {
    const result = await db
      .from(table)
      .select(columns)
      .eq('organization_id', org);

    if (result.error) throw result.error;
    return result.data || [];
  }, []);

  useEffect(() => {
    let alive = true;

    async function initialize() {
      try {
        if (!db) {
          throw new Error('Supabase configuration is missing.');
        }

        const authResult = await db.auth.getUser();
        if (authResult.error) throw authResult.error;

        const uid = authResult.data?.user?.id;
        if (!uid) throw new Error('Please sign in.');

        const memberships = await db
          .from('enterprise_members')
          .select('organization_id,role')
          .eq('user_id', uid);

        if (memberships.error) throw memberships.error;

        const ids = [
          ...new Set(
            (memberships.data || []).map(m => m.organization_id)
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

        if (!alive) return;

        setUserId(uid);
        setOrganizations(orgs);
        setOrgId(orgs[0]?.id || '');
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    initialize();
    return () => { alive = false; };
  }, []);

  const loadCompany = useCallback(async (organizationId) => {
    const [
      memberRows,
      facilityRows,
      departmentRows,
      locationRows,
      locationDepartmentRows,
      staffRows,
      auditRows,
    ] = await Promise.all([
      read('enterprise_members', organizationId,
        'organization_id,user_id,role'),
      read('enterprise_facilities', organizationId,
        'id,organization_id,name,region'),
      read('enterprise_departments', organizationId,
        'id,organization_id,name'),
      read('enterprise_location_assignments', organizationId),
      read('enterprise_location_departments', organizationId),
      read('enterprise_location_department_staff', organizationId),
      read('enterprise_assignment_audit', organizationId),
    ]);

    const userIds = [
      ...new Set(memberRows.map(m => m.user_id)),
    ];

    let profileRows = [];

    if (userIds.length) {
      const result = await db
        .from('enterprise_employee_profiles')
        .select('user_id,display_name,job_title')
        .in('user_id', userIds);

      if (result.error) throw result.error;
      profileRows = result.data || [];
    }

    return {
      members: memberRows,
      facilities: facilityRows,
      departments: departmentRows,
      locations: locationRows,
      locationDepartments: locationDepartmentRows,
      departmentStaff: staffRows,
      audit: auditRows,
      profiles: profileRows,
    };
  }, [read]);

  const applyCompany = useCallback((data) => {
    setMembers(data.members);
    setFacilities(data.facilities);
    setDepartments(data.departments);
    setLocations(data.locations);
    setLocationDepartments(data.locationDepartments);
    setDepartmentStaff(data.departmentStaff);
    setAudit(data.audit);
    setProfiles(data.profiles);
  }, []);

  useEffect(() => {
    if (!orgId || !userId) return;

    let alive = true;
    setLoading(true);
    setError('');
    setMessage('');
    setFacilityId('');
    setDepartmentId('');
    setEmployeeId('');

    loadCompany(orgId)
      .then(data => {
        if (!alive) return;
        applyCompany(data);
      })
      .catch(err => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [orgId, userId, loadCompany, applyCompany]);

  const myMembership = members.find(
    m => m.organization_id === orgId && m.user_id === userId
  );

  const isOwner = myMembership?.role === 'owner';

  const managedLocationIds = useMemo(() => {
    if (isOwner) {
      return new Set(facilities.map(f => f.id));
    }

    return new Set(
      locations
        .filter(a =>
          a.user_id === userId &&
          a.assignment_role === 'location_manager'
        )
        .map(a => a.facility_id)
    );
  }, [isOwner, facilities, locations, userId]);

  const managedDepartmentPairs = useMemo(() => {
    return new Set(
      departmentStaff
        .filter(a =>
          a.user_id === userId &&
          a.assignment_role === 'department_manager'
        )
        .map(a => `${a.facility_id}:${a.department_id}`)
    );
  }, [departmentStaff, userId]);

  const visibleFacilities = useMemo(() => {
    return facilities.filter(f =>
      isOwner ||
      managedLocationIds.has(f.id) ||
      [...managedDepartmentPairs].some(
        pair => pair.startsWith(`${f.id}:`)
      )
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [
    facilities,
    isOwner,
    managedLocationIds,
    managedDepartmentPairs,
  ]);

  useEffect(() => {
    if (loading) return;

    if (
      facilityId &&
      visibleFacilities.some(f => f.id === facilityId)
    ) return;

    setFacilityId(visibleFacilities[0]?.id || '');
  }, [visibleFacilities, facilityId, loading]);

  const canManageLocation =
    !!facilityId &&
    (isOwner || managedLocationIds.has(facilityId));

  const visibleLocationDepartments = useMemo(() => {
    return locationDepartments.filter(row =>
      row.facility_id === facilityId &&
      (
        canManageLocation ||
        managedDepartmentPairs.has(
          `${row.facility_id}:${row.department_id}`
        )
      )
    );
  }, [
    locationDepartments,
    facilityId,
    canManageLocation,
    managedDepartmentPairs,
  ]);

  const visibleDepartmentIds = new Set(
    visibleLocationDepartments.map(d => d.department_id)
  );

  const canManageDepartment =
    !!departmentId &&
    (
      canManageLocation ||
      managedDepartmentPairs.has(
        `${facilityId}:${departmentId}`
      )
    );

  useEffect(() => {
    if (
      departmentId &&
      visibleDepartmentIds.has(departmentId)
    ) return;

    setDepartmentId(
      visibleLocationDepartments[0]?.department_id || ''
    );
  }, [facilityId, visibleLocationDepartments, departmentId]);

  const employees = useMemo(() => {
    return members.map(member => {
      const profile = profiles.find(
        p => p.user_id === member.user_id
      );

      return {
        ...member,
        name:
          profile?.display_name ||
          `Employee ${member.user_id.slice(0, 8)}`,
        title: profile?.job_title || '',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, profiles]);

  const locationAssignments = locations.filter(
    a => a.facility_id === facilityId
  );

  const departmentAssignments = departmentStaff.filter(
    a =>
      a.facility_id === facilityId &&
      a.department_id === departmentId
  );

  const selectedLocationAssignment = locations.find(
    a =>
      a.facility_id === facilityId &&
      a.user_id === employeeId
  );

  const selectedDepartmentAssignment = departmentStaff.find(
    a =>
      a.facility_id === facilityId &&
      a.department_id === departmentId &&
      a.user_id === employeeId
  );

  const currentFacility = facilities.find(
    f => f.id === facilityId
  );

  const canManageSelectedLocationRole =
    isOwner ||
    (
      canManageLocation &&
      locationRole === 'staff' &&
      selectedLocationAssignment?.assignment_role !==
        'location_manager'
    );

  const canManageSelectedDepartmentRole =
    canManageLocation ||
    (
      canManageDepartment &&
      departmentRole === 'staff' &&
      selectedDepartmentAssignment?.assignment_role !==
        'department_manager'
    );

  function employeeName(id) {
    if (!id) return '—';
    return employees.find(e => e.user_id === id)?.name ||
      `Employee ${id.slice(0, 8)}`;
  }

  function departmentName(id) {
    return departments.find(d => d.id === id)?.name ||
      'Unknown department';
  }

  async function refresh() {
    const data = await loadCompany(orgId);
    applyCompany(data);
  }

  async function runAction(operation, success) {
    if (busy) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await operation();
      await refresh();
      setMessage(success);
    } catch (err) {
      setError(err.message || 'Unable to save changes.');
      try {
        await refresh();
      } catch (_) {
        // Keep the original error visible.
      }
    } finally {
      setBusy(false);
    }
  }

  async function rpc(name, params) {
    const result = await db.rpc(name, params);
    if (result.error) throw result.error;
  }

  function saveLocation() {
    if (
      !employeeId ||
      !facilityId ||
      !canManageSelectedLocationRole
    ) return;

    runAction(
      () => rpc('enterprise_set_location_assignment', {
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
    if (
      !selectedLocationAssignment ||
      !canManageLocation ||
      (
        !isOwner &&
        selectedLocationAssignment.assignment_role ===
          'location_manager'
      )
    ) return;

    if (!window.confirm(
      'Remove this employee from this location and its departments?'
    )) return;

    runAction(
      () => rpc('enterprise_set_location_assignment', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_user_id: employeeId,
        p_role: selectedLocationAssignment.assignment_role,
        p_enabled: false,
      }),
      'Location access removed.'
    );
  }

  function toggleDepartment(id, enabled) {
    if (!canManageLocation || busy) return;

    if (!enabled && !window.confirm(
      'Remove this department from the location? Its local staff assignments will also be removed.'
    )) return;

    runAction(
      () => rpc('enterprise_set_location_department', {
        p_organization_id: orgId,
        p_facility_id: facilityId,
        p_department_id: id,
        p_enabled: enabled,
      }),
      enabled
        ? 'Department activated at location.'
        : 'Department removed from location.'
    );
  }

  function saveDepartmentStaff() {
    if (
      !employeeId ||
      !departmentId ||
      !selectedLocationAssignment ||
      !canManageSelectedDepartmentRole
    ) return;

    runAction(
      () => rpc('enterprise_set_department_staff', {
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
    if (
      !selectedDepartmentAssignment ||
      !canManageDepartment ||
      (
        !canManageLocation &&
        selectedDepartmentAssignment.assignment_role ===
          'department_manager'
      )
    ) return;

    runAction(
      () => rpc('enterprise_set_department_staff', {
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

  const visibleAudit = useMemo(() => {
    return audit
      .filter(row => {
        if (isOwner) return true;

        if (managedLocationIds.has(row.facility_id)) {
          return true;
        }

        return row.department_id &&
          managedDepartmentPairs.has(
            `${row.facility_id}:${row.department_id}`
          );
      })
      .filter(row =>
        !facilityId || row.facility_id === facilityId
      )
      .sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      )
      .slice(0, 100);
  }, [
    audit,
    isOwner,
    facilityId,
    managedLocationIds,
    managedDepartmentPairs,
  ]);

  function chooseEmployee(id) {
    setEmployeeId(id);

    const location = locations.find(
      a => a.facility_id === facilityId && a.user_id === id
    );

    const department = departmentStaff.find(
      a =>
        a.facility_id === facilityId &&
        a.department_id === departmentId &&
        a.user_id === id
    );

    setLocationRole(location?.assignment_role || 'staff');
    setDepartmentRole(department?.assignment_role || 'staff');
  }

  function chooseDepartment(id) {
    setDepartmentId(id);

    const existing = departmentStaff.find(
      a =>
        a.facility_id === facilityId &&
        a.department_id === id &&
        a.user_id === employeeId
    );

    setDepartmentRole(existing?.assignment_role || 'staff');
  }

  const accessTitle = isOwner
    ? 'Company Super Admin'
    : canManageLocation
      ? 'Location Manager'
      : 'Department Manager';

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / ADMINISTRATION
          </div>
          <h1>Location & Department Assignments</h1>
          <p>
            Manage location responsibilities, departmental teams,
            and delegated access.
          </p>
        </div>

        <nav style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
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
        </nav>
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
          Loading company assignments…
        </section>
      ) : !orgId ? (
        <section className="ent-panel">
          No enterprise company membership was found.
        </section>
      ) : !visibleFacilities.length ? (
        <section className="ent-panel">
          You do not currently manage any company locations or
          departments. Contact your Company Super Admin for access.
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <section style={styles.panel}>
            <div style={styles.grid}>
              <label style={styles.field}>
                <strong>Company</strong>
                <select
                  style={styles.input}
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

              <label style={styles.field}>
                <strong>Location / Facility</strong>
                <select
                  style={styles.input}
                  value={facilityId}
                  disabled={busy}
                  onChange={e => {
                    setFacilityId(e.target.value);
                    setDepartmentId('');
                    setEmployeeId('');
                    setLocationRole('staff');
                    setDepartmentRole('staff');
                  }}
                >
                  {visibleFacilities.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p style={{
              ...styles.muted,
              marginTop: 13,
              marginBottom: 0,
            }}>
              {currentFacility?.name || 'Select location'}
              {currentFacility?.region
                ? ` — ${currentFacility.region}`
                : ''}
              {' • '}
              Your access: {accessTitle}
            </p>
          </section>

          <section style={styles.panel}>
            <h2>Employee & Location Access</h2>

            <p style={styles.muted}>
              {canManageLocation
                ? 'Assign employees to this location. Only Company Super Admins can appoint Location Managers.'
                : 'Location assignment is managed by your Location Manager or Company Super Admin.'}
            </p>

            {canManageLocation && (
              <>
                <div style={styles.grid}>
                  <label style={styles.field}>
                    <strong>Employee</strong>
                    <select
                      style={styles.input}
                      value={employeeId}
                      disabled={busy}
                      onChange={e =>
                        chooseEmployee(e.target.value)
                      }
                    >
                      <option value="">Select employee</option>
                      {employees.map(e => (
                        <option
                          key={e.user_id}
                          value={e.user_id}
                        >
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.field}>
                    <strong>Location responsibility</strong>
                    <select
                      style={styles.input}
                      value={locationRole}
                      disabled={busy}
                      onChange={e =>
                        setLocationRole(e.target.value)
                      }
                    >
                      <option value="staff">
                        Location Staff
                      </option>
                      {isOwner && (
                        <option value="location_manager">
                          Location Manager
                        </option>
                      )}
                    </select>
                  </label>
                </div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.primary}
                    disabled={
                      busy ||
                      !employeeId ||
                      !canManageSelectedLocationRole
                    }
                    onClick={saveLocation}
                  >
                    {busy
                      ? 'Saving…'
                      : 'Save location assignment'}
                  </button>

                  {selectedLocationAssignment &&
                    (
                      isOwner ||
                      selectedLocationAssignment.assignment_role
                        !== 'location_manager'
                    ) && (
                      <button
                        type="button"
                        style={styles.secondary}
                        disabled={busy}
                        onClick={removeLocation}
                      >
                        Remove location access
                      </button>
                    )}
                </div>
              </>
            )}

            <h3 style={{ marginTop: 24 }}>
              Assigned employees
            </h3>

            {locationAssignments.length ? (
              <div style={{ display: 'grid', gap: 9 }}>
                {locationAssignments.map(a => (
                  <div key={a.id} style={{
                    padding: 13,
                    border: '1px solid #dbe4ee',
                    borderRadius: 9,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}>
                    <strong>{employeeName(a.user_id)}</strong>
                    <span style={styles.muted}>
                      {displayRole(a.assignment_role)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.muted}>
                No visible location assignments.
              </p>
            )}
          </section>

          <section style={styles.panel}>
            <h2>Departments at This Location</h2>

            <p style={styles.muted}>
              {canManageLocation
                ? 'Activate or deactivate departments at this facility.'
                : 'You can view departments assigned to you.'}
            </p>

            <div style={{ display: 'grid', gap: 10 }}>
              {(canManageLocation
                ? departments
                : departments.filter(d =>
                    visibleDepartmentIds.has(d.id)
                  )
              ).map(d => {
                const enabled =
                  visibleDepartmentIds.has(d.id);

                return (
                  <label key={d.id} style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: 13,
                    border: '1px solid #dbe4ee',
                    borderRadius: 9,
                  }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={!canManageLocation || busy}
                      onChange={e =>
                        toggleDepartment(
                          d.id,
                          e.target.checked
                        )
                      }
                    />
                    <strong>{d.name}</strong>
                  </label>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <h2>Department Managers & Staff</h2>

            <p style={styles.muted}>
              Department Managers can allocate staff within
              their assigned department. Location Managers can
              also appoint Department Managers.
            </p>

            <label style={styles.field}>
              <strong>Active department</strong>
              <select
                style={styles.input}
                value={departmentId}
                disabled={busy}
                onChange={e =>
                  chooseDepartment(e.target.value)
                }
              >
                <option value="">Select department</option>
                {visibleLocationDepartments.map(d => (
                  <option
                    key={d.department_id}
                    value={d.department_id}
                  >
                    {departmentName(d.department_id)}
                  </option>
                ))}
              </select>
            </label>

            {departmentId && canManageDepartment && (
              <>
                {!canManageLocation && (
                  <label style={{
                    ...styles.field,
                    marginTop: 14,
                  }}>
                    <strong>Employee</strong>
                    <select
                      style={styles.input}
                      value={employeeId}
                      disabled={busy}
                      onChange={e =>
                        chooseEmployee(e.target.value)
                      }
                    >
                      <option value="">Select employee</option>
                      {employees.map(e => (
                        <option
                          key={e.user_id}
                          value={e.user_id}
                        >
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label style={{
                  ...styles.field,
                  marginTop: 14,
                }}>
                  <strong>Employee responsibility</strong>
                  <select
                    style={styles.input}
                    value={departmentRole}
                    disabled={busy}
                    onChange={e =>
                      setDepartmentRole(e.target.value)
                    }
                  >
                    <option value="staff">
                      Department Staff
                    </option>
                    {canManageLocation && (
                      <option value="department_manager">
                        Department Manager
                      </option>
                    )}
                  </select>
                </label>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.primary}
                    disabled={
                      busy ||
                      !employeeId ||
                      !selectedLocationAssignment ||
                      !canManageSelectedDepartmentRole
                    }
                    onClick={saveDepartmentStaff}
                  >
                    Save department assignment
                  </button>

                  {selectedDepartmentAssignment &&
                    (
                      canManageLocation ||
                      selectedDepartmentAssignment.assignment_role
                        !== 'department_manager'
                    ) && (
                      <button
                        type="button"
                        style={styles.secondary}
                        disabled={busy}
                        onClick={removeDepartmentStaff}
                      >
                        Remove department assignment
                      </button>
                    )}
                </div>

                {!selectedLocationAssignment && employeeId && (
                  <p style={styles.muted}>
                    This employee must first be assigned to
                    the location by an authorized Location Manager.
                  </p>
                )}
              </>
            )}

            {departmentId && (
              <>
                <h3 style={{ marginTop: 24 }}>
                  Department team
                </h3>

                {departmentAssignments.length ? (
                  <div style={{ display: 'grid', gap: 9 }}>
                    {departmentAssignments.map(a => (
                      <div key={a.id} style={{
                        padding: 13,
                        border: '1px solid #dbe4ee',
                        borderRadius: 9,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}>
                        <strong>
                          {employeeName(a.user_id)}
                        </strong>
                        <span style={styles.muted}>
                          {displayRole(a.assignment_role)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.muted}>
                    No department employees assigned.
                  </p>
                )}
              </>
            )}
          </section>

          <section style={styles.panel}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div>
                <h2 style={{ marginBottom: 6 }}>
                  Assignment Audit History
                </h2>
                <p style={styles.muted}>
                  Changes recorded for locations and departments
                  within your management scope.
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: 10,
              }}>
                <button
                  type="button"
                  style={styles.secondary}
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      async () => {},
                      'Assignments refreshed.'
                    )
                  }
                >
                  Refresh
                </button>

                <button
                  type="button"
                  style={styles.secondary}
                  onClick={() => setShowAudit(v => !v)}
                >
                  {showAudit ? 'Hide history' : 'Show history'}
                </button>
              </div>
            </div>

            {showAudit && (
              !visibleAudit.length ? (
                <p style={styles.muted}>
                  No visible assignment activity yet.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14,
                  }}>
                    <thead>
                      <tr>
                        {[
                          'Date',
                          'Action',
                          'Employee',
                          'Performed by',
                          'Department',
                          'Role change',
                        ].map(label => (
                          <th key={label} style={{
                            textAlign: 'left',
                            padding: 12,
                            borderBottom: '1px solid #dbe4ee',
                          }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {visibleAudit.map(row => (
                        <tr key={row.id}>
                          <td style={{
                            padding: 12,
                            borderBottom: '1px solid #eef2f7',
                            whiteSpace: 'nowrap',
                          }}>
                            {formatDate(row.created_at)}
                          </td>
                          <td style={{
                            padding: 12,
                            borderBottom: '1px solid #eef2f7',
                          }}>
                            {eventLabel(row)}
                          </td>
                          <td style={{
                            padding: 12,
                            borderBottom: '1px solid #eef2f7',
                          }}>
                            {employeeName(row.subject_user_id)}
                          </td>
                          <td style={{
                            padding: 12,
                            borderBottom: '1px solid #eef2f7',
                          }}>
                            {employeeName(row.actor_id)}
                          </td>
                          <td style={{
                            padding: 12,
                            borderBottom: '1px solid #eef2f7',
                          }}>
                            {row.department_id
                              ? departmentName(row.department_id)
                              : '—'}
                          </td>
                          <td style={{
                            padding: 12,
                            borderBottom: '1px solid #eef2f7',
                          }}>
                            {row.old_role
                              ? displayRole(row.old_role)
                              : '—'}
                            {' → '}
                            {row.new_role
                              ? displayRole(row.new_role)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>
        </div>
      )}
    </main>
  );
}
