
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

const db =
  url && key
    ? createClient(url, key, { global: { fetch: proxy } })
    : null;

const futureModules = [
  ['Contractors & vendors', 'Vendor compliance, assignments and performance'],
  ['Work orders', 'Maintenance backlog, deadlines and completion'],
  ['Projects', 'Milestones, progress and department performance'],
  ['Procurement & finance', 'Budgets, commitments and operating costs'],
  ['Employees & teams', 'Staffing and departmental coverage'],
];

function Card({ title, value, note }) {
  return (
    <div className="ent-panel" style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: '#52667e' }}>{title}</div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 750,
          marginTop: 8,
          color: '#142d47',
        }}
      >
        {value}
      </div>
      {note && (
        <div style={{ fontSize: 12, color: '#66788d', marginTop: 5 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function StatusBar({ label, count, total, color }) {
  const percent = total ? Math.round((count / total) * 100) : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 7,
          gap: 12,
          fontSize: 13,
        }}
      >
        <span>{label}</span>
        <strong>{count} ({percent}%)</strong>
      </div>
      <div
        style={{
          background: '#e8eef5',
          borderRadius: 12,
          height: 9,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            background: color,
            height: '100%',
            borderRadius: 12,
          }}
        />
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [findings, setFindings] = useState([]);
  const [actions, setActions] = useState([]);
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadOrganizations() {
      try {
        if (!db) throw new Error('Supabase is not configured.');

        const auth = await db.auth.getUser();
        if (auth.error || !auth.data.user) {
          throw new Error('Please sign in to view the dashboard.');
        }

        const result = await db
          .from('enterprise_organizations')
          .select('id,name')
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
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId || !db) return;

    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');
      setFacilityFilter('all');

      try {
        const [f, a, i, r] = await Promise.all([
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
        ]);

        for (const result of [f, a, i, r]) {
          if (result.error) throw result.error;
        }

        const inspectionRows = i.data || [];
        const inspectionIds = inspectionRows.map(item => item.id);

        let findingRows = [];

        if (inspectionIds.length) {
          // Batch IDs to avoid excessively long query URLs.
          for (let offset = 0; offset < inspectionIds.length; offset += 100) {
            const batch = inspectionIds.slice(offset, offset + 100);

            const response = await db
              .from('enterprise_findings')
              .select('*')
              .eq('organization_id', organizationId)
              .in('inspection_id', batch);

            if (response.error) throw response.error;
            findingRows.push(...(response.data || []));
          }
        }

        if (active) {
          setFacilities(f.data || []);
          setAssets(a.data || []);
          setInspections(inspectionRows);
          setActions(r.data || []);
          setFindings(findingRows);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load dashboard data.');
          setFacilities([]);
          setAssets([]);
          setInspections([]);
          setFindings([]);
          setActions([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => { active = false; };
  }, [organizationId]);

  const inspectionFacility = useMemo(
    () => new Map(inspections.map(i => [i.id, i.facility_id])),
    [inspections]
  );

  const filtered = useMemo(() => {
    const match = id =>
      facilityFilter === 'all' || id === facilityFilter;

    return {
      facilities: facilities.filter(f => match(f.id)),
      assets: assets.filter(a => match(a.facility_id)),
      inspections: inspections.filter(i => match(i.facility_id)),
      findings: findings.filter(f =>
        match(inspectionFacility.get(f.inspection_id))
      ),
      actions: actions.filter(a => match(a.facility_id)),
    };
  }, [
    facilityFilter, facilities, assets, inspections,
    findings, actions, inspectionFacility,
  ]);

  const stats = useMemo(() => {
    const activeFindings = filtered.findings.filter(
      f => !['resolved', 'verified'].includes(f.status)
    );

    return {
      facilities: filtered.facilities.length,
      assets: filtered.assets.length,
      inspections: filtered.inspections.length,
      openFindings: activeFindings.length,
      criticalFindings: activeFindings.filter(
        f => f.severity === 'critical'
      ).length,
      openActions: filtered.actions.filter(
        a => !['resolved', 'verified', 'completed', 'closed']
          .includes(a.status)
      ).length,
    };
  }, [filtered]);

  const conditionCounts = useMemo(() => {
    const conditions = ['good', 'attention', 'critical', 'unknown', 'retired'];

    return conditions.map(condition => ({
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

      const localIds = new Set(localInspections.map(i => i.id));

      return {
        ...f,
        assetCount: assets.filter(a => a.facility_id === f.id).length,
        inspectionCount: localInspections.length,
        findingCount: findings.filter(
          x =>
            localIds.has(x.inspection_id) &&
            !['resolved', 'verified'].includes(x.status)
        ).length,
        actionCount: actions.filter(
          x =>
            x.facility_id === f.id &&
            !['resolved', 'verified', 'completed', 'closed']
              .includes(x.status)
        ).length,
      };
    });
  }, [filtered.facilities, inspections, assets, findings, actions]);

  const organizationName =
    organizations.find(o => o.id === organizationId)?.name ||
    'Enterprise';

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / EXECUTIVE COMMAND CENTER
          </div>
          <h1>Executive Dashboard</h1>
          <p>
            Company-wide operational visibility across facilities,
            equipment, inspections and risk.
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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'end',
          }}
        >
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
                <option key={o.id} value={o.id}>{o.name}</option>
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
                <option key={f.id} value={f.id}>{f.name}</option>
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
          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(175px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <Card title="Facilities" value={stats.facilities} />
            <Card title="Registered assets" value={stats.assets} />
            <Card title="Inspections" value={stats.inspections} />
            <Card title="Open findings" value={stats.openFindings} />
            <Card title="Critical findings" value={stats.criticalFindings} />
            <Card title="Open actions" value={stats.openActions} />
          </section>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <section className="ent-panel">
              <h2>Asset condition overview</h2>
              <p>All equipment categories — {organizationName}</p>

              {conditionCounts.map(item => (
                <StatusBar
                  key={item.condition}
                  label={item.condition.replace('_', ' ').toUpperCase()}
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

          <section className="ent-panel" style={{ marginBottom: 20 }}>
            <h2>Facility performance overview</h2>
            <p>
              Compare operational records across company locations.
              Select a facility to open its Facility 360 workspace.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  minWidth: 690,
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Facility',
                      'Status',
                      'Assets',
                      'Inspections',
                      'Open findings',
                      'Open actions',
                    ].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #dce4ed',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {facilityRows.map(f => (
                    <tr key={f.id}>
                      <td
                        style={{
                          padding: 12,
                          borderBottom: '1px solid #e8eef4',
                        }}
                      >
                        <Link
                          href={
                            '/collaboration/enterprise/facilities/' +
                            encodeURIComponent(f.id)
                          }
                        >
                          <strong>{f.name}</strong> ↗
                        </Link>
                      </td>
                      <td>{f.status || 'Not specified'}</td>
                      <td>{f.assetCount}</td>
                      <td>{f.inspectionCount}</td>
                      <td>{f.findingCount}</td>
                      <td>{f.actionCount}</td>
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
              Additional executive reporting will activate as the
              corresponding company-wide modules are built.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {futureModules.map(([name, description]) => (
                <div
                  key={name}
                  style={{
                    border: '1px solid #dce4ed',
                    borderRadius: 10,
                    padding: 16,
                    background: '#f8fafc',
                  }}
                >
                  <strong>{name}</strong>
                  <p style={{ fontSize: 13 }}>{description}</p>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
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
