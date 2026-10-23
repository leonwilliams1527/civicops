
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import '../../enterprise.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const proxy = async (input, init) => {
  const raw = typeof input === 'string' ? input : input.url;
  const p = new URL(raw);

  if (
    url &&
    p.hostname === new URL(url).hostname &&
    /^\/(auth|rest|storage)\/v1\//.test(p.pathname)
  ) {
    return fetch(
      '/api/supabase-proxy?path=' +
        encodeURIComponent(p.pathname) +
        (p.search ? '&' + p.search.slice(1) : ''),
      init
    );
  }

  return fetch(input, init);
};

const db = url && key
  ? createClient(url, key, { global: { fetch: proxy } })
  : null;

const tabs = [
  ['all', 'All records'],
  ['assets', 'Assets & equipment'],
  ['inspections', 'Inspections'],
  ['findings', 'Findings & risks'],
  ['actions', 'Corrective actions'],
  ['contractors', 'Contractors & vendors'],
  ['employees', 'Employees & teams'],
  ['workorders', 'Work orders'],
  ['projects', 'Projects'],
  ['procurement', 'Procurement & finance'],
  ['documents', 'Documents'],
];

const planned = {
  employees:
    'Employee directory, departmental roles, and location assignments will appear here when Enterprise workforce management is released.',
  workorders:
    'Preventive and reactive work orders, assigned technicians, deadlines, and completion evidence will appear here when Work Orders is released.',
  projects:
    'Company projects, milestones, budgets, and cross-department tasks will appear here when Enterprise Projects is released.',
  procurement:
    'Purchase requests, purchase orders, contract spending, and budgets will appear here when Procurement & Finance is released.',
  documents:
    'Facility-specific documents, permits, warranties, and compliance records will appear here when Enterprise Documents is released.',
};

const cardStyle = {
  padding: 16,
  border: '1px solid #dce4ed',
  borderRadius: 10,
  background: '#fff',
};

const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
  gap: 12,
  marginTop: 12,
};

function dateStatus(date) {
  if (!date) return 'Expiry not recorded';

  const today = new Date().toISOString().slice(0, 10);
  const warning = new Date(Date.now() + 30 * 86400000)
    .toISOString().slice(0, 10);

  if (date < today) return 'Expired';
  if (date <= warning) return 'Expiring soon';

  return 'Current';
}

function currency(value, code) {
  if (value == null) return 'Not recorded';

  return `${code || 'GYD'} ${Number(value).toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

export default function Facility360() {
  const params = useParams();
  const id = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [facility, setFacility] = useState(null);
  const [assets, setAssets] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [findings, setFindings] = useState([]);
  const [actions, setActions] = useState([]);

  const [contractors, setContractors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [contractFacilities, setContractFacilities] = useState([]);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let live = true;

    async function load() {
      setBusy(true);
      setError('');

      try {
        if (!db || !id) {
          throw Error('Workspace is not configured');
        }

        const auth = await db.auth.getUser();

        if (auth.error || !auth.data.user) {
          throw Error('Sign in to view this facility');
        }

        const f = await db
          .from('enterprise_facilities')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (f.error) throw f.error;

        if (!f.data) {
          throw Error('Facility not found or access denied');
        }

        const org = f.data.organization_id;

        const [
          a,
          i,
          ac,
          assignmentResult,
          contractLinks,
        ] = await Promise.all([
          db.from('enterprise_assets')
            .select('*')
            .eq('organization_id', org)
            .eq('facility_id', id)
            .order('name'),

          db.from('enterprise_inspections')
            .select('*')
            .eq('organization_id', org)
            .eq('facility_id', id)
            .order('inspection_date', { ascending: false }),

          db.from('enterprise_actions')
            .select('*')
            .eq('organization_id', org)
            .eq('facility_id', id),

          db.from('enterprise_contractor_facilities')
            .select('*')
            .eq('organization_id', org)
            .eq('facility_id', id),

          db.from('enterprise_contractor_contract_facilities')
            .select('*')
            .eq('organization_id', org),
        ]);

        for (const result of [
          a, i, ac, assignmentResult, contractLinks,
        ]) {
          if (result.error) throw result.error;
        }

        const inspectionIds = (i.data || []).map(x => x.id);
        const contractorIds = [
          ...new Set(
            (assignmentResult.data || []).map(x => x.contractor_id)
          ),
        ];

        let findingRows = [];
        let contractorRows = [];
        let contractRows = [];
        let credentialRows = [];

        if (inspectionIds.length) {
          const result = await db
            .from('enterprise_findings')
            .select('*')
            .eq('organization_id', org)
            .in('inspection_id', inspectionIds);

          if (result.error) throw result.error;
          findingRows = result.data || [];
        }

        if (contractorIds.length) {
          const [c, ct, cr] = await Promise.all([
            db.from('enterprise_contractors')
              .select('*')
              .eq('organization_id', org)
              .in('id', contractorIds),

            db.from('enterprise_contractor_contracts')
              .select('*')
              .eq('organization_id', org)
              .in('contractor_id', contractorIds),

            db.from('enterprise_contractor_credentials')
              .select('*')
              .eq('organization_id', org)
              .in('contractor_id', contractorIds),
          ]);

          for (const result of [c, ct, cr]) {
            if (result.error) throw result.error;
          }

          contractorRows = c.data || [];
          contractRows = ct.data || [];
          credentialRows = cr.data || [];
        }

        if (live) {
          setFacility(f.data);
          setAssets(a.data || []);
          setInspections(i.data || []);
          setActions(ac.data || []);
          setFindings(findingRows);

          setAssignments(assignmentResult.data || []);
          setContractors(contractorRows);
          setContracts(contractRows);
          setCredentials(credentialRows);
          setContractFacilities(contractLinks.data || []);
        }
      } catch (e) {
        if (live) {
          setError(e.message || 'Unable to load facility');
          setFacility(null);
        }
      } finally {
        if (live) setBusy(false);
      }
    }

    load();

    return () => {
      live = false;
    };
  }, [id]);

  const hasCoords =
    facility &&
    facility.latitude != null &&
    facility.longitude != null &&
    Number.isFinite(Number(facility.latitude)) &&
    Number.isFinite(Number(facility.longitude)) &&
    Math.abs(Number(facility.latitude)) <= 90 &&
    Math.abs(Number(facility.longitude)) <= 180;

  const lat = Number(facility?.latitude);
  const lon = Number(facility?.longitude);

  const mapUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        encodeURIComponent(
          [lon - .015, lat - .01, lon + .015, lat + .01].join(',')
        )
      }&layer=mapnik&marker=${encodeURIComponent(lat + ',' + lon)}`
    : null;

  const contractorRecords = useMemo(() => {
    return assignments.map(a => {
      const contractor = contractors.find(
        c => c.id === a.contractor_id
      );

      if (!contractor) return null;

      const contractorCredentials = credentials.filter(
        c => c.contractor_id === contractor.id
      );

      const applicableContracts = contracts.filter(c => {
        if (c.contractor_id !== contractor.id) return false;

        const links = contractFacilities.filter(
          link => link.contract_id === c.id
        );

        // No facility links means company-wide agreement.
        if (!links.length) return true;

        return links.some(link => link.facility_id === id);
      });

      return {
        assignment: a,
        contractor,
        credentials: contractorCredentials,
        contracts: applicableContracts,
      };
    }).filter(Boolean);
  }, [
    assignments,
    contractors,
    credentials,
    contracts,
    contractFacilities,
    id,
  ]);

  const items = useMemo(() => [
    ...assets.map(x => ({
      type: 'assets',
      title: x.name,
      detail: `${x.asset_tag} · ${x.category} · ${x.condition}`,
      id: x.id,
    })),

    ...inspections.map(x => ({
      type: 'inspections',
      title: x.title,
      detail: `${x.inspection_date} · ${x.status}`,
      id: x.id,
    })),

    ...findings.map(x => ({
      type: 'findings',
      title: x.title,
      detail:
        `${x.severity} · ${x.status} · ${
          x.recommendation || 'No recommendation'
        }`,
      id: x.id,
    })),

    ...actions.map(x => ({
      type: 'actions',
      title: x.title,
      detail: `${
        x.priority || 'Priority not set'
      } · ${x.status}`,
      id: x.id,
    })),

    ...contractorRecords.map(x => ({
      type: 'contractors',
      title: x.contractor.name,
      detail:
        `${x.contractor.category || 'General services'} · ${
          x.assignment.service_scope || 'General services'
        } · ${x.contractor.status}`,
      id: x.assignment.id,
      contractorId: x.contractor.id,
    })),
  ], [
    assets,
    inspections,
    findings,
    actions,
    contractorRecords,
  ]);

  const visible = items.filter(x =>
    (tab === 'all' || x.type === tab) &&
    `${x.title} ${x.detail}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const count = type =>
    type === 'all'
      ? items.length
      : items.filter(x => x.type === type).length;

  const visibleContractorIds = new Set(
    visible
      .filter(x => x.type === 'contractors')
      .map(x => x.contractorId)
  );

  const displayedContractors = contractorRecords.filter(x =>
    visibleContractorIds.has(x.contractor.id)
  );

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE OPERATIONS / FACILITY 360
          </div>
          <h1>{facility?.name || 'Facility overview'}</h1>
          <p>
            {facility?.address ||
              facility?.region ||
              'Facility operational records'}
          </p>
        </div>

        <Link href="/collaboration/enterprise">
          ← All facilities
        </Link>
      </header>

      {error && (
        <div className="ent-error" role="alert">
          {error}
        </div>
      )}

      {busy ? (
        <section className="ent-panel">
          Loading facility records…
        </section>
      ) : facility && (
        <>
          <div className="ent-kpis">
            <div>
              <strong>{assets.length}</strong>
              <span>All registered assets</span>
            </div>
            <div>
              <strong>{inspections.length}</strong>
              <span>Inspections</span>
            </div>
            <div>
              <strong>{findings.length}</strong>
              <span>Findings & risks</span>
            </div>
            <div>
              <strong>
                {actions.filter(x =>
                  !['resolved', 'verified'].includes(x.status)
                ).length}
              </strong>
              <span>Open corrective actions</span>
            </div>
            <div>
              <strong>{contractorRecords.length}</strong>
              <span>Assigned contractors</span>
            </div>
          </div>

          <div className="ent-columns">
            <section className="ent-panel">
              <h2>Facility location</h2>

              {mapUrl ? (
                <>
                  <iframe
                    title={`Map of ${facility.name}`}
                    src={mapUrl}
                    style={{
                      width: '100%',
                      height: 320,
                      border: 0,
                      borderRadius: 10,
                    }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />

                  <p>
                    <a
                      href={
                        `https://www.openstreetmap.org/?mlat=${
                          encodeURIComponent(lat)
                        }&mlon=${
                          encodeURIComponent(lon)
                        }#map=15/${
                          encodeURIComponent(lat)
                        }/${
                          encodeURIComponent(lon)
                        }`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open interactive map ↗
                    </a>
                  </p>
                </>
              ) : (
                <p>
                  No verified coordinates recorded for this facility.
                  Add latitude and longitude in the facility record
                  to display its map.
                </p>
              )}
            </section>

            <aside className="ent-panel">
              <h2>Facility information</h2>
              <p>
                <strong>Status:</strong> {facility.status}
              </p>
              <p>
                <strong>Region:</strong>{' '}
                {facility.region || 'Not specified'}
              </p>
              <p>
                <strong>Address:</strong>{' '}
                {facility.address || 'Not specified'}
              </p>
              <p>
                <strong>Coordinates:</strong>{' '}
                {hasCoords
                  ? `${lat}, ${lon}`
                  : 'Not verified'}
              </p>
              <p>
                Records are scoped to this facility and organization.
                Database RLS independently enforces tenant access.
              </p>
            </aside>
          </div>

          <section className="ent-panel">
            <h2>Facility 360 — company-wide record views</h2>

            <p>
              Explore equipment, inspections, risks, corrective actions,
              contractors, and other operational records associated
              with this location.
            </p>

            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}>
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  aria-pressed={tab === value}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cad5e2',
                    background: tab === value
                      ? '#174b70'
                      : '#fff',
                    color: tab === value
                      ? '#fff'
                      : '#17314b',
                    cursor: 'pointer',
                  }}
                >
                  {label} ({count(value)})
                </button>
              ))}
            </div>

            <label>
              Search this facility's records
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search assets, inspections, risks, contractors..."
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 12,
                  margin: '8px 0 16px',
                  border: '1px solid #cad5e2',
                  borderRadius: 8,
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {planned[tab] ? (
              <p
                role="status"
                style={{
                  padding: 16,
                  background: '#f1f5f9',
                  borderRadius: 8,
                }}
              >
                <strong>Coming in a future phase:</strong>{' '}
                {planned[tab]}
              </p>
            ) : (
              <>
                {tab === 'contractors' ? (
                  displayedContractors.length ? (
                    <div style={cardGrid}>
                      {displayedContractors.map(x => {
                        const warnings = x.credentials.filter(c =>
                          ['Expired', 'Expiring soon'].includes(
                            dateStatus(c.expires_on)
                          )
                        );

                        return (
                          <article
                            key={x.assignment.id}
                            style={cardStyle}
                          >
                            <h3 style={{ marginTop: 0 }}>
                              {x.contractor.name}
                            </h3>

                            <p>
                              <strong>Category:</strong>{' '}
                              {x.contractor.category ||
                                'General services'}
                            </p>

                            <p>
                              <strong>Status:</strong>{' '}
                              {x.contractor.status}
                            </p>

                            <p>
                              <strong>Service scope:</strong>{' '}
                              {x.assignment.service_scope ||
                                'General services'}
                            </p>

                            <p>
                              <strong>Contact:</strong>{' '}
                              {x.contractor.contact_name ||
                                'Not recorded'}
                            </p>

                            <p>
                              <strong>Contracts applicable here:</strong>{' '}
                              {x.contracts.length}
                            </p>

                            <p>
                              <strong>Compliance credentials:</strong>{' '}
                              {x.credentials.length}
                            </p>

                            <p style={{
                              color: warnings.length
                                ? '#a43b35'
                                : '#176346',
                              fontWeight: 600,
                            }}>
                              {warnings.length
                                ? `${warnings.length} credential(s) require review`
                                : 'No recorded expiry warnings'}
                            </p>

                            {x.contracts.length > 0 && (
                              <div style={{
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: 12,
                              }}>
                                <strong>Applicable contracts</strong>

                                {x.contracts.map(c => (
                                  <p key={c.id}>
                                    {c.title} · {c.status}
                                    <br />
                                    {currency(
                                      c.contract_value,
                                      c.currency
                                    )}
                                  </p>
                                ))}
                              </div>
                            )}

                            {x.credentials.length > 0 && (
                              <div style={{
                                borderTop: '1px solid #e2e8f0',
                                paddingTop: 12,
                              }}>
                                <strong>Compliance</strong>

                                {x.credentials.map(c => (
                                  <p key={c.id}>
                                    {c.title} ·{' '}
                                    {dateStatus(c.expires_on)}
                                  </p>
                                ))}
                              </div>
                            )}

                            <p>
                              <Link
                                href="/collaboration/enterprise/contractors"
                              >
                                Open contractor register →
                              </Link>
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p>
                      No contractors assigned to this facility
                      match the current search.
                    </p>
                  )
                ) : visible.length ? (
                  <div className="ent-list">
                    {visible.map(x => (
                      <div
                        key={x.type + x.id}
                        style={{
                          padding: 14,
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        <strong>{x.title}</strong>
                        <p style={{ margin: '4px 0' }}>
                          {tabs.find(t => t[0] === x.type)?.[1]}
                          {' · '}
                          {x.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No existing records match this filter.</p>
                )}
              </>
            )}

            <p>
              <Link href="/collaboration/enterprise/assets">
                Manage company assets ↗
              </Link>
              {' · '}
              <Link href="/collaboration/enterprise/inspections">
                Manage company inspections ↗
              </Link>
              {' · '}
              <Link href="/collaboration/enterprise/contractors">
                Manage contractors ↗
              </Link>
            </p>
          </section>
        </>
      )}
    </main>
  );
}
