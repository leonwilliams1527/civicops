 
'use client';

import { useEffect, useMemo, useState } from 'react';
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

const futureModules = [
  ['Work orders', 'Maintenance backlog, deadlines and completion'],
  ['Projects', 'Milestones, progress and department performance'],
  ['Procurement & finance', 'Budgets, commitments and operating costs'],
  ['Employees & teams', 'Staffing and departmental coverage'],
];

const CLOSED = ['resolved', 'verified', 'completed', 'closed'];

function Card({ title, value, note }) {
  return (
    <div className="ent-panel" style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: '#52667e' }}>
        {title}
      </div>
      <div style={{
        fontSize: 34,
        fontWeight: 750,
        marginTop: 8,
        color: '#142d47',
      }}>
        {value}
      </div>
      {note && (
        <div style={{
          fontSize: 12,
          color: '#66788d',
          marginTop: 5,
        }}>
          {note}
        </div>
      )}
    </div>
  );
}

function StatusBar({ label, count, total, color }) {
  const percent = total
    ? Math.round((count / total) * 100)
    : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 7,
        gap: 12,
        fontSize: 13,
      }}>
        <span>{label}</span>
        <strong>{count} ({percent}%)</strong>
      </div>
      <div style={{
        background: '#e8eef5',
        borderRadius: 12,
        height: 9,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percent}%`,
          background: color,
          height: '100%',
          borderRadius: 12,
        }} />
      </div>
    </div>
  );
}

function expiryStatus(date) {
  if (!date) return 'unknown';

  const today = new Date().toISOString().slice(0, 10);
  const warning = new Date(
    Date.now() + 30 * 86400000
  ).toISOString().slice(0, 10);

  if (date < today) return 'expired';
  if (date <= warning) return 'expiring';

  return 'current';
}

function formatMoney(value, currency = 'GYD') {
  const number = Number(value);

  if (!Number.isFinite(number)) return 'Not recorded';

  return `${currency} ${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const panelGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
  gap: 16,
  marginBottom: 20,
};

export default function ExecutiveDashboard() {
  const [organizations, setOrganizations] = useState([]);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('all');

  const [facilities, setFacilities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [findings, setFindings] = useState([]);
  const [actions, setActions] = useState([]);

  const [contractors, setContractors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [contractFacilities, setContractFacilities] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadOrganizations() {
      try {
        if (!db) {
          throw new Error('Supabase is not configured.');
        }

        const auth = await db.auth.getUser();

        if (auth.error || !auth.data.user) {
          throw new Error('Please sign in to view the dashboard.');
        }

        const memberships = await db.from('enterprise_members').select('organization_id,role').eq('user_id', auth.data.user.id);
        if (memberships.error) throw memberships.error;
        const ids = (memberships.data || []).filter(m => ['owner','admin'].includes(m.role)).map(m => m.organization_id);
        if (!active) return;
        setAccessChecked(true);
        setAccessGranted(ids.length > 0);
        if (!ids.length) { setLoading(false); return; }
        const result = await db
          .from('enterprise_organizations')
          .select('id,name')
          .in('id', ids)
          .order('name');

        if (result.error) throw result.error;

        if (active) {
          const rows = result.data || [];
          setOrganizations(rows);
          setOrganizationId(rows[0]?.id || '');
          if (!rows.length) setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load organizations.');
          setLoading(false);
        }
      }
    }

    loadOrganizations();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!organizationId || !db || !accessGranted) return;

    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');
      setFacilityFilter('all');

      try {
        const queries = await Promise.all([
          db.from('enterprise_facilities')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name'),

          db.from('enterprise_assets')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_inspections')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_actions')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_contractors')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_contractor_facilities')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_contractor_contracts')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_contractor_credentials')
            .select('*')
            .eq('organization_id', organizationId),

          db.from('enterprise_contractor_contract_facilities')
            .select('*')
            .eq('organization_id', organizationId),
        ]);

        for (const result of queries) {
          if (result.error) throw result.error;
        }

        const [
          f, a, i, r, c, assigned, agreements,
          compliance, agreementLocations,
        ] = queries;

        const inspectionRows = i.data || [];
        const inspectionIds = inspectionRows.map(x => x.id);
        const findingRows = [];

        for (let offset = 0; offset < inspectionIds.length; offset += 100) {
          const batch = inspectionIds.slice(offset, offset + 100);

          const result = await db
            .from('enterprise_findings')
            .select('*')
            .eq('organization_id', organizationId)
            .in('inspection_id', batch);

          if (result.error) throw result.error;
          findingRows.push(...(result.data || []));
        }

        if (active) {
          setFacilities(f.data || []);
          setAssets(a.data || []);
          setInspections(inspectionRows);
          setActions(r.data || []);
          setFindings(findingRows);

          setContractors(c.data || []);
          setAssignments(assigned.data || []);
          setContracts(agreements.data || []);
          setCredentials(compliance.data || []);
          setContractFacilities(agreementLocations.data || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load dashboard data.');
          setFacilities([]);
          setAssets([]);
          setInspections([]);
          setFindings([]);
          setActions([]);
          setContractors([]);
          setAssignments([]);
          setContracts([]);
          setCredentials([]);
          setContractFacilities([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [organizationId]);

  const inspectionFacility = useMemo(
    () => new Map(
      inspections.map(i => [i.id, i.facility_id])
    ),
    [inspections]
  );

  const filtered = useMemo(() => {
    const match = id =>
      facilityFilter === 'all' || id === facilityFilter;

    const locationAssignments = assignments.filter(
      a => match(a.facility_id)
    );

    const assignedIds = new Set(
      locationAssignments.map(a => a.contractor_id)
    );

    const selectedContractors = facilityFilter === 'all'
      ? contractors
      : contractors.filter(c => assignedIds.has(c.id));

    const selectedIds = new Set(
      selectedContractors.map(c => c.id)
    );

    const selectedContracts = contracts.filter(c => {
      if (!selectedIds.has(c.contractor_id)) return false;
      if (facilityFilter === 'all') return true;

      const links = contractFacilities.filter(
        link => link.contract_id === c.id
      );

      return (
        !links.length ||
        links.some(link => link.facility_id === facilityFilter)
      );
    });

    return {
      facilities: facilities.filter(f => match(f.id)),
      assets: assets.filter(a => match(a.facility_id)),
      inspections: inspections.filter(i => match(i.facility_id)),
      findings: findings.filter(f =>
        match(inspectionFacility.get(f.inspection_id))
      ),
      actions: actions.filter(a => match(a.facility_id)),
      contractors: selectedContractors,
      assignments: locationAssignments,
      contracts: selectedContracts,
      credentials: credentials.filter(c =>
        selectedIds.has(c.contractor_id)
      ),
    };
  }, [
    facilityFilter,
    facilities,
    assets,
    inspections,
    findings,
    actions,
    contractors,
    assignments,
    contracts,
    credentials,
    contractFacilities,
    inspectionFacility,
  ]);

  const stats = useMemo(() => {
    const openFindings = filtered.findings.filter(
      f => !['resolved', 'verified'].includes(f.status)
    );

    const activeContracts = filtered.contracts.filter(
      c => c.status === 'active'
    );

    const warnings = filtered.credentials.filter(
      c => ['expired', 'expiring'].includes(
        expiryStatus(c.expires_on)
      )
    );

    return {
      facilities: filtered.facilities.length,
      assets: filtered.assets.length,
      inspections: filtered.inspections.length,
      openFindings: openFindings.length,
      criticalFindings: openFindings.filter(
        f => f.severity === 'critical'
      ).length,
      openActions: filtered.actions.filter(
        a => !CLOSED.includes(a.status)
      ).length,
      contractors: filtered.contractors.length,
      activeContractors: filtered.contractors.filter(
        c => c.status === 'active'
      ).length,
      activeContracts: activeContracts.length,
      credentialWarnings: warnings.length,
      contractValueByCurrency: activeContracts.reduce((totals, c) => {
        if (c.contract_value == null) return totals;
        const amount = Number(c.contract_value);
        if (!Number.isFinite(amount)) return totals;
        const currency = c.currency || 'GYD';
        totals[currency] = (totals[currency] || 0) + amount;
        return totals;
      }, {}),
    };
  }, [filtered]);

  const conditionCounts = useMemo(() => {
    return ['good', 'attention', 'critical', 'unknown', 'retired']
      .map(condition => ({
        condition,
        count: filtered.assets.filter(
          a => a.condition === condition
        ).length,
      }));
  }, [filtered.assets]);

  const facilityRows = useMemo(() => {
    return filtered.facilities.map(f => {
      const localInspections = inspections.filter(
        i => i.facility_id === f.id
      );

      const localIds = new Set(
        localInspections.map(i => i.id)
      );

      const localAssignments = assignments.filter(
        a => a.facility_id === f.id
      );

      const contractorIds = new Set(
        localAssignments.map(a => a.contractor_id)
      );

      return {
        ...f,
        assetCount: assets.filter(
          a => a.facility_id === f.id
        ).length,
        inspectionCount: localInspections.length,
        findingCount: findings.filter(
          x =>
            localIds.has(x.inspection_id) &&
            !['resolved', 'verified'].includes(x.status)
        ).length,
        actionCount: actions.filter(
          x =>
            x.facility_id === f.id &&
            !CLOSED.includes(x.status)
        ).length,
        contractorCount: contractorIds.size,
      };
    });
  }, [
    filtered.facilities,
    inspections,
    assets,
    findings,
    actions,
    assignments,
  ]);

  const organizationName =
    organizations.find(o => o.id === organizationId)?.name ||
    'Enterprise';

  const coveredLocations = facilityRows.filter(
    f => f.contractorCount > 0
  ).length;

  if (!accessChecked && loading) return <main className="ent-page"><p>Checking permissions…</p></main>;
  if (!accessGranted) return <main className="ent-page"><h1>Access restricted</h1><p>Executive Dashboard requires organization owner or administrator access.</p><Link href="/collaboration/enterprise/workspace">My Workspace</Link></main>;
  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / EXECUTIVE COMMAND CENTER
          </div>
          <h1>Executive Dashboard</h1>
          <p>
            Company-wide visibility across facilities, equipment,
            inspections, risk, contractors and agreements.
          </p>
        </div>
        <Link href="/collaboration/enterprise">
          View all facilities →
        </Link>
      </header>

      {error && (
        <div className="ent-error" role="alert">
          {error}
        </div>
      )}

      <section className="ent-panel" style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'end',
        }}>
          <label style={{ flex: '1 1 240px' }}>
            <strong>Organization</strong>
            <select
              value={organizationId}
              onChange={e => setOrganizationId(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: 11,
                marginTop: 8,
              }}
            >
              {organizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ flex: '1 1 240px' }}>
            <strong>Facility filter</strong>
            <select
              value={facilityFilter}
              onChange={e => setFacilityFilter(e.target.value)}
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                padding: 11,
                marginTop: 8,
              }}
            >
              <option value="all">All locations</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <section className="ent-panel">
          Loading executive data…
        </section>
      ) : !error && (
        <>
          <section style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(175px,1fr))',
            gap: 14,
            marginBottom: 20,
          }}>
            <Card title="Facilities" value={stats.facilities} />
            <Card title="Registered assets" value={stats.assets} />
            <Card title="Inspections" value={stats.inspections} />
            <Card title="Open findings" value={stats.openFindings} />
            <Card title="Critical findings" value={stats.criticalFindings} />
            <Card title="Open actions" value={stats.openActions} />

            <Card
              title="Contractors & vendors"
              value={stats.contractors}
              note={`${stats.activeContractors} active`}
            />
            <Card
              title="Active contracts"
              value={stats.activeContracts}
              note="Unique agreements"
            />
            <Card
              title="Compliance warnings"
              value={stats.credentialWarnings}
              note="Expired or expiring within 30 days"
            />
            <Card
              title="Locations with contractors"
              value={coveredLocations}
              note={`Of ${stats.facilities} displayed locations`}
            />
          </section>

          <div style={panelGrid}>
            <section className="ent-panel">
              <h2>Asset condition overview</h2>
              <p>All equipment categories — {organizationName}</p>

              {conditionCounts.map(item => (
                <StatusBar
                  key={item.condition}
                  label={item.condition.toUpperCase()}
                  count={item.count}
                  total={stats.assets}
                  color={{
                    good: '#23815d',
                    attention: '#d49b26',
                    critical: '#c64c4c',
                    unknown: '#7c8ca1',
                    retired: '#596579',
                  }[item.condition]}
                />
              ))}
            </section>

            <section className="ent-panel">
              <h2>Operational risk</h2>
              <p>Unresolved inspection findings by severity</p>

              {['critical', 'high', 'medium', 'low'].map(severity => {
                const count = filtered.findings.filter(
                  f =>
                    f.severity === severity &&
                    !['resolved', 'verified'].includes(f.status)
                ).length;

                return (
                  <StatusBar
                    key={severity}
                    label={severity.toUpperCase()}
                    count={count}
                    total={stats.openFindings}
                    color={{
                      critical: '#c64c4c',
                      high: '#df8542',
                      medium: '#d8b44a',
                      low: '#4889a7',
                    }[severity]}
                  />
                );
              })}
            </section>
          </div>

          <div style={panelGrid}>
            <section className="ent-panel">
              <h2>Contractor coverage</h2>
              <p>
                Assigned contractors by location. A contractor serving
                multiple locations is counted once at each location.
              </p>

              {facilityRows.length ? facilityRows.map(f => (
                <StatusBar
                  key={f.id}
                  label={f.name}
                  count={f.contractorCount}
                  total={Math.max(
                    1,
                    ...facilityRows.map(x => x.contractorCount)
                  )}
                  color="#2872a7"
                />
              )) : (
                <p>No facilities recorded.</p>
              )}

              <p>
                <Link href="/collaboration/enterprise/contractors">
                  Manage contractors & vendors →
                </Link>
              </p>
            </section>

            <section className="ent-panel">
              <h2>Contracts & compliance</h2>
              <p>
                Financial exposure and credential oversight for
                {facilityFilter === 'all'
                  ? ' the organization.'
                  : ' the selected facility.'}
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                gap: 12,
                marginBottom: 16,
              }}>
                <Card
                  title="Active agreements"
                  value={stats.activeContracts}
                />
                <Card
                  title="Credential warnings"
                  value={stats.credentialWarnings}
                />
              </div>

              <h3>Recorded active contract value</h3>

              {Object.entries(stats.contractValueByCurrency).length ? (
                Object.entries(stats.contractValueByCurrency)
                  .map(([currency, amount]) => (
                    <p key={currency}>
                      <strong>{formatMoney(amount, currency)}</strong>
                    </p>
                  ))
              ) : (
                <p>No active contract values recorded.</p>
              )}

              <p style={{ fontSize: 13, color: '#52667e' }}>
                Values represent recorded contract amounts, not actual
                expenditure. Multi-location agreements are counted
                once in each filtered view.
              </p>
            </section>
          </div>

          <section className="ent-panel" style={{ marginBottom: 20 }}>
            <h2>Facility performance overview</h2>
            <p>
              Compare operational records and contractor coverage
              across company locations. Select a facility to open
              its Facility 360 workspace.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                minWidth: 790,
              }}>
                <thead>
                  <tr>
                    {[
                      'Facility',
                      'Status',
                      'Assets',
                      'Inspections',
                      'Open findings',
                      'Open actions',
                      'Contractors',
                    ].map(h => (
                      <th key={h} style={{
                        padding: 12,
                        borderBottom: '1px solid #dce4ed',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {facilityRows.map(f => (
                    <tr key={f.id}>
                      <td style={{
                        padding: 12,
                        borderBottom: '1px solid #e8eef4',
                      }}>
                        <Link href={
                          '/collaboration/enterprise/facilities/' +
                          encodeURIComponent(f.id)
                        }>
                          <strong>{f.name}</strong> ↗
                        </Link>
                      </td>
                      <td>{f.status || 'Not specified'}</td>
                      <td>{f.assetCount}</td>
                      <td>{f.inspectionCount}</td>
                      <td>{f.findingCount}</td>
                      <td>{f.actionCount}</td>
                      <td>{f.contractorCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!facilityRows.length && (
              <p>No facilities match this selection.</p>
            )}
          </section>

          <section className="ent-panel">
            <h2>Enterprise management modules</h2>
            <p>
              Contractor management is now integrated. Other
              company-wide modules will become available as
              their operational workflows are implemented.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(240px,1fr))',
              gap: 12,
            }}>
              <Link
                href="/collaboration/enterprise/contractors"
                style={{
                  display: 'block',
                  border: '1px solid #c6d8e8',
                  borderRadius: 10,
                  padding: 16,
                  background: '#edf5fc',
                  color: '#17314b',
                  textDecoration: 'none',
                }}
              >
                <strong>Contractors & vendors ↗</strong>
                <p style={{ fontSize: 13 }}>
                  Supplier register, facility assignments,
                  contracts, compliance and Contractor 360°.
                </p>
                <span style={{
                  fontSize: 12,
                  color: '#176346',
                  fontWeight: 700,
                }}>
                  Integrated
                </span>
              </Link>

              {futureModules.map(([name, description]) => (
                <div key={name} style={{
                  border: '1px solid #dce4ed',
                  borderRadius: 10,
                  padding: 16,
                  background: '#f8fafc',
                }}>
                  <strong>{name}</strong>
                  <p style={{ fontSize: 13 }}>{description}</p>
                  <span style={{
                    fontSize: 12,
                    color: '#64748b',
                  }}>
                    Future integration
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
         
