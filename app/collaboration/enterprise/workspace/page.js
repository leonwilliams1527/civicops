
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
  ? createClient(url, key, { global: { fetch: proxyFetch } })
  : null;

const STATUS = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const PRIORITY = ['low', 'medium', 'high', 'critical'];

const blankTask = {
  title: '',
  description: '',
  department_id: '',
  assigned_to: '',
  priority: 'medium',
  due_date: '',
  status: 'todo',
};

const inputStyle = {
  width: '100%',
  minWidth: 0,
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#fff',
  color: '#172b42',
  boxSizing: 'border-box',
  fontSize: 14,
};

const primaryButton = {
  padding: '11px 17px',
  background: '#174b70',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton = {
  ...primaryButton,
  background: '#edf3f8',
  color: '#17324d',
  border: '1px solid #cbd5e1',
};

const cardStyle = {
  padding: 18,
  border: '1px solid #dbe4ee',
  borderRadius: 12,
  background: '#fff',
};

const muted = { color: '#64748b', fontSize: 13 };

function todayString() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateString(value) {
  return value ? String(value).slice(0, 10) : '';
}

function statusLabel(value) {
  return STATUS.find(item => item[0] === value)?.[1] || value || 'Unknown';
}

function priorityColor(value) {
  if (value === 'critical') return '#fee2e2';
  if (value === 'high') return '#ffedd5';
  if (value === 'medium') return '#fef3c7';
  return '#e2e8f0';
}

function timestamp(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
      <strong style={{ fontSize: 13 }}>{label}</strong>
      {children}
    </label>
  );
}

export default function EnterpriseWorkspace() {
  const [userId, setUserId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');

  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...blankTask });

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [editForm, setEditForm] = useState({ ...blankTask });
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [commentText, setCommentText] = useState('');

  const [view, setView] = useState('mine');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!db) throw new Error('Supabase configuration is missing.');

        const auth = await db.auth.getUser();
        if (auth.error) throw auth.error;
        if (!auth.data?.user) {
          throw new Error('Please sign in to access your workspace.');
        }

        const uid = auth.data.user.id;

        const membership = await db
          .from('enterprise_members')
          .select('organization_id')
          .eq('user_id', uid);

        if (membership.error) throw membership.error;

        const ids = [
          ...new Set(
            (membership.data || []).map(row => row.organization_id)
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
        if (active) setError(err.message || 'Initialization failed.');
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => { active = false; };
  }, []);

  async function fetchWorkspace(orgId) {
    const results = await Promise.all([
      db.from('enterprise_tasks')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),

      db.from('enterprise_members')
        .select('user_id,role')
        .eq('organization_id', orgId),

      db.from('enterprise_departments')
        .select('id,name')
        .eq('organization_id', orgId)
        .order('name'),

      db.from('enterprise_department_members')
        .select('department_id,user_id')
        .eq('organization_id', orgId),
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    const loadedMembers = results[1].data || [];
    const ids = [...new Set(loadedMembers.map(m => m.user_id))];
    let loadedProfiles = [];

    if (ids.length) {
      const result = await db
        .from('enterprise_employee_profiles')
        .select('user_id,display_name,job_title')
        .in('user_id', ids);

      if (result.error) throw result.error;
      loadedProfiles = result.data || [];
    }

    return {
      tasks: results[0].data || [],
      members: loadedMembers,
      departments: results[2].data || [],
      departmentMembers: results[3].data || [],
      profiles: loadedProfiles,
    };
  }

  function applyWorkspace(data) {
    setTasks(data.tasks);
    setMembers(data.members);
    setDepartments(data.departments);
    setDepartmentMembers(data.departmentMembers);
    setProfiles(data.profiles);
  }

  useEffect(() => {
    if (!organizationId || !userId) return;

    let active = true;
    setLoading(true);
    setError('');

    fetchWorkspace(organizationId)
      .then(data => {
        if (active) applyWorkspace(data);
      })
      .catch(err => {
        if (active) setError(err.message || 'Workspace load failed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [organizationId, userId]);

  async function refreshWorkspace() {
    const data = await fetchWorkspace(organizationId);
    applyWorkspace(data);
    return data;
  }

  const myRole = members.find(m => m.user_id === userId)?.role;
  const isManager = ['owner', 'admin', 'manager'].includes(myRole);

  const allowedDepartments = useMemo(() => {
    return departments.filter(d =>
      isManager ||
      departmentMembers.some(
        m => m.department_id === d.id && m.user_id === userId
      )
    );
  }, [departments, departmentMembers, isManager, userId]);

  function employeesInDepartment(departmentId) {
    return members.filter(m =>
      departmentMembers.some(
        dm =>
          dm.department_id === departmentId &&
          dm.user_id === m.user_id
      )
    );
  }

  function employeeName(id) {
    if (!id) return 'Unassigned';
    const profile = profiles.find(p => p.user_id === id);
    const name = profile?.display_name ||
      `Employee ${String(id).slice(0, 8)}`;
    return id === userId ? `${name} (You)` : name;
  }

  function departmentName(id) {
    return departments.find(d => d.id === id)?.name || 'Not assigned';
  }

  const myTasks = tasks.filter(t => t.assigned_to === userId);
  const today = todayString();

  const inProgress = myTasks.filter(
    t => t.status === 'in_progress'
  ).length;

  const overdue = myTasks.filter(
    t =>
      t.due_date &&
      dateString(t.due_date) < today &&
      !['completed', 'cancelled'].includes(t.status)
  ).length;

  const completed = myTasks.filter(
    t => t.status === 'completed'
  ).length;

  const visibleTasks = useMemo(() => {
    let result = tasks;

    if (view === 'mine') {
      result = result.filter(t => t.assigned_to === userId);
    } else if (view === 'created') {
      result = result.filter(t => t.created_by === userId);
    } else if (view === 'department') {
      const ids = allowedDepartments.map(d => d.id);
      result = result.filter(t => ids.includes(t.department_id));
    } else if (!isManager) {
      result = result.filter(
        t => t.assigned_to === userId || t.created_by === userId
      );
    }

    if (departmentFilter !== 'all') {
      result = result.filter(
        t => t.department_id === departmentFilter
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        t =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [
    tasks, view, userId, allowedDepartments, isManager,
    departmentFilter, statusFilter, search,
  ]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const canEditAll = task =>
    !!task &&
    (isManager || task.created_by === userId);

  const canAccess = task =>
    !!task &&
    (isManager ||
      task.created_by === userId ||
      task.assigned_to === userId);

  const canEditStatus = task => canAccess(task);

  function closeEditor() {
    if (busy) return;
    setSelectedTaskId('');
    setComments([]);
    setActivity([]);
    setCommentText('');
    setError('');
  }

  useEffect(() => {
    if (!selectedTaskId) return;

    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) closeEditor();
    }

    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedTaskId, busy]);

  async function loadDetails(taskId, orgId) {
    const [commentResult, activityResult] = await Promise.all([
      db.from('enterprise_task_comments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }),

      db.from('enterprise_task_activity')
        .select('*')
        .eq('organization_id', orgId)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false }),
    ]);

    if (commentResult.error) throw commentResult.error;
    if (activityResult.error) throw activityResult.error;

    return {
      comments: commentResult.data || [],
      activity: activityResult.data || [],
    };
  }

  async function refreshDetails(taskId = selectedTaskId) {
    if (!taskId) return;
    const data = await loadDetails(taskId, organizationId);
    setComments(data.comments);
    setActivity(data.activity);
  }

  async function openTask(task) {
    if (!canAccess(task)) {
      setError('You do not have access to this task.');
      return;
    }

    setSelectedTaskId(task.id);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      due_date: dateString(task.due_date),
      department_id: task.department_id || '',
      assigned_to: task.assigned_to || '',
    });
    setComments([]);
    setActivity([]);
    setCommentText('');
    setError('');
    setMessage('');
    setDetailLoading(true);

    try {
      await refreshDetails(task.id);
    } catch (err) {
      setError(err.message || 'Unable to load task details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    if (busy) return;

    const f = createForm;
    const validDepartment = allowedDepartments.some(
      d => d.id === f.department_id
    );
    const validEmployee = employeesInDepartment(
      f.department_id
    ).some(m => m.user_id === f.assigned_to);

    if (!f.title.trim() || !validDepartment || !validEmployee) {
      setError('Select a valid title, department and assignee.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db.from('enterprise_tasks').insert({
        organization_id: organizationId,
        title: f.title.trim(),
        description: f.description.trim() || null,
        department_id: f.department_id,
        assigned_to: f.assigned_to,
        created_by: userId,
        priority: f.priority,
        due_date: f.due_date || null,
        status: 'todo',
      });

      if (result.error) throw result.error;

      await refreshWorkspace();
      setCreateForm({ ...blankTask });
      setCreateOpen(false);
      setMessage('Task created successfully.');
    } catch (err) {
      setError(err.message || 'Unable to create task.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!selectedTask || busy) return;

    const fullEdit = canEditAll(selectedTask);
    const statusEdit = canEditStatus(selectedTask);

    if (!statusEdit) {
      setError('You do not have permission to edit this task.');
      return;
    }

    let changes;

    if (fullEdit) {
      const validDepartment = allowedDepartments.some(
        d => d.id === editForm.department_id
      );

      const validEmployee = employeesInDepartment(
        editForm.department_id
      ).some(m => m.user_id === editForm.assigned_to);

      if (!editForm.title.trim()) {
        setError('Task title is required.');
        return;
      }

      if (!validDepartment || !validEmployee) {
        setError('Choose a valid department and assigned employee.');
        return;
      }

      changes = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        status: editForm.status,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
        department_id: editForm.department_id,
        assigned_to: editForm.assigned_to,
      };
    } else {
      changes = { status: editForm.status };
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .update(changes)
        .eq('id', selectedTask.id)
        .eq('organization_id', organizationId)
        .select('*')
        .single();

      if (result.error) throw result.error;

      await refreshWorkspace();

      const stillAccessible =
        isManager ||
        result.data.created_by === userId ||
        result.data.assigned_to === userId;

      if (stillAccessible) {
        setEditForm({
          title: result.data.title || '',
          description: result.data.description || '',
          status: result.data.status || 'todo',
          priority: result.data.priority || 'medium',
          due_date: dateString(result.data.due_date),
          department_id: result.data.department_id || '',
          assigned_to: result.data.assigned_to || '',
        });

        await refreshDetails(result.data.id);
      } else {
        setSelectedTaskId('');
      }

      setMessage('Task changes saved successfully.');
    } catch (err) {
      setError(err.message || 'Unable to save task changes.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(task, status) {
    if (busy || !canEditStatus(task) || status === task.status) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .update({ status })
        .eq('id', task.id)
        .eq('organization_id', organizationId)
        .select('id');

      if (result.error) throw result.error;
      if (!result.data?.length) {
        throw new Error('Status update was not permitted.');
      }

      await refreshWorkspace();
      setMessage('Task status updated.');
    } catch (err) {
      setError(err.message || 'Unable to update task status.');
    } finally {
      setBusy(false);
    }
  }

  async function postComment(event) {
    event.preventDefault();

    if (
      busy ||
      !selectedTask ||
      !canAccess(selectedTask) ||
      !commentText.trim()
    ) return;

    setBusy(true);
    setError('');

    try {
      const result = await db
        .from('enterprise_task_comments')
        .insert({
          organization_id: organizationId,
          task_id: selectedTask.id,
          author_id: userId,
          body: commentText.trim(),
        });

      if (result.error) throw result.error;

      setCommentText('');
      await refreshDetails();
      setMessage('Comment posted.');
    } catch (err) {
      setError(err.message || 'Unable to post comment.');
    } finally {
      setBusy(false);
    }
  }

  function activityText(item) {
    const oldValue = item.old_value;
    const newValue = item.new_value;

    switch (item.event_type) {
      case 'created':
        return 'Created this task';
      case 'commented':
        return 'Added a comment';
      case 'status':
        return `Changed status from ${statusLabel(oldValue)} to ${statusLabel(newValue)}`;
      case 'reassigned':
        return `Reassigned from ${employeeName(oldValue)} to ${employeeName(newValue)}`;
      case 'department':
        return `Changed department from ${departmentName(oldValue)} to ${departmentName(newValue)}`;
      case 'title':
        return `Changed title from "${oldValue || ''}" to "${newValue || ''}"`;
      case 'description':
        return 'Updated task description';
      case 'priority':
        return `Changed priority from ${oldValue || 'none'} to ${newValue || 'none'}`;
      case 'due_date':
        return `Changed due date from ${oldValue || 'not set'} to ${newValue || 'not set'}`;
      default:
        return item.event_type || 'Updated task';
    }
  }

  function changeOrganization(id) {
    setOrganizationId(id);
    setTasks([]);
    setMembers([]);
    setDepartments([]);
    setDepartmentMembers([]);
    setProfiles([]);
    setSelectedTaskId('');
    setCreateOpen(false);
    setCreateForm({ ...blankTask });
    setView('mine');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setSearch('');
    setError('');
    setMessage('');
  }

  const formGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  };

  const modalOpen = !!selectedTaskId && !!selectedTask;

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

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/collaboration/enterprise/employees">
            Employee Directory →
          </Link>
          <Link href="/collaboration/enterprise/dashboard">
            Executive Dashboard →
          </Link>
        </div>
      </header>

      {error && !modalOpen && (
        <div className="ent-error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <p role="status" style={{ color: '#176346', marginBottom: 16 }}>
          {message}
        </p>
      )}

      <section className="ent-panel" style={{ marginBottom: 16 }}>
        <Field label="Organization">
          <select
            value={organizationId}
            disabled={loading || organizations.length === 0}
            onChange={e => changeOrganization(e.target.value)}
            style={inputStyle}
          >
            {!organizations.length && (
              <option value="">No organization available</option>
            )}
            {organizations.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </Field>
      </section>

      {loading ? (
        <section className="ent-panel">Loading workspace…</section>
      ) : !organizationId ? (
        <section className="ent-panel">
          No Enterprise organization is available for this account.
        </section>
      ) : (
        <>
          <div className="ent-kpis" style={{ marginBottom: 20 }}>
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

          <section className="ent-panel" style={{ marginBottom: 16 }}>
            <div className="ent-row" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <h2>Task management</h2>
                <p>Create assignments and track work across your organization.</p>
              </div>
              <button
                type="button"
                style={primaryButton}
                onClick={() => {
                  setCreateOpen(v => !v);
                  setError('');
                }}
              >
                {createOpen ? 'Cancel' : '+ Create task'}
              </button>
            </div>

            {createOpen && (
              <form onSubmit={createTask} style={{
                ...cardStyle, marginTop: 16, display: 'grid', gap: 14,
              }}>
                <h3 style={{ margin: 0 }}>Create a task</h3>

                <Field label="Task title *">
                  <input
                    required
                    maxLength={200}
                    value={createForm.title}
                    onChange={e => setCreateForm(f => ({
                      ...f, title: e.target.value,
                    }))}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Description">
                  <textarea
                    rows={3}
                    value={createForm.description}
                    onChange={e => setCreateForm(f => ({
                      ...f, description: e.target.value,
                    }))}
                    style={inputStyle}
                  />
                </Field>

                <div style={formGrid}>
                  <Field label="Department *">
                    <select
                      required
                      value={createForm.department_id}
                      onChange={e => setCreateForm(f => ({
                        ...f,
                        department_id: e.target.value,
                        assigned_to: '',
                      }))}
                      style={inputStyle}
                    >
                      <option value="">Select department</option>
                      {allowedDepartments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Assign to *">
                    <select
                      required
                      value={createForm.assigned_to}
                      disabled={!createForm.department_id}
                      onChange={e => setCreateForm(f => ({
                        ...f, assigned_to: e.target.value,
                      }))}
                      style={inputStyle}
                    >
                      <option value="">Select employee</option>
                      {employeesInDepartment(
                        createForm.department_id
                      ).map(m => (
                        <option key={m.user_id} value={m.user_id}>
                          {employeeName(m.user_id)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      value={createForm.priority}
                      onChange={e => setCreateForm(f => ({
                        ...f, priority: e.target.value,
                      }))}
                      style={inputStyle}
                    >
                      {PRIORITY.map(p => (
                        <option key={p} value={p}>
                          {p[0].toUpperCase() + p.slice(1)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Due date">
                    <input
                      type="date"
                      value={createForm.due_date}
                      onChange={e => setCreateForm(f => ({
                        ...f, due_date: e.target.value,
                      }))}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <div>
                  <button
                    type="submit"
                    style={primaryButton}
                    disabled={
                      busy ||
                      !createForm.title.trim() ||
                      !createForm.department_id ||
                      !createForm.assigned_to
                    }
                  >
                    {busy ? 'Saving…' : 'Create task'}
                  </button>
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
                display: 'flex', gap: 8, flexWrap: 'wrap',
              }}>
                <select
                  aria-label="Task view"
                  value={view}
                  onChange={e => setView(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="mine">Assigned to me</option>
                  <option value="created">Created by me</option>
                  <option value="department">Department tasks</option>
                  <option value="all">
                    {isManager
                      ? 'All organization tasks'
                      : 'My related tasks'}
                  </option>
                </select>

                <select
                  aria-label="Department filter"
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="all">All departments</option>
                  {allowedDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                <select
                  aria-label="Status filter"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="all">All statuses</option>
                  {STATUS.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <input
              aria-label="Search tasks"
              placeholder="Search tasks by title or description"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            {!visibleTasks.length ? (
              <p style={muted}>No tasks match the selected view.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {visibleTasks.map(task => {
                  const late =
                    task.due_date &&
                    dateString(task.due_date) < today &&
                    !['completed', 'cancelled'].includes(task.status);

                  return (
                    <article key={task.id} style={cardStyle}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
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
                          background: priorityColor(task.priority),
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {task.priority || 'medium'}
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 16,
                        margin: '10px 0 14px',
                        ...muted,
                      }}>
                        <span>
                          <strong>Assigned:</strong>{' '}
                          {employeeName(task.assigned_to)}
                        </span>
                        <span>
                          <strong>Department:</strong>{' '}
                          {departmentName(task.department_id)}
                        </span>
                        <span>
                          <strong>Created by:</strong>{' '}
                          {employeeName(task.created_by)}
                        </span>
                        <span style={{
                          color: late ? '#b91c1c' : undefined,
                        }}>
                          <strong>Due:</strong>{' '}
                          {dateString(task.due_date) || 'Not set'}
                          {late ? ' — Overdue' : ''}
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}>
                        <strong style={{ fontSize: 13 }}>Status</strong>

                        <select
                          aria-label={`Status for ${task.title}`}
                          value={task.status || 'todo'}
                          disabled={busy || !canEditStatus(task)}
                          onChange={e =>
                            updateStatus(task, e.target.value)
                          }
                          style={{ ...inputStyle, width: 'auto' }}
                        >
                          {STATUS.map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>

                        {canAccess(task) && (
                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() => openTask(task)}
                          >
                            Open task / Edit
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {modalOpen && (
        <div
          className="ent-task-overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <section
            className="ent-task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ent-task-modal-title"
          >
            <div className="ent-task-modal-header">
              <div>
                <div className="ent-eyebrow">TASK WORKSPACE</div>
                <h2 id="ent-task-modal-title" style={{ margin: '5px 0' }}>
                  Edit task
                </h2>
                <p style={{ ...muted, margin: 0 }}>
                  Update details, collaborate and review activity.
                </p>
              </div>

              <button
                type="button"
                className="ent-task-close"
                aria-label="Close task editor"
                onClick={closeEditor}
                disabled={busy}
              >
                ×
              </button>
            </div>

            <div className="ent-task-modal-body">
              {error && (
                <div
                  className="ent-error"
                  role="alert"
                  style={{ marginBottom: 16 }}
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={saveTask}
                style={{ display: 'grid', gap: 18 }}
              >
                <div className="ent-task-form-grid">
                  <div className="ent-task-form-main">
                    <Field label="Task title *">
                      <input
                        required
                        maxLength={200}
                        value={editForm.title}
                        disabled={!canEditAll(selectedTask) || busy}
                        onChange={e => setEditForm(f => ({
                          ...f, title: e.target.value,
                        }))}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Description">
                      <textarea
                        rows={5}
                        value={editForm.description}
                        disabled={!canEditAll(selectedTask) || busy}
                        onChange={e => setEditForm(f => ({
                          ...f, description: e.target.value,
                        }))}
                        style={inputStyle}
                        placeholder="Add instructions, context and expected outcomes…"
                      />
                    </Field>
                  </div>

                  <div className="ent-task-form-side">
                    <Field label="Status">
                      <select
                        value={editForm.status}
                        disabled={!canEditStatus(selectedTask) || busy}
                        onChange={e => setEditForm(f => ({
                          ...f, status: e.target.value,
                        }))}
                        style={inputStyle}
                      >
                        {STATUS.map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Priority">
                      <select
                        value={editForm.priority}
                        disabled={!canEditAll(selectedTask) || busy}
                        onChange={e => setEditForm(f => ({
                          ...f, priority: e.target.value,
                        }))}
                        style={inputStyle}
                      >
                        {PRIORITY.map(p => (
                          <option key={p} value={p}>
                            {p[0].toUpperCase() + p.slice(1)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Due date">
                      <input
                        type="date"
                        value={editForm.due_date}
                        disabled={!canEditAll(selectedTask) || busy}
                        onChange={e => setEditForm(f => ({
                          ...f, due_date: e.target.value,
                        }))}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Department">
                      <select
                        value={editForm.department_id}
                        disabled={!canEditAll(selectedTask) || busy}
                        onChange={e => setEditForm(f => ({
                          ...f,
                          department_id: e.target.value,
                          assigned_to: '',
                        }))}
                        style={inputStyle}
                      >
                        <option value="">Select department</option>
                        {allowedDepartments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Assigned employee">
                      <select
                        value={editForm.assigned_to}
                        disabled={
                          !canEditAll(selectedTask) ||
                          !editForm.department_id ||
                          busy
                        }
                        onChange={e => setEditForm(f => ({
                          ...f, assigned_to: e.target.value,
                        }))}
                        style={inputStyle}
                      >
                        <option value="">Select employee</option>
                        {employeesInDepartment(
                          editForm.department_id
                        ).map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {employeeName(m.user_id)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: 16,
                }}>
                  <span style={muted}>
                    Created by {employeeName(selectedTask.created_by)}
                  </span>

                  <div style={{
                    display: 'flex', gap: 10, flexWrap: 'wrap',
                  }}>
                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={closeEditor}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={primaryButton}
                      disabled={busy}
                    >
                      {busy ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="ent-task-collaboration">
                <section style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Comments & updates</h3>

                  {detailLoading ? (
                    <p>Loading comments…</p>
                  ) : comments.length === 0 ? (
                    <p style={muted}>No comments yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {comments.map(comment => (
                        <div
                          key={comment.id}
                          style={{
                            paddingBottom: 12,
                            borderBottom: '1px solid #e2e8f0',
                          }}
                        >
                          <strong>
                            {employeeName(comment.author_id)}
                          </strong>
                          <div style={muted}>
                            {timestamp(comment.created_at)}
                          </div>
                          <p style={{ whiteSpace: 'pre-wrap' }}>
                            {comment.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    onSubmit={postComment}
                    style={{ marginTop: 16 }}
                  >
                    <Field label="Add an update">
                      <textarea
                        rows={4}
                        maxLength={5000}
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Share progress, questions or handover notes…"
                        style={inputStyle}
                      />
                    </Field>
                    <button
                      type="submit"
                      style={{ ...primaryButton, marginTop: 10 }}
                      disabled={busy || !commentText.trim()}
                    >
                      {busy ? 'Posting…' : 'Post comment'}
                    </button>
                  </form>
                </section>

                <section style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Activity history</h3>

                  {detailLoading ? (
                    <p>Loading activity…</p>
                  ) : activity.length === 0 ? (
                    <p style={muted}>
                      No recorded activity yet.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 14 }}>
                      {activity.map(item => (
                        <div
                          key={item.id}
                          style={{
                            paddingLeft: 12,
                            borderLeft: '3px solid #b8ccde',
                          }}
                        >
                          <strong>
                            {employeeName(item.actor_id)}
                          </strong>
                          <p style={{ margin: '5px 0' }}>
                            {activityText(item)}
                          </p>
                          <div style={muted}>
                            {timestamp(item.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    style={{ ...secondaryButton, marginTop: 16 }}
                    disabled={busy || detailLoading}
                    onClick={async () => {
                      setDetailLoading(true);
                      try {
                        await refreshDetails();
                      } catch (err) {
                        setError(err.message || 'Refresh failed.');
                      } finally {
                        setDetailLoading(false);
                      }
                    }}
                  >
                    Refresh activity
                  </button>
                </section>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
