
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

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

const blank = {
  name: '',
  category: 'General services',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  status: 'active',
  notes: '',
};

const fieldStyle = {
  width: '100%',
  padding: 10,
  border: '1px solid #cad5e2',
  borderRadius: 8,
  boxSizing: 'border-box',
};

const panel = { padding: 18, marginBottom: 16 };

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
      {label}
      <div style={{ marginTop: 5 }}>{children}</div>
    </label>
  );
}

function Input({ value, onChange, ...props }) {
  return (
    <input
      {...props}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={fieldStyle}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={fieldStyle}
    >
      {options.map(x => (
        <option key={x[0]} value={x[0]}>{x[1]}</option>
      ))}
    </select>
  );
}

export default function ContractorsPage() {
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [credentials, setCredentials] = useState([]);

  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [assignment, setAssignment] = useState({
    facility_id: '',
    service_scope: '',
  });

  const [contract, setContract] = useState({
    title: '',
    reference: '',
    start_date: '',
    end_date: '',
    contract_value: '',
    currency: 'GYD',
    status: 'active',
  });

  const [credential, setCredential] = useState({
    title: '',
    credential_type: 'insurance',
    issuer: '',
    expires_on: '',
  });

  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        if (!db) throw Error('Supabase is not configured');

        const a = await db.auth.getUser();
        if (a.error || !a.data.user) {
          throw Error('Sign in to continue');
        }

        const r = await db
          .from('enterprise_organizations')
          .select('id,name')
          .order('name');

        if (r.error) throw r.error;

        if (live) {
          setOrgs(r.data || []);
          setOrg(r.data?.[0]?.id || '');

          if (!r.data?.length) setLoading(false);
        }
      } catch (e) {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();

    return () => { live = false; };
  }, []);

  async function reload(o) {
    const [f, c, a, t, d, m] = await Promise.all([
      db.from('enterprise_facilities')
        .select('id,name')
        .eq('organization_id', o)
        .order('name'),

      db.from('enterprise_contractors')
        .select('*')
        .eq('organization_id', o)
        .order('name'),

      db.from('enterprise_contractor_facilities')
        .select('*')
        .eq('organization_id', o),

      db.from('enterprise_contractor_contracts')
        .select('*')
        .eq('organization_id', o),

      db.from('enterprise_contractor_credentials')
        .select('*')
        .eq('organization_id', o),

      db.from('enterprise_members')
        .select('role')
        .eq('organization_id', o),
    ]);

    for (const r of [f, c, a, t, d, m]) {
      if (r.error) throw r.error;
    }

    return {
      facilities: f.data || [],
      contractors: c.data || [],
      assignments: a.data || [],
      contracts: t.data || [],
      credentials: d.data || [],
      canWrite: (m.data || []).some(x =>
        ['manager', 'operator', 'admin', 'owner'].includes(x.role)
      ),
    };
  }

  useEffect(() => {
    if (!org) return;

    let live = true;
    setLoading(true);
    setError('');
    setSelected('');

    (async () => {
      try {
        const r = await reload(org);

        if (live) {
          setFacilities(r.facilities);
          setContractors(r.contractors);
          setAssignments(r.assignments);
          setContracts(r.contracts);
          setCredentials(r.credentials);
          setCanWrite(r.canWrite);
        }
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => { live = false; };
  }, [org]);

  async function run(operation) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      await operation();
      const r = await reload(org);

      setFacilities(r.facilities);
      setContractors(r.contractors);
      setAssignments(r.assignments);
      setContracts(r.contracts);
      setCredentials(r.credentials);
      setMessage('Saved successfully.');
    } catch (e) {
      setError(e.message || 'Unable to save');
    } finally {
      setBusy(false);
    }
  }

  const save = async (table, data) => {
    const r = await db
      .from(table)
      .insert({ ...data, organization_id: org });

    if (r.error) throw r.error;
  };

  const selectedContractor = contractors.find(c => c.id === selected);

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400000)
    .toISOString().slice(0, 10);

  const credentialState = c =>
    !c.expires_on ? 'No expiry'
    : c.expires_on < today ? 'Expired'
    : c.expires_on <= soon ? 'Expiring soon'
    : 'Current';

  const shown = useMemo(
    () => contractors.filter(c =>
      (filter === 'all' || c.status === filter) &&
      `${c.name} ${c.category} ${c.contact_name || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ),
    [contractors, filter, search]
  );

  const selectedAssignments = assignments.filter(
    x => x.contractor_id === selected
  );

  const selectedContracts = contracts.filter(
    x => x.contractor_id === selected
  );

  const selectedCredentials = credentials.filter(
    x => x.contractor_id === selected
  );

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE OPERATIONS / VENDOR MANAGEMENT
          </div>
          <h1>Contractors & Vendors</h1>
          <p>
            Company-wide supplier register, multi-site assignments,
            contracts and compliance.
          </p>
        </div>

        <Link href="/collaboration/enterprise/dashboard">
          Executive Dashboard →
        </Link>
      </header>

      {error && (
        <div className="ent-error" role="alert">{error}</div>
      )}

      {message && (
        <p role="status" style={{ color: '#146c43' }}>{message}</p>
      )}

      <section className="ent-panel" style={panel}>
        <Field label="Organization">
          <Select
            value={org}
            onChange={setOrg}
            options={orgs.map(x => [x.id, x.name])}
          />
        </Field>
      </section>

      {loading ? (
        <section className="ent-panel">Loading vendor records…</section>
      ) : (
        <>
          <div className="ent-kpis">
            <div>
              <strong>{contractors.length}</strong>
              <span>Registered vendors</span>
            </div>
            <div>
              <strong>
                {contractors.filter(x => x.status === 'active').length}
              </strong>
              <span>Active vendors</span>
            </div>
            <div>
              <strong>
                {contracts.filter(x => x.status === 'active').length}
              </strong>
              <span>Active contracts</span>
            </div>
            <div>
              <strong>
                {credentials.filter(x =>
                  ['Expired', 'Expiring soon'].includes(credentialState(x))
                ).length}
              </strong>
              <span>Credentials requiring review</span>
            </div>
          </div>

          <section className="ent-panel" style={panel}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <h2>Vendor register</h2>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setShowForm(!showForm)}
                  disabled={busy}
                >
                  + Add contractor or vendor
                </button>
              )}
            </div>

            {showForm && canWrite && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  run(async () => {
                    await save('enterprise_contractors', {
                      ...form,
                      name: form.name.trim(),
                    });
                    setForm(blank);
                    setShowForm(false);
                  });
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(190px,1fr))',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <Field label="Company name *">
                  <Input required value={form.name}
                    onChange={v => setForm({ ...form, name: v })} />
                </Field>
                <Field label="Service category">
                  <Input value={form.category}
                    onChange={v => setForm({ ...form, category: v })} />
                </Field>
                <Field label="Contact person">
                  <Input value={form.contact_name}
                    onChange={v => setForm({ ...form, contact_name: v })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.contact_email}
                    onChange={v => setForm({ ...form, contact_email: v })} />
                </Field>
                <Field label="Phone">
                  <Input value={form.contact_phone}
                    onChange={v => setForm({ ...form, contact_phone: v })} />
                </Field>
                <Field label="Status">
                  <Select value={form.status}
                    onChange={v => setForm({ ...form, status: v })}
                    options={['active', 'inactive', 'suspended']
                      .map(x => [x, x])} />
                </Field>
                <div style={{ alignSelf: 'end' }}>
                  <button
                    type="submit"
                    disabled={busy || !form.name.trim()}
                  >
                    Save vendor
                  </button>
                </div>
              </form>
            )}

            <div style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}>
              <input
                aria-label="Search vendors"
                placeholder="Search vendors or service categories"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...fieldStyle, flex: '1 1 240px' }}
              />
              <select
                aria-label="Filter vendor status"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ ...fieldStyle, width: 'auto' }}
              >
                {['all', 'active', 'inactive', 'suspended'].map(x => (
                  <option key={x} value={x}>
                    {x === 'all' ? 'All statuses' : x}
                  </option>
                ))}
              </select>
            </div>

            {shown.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  padding: 14,
                  marginBottom: 8,
                  border: '1px solid #dce4ed',
                  borderRadius: 9,
                  background: selected === c.id ? '#eaf3ff' : 'white',
                  cursor: 'pointer',
                }}
              >
                <span>
                  <strong>{c.name}</strong>
                  <br />
                  <small>
                    {c.category} ·{' '}
                    {assignments.filter(
                      x => x.contractor_id === c.id
                    ).length} assigned locations
                  </small>
                </span>
                <span>{c.status}</span>
              </button>
            ))}

            {!shown.length && <p>No vendors match this selection.</p>}
          </section>

          {selectedContractor && (
            <section className="ent-panel" style={panel}>
              <h2>{selectedContractor.name}</h2>
              <p>
                {selectedContractor.category} · {selectedContractor.status}
              </p>
              <p>
                Contact: {selectedContractor.contact_name || 'Not recorded'}
                {' · '}
                {selectedContractor.contact_email || 'No email'}
                {' · '}
                {selectedContractor.contact_phone || 'No phone'}
              </p>

              <h3>Assigned facilities</h3>
              {selectedAssignments.map(a => (
                <p key={a.id}>
                  • {facilities.find(f => f.id === a.facility_id)?.name
                    || 'Facility'}
                  {' — '}
                  {a.service_scope || 'General services'}
                </p>
              ))}
              {!selectedAssignments.length && (
                <p>No facility assignments yet.</p>
              )}

              {canWrite && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    run(async () => {
                      await save('enterprise_contractor_facilities', {
                        contractor_id: selected,
                        ...assignment,
                      });
                      setAssignment({
                        facility_id: '',
                        service_scope: '',
                      });
                    });
                  }}
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    alignItems: 'end',
                  }}
                >
                  <Field label="Assign facility">
                    <Select
                      value={assignment.facility_id}
                      onChange={v => setAssignment({
                        ...assignment,
                        facility_id: v,
                      })}
                      options={[
                        ['', 'Select facility'],
                        ...facilities.filter(
                          f => !selectedAssignments.some(
                            a => a.facility_id === f.id
                          )
                        ).map(f => [f.id, f.name]),
                      ]}
                    />
                  </Field>
                  <Field label="Service scope">
                    <Input
                      value={assignment.service_scope}
                      onChange={v => setAssignment({
                        ...assignment,
                        service_scope: v,
                      })}
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={busy || !assignment.facility_id}
                  >
                    Assign location
                  </button>
                </form>
              )}

              <h3 style={{ marginTop: 24 }}>Contracts</h3>
              {selectedContracts.map(c => (
                <p key={c.id}>
                  <strong>{c.title}</strong> · {c.status} · {c.currency}{' '}
                  {c.contract_value == null
                    ? 'Not recorded'
                    : Number(c.contract_value).toLocaleString()}
                  {' · End: '}{c.end_date || 'Not set'}
                </p>
              ))}
              {!selectedContracts.length && (
                <p>No contracts recorded.</p>
              )}

              {canWrite && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    run(async () => {
                      await save('enterprise_contractor_contracts', {
                        ...contract,
                        contractor_id: selected,
                        contract_value:
                          contract.contract_value === ''
                            ? null
                            : Number(contract.contract_value),
                        start_date: contract.start_date || null,
                        end_date: contract.end_date || null,
                        reference: contract.reference || null,
                      });
                      setContract({
                        title: '',
                        reference: '',
                        start_date: '',
                        end_date: '',
                        contract_value: '',
                        currency: 'GYD',
                        status: 'active',
                      });
                    });
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(160px,1fr))',
                    gap: 10,
                  }}
                >
                  <Field label="Contract title *">
                    <Input required value={contract.title}
                      onChange={v => setContract({
                        ...contract, title: v,
                      })} />
                  </Field>
                  <Field label="Reference">
                    <Input value={contract.reference}
                      onChange={v => setContract({
                        ...contract, reference: v,
                      })} />
                  </Field>
                  <Field label="Start date">
                    <Input type="date" value={contract.start_date}
                      onChange={v => setContract({
                        ...contract, start_date: v,
                      })} />
                  </Field>
                  <Field label="End date">
                    <Input type="date" value={contract.end_date}
                      onChange={v => setContract({
                        ...contract, end_date: v,
                      })} />
                  </Field>
                  <Field label="Value">
                    <Input type="number" min="0" step="0.01"
                      value={contract.contract_value}
                      onChange={v => setContract({
                        ...contract, contract_value: v,
                      })} />
                  </Field>
                  <Field label="Currency">
                    <Input maxLength={3} value={contract.currency}
                      onChange={v => setContract({
                        ...contract, currency: v.toUpperCase(),
                      })} />
                  </Field>
                  <div style={{ alignSelf: 'end' }}>
                    <button
                      disabled={busy || !contract.title.trim()}
                      type="submit"
                    >
                      Add contract
                    </button>
                  </div>
                </form>
              )}

              <h3 style={{ marginTop: 24 }}>
                Insurance, licenses & certifications
              </h3>

              {selectedCredentials.map(c => (
                <p key={c.id}>
                  <strong>{c.title}</strong> · {c.credential_type}
                  {' · '}{credentialState(c)}
                  {' · Expires: '}{c.expires_on || 'Not recorded'}
                </p>
              ))}
              {!selectedCredentials.length && (
                <p>No credentials recorded.</p>
              )}

              {canWrite && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    run(async () => {
                      await save('enterprise_contractor_credentials', {
                        ...credential,
                        contractor_id: selected,
                        expires_on: credential.expires_on || null,
                      });
                      setCredential({
                        title: '',
                        credential_type: 'insurance',
                        issuer: '',
                        expires_on: '',
                      });
                    });
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 10,
                  }}
                >
                  <Field label="Credential title *">
                    <Input required value={credential.title}
                      onChange={v => setCredential({
                        ...credential, title: v,
                      })} />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={credential.credential_type}
                      onChange={v => setCredential({
                        ...credential, credential_type: v,
                      })}
                      options={[
                        'insurance', 'certification',
                        'license', 'other',
                      ].map(x => [x, x])}
                    />
                  </Field>
                  <Field label="Issuer">
                    <Input value={credential.issuer}
                      onChange={v => setCredential({
                        ...credential, issuer: v,
                      })} />
                  </Field>
                  <Field label="Expiry date">
                    <Input type="date" value={credential.expires_on}
                      onChange={v => setCredential({
                        ...credential, expires_on: v,
                      })} />
                  </Field>
                  <div style={{ alignSelf: 'end' }}>
                    <button
                      type="submit"
                      disabled={busy || !credential.title.trim()}
                    >
                      Add credential
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
