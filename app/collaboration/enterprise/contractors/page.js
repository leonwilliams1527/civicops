
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

const initialVendor = {
  name: '',
  category: 'General services',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  status: 'active',
};

const initialAssignment = {
  facility_id: '',
  service_scope: '',
};

const initialContract = {
  title: '',
  reference: '',
  start_date: '',
  end_date: '',
  contract_value: '',
  currency: 'GYD',
  status: 'active',
};

const initialCredential = {
  title: '',
  credential_type: 'insurance',
  issuer: '',
  expires_on: '',
};

const inputStyle = {
  width: '100%',
  padding: 11,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#172b42',
  fontSize: 14,
};

const cardStyle = {
  padding: 18,
  border: '1px solid #dce4ed',
  borderRadius: 12,
  background: '#fff',
};

const buttonStyle = {
  padding: '10px 15px',
  background: '#153b58',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryButton = {
  ...buttonStyle,
  background: '#f1f5f9',
  color: '#17314b',
  border: '1px solid #cbd5e1',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
  gap: 12,
  marginTop: 16,
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>
      {label}
      <div style={{ marginTop: 6 }}>{children}</div>
    </label>
  );
}

function TextInput({ value, onChange, ...props }) {
  return (
    <input
      {...props}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}

function SectionHeader({ title, count, open, onToggle, canWrite }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <h3 style={{ margin: 0 }}>{title} ({count})</h3>
      {canWrite && (
        <button
          type="button"
          onClick={onToggle}
          style={open ? secondaryButton : buttonStyle}
        >
          {open ? 'Cancel' : '+ Add new'}
        </button>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <p style={{ color: '#64748b', padding: '12px 0' }}>
      {children}
    </p>
  );
}

const profileTabs = [
  ['overview', 'Overview'],
  ['locations', 'Assigned locations'],
  ['contracts', 'Contracts'],
  ['compliance', 'Compliance'],
  ['history', 'Work history'],
  ['performance', 'Performance'],
];

export default function ContractorsPage() {
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [contractLocations, setContractLocations] = useState([]);
  const [contractLocationEdit, setContractLocationEdit] = useState('');
  const [locationChoices, setLocationChoices] = useState([]);

  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [vendorForm, setVendorForm] = useState(initialVendor);
  const [assignmentForm, setAssignmentForm] = useState(initialAssignment);
  const [contractForm, setContractForm] = useState(initialContract);
  const [credentialForm, setCredentialForm] = useState(initialCredential);

  const [openForm, setOpenForm] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;

    async function initialize() {
      try {
        if (!db) throw Error('Supabase is not configured.');

        const auth = await db.auth.getUser();
        if (auth.error || !auth.data.user) {
          throw Error('Please sign in.');
        }

        const result = await db
          .from('enterprise_organizations')
          .select('id,name')
          .order('name');

        if (result.error) throw result.error;

        if (live) {
          setOrgs(result.data || []);
          setOrg(result.data?.[0]?.id || '');
          if (!result.data?.length) setLoading(false);
        }
      } catch (e) {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      }
    }

    initialize();
    return () => { live = false; };
  }, []);

  async function fetchRecords(organizationId) {
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user) {
      throw Error('Session expired. Please sign in again.');
    }

    // Contractor data has organization-wide fields and requires its own scoped RLS.
    // Fail closed for non-admins until contractor-specific policies are deployed.
    const permission = await db.from('enterprise_members').select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', auth.data.user.id).maybeSingle();
    if (permission.error) throw permission.error;
    if (!['owner', 'admin'].includes(permission.data?.role)) {
      throw Error('Contractor records are restricted until location-based contractor access is enabled.');
    }

    const [f, v, a, c, d, m, cl] = await Promise.all([
      db.from('enterprise_facilities')
        .select('id,name,region,status')
        .eq('organization_id', organizationId)
        .order('name'),

      db.from('enterprise_contractors')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name'),

      db.from('enterprise_contractor_facilities')
        .select('*')
        .eq('organization_id', organizationId),

      db.from('enterprise_contractor_contracts')
        .select('*')
        .eq('organization_id', organizationId),

      db.from('enterprise_contractor_credentials')
        .select('*')
        .eq('organization_id', organizationId),

      db.from('enterprise_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', auth.data.user.id),

      db.from('enterprise_contract_locations')
        .select('*')
        .eq('organization_id', organizationId),
    ]);

    for (const result of [f, v, a, c, d, m, cl]) {
      if (result.error) throw result.error;
    }

    return {
      facilities: f.data || [],
      vendors: v.data || [],
      assignments: a.data || [],
      contracts: c.data || [],
      credentials: d.data || [],
      contractLocations: cl.data || [],
      canWrite: (m.data || []).some(x =>
        ['manager', 'operator', 'admin', 'owner'].includes(x.role)
      ),
    };
  }

  function applyRecords(data) {
    setFacilities(data.facilities);
    setVendors(data.vendors);
    setAssignments(data.assignments);
    setContracts(data.contracts);
    setCredentials(data.credentials);
    setContractLocations(data.contractLocations);
    setCanWrite(data.canWrite);
  }

  useEffect(() => {
    if (!org) return;

    let live = true;
    setLoading(true);
    setError('');
    setMessage('');
    setSelected('');
    setOpenForm('');
    setContractLocationEdit('');

    async function load() {
      try {
        const data = await fetchRecords(org);
        if (live) applyRecords(data);
      } catch (e) {
        if (live) {
          setError(e.message);
          setFacilities([]);
          setVendors([]);
          setAssignments([]);
          setContracts([]);
          setCredentials([]);
          setContractLocations([]);
          setCanWrite(false);
        }
      } finally {
        if (live) setLoading(false);
      }
    }

    load();
    return () => { live = false; };
  }, [org]);

  async function insert(table, data) {
    const result = await db.from(table).insert({
      ...data,
      organization_id: org,
    });
    if (result.error) throw result.error;
  }

  async function saveRecord(operation, onSuccess) {
    if (busy || !canWrite) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await operation();
      const refreshed = await fetchRecords(org);
      applyRecords(refreshed);
      onSuccess();
      setOpenForm('');
      setMessage('Record saved successfully.');
    } catch (e) {
      setError(e.message || 'Unable to save record.');
    } finally {
      setBusy(false);
    }
  }

  function chooseVendor(id) {
    setSelected(id);
    setTab('overview');
    setOpenForm('');
    setContractLocationEdit('');
    setMessage('');
    setError('');
  }

  function switchTab(next) {
    setTab(next);
    setOpenForm('');
    setContractLocationEdit('');
    setError('');
  }

  function toggleForm(name) {
    setOpenForm(current => current === name ? '' : name);
    setError('');
    setMessage('');
  }

  const shown = useMemo(() => vendors.filter(v =>
    (statusFilter === 'all' || v.status === statusFilter) &&
    `${v.name} ${v.category} ${v.contact_name || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  ), [vendors, statusFilter, search]);

  const vendor = vendors.find(v => v.id === selected);

  const vendorAssignments = assignments.filter(
    a => a.contractor_id === selected
  );

  const vendorContracts = contracts.filter(
    c => c.contractor_id === selected
  );

  function startContractLocationEdit(contract) {
    setContractLocationEdit(contract.id);
    setLocationChoices(contractLocations
      .filter(x => x.contract_id === contract.id)
      .map(x => x.facility_id));
    setError('');
    setMessage('');
  }

  async function saveContractLocations(contractId) {
    if (busy || !canWrite || !org) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      // Single atomic database call prevents partially applied assignments.
      const result = await db.rpc('enterprise_set_contract_locations', {
        p_organization_id: org,
        p_contract_id: contractId,
        p_facility_ids: locationChoices,
      });
      if (result.error) throw result.error;
      const refreshed = await fetchRecords(org);
      applyRecords(refreshed);
      setContractLocationEdit('');
      setMessage('Contract locations updated successfully.');
    } catch (e) {
      setError(e.message || 'Unable to update contract locations.');
    } finally {
      setBusy(false);
    }
  }

  const vendorCredentials = credentials.filter(
    c => c.contractor_id === selected
  );

  const availableFacilities = facilities.filter(
    f => !vendorAssignments.some(a => a.facility_id === f.id)
  );

  const today = new Date().toISOString().slice(0, 10);
  const warningDate = new Date(Date.now() + 30 * 86400000)
    .toISOString().slice(0, 10);

  function credentialStatus(c) {
    if (!c.expires_on) return 'Expiry not recorded';
    if (c.expires_on < today) return 'Expired';
    if (c.expires_on <= warningDate) return 'Expiring soon';
    return 'Current';
  }

  function money(value, currency) {
    if (value == null) return 'Value not recorded';
    return `${currency || 'GYD'} ${Number(value).toLocaleString(
      'en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )}`;
  }

  const credentialWarnings = credentials.filter(c =>
    ['Expired', 'Expiring soon'].includes(credentialStatus(c))
  ).length;

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / CONTRACTOR MANAGEMENT
          </div>
          <h1>Contractors & Vendors</h1>
          <p>
            Company-wide contractor profiles, location assignments,
            agreements and compliance management.
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
        <p role="status" style={{ color: '#176346' }}>{message}</p>
      )}

      <section className="ent-panel" style={{ marginBottom: 16 }}>
        <Field label="Organization">
          <select
            value={org}
            onChange={e => setOrg(e.target.value)}
            style={inputStyle}
          >
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </Field>
      </section>

      {loading ? (
        <section className="ent-panel">Loading contractor records…</section>
      ) : !error || vendors.length > 0 ? (
        <>
          <div className="ent-kpis">
            <div>
              <strong>{vendors.length}</strong>
              <span>Registered vendors</span>
            </div>
            <div>
              <strong>
                {vendors.filter(v => v.status === 'active').length}
              </strong>
              <span>Active vendors</span>
            </div>
            <div>
              <strong>
                {contracts.filter(c => c.status === 'active').length}
              </strong>
              <span>Active contracts</span>
            </div>
            <div>
              <strong>{credentialWarnings}</strong>
              <span>Credentials requiring review</span>
            </div>
          </div>

          <section className="ent-panel" style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <h2 style={{ margin: 0 }}>Vendor register</h2>
              {canWrite && (
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => toggleForm('vendor')}
                >
                  {openForm === 'vendor'
                    ? 'Cancel'
                    : '+ Add contractor or vendor'}
                </button>
              )}
            </div>

            {openForm === 'vendor' && canWrite && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  saveRecord(
                    () => insert('enterprise_contractors', {
                      ...vendorForm,
                      name: vendorForm.name.trim(),
                    }),
                    () => setVendorForm(initialVendor)
                  );
                }}
                style={gridStyle}
              >
                <Field label="Company name *">
                  <TextInput
                    required
                    value={vendorForm.name}
                    onChange={v => setVendorForm({
                      ...vendorForm, name: v,
                    })}
                  />
                </Field>
                <Field label="Service category">
                  <TextInput
                    value={vendorForm.category}
                    onChange={v => setVendorForm({
                      ...vendorForm, category: v,
                    })}
                  />
                </Field>
                <Field label="Contact person">
                  <TextInput
                    value={vendorForm.contact_name}
                    onChange={v => setVendorForm({
                      ...vendorForm, contact_name: v,
                    })}
                  />
                </Field>
                <Field label="Email">
                  <TextInput
                    type="email"
                    value={vendorForm.contact_email}
                    onChange={v => setVendorForm({
                      ...vendorForm, contact_email: v,
                    })}
                  />
                </Field>
                <Field label="Phone">
                  <TextInput
                    value={vendorForm.contact_phone}
                    onChange={v => setVendorForm({
                      ...vendorForm, contact_phone: v,
                    })}
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={vendorForm.status}
                    onChange={e => setVendorForm({
                      ...vendorForm, status: e.target.value,
                    })}
                    style={inputStyle}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </Field>
                <div style={{ alignSelf: 'end' }}>
                  <button type="submit" disabled={busy} style={buttonStyle}>
                    {busy ? 'Saving…' : 'Save vendor'}
                  </button>
                </div>
              </form>
            )}

            <div style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              margin: '18px 0 14px',
            }}>
              <input
                aria-label="Search contractors"
                placeholder="Search contractors or service categories"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, flex: '1 1 250px' }}
              />
              <select
                aria-label="Filter contractor status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ ...inputStyle, width: 'auto' }}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {shown.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => chooseVendor(v.id)}
                aria-pressed={selected === v.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  minHeight: 70,
                  padding: 16,
                  marginBottom: 8,
                  border: selected === v.id
                    ? '2px solid #246fae'
                    : '1px solid #dce4ed',
                  borderRadius: 9,
                  backgroundColor: selected === v.id
                    ? '#eaf3ff'
                    : '#fff',
                  color: '#172b42',
                  textAlign: 'left',
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                <span style={{ display: 'grid', gap: 5 }}>
                  <strong style={{ color: '#172b42' }}>{v.name}</strong>
                  <small style={{ color: '#52667e' }}>
                    {v.category} ·{' '}
                    {assignments.filter(
                      a => a.contractor_id === v.id
                    ).length} assigned locations
                  </small>
                </span>
                <span style={{
                  color: v.status === 'active' ? '#176346' : '#52667e',
                  background: v.status === 'active'
                    ? '#e2f3ea' : '#edf1f5',
                  padding: '5px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {v.status}
                </span>
              </button>
            ))}

            {!shown.length && (
              <Empty>No contractors match your search.</Empty>
            )}
          </section>

          {vendor && (
            <section className="ent-panel">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <div className="ent-eyebrow">CONTRACTOR 360°</div>
                  <h2 style={{ margin: '8px 0' }}>{vendor.name}</h2>
                  <p>{vendor.category} · {vendor.status}</p>
                </div>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => setSelected('')}
                >
                  Close profile
                </button>
              </div>

              <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                margin: '18px 0',
              }}>
                {profileTabs.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => switchTab(id)}
                    style={{
                      ...secondaryButton,
                      background: tab === id ? '#174b70' : '#f1f5f9',
                      color: tab === id ? '#fff' : '#17314b',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <div style={cardStyle}>
                  <h3>Company overview</h3>
                  <p><strong>Category:</strong> {vendor.category}</p>
                  <p><strong>Status:</strong> {vendor.status}</p>
                  <p>
                    <strong>Contact:</strong>{' '}
                    {vendor.contact_name || 'Not recorded'}
                  </p>
                  <p>
                    <strong>Email:</strong>{' '}
                    {vendor.contact_email || 'Not recorded'}
                  </p>
                  <p>
                    <strong>Phone:</strong>{' '}
                    {vendor.contact_phone || 'Not recorded'}
                  </p>
                  <div style={gridStyle}>
                    <div style={cardStyle}>
                      <strong>{vendorAssignments.length}</strong>
                      <p>Assigned locations</p>
                    </div>
                    <div style={cardStyle}>
                      <strong>{vendorContracts.length}</strong>
                      <p>Contracts</p>
                    </div>
                    <div style={cardStyle}>
                      <strong>{vendorCredentials.length}</strong>
                      <p>Credentials</p>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'locations' && (
                <div>
                  <SectionHeader
                    title="Assigned locations"
                    count={vendorAssignments.length}
                    open={openForm === 'assignment'}
                    onToggle={() => toggleForm('assignment')}
                    canWrite={canWrite}
                  />

                  {vendorAssignments.length === 0 && (
                    <Empty>No facilities assigned yet.</Empty>
                  )}

                  <div style={gridStyle}>
                    {vendorAssignments.map(a => {
                      const f = facilities.find(
                        x => x.id === a.facility_id
                      );

                      return (
                        <article key={a.id} style={cardStyle}>
                          <h3 style={{ marginTop: 0 }}>
                            {f?.name || 'Assigned facility'}
                          </h3>
                          <p>
                            <strong>Service scope:</strong>{' '}
                            {a.service_scope || 'General services'}
                          </p>
                          <p>
                            <strong>Region:</strong>{' '}
                            {f?.region || 'Not specified'}
                          </p>
                          <p>
                            <strong>Facility status:</strong>{' '}
                            {f?.status || 'Not specified'}
                          </p>
                          <p>
                            <strong>Assigned:</strong>{' '}
                            {a.assigned_at
                              ? new Date(a.assigned_at)
                                  .toLocaleDateString()
                              : 'Not recorded'}
                          </p>
                          {f && (
                            <Link href={
                              '/collaboration/enterprise/facilities/' +
                              encodeURIComponent(f.id)
                            }>
                              Open Facility 360 →
                            </Link>
                          )}
                        </article>
                      );
                    })}
                  </div>

                  {openForm === 'assignment' && canWrite && (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        saveRecord(
                          () => insert(
                            'enterprise_contractor_facilities',
                            {
                              contractor_id: selected,
                              ...assignmentForm,
                            }
                          ),
                          () => setAssignmentForm(initialAssignment)
                        );
                      }}
                      style={{ ...cardStyle, marginTop: 16 }}
                    >
                      <h3>Assign contractor to a facility</h3>
                      <div style={gridStyle}>
                        <Field label="Facility *">
                          <select
                            required
                            value={assignmentForm.facility_id}
                            onChange={e => setAssignmentForm({
                              ...assignmentForm,
                              facility_id: e.target.value,
                            })}
                            style={inputStyle}
                          >
                            <option value="">Select facility</option>
                            {availableFacilities.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Service scope">
                          <TextInput
                            value={assignmentForm.service_scope}
                            onChange={v => setAssignmentForm({
                              ...assignmentForm, service_scope: v,
                            })}
                            placeholder="e.g. Cleaning and maintenance"
                          />
                        </Field>
                        <div style={{ alignSelf: 'end' }}>
                          <button
                            type="submit"
                            disabled={
                              busy ||
                              !assignmentForm.facility_id
                            }
                            style={buttonStyle}
                          >
                            {busy ? 'Saving…' : 'Save assignment'}
                          </button>
                        </div>
                      </div>
                      {!availableFacilities.length && (
                        <Empty>
                          This contractor is already assigned to every
                          available facility.
                        </Empty>
                      )}
                    </form>
                  )}
                </div>
              )}

              {tab === 'contracts' && (
                <div>
                  <SectionHeader
                    title="Contracts & agreements"
                    count={vendorContracts.length}
                    open={openForm === 'contract'}
                    onToggle={() => toggleForm('contract')}
                    canWrite={canWrite}
                  />

                  {!vendorContracts.length && (
                    <Empty>No contracts recorded yet.</Empty>
                  )}

                  <div style={gridStyle}>
                    {vendorContracts.map(c => (
                      <article key={c.id} style={cardStyle}>
                        <h3 style={{ marginTop: 0 }}>{c.title}</h3>
                        <p><strong>Status:</strong> {c.status}</p>
                        <p>
                          <strong>Reference:</strong>{' '}
                          {c.reference || 'Not recorded'}
                        </p>
                        <p>
                          <strong>Value:</strong>{' '}
                          {money(c.contract_value, c.currency)}
                        </p>
                        <p>
                          <strong>Start:</strong>{' '}
                          {c.start_date || 'Not recorded'}
                        </p>
                        <p>
                          <strong>End:</strong>{' '}
                          {c.end_date || 'Not recorded'}
                        </p>
                        <div style={{ marginTop: 16, borderTop: '1px solid #dce4ed', paddingTop: 12 }}>
                          <strong>Contract coverage</strong>
                          {(() => {
                            const rows = contractLocations.filter(x => x.contract_id === c.id);
                            const names = rows.map(x => facilities.find(f => f.id === x.facility_id)?.name).filter(Boolean);
                            return <p style={{ margin: '8px 0' }}>
                              {rows.length === 0
                                ? 'Company-wide agreement (all organization facilities)'
                                : names.length ? names.join(' · ') : 'Assigned facilities not available'}
                            </p>;
                          })()}
                          {canWrite && contractLocationEdit !== c.id && (
                            <button type="button" style={secondaryButton} onClick={() => startContractLocationEdit(c)}>
                              Manage contract locations
                            </button>
                          )}
                          {canWrite && contractLocationEdit === c.id && (
                            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                              <p style={{ margin: 0, fontSize: 13 }}>
                                Select covered locations. Leave all unchecked for company-wide coverage.
                              </p>
                              {facilities.map(f => (
                                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" checked={locationChoices.includes(f.id)}
                                    onChange={e => setLocationChoices(old => e.target.checked
                                      ? [...old, f.id] : old.filter(id => id !== f.id))} />
                                  {f.name}
                                </label>
                              ))}
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" disabled={busy} style={buttonStyle}
                                  onClick={() => saveContractLocations(c.id)}>
                                  {busy ? 'Saving…' : 'Save contract coverage'}
                                </button>
                                <button type="button" disabled={busy} style={secondaryButton}
                                  onClick={() => setContractLocationEdit('')}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                        {c.end_date && c.end_date < today && (
                          <p style={{ color: '#a43b35' }}>
                            End date has passed — review contract status.
                          </p>
                        )}
                      </article>
                    ))}
                  </div>

                  {openForm === 'contract' && canWrite && (
                    <form
                      onSubmit={e => {
                        e.preventDefault();

                        if (
                          contractForm.start_date &&
                          contractForm.end_date &&
                          contractForm.end_date <
                            contractForm.start_date
                        ) {
                          setError(
                            'End date cannot precede start date.'
                          );
                          return;
                        }

                        saveRecord(
                          () => insert(
                            'enterprise_contractor_contracts',
                            {
                              ...contractForm,
                              contractor_id: selected,
                              reference:
                                contractForm.reference || null,
                              start_date:
                                contractForm.start_date || null,
                              end_date:
                                contractForm.end_date || null,
                              contract_value:
                                contractForm.contract_value === ''
                                  ? null
                                  : Number(
                                      contractForm.contract_value
                                    ),
                            }
                          ),
                          () => setContractForm(initialContract)
                        );
                      }}
                      style={{ ...cardStyle, marginTop: 16 }}
                    >
                      <h3>Add contract</h3>
                      <div style={gridStyle}>
                        <Field label="Contract title *">
                          <TextInput
                            required
                            value={contractForm.title}
                            onChange={v => setContractForm({
                              ...contractForm, title: v,
                            })}
                          />
                        </Field>
                        <Field label="Reference">
                          <TextInput
                            value={contractForm.reference}
                            onChange={v => setContractForm({
                              ...contractForm, reference: v,
                            })}
                          />
                        </Field>
                        <Field label="Start date">
                          <TextInput
                            type="date"
                            value={contractForm.start_date}
                            onChange={v => setContractForm({
                              ...contractForm, start_date: v,
                            })}
                          />
                        </Field>
                        <Field label="End date">
                          <TextInput
                            type="date"
                            value={contractForm.end_date}
                            onChange={v => setContractForm({
                              ...contractForm, end_date: v,
                            })}
                          />
                        </Field>
                        <Field label="Contract value">
                          <TextInput
                            type="number"
                            min="0"
                            step="0.01"
                            value={contractForm.contract_value}
                            onChange={v => setContractForm({
                              ...contractForm,
                              contract_value: v,
                            })}
                          />
                        </Field>
                        <Field label="Currency">
                          <TextInput
                            maxLength={3}
                            minLength={3}
                            required
                            value={contractForm.currency}
                            onChange={v => setContractForm({
                              ...contractForm,
                              currency: v.toUpperCase(),
                            })}
                          />
                        </Field>
                        <Field label="Status">
                          <select
                            value={contractForm.status}
                            onChange={e => setContractForm({
                              ...contractForm,
                              status: e.target.value,
                            })}
                            style={inputStyle}
                          >
                            {[
                              'draft',
                              'active',
                              'expired',
                              'terminated',
                              'completed',
                            ].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                        <div style={{ alignSelf: 'end' }}>
                          <button
                            type="submit"
                            disabled={
                              busy ||
                              !contractForm.title.trim()
                            }
                            style={buttonStyle}
                          >
                            {busy ? 'Saving…' : 'Save contract'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {tab === 'compliance' && (
                <div>
                  <SectionHeader
                    title="Insurance, licenses & certifications"
                    count={vendorCredentials.length}
                    open={openForm === 'credential'}
                    onToggle={() => toggleForm('credential')}
                    canWrite={canWrite}
                  />

                  {!vendorCredentials.length && (
                    <Empty>No compliance credentials recorded.</Empty>
                  )}

                  <div style={gridStyle}>
                    {vendorCredentials.map(c => {
                      const status = credentialStatus(c);

                      return (
                        <article key={c.id} style={cardStyle}>
                          <h3 style={{ marginTop: 0 }}>{c.title}</h3>
                          <p>
                            <strong>Type:</strong> {c.credential_type}
                          </p>
                          <p>
                            <strong>Issuer:</strong>{' '}
                            {c.issuer || 'Not recorded'}
                          </p>
                          <p>
                            <strong>Expires:</strong>{' '}
                            {c.expires_on || 'Not recorded'}
                          </p>
                          <p style={{
                            fontWeight: 700,
                            color: ['Expired', 'Expiring soon']
                              .includes(status)
                              ? '#a43b35'
                              : '#176346',
                          }}>
                            {status}
                          </p>
                        </article>
                      );
                    })}
                  </div>

                  {openForm === 'credential' && canWrite && (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        saveRecord(
                          () => insert(
                            'enterprise_contractor_credentials',
                            {
                              ...credentialForm,
                              contractor_id: selected,
                              expires_on:
                                credentialForm.expires_on || null,
                            }
                          ),
                          () => setCredentialForm(initialCredential)
                        );
                      }}
                      style={{ ...cardStyle, marginTop: 16 }}
                    >
                      <h3>Add compliance credential</h3>
                      <div style={gridStyle}>
                        <Field label="Credential title *">
                          <TextInput
                            required
                            value={credentialForm.title}
                            onChange={v => setCredentialForm({
                              ...credentialForm, title: v,
                            })}
                          />
                        </Field>
                        <Field label="Type">
                          <select
                            value={credentialForm.credential_type}
                            onChange={e => setCredentialForm({
                              ...credentialForm,
                              credential_type: e.target.value,
                            })}
                            style={inputStyle}
                          >
                            <option value="insurance">Insurance</option>
                            <option value="license">License</option>
                            <option value="certification">
                              Certification
                            </option>
                            <option value="other">Other</option>
                          </select>
                        </Field>
                        <Field label="Issuer">
                          <TextInput
                            value={credentialForm.issuer}
                            onChange={v => setCredentialForm({
                              ...credentialForm, issuer: v,
                            })}
                          />
                        </Field>
                        <Field label="Expiry date">
                          <TextInput
                            type="date"
                            value={credentialForm.expires_on}
                            onChange={v => setCredentialForm({
                              ...credentialForm, expires_on: v,
                            })}
                          />
                        </Field>
                        <div style={{ alignSelf: 'end' }}>
                          <button
                            type="submit"
                            disabled={
                              busy ||
                              !credentialForm.title.trim()
                            }
                            style={buttonStyle}
                          >
                            {busy ? 'Saving…' : 'Save credential'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {tab === 'history' && (
                <div style={cardStyle}>
                  <h3>Contractor work history</h3>
                  <p>
                    Work orders, completed services, response times,
                    and supporting evidence will be connected here
                    when Enterprise Work Orders is implemented.
                  </p>
                </div>
              )}

              {tab === 'performance' && (
                <div style={cardStyle}>
                  <h3>Contractor performance</h3>
                  <p>
                    <strong>Existing performance rating:</strong>{' '}
                    {vendor.performance_rating == null
                      ? 'Not recorded'
                      : `${vendor.performance_rating} / 5`}
                  </p>
                  <p>
                    Service-level metrics, completion performance,
                    compliance scores, and facility comparisons
                    will be added as their source modules become
                    available.
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}
