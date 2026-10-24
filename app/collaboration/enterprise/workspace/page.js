
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
  ? createClient(url, key, {
      global: { fetch: proxy },
    })
  : null;

const statuses = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['in_review', 'In review'],
  ['blocked', 'Blocked'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const priorities = ['low', 'medium', 'high', 'critical'];

const inputStyle = {
  width: '100%',
  padding: 11,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#172b42',
};

const buttonStyle = {
  padding: '10px 16px',
  border: 0,
  borderRadius: 8,
  background: '#174b70',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const cardStyle = {
  padding: 18,
  border: '1px solid #dce4ed',
  borderRadius: 12,
  background: '#fff',
};

const initialForm = {
  title: '',
  description: '',
  priority: 'medium',
  assigned_to: '',
  due_date: '',
};

function statusLabel(value) {
  return statuses.find(([id]) => id === value)?.[1] || value;
}

function displayName(member) {
  return member?.user_id
    ? `Employee ${member.user_id.slice(0, 8)}`
    : 'Unassigned';
}

export default function EnterpriseWorkspace() {
  const [userId, setUserId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');

  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [view, setView] = useState('mine');
  const [filter, setFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!db) {
          throw new Error('Supabase configuration is missing.');
        }

        const auth = await db.auth.getUser();

        if (auth.error || !auth.data.user) {
          throw new Error('Please sign in to CivicOps.');
        }

        const uid = auth.data.user.id;

        const membership = await db
          .from('enterprise_members')
          .select('organization_id')
          .eq('user_id', uid);

        if (membership.error) throw membership.error;

        const ids = [
          ...new Set(
            (membership.data || []).map(m => m.organization_id)
          ),
        ];

        let organizationsData = [];

        if (ids.length) {
          const orgResult = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', ids)
            .order('name');

          if (orgResult.error) throw orgResult.error;
          organizationsData = orgResult.data || [];
        }

        if (!active) return;

        setUserId(uid);
        setOrganizations(organizationsData);
        setOrganizationId(organizationsData[0]?.id || '');
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  async function loadWorkspace(orgId) {
    if (!orgId) {
      setTasks([]);
      setMembers([]);
      return;
    }

    const [taskResult, memberResult] = await Promise.all([
      db.from('enterprise_tasks')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),

      db.from('enterprise_members')
        .select('user_id,role')
        .eq('organization_id', orgId),
    ]);

    if (taskResult.error) throw taskResult.error;
    if (memberResult.error) throw memberResult.error;

    setTasks(taskResult.data || []);
    setMembers(memberResult.data || []);
  }

  useEffect(() => {
    if (!organizationId) return;

    let active = true;

    setLoading(true);
    setError('');

    async function load() {
      try {
        const [taskResult, memberResult] = await Promise.all([
          db.from('enterprise_tasks')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false }),

          db.from('enterprise_members')
            .select('user_id,role')
            .eq('organization_id', organizationId),
        ]);

        if (taskResult.error) throw taskResult.error;
        if (memberResult.error) throw memberResult.error;

        if (active) {
          setTasks(taskResult.data || []);
          setMembers(memberResult.data || []);
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [organizationId]);

  const myTasks = useMemo(
    () => tasks.filter(t => t.assigned_to === userId),
    [tasks, userId]
  );

  const today = new Date().toISOString().slice(0, 10);

  const overdue = myTasks.filter(
    t => t.due_date &&
      t.due_date < today &&
      !['completed', 'cancelled'].includes(t.status)
  ).length;

  const completed = myTasks.filter(
    t => t.status === 'completed'
  ).length;

  const inProgress = myTasks.filter(
    t => t.status === 'in_progress'
  ).length;

  const visibleTasks = useMemo(() => {
    let list = view === 'mine'
      ? tasks.filter(t => t.assigned_to === userId)
      : view === 'created'
        ? tasks.filter(t => t.created_by === userId)
        : tasks;

    if (filter !== 'all') {
      list = list.filter(t => t.status === filter);
    }

    return list;
  }, [tasks, view, filter, userId]);

  async function createTask(e) {
    e.preventDefault();

    if (busy || !organizationId || !form.title.trim()) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .insert({
          organization_id: organizationId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          assigned_to: form.assigned_to || userId,
          created_by: userId,
          due_date: form.due_date || null,
          status: 'todo',
        });

      if (result.error) throw result.error;

      await loadWorkspace(organizationId);

      setForm(initialForm);
      setShowForm(false);
      setMessage('Task created successfully.');
    } catch (e) {
      setError(e.message || 'Unable to create task.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(task, status) {
    if (busy || task.status === status) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .update({
          status,
          completed_at:
            status === 'completed'
              ? new Date().toISOString()
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('organization_id', organizationId)
        .select('id');

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          'Task was not updated. Check your permissions.'
        );
      }

      await loadWorkspace(organizationId);
      setMessage('Task status updated.');
    } catch (e) {
      setError(e.message || 'Unable to update task.');
    } finally {
      setBusy(false);
    }
  }

  const myRole = members.find(
    m => m.user_id === userId
  )?.role;

  const isManager = ['owner', 'admin', 'manager']
    .includes(myRole);

  return (
    <main className="ent-page">
      <header className="ent-header">
        <div>
          <div className="ent-eyebrow">
            CIVICOPS / ENTERPRISE / MY WORKSPACE
          </div>
          <h1>My Workspace</h1>
          <p>
            Manage assigned work, collaborate with colleagues,
            and keep daily operations moving.
          </p>
        </div>

        <Link href="/collaboration/enterprise/dashboard">
          Executive Dashboard →
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

      <section className="ent-panel" style={{ marginBottom: 16 }}>
        <label>
          <strong>Organization</strong>
          <select
            value={organizationId}
            onChange={e => {
              setOrganizationId(e.target.value);
              setShowForm(false);
            }}
            style={{ ...inputStyle, marginTop: 8 }}
          >
            {organizations.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <section className="ent-panel">
          Loading your workspace…
        </section>
      ) : !organizationId ? (
        <section className="ent-panel">
          No Enterprise organization is available for this account.
        </section>
      ) : (
        <>
          <div className="ent-kpis">
            <div>
              <strong>{myTasks.length}</strong>
              <span>My assigned tasks</span>
            </div>
            <div>
              <strong>{inProgress}</strong>
              <span>In progress</span>
            </div>
            <div>
              <strong>{overdue}</strong>
              <span>Overdue</span>
            </div>
            <div>
              <strong>{completed}</strong>
              <span>Completed</span>
            </div>
          </div>

          <section
            className="ent-panel"
            style={{ marginBottom: 16 }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <h2 style={{ margin: 0 }}>Task management</h2>
                <p>
                  Create assignments and track work across
                  your organization.
                </p>
              </div>

              <button
                type="button"
                style={buttonStyle}
                onClick={() => setShowForm(v => !v)}
              >
                {showForm ? 'Cancel' : '+ Create task'}
              </button>
            </div>

            {showForm && (
              <form
                onSubmit={createTask}
                style={{ ...cardStyle, marginTop: 16 }}
              >
                <h3>Create a task</h3>

                <div style={{
                  display: 'grid',
                  gap: 14,
                }}>
                  <label>
                    <strong>Task title *</strong>
                    <input
                      required
                      maxLength={200}
                      value={form.title}
                      onChange={e => setForm({
                        ...form,
                        title: e.target.value,
                      })}
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <strong>Description</strong>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={e => setForm({
                        ...form,
                        description: e.target.value,
                      })}
                      style={inputStyle}
                    />
                  </label>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(190px,1fr))',
                    gap: 12,
                  }}>
                    <label>
                      <strong>Assign to</strong>
                      <select
                        value={form.assigned_to}
                        onChange={e => setForm({
                          ...form,
                          assigned_to: e.target.value,
                        })}
                        style={inputStyle}
                      >
                        <option value="">
                          Myself
                        </option>

                        {members
                          .filter(m => m.user_id !== userId)
                          .map(m => (
                            <option
                              key={m.user_id}
                              value={m.user_id}
                            >
                              {displayName(m)}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      <strong>Priority</strong>
                      <select
                        value={form.priority}
                        onChange={e => setForm({
                          ...form,
                          priority: e.target.value,
                        })}
                        style={inputStyle}
                      >
                        {priorities.map(p => (
                          <option key={p} value={p}>
                            {p.charAt(0).toUpperCase() +
                              p.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <strong>Due date</strong>
                      <input
                        type="date"
                        value={form.due_date}
                        onChange={e => setForm({
                          ...form,
                          due_date: e.target.value,
                        })}
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={busy || !form.title.trim()}
                      style={buttonStyle}
                    >
                      {busy ? 'Saving…' : 'Create task'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          <section className="ent-panel">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}>
              <h2 style={{ margin: 0 }}>Task board</h2>

              <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}>
                <select
                  aria-label="Task view"
                  value={view}
                  onChange={e => setView(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="mine">Assigned to me</option>
                  <option value="created">Created by me</option>
                  <option value="all">
                    {isManager
                      ? 'All organization tasks'
                      : 'Organization tasks'}
                  </option>
                </select>

                <select
                  aria-label="Task status filter"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="all">All statuses</option>
                  {statuses.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {visibleTasks.length === 0 ? (
              <p style={{ color: '#64748b' }}>
                No tasks match the selected view.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gap: 12,
              }}>
                {visibleTasks.map(task => {
                  const isOverdue =
                    task.due_date &&
                    task.due_date < today &&
                    !['completed', 'cancelled']
                      .includes(task.status);

                  const canUpdate =
                    task.created_by === userId ||
                    task.assigned_to === userId ||
                    isManager;

                  return (
                    <article key={task.id} style={cardStyle}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 8px' }}>
                            {task.title}
                          </h3>

                          {task.description && (
                            <p>{task.description}</p>
                          )}
                        </div>

                        <span style={{
                          padding: '5px 10px',
                          borderRadius: 20,
                          background:
                            task.priority === 'critical'
                              ? '#fee2e2'
                              : task.priority === 'high'
                                ? '#fff0d6'
                                : '#edf2f7',
                          color: '#172b42',
                          fontSize: 12,
                          fontWeight: 700,
                        }}>
                          {task.priority.toUpperCase()}
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        fontSize: 13,
                        margin: '14px 0',
                        color: '#52667e',
                      }}>
                        <span>
                          <strong>Assigned:</strong>{' '}
                          {task.assigned_to === userId
                            ? 'You'
                            : displayName(
                                members.find(
                                  m => m.user_id ===
                                    task.assigned_to
                                )
                              )}
                        </span>

                        <span>
                          <strong>Due:</strong>{' '}
                          {task.due_date || 'Not set'}
                        </span>

                        {isOverdue && (
                          <strong style={{ color: '#a43b35' }}>
                            Overdue
                          </strong>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}>
                        <label>
                          <strong style={{
                            fontSize: 13,
                            marginRight: 8,
                          }}>
                            Status
                          </strong>

                          <select
                            value={task.status}
                            disabled={busy || !canUpdate}
                            onChange={e => updateStatus(
                              task,
                              e.target.value
                            )}
                            style={{
                              ...inputStyle,
                              width: 'auto',
                            }}
                          >
                            {statuses.map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
