
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

// CIVICOPS ENTERPRISE — PHASE 35.3
// Employee workspace, department tasks, collaboration and activity.

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
        (parsed.search ? '&' + parsed.search.substring(1) : ''),
      init
    );
  }

  return fetch(input, init);
}

const db =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        global: { fetch: proxyFetch },
      })
    : null;

const initialForm = {
  title: '',
  description: '',
  assigned_to: '',
  priority: 'medium',
  due_date: '',
};

const statuses = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const priorities = ['low', 'medium', 'high', 'critical'];

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#ffffff',
  color: '#172b42',
  boxSizing: 'border-box',
  fontSize: 14,
};

const buttonStyle = {
  padding: '11px 17px',
  background: '#174b70',
  border: 0,
  borderRadius: 8,
  color: '#ffffff',
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
  padding: 18,
  background: '#ffffff',
  border: '1px solid #dbe4ee',
  borderRadius: 12,
};

const mutedStyle = {
  color: '#64748b',
  fontSize: 13,
};

function statusLabel(value) {
  return statuses.find(([id]) => id === value)?.[1] || value || 'Unknown';
}

function priorityColor(value) {
  if (value === 'critical') return '#fee2e2';
  if (value === 'high') return '#ffedd5';
  if (value === 'medium') return '#fef3c7';
  return '#e2e8f0';
}

function formatDate(value) {
  return value ? String(value).substring(0, 10) : 'Not set';
}

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimestamp(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

export default function EnterpriseWorkspace() {
  const [userId, setUserId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');

  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [taskDepartment, setTaskDepartment] = useState('');
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);

  const [view, setView] = useState('mine');
  const [filter, setFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [editDepartment, setEditDepartment] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!db) {
          throw new Error('Supabase environment variables are missing.');
        }

        const auth = await db.auth.getUser();
        if (auth.error) throw auth.error;

        const user = auth.data?.user;
        if (!user) {
          throw new Error('Please sign in to access your workspace.');
        }

        const membership = await db
          .from('enterprise_members')
          .select('organization_id')
          .eq('user_id', user.id);

        if (membership.error) throw membership.error;

        const ids = [
          ...new Set(
            (membership.data || []).map(item => item.organization_id)
          ),
        ];

        let available = [];

        if (ids.length) {
          const result = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', ids)
            .order('name');

          if (result.error) throw result.error;
          available = result.data || [];
        }

        if (!active) return;

        setUserId(user.id);
        setOrganizations(available);
        setOrganizationId(available[0]?.id || '');
      } catch (err) {
        if (active) setError(err.message || 'Unable to initialize.');
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
    if (!orgId) return;

    const results = await Promise.all([
      db
        .from('enterprise_tasks')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),
      db
        .from('enterprise_members')
        .select('user_id,role')
        .eq('organization_id', orgId),
      db
        .from('enterprise_departments')
        .select('id,name')
        .eq('organization_id', orgId)
        .order('name'),
      db
        .from('enterprise_department_members')
        .select('department_id,user_id')
        .eq('organization_id', orgId),
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    const loadedMembers = results[1].data || [];
    const employeeIds = [
      ...new Set(loadedMembers.map(item => item.user_id)),
    ];

    let loadedProfiles = [];

    if (employeeIds.length) {
      const profileResult = await db
        .from('enterprise_employee_profiles')
        .select('user_id,display_name,job_title')
        .in('user_id', employeeIds);

      if (profileResult.error) throw profileResult.error;
      loadedProfiles = profileResult.data || [];
    }

    return {
      tasks: results[0].data || [],
      members: loadedMembers,
      departments: results[2].data || [],
      departmentMembers: results[3].data || [],
      profiles: loadedProfiles,
    };
  }

  async function refreshWorkspace(orgId = organizationId) {
    const data = await loadWorkspace(orgId);
    if (!data) return;

    // Do not apply another organization's results.
    if (orgId !== organizationId) return;

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

    loadWorkspace(organizationId)
      .then(data => {
        if (!active || !data) return;
        setTasks(data.tasks);
        setMembers(data.members);
        setDepartments(data.departments);
        setDepartmentMembers(data.departmentMembers);
        setProfiles(data.profiles);
      })
      .catch(err => {
        if (active) setError(err.message || 'Unable to load workspace.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizationId, userId]);

  const myRole = members.find(
    member => member.user_id === userId
  )?.role;

  const isManager = ['owner', 'admin', 'manager'].includes(myRole);

  const allowedDepartments = useMemo(
    () =>
      departments.filter(department =>
        isManager ||
        departmentMembers.some(
          member =>
            member.department_id === department.id &&
            member.user_id === userId
        )
      ),
    [departments, departmentMembers, isManager, userId]
  );

  const assignableEmployees = useMemo(
    () =>
      members.filter(member =>
        departmentMembers.some(
          assignment =>
            assignment.department_id === taskDepartment &&
            assignment.user_id === member.user_id
        )
      ),
    [members, departmentMembers, taskDepartment]
  );

  const editAssignableEmployees = useMemo(
    () =>
      members.filter(member =>
        departmentMembers.some(
          assignment =>
            assignment.department_id === editDepartment &&
            assignment.user_id === member.user_id
        )
      ),
    [members, departmentMembers, editDepartment]
  );

  function employeeName(id) {
    if (!id) return 'Unassigned';

    const profile = profiles.find(person => person.user_id === id);
    const name = profile?.display_name || `Employee ${String(id).slice(0, 8)}`;

    return id === userId ? `${name} (You)` : name;
  }

  function departmentName(id) {
    return (
      departments.find(department => department.id === id)?.name ||
      'Not assigned'
    );
  }

  const today = localDate();

  const myTasks = useMemo(
    () => tasks.filter(task => task.assigned_to === userId),
    [tasks, userId]
  );

  const inProgress = myTasks.filter(
    task => task.status === 'in_progress'
  ).length;

  const overdue = myTasks.filter(
    task =>
      task.due_date &&
      formatDate(task.due_date) < today &&
      !['completed', 'cancelled'].includes(task.status)
  ).length;

  const completed = myTasks.filter(
    task => task.status === 'completed'
  ).length;

  const visibleTasks = useMemo(() => {
    let result = tasks;

    if (view === 'mine') {
      result = result.filter(task => task.assigned_to === userId);
    } else if (view === 'created') {
      result = result.filter(task => task.created_by === userId);
    } else if (view === 'department') {
      const ids = allowedDepartments.map(item => item.id);
      result = result.filter(task => ids.includes(task.department_id));
    } else if (!isManager) {
      result = result.filter(
        task =>
          task.assigned_to === userId ||
          task.created_by === userId
      );
    }

    if (departmentFilter !== 'all') {
      result = result.filter(
        task => task.department_id === departmentFilter
      );
    }

    if (filter !== 'all') {
      result = result.filter(task => task.status === filter);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter(
        task =>
          task.title?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [
    tasks,
    view,
    filter,
    departmentFilter,
    search,
    userId,
    isManager,
    allowedDepartments,
  ]);

  const selectedTask = tasks.find(task => task.id === selectedTaskId);

  const canAccessTask = task =>
    isManager ||
    task?.assigned_to === userId ||
    task?.created_by === userId;

  const canReassignTask = task =>
    isManager || task?.created_by === userId;

  async function createTask(event) {
    event.preventDefault();
    if (busy) return;

    if (
      !organizationId ||
      !form.title.trim() ||
      !taskDepartment ||
      !form.assigned_to
    ) {
      setError('Enter a title, department and assignee.');
      return;
    }

    if (
      !allowedDepartments.some(item => item.id === taskDepartment) ||
      !assignableEmployees.some(
        item => item.user_id === form.assigned_to
      )
    ) {
      setError('Invalid department or assignee.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db.from('enterprise_tasks').insert({
        organization_id: organizationId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        department_id: taskDepartment,
        assigned_to: form.assigned_to,
        created_by: userId,
        priority: form.priority,
        due_date: form.due_date || null,
        status: 'todo',
      });

      if (result.error) throw result.error;

      await refreshWorkspace();

      setForm({ ...initialForm });
      setTaskDepartment('');
      setShowForm(false);
      setMessage('Task created successfully.');
    } catch (err) {
      setError(err.message || 'Unable to create task.');
    } finally {
      setBusy(false);
    }
  }

  async function updateTaskStatus(task, nextStatus) {
    if (busy || task.status === nextStatus) return;

    if (!canAccessTask(task)) {
      setError('You cannot update this task.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .update({ status: nextStatus })
        .eq('id', task.id)
        .eq('organization_id', organizationId)
        .select('id');

      if (result.error) throw result.error;
      if (!result.data?.length) {
        throw new Error('Task update was not permitted.');
      }

      await refreshWorkspace();

      if (selectedTaskId === task.id) {
        await loadTaskDetails(task.id, organizationId);
      }

      setMessage('Task status updated.');
    } catch (err) {
      setError(err.message || 'Unable to update task.');
    } finally {
      setBusy(false);
    }
  }

  async function loadTaskDetails(taskId, orgId) {
    if (!taskId || !orgId) return;

    const [commentResult, activityResult] = await Promise.all([
      db
        .from('enterprise_task_comments')
        .select('*')
        .eq('organization_id', orgId)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }),
      db
        .from('enterprise_task_activity')
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

  async function openTask(task) {
    if (!canAccessTask(task)) {
      setError('You cannot open this task.');
      return;
    }

    setSelectedTaskId(task.id);
    setEditDepartment(task.department_id || '');
    setEditAssignee(task.assigned_to || '');
    setComments([]);
    setActivity([]);
    setCommentText('');
    setDetailLoading(true);
    setError('');

    try {
      const data = await loadTaskDetails(task.id, organizationId);
      if (data) {
        setComments(data.comments);
        setActivity(data.activity);
      }
    } catch (err) {
      setError(err.message || 'Unable to load task details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetails() {
    if (!selectedTaskId) return;
    const data = await loadTaskDetails(selectedTaskId, organizationId);
    if (data) {
      setComments(data.comments);
      setActivity(data.activity);
    }
  }

  async function addComment(event) {
    event.preventDefault();

    if (
      busy ||
      !selectedTask ||
      !canAccessTask(selectedTask) ||
      !commentText.trim()
    ) return;

    setBusy(true);
    setError('');
    setMessage('');

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
      setMessage('Comment added.');
    } catch (err) {
      setError(err.message || 'Unable to add comment.');
    } finally {
      setBusy(false);
    }
  }

  async function reassignTask(event) {
    event.preventDefault();

    if (!selectedTask || !canReassignTask(selectedTask) || busy) return;

    const validDepartment = allowedDepartments.some(
      item => item.id === editDepartment
    );

    const validEmployee = editAssignableEmployees.some(
      item => item.user_id === editAssignee
    );

    if (!validDepartment || !validEmployee) {
      setError('Select a valid department and employee.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .update({
          department_id: editDepartment,
          assigned_to: editAssignee,
        })
        .eq('id', selectedTask.id)
        .eq('organization_id', organizationId)
        .select('id');

      if (result.error) throw result.error;
      if (!result.data?.length) {
        throw new Error('Reassignment was not permitted.');
      }

      await refreshWorkspace();

      // A creator may retain access; otherwise close the task.
      const retainsAccess =
        isManager ||
        selectedTask.created_by === userId ||
        editAssignee === userId;

      if (retainsAccess) {
        await refreshDetails();
      } else {
        setSelectedTaskId('');
      }

      setMessage('Task assignment updated.');
    } catch (err) {
      setError(err.message || 'Unable to reassign task.');
    } finally {
      setBusy(false);
    }
  }

  function activityDescription(item) {
    if (item.event_type === 'created') return 'Created this task';
    if (item.event_type === 'commented') return 'Added a comment';

    if (item.event_type === 'status') {
      return `Changed status from ${statusLabel(item.old_value)} to ${statusLabel(item.new_value)}`;
    }

    if (item.event_type === 'reassigned') {
      return `Reassigned from ${employeeName(item.old_value)} to ${employeeName(item.new_value)}`;
    }

    if (item.event_type === 'department') {
      return `Changed department from ${departmentName(item.old_value)} to ${departmentName(item.new_value)}`;
    }

    return item.event_type;
  }

  function changeOrganization(nextId) {
    setOrganizationId(nextId);
    setTasks([]);
    setMembers([]);
    setDepartments([]);
    setDepartmentMembers([]);
    setProfiles([]);
    setSelectedTaskId('');
    setComments([]);
    setActivity([]);
    setShowForm(false);
    setTaskDepartment('');
    setForm({ ...initialForm });
    setView('mine');
    setFilter('all');
    setDepartmentFilter('all');
    setSearch('');
    setError('');
    setMessage('');
  }

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

      {error && (
        <div className="ent-error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {message && (
        <p role="status" style={{ color: '#176346', marginBottom: 16 }}>
          {message}
        </p>
      )}

      <section className="ent-panel" style={{ marginBottom: 16 }}>
        <label>
          <strong>Organization</strong>
          <select
            value={organizationId}
            disabled={loading || organizations.length === 0}
            onChange={event => changeOrganization(event.target.value)}
            style={{ ...inputStyle, marginTop: 8 }}
          >
            {organizations.length === 0 && (
              <option value="">No organization available</option>
            )}
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <section className="ent-panel">Loading your workspace…</section>
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <h2 style={{ marginTop: 0 }}>Task management</h2>
                <p>
                  Create assignments and track work across your organization.
                </p>
              </div>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  setShowForm(value => !value);
                  setError('');
                  setMessage('');
                }}
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
                <div style={{ display: 'grid', gap: 14 }}>
                  <label>
                    <strong>Task title *</strong>
                    <input
                      required
                      maxLength={200}
                      value={form.title}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <strong>Description</strong>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={event =>
                        setForm(previous => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                      style={inputStyle}
                    />
                  </label>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 12,
                  }}>
                    <label>
                      <strong>Department *</strong>
                      <select
                        required
                        value={taskDepartment}
                        onChange={event => {
                          setTaskDepartment(event.target.value);
                          setForm(previous => ({
                            ...previous,
                            assigned_to: '',
                          }));
                        }}
                        style={inputStyle}
                      >
                        <option value="">Select department</option>
                        {allowedDepartments.map(department => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <strong>Assign to *</strong>
                      <select
                        required
                        value={form.assigned_to}
                        disabled={!taskDepartment}
                        onChange={event =>
                          setForm(previous => ({
                            ...previous,
                            assigned_to: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="">Select assignee</option>
                        {assignableEmployees.map(employee => (
                          <option
                            key={employee.user_id}
                            value={employee.user_id}
                          >
                            {employeeName(employee.user_id)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <strong>Priority</strong>
                      <select
                        value={form.priority}
                        onChange={event =>
                          setForm(previous => ({
                            ...previous,
                            priority: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      >
                        {priorities.map(priority => (
                          <option key={priority} value={priority}>
                            {priority.charAt(0).toUpperCase() +
                              priority.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <strong>Due date</strong>
                      <input
                        type="date"
                        value={form.due_date}
                        onChange={event =>
                          setForm(previous => ({
                            ...previous,
                            due_date: event.target.value,
                          }))
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  {allowedDepartments.length === 0 && (
                    <p style={mutedStyle}>
                      No departments are available. Visit the Employee
                      Directory to configure department membership.
                    </p>
                  )}

                  {taskDepartment &&
                    assignableEmployees.length === 0 && (
                      <p style={mutedStyle}>
                        No employees belong to this department yet.
                      </p>
                    )}

                  <div>
                    <button
                      type="submit"
                      disabled={
                        busy ||
                        !form.title.trim() ||
                        !taskDepartment ||
                        !form.assigned_to
                      }
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
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
              }}>
                <select
                  aria-label="Task view"
                  value={view}
                  onChange={event => setView(event.target.value)}
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
                  onChange={event =>
                    setDepartmentFilter(event.target.value)
                  }
                  style={{ ...inputStyle, width: 'auto' }}
                >
                  <option value="all">All departments</option>
                  {allowedDepartments.map(department => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Task status filter"
                  value={filter}
                  onChange={event => setFilter(event.target.value)}
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

            <input
              aria-label="Search tasks"
              placeholder="Search tasks by title or description"
              value={search}
              onChange={event => setSearch(event.target.value)}
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            {visibleTasks.length === 0 ? (
              <p style={mutedStyle}>
                No tasks match the selected view.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {visibleTasks.map(task => {
                  const isOverdue =
                    task.due_date &&
                    formatDate(task.due_date) < today &&
                    !['completed', 'cancelled'].includes(task.status);

                  const canUpdate = canAccessTask(task);

                  return (
                    <article key={task.id} style={cardStyle}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
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
                          background: priorityColor(task.priority),
                          padding: '5px 10px',
                          borderRadius: 20,
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
                        marginTop: 10,
                        marginBottom: 14,
                        ...mutedStyle,
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
                        <span>
                          <strong>Due:</strong>{' '}
                          <span style={{
                            color: isOverdue ? '#b91c1c' : 'inherit',
                            fontWeight: isOverdue ? 700 : 400,
                          }}>
                            {formatDate(task.due_date)}
                            {isOverdue ? ' — Overdue' : ''}
                          </span>
                        </span>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}>
                        <strong style={{ fontSize: 13 }}>Status</strong>

                        <select
                          aria-label={`Status for ${task.title}`}
                          value={task.status || 'todo'}
                          disabled={busy || !canUpdate}
                          onChange={event =>
                            updateTaskStatus(task, event.target.value)
                          }
                          style={{ ...inputStyle, width: 'auto' }}
                        >
                          {statuses.map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>

                        {canUpdate ? (
                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() => openTask(task)}
                          >
                            Open task / Collaborate
                          </button>
                        ) : (
                          <span style={mutedStyle}>View only</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {selectedTask && canAccessTask(selectedTask) && (
            <section
              className="ent-panel"
              style={{ marginTop: 16 }}
              aria-label="Task details"
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <div>
                  <div className="ent-eyebrow">TASK DETAILS</div>
                  <h2>{selectedTask.title}</h2>
                </div>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => {
                    setSelectedTaskId('');
                    setComments([]);
                    setActivity([]);
                  }}
                >
                  Close details
                </button>
              </div>

              <div style={{
                ...cardStyle,
                display: 'grid',
                gap: 10,
                marginBottom: 16,
              }}>
                <p style={{ margin: 0 }}>
                  {selectedTask.description || 'No description provided.'}
                </p>
                <div><strong>Status:</strong> {statusLabel(selectedTask.status)}</div>
                <div><strong>Priority:</strong> {selectedTask.priority}</div>
                <div><strong>Department:</strong> {departmentName(selectedTask.department_id)}</div>
                <div><strong>Assigned to:</strong> {employeeName(selectedTask.assigned_to)}</div>
                <div><strong>Created by:</strong> {employeeName(selectedTask.created_by)}</div>
                <div><strong>Due:</strong> {formatDate(selectedTask.due_date)}</div>
              </div>

              {canReassignTask(selectedTask) && (
                <form
                  onSubmit={reassignTask}
                  style={{ ...cardStyle, marginBottom: 16 }}
                >
                  <h3 style={{ marginTop: 0 }}>Manage assignment</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    marginBottom: 12,
                  }}>
                    <label>
                      <strong>Department</strong>
                      <select
                        value={editDepartment}
                        onChange={event => {
                          setEditDepartment(event.target.value);
                          setEditAssignee('');
                        }}
                        style={inputStyle}
                      >
                        <option value="">Select department</option>
                        {allowedDepartments.map(department => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <strong>Assigned employee</strong>
                      <select
                        value={editAssignee}
                        onChange={event =>
                          setEditAssignee(event.target.value)
                        }
                        style={inputStyle}
                      >
                        <option value="">Select employee</option>
                        {editAssignableEmployees.map(employee => (
                          <option
                            key={employee.user_id}
                            value={employee.user_id}
                          >
                            {employeeName(employee.user_id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !editDepartment || !editAssignee}
                    style={buttonStyle}
                  >
                    {busy ? 'Saving…' : 'Save assignment'}
                  </button>
                </form>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}>
                <div style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Comments & updates</h3>

                  {detailLoading ? (
                    <p>Loading comments…</p>
                  ) : comments.length === 0 ? (
                    <p style={mutedStyle}>No comments yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {comments.map(comment => (
                        <div
                          key={comment.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            paddingBottom: 10,
                          }}
                        >
                          <strong>{employeeName(comment.author_id)}</strong>
                          <div style={mutedStyle}>
                            {formatTimestamp(comment.created_at)}
                          </div>
                          <p style={{ whiteSpace: 'pre-wrap' }}>
                            {comment.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={addComment} style={{ marginTop: 16 }}>
                    <label>
                      <strong>Add an update</strong>
                      <textarea
                        rows={4}
                        maxLength={5000}
                        value={commentText}
                        onChange={event =>
                          setCommentText(event.target.value)
                        }
                        placeholder="Share progress, questions or handover notes…"
                        style={inputStyle}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy || !commentText.trim()}
                      style={{ ...buttonStyle, marginTop: 10 }}
                    >
                      {busy ? 'Posting…' : 'Post comment'}
                    </button>
                  </form>
                </div>

                <div style={cardStyle}>
                  <h3 style={{ marginTop: 0 }}>Activity history</h3>

                  {detailLoading ? (
                    <p>Loading activity…</p>
                  ) : activity.length === 0 ? (
                    <p style={mutedStyle}>
                      No recorded activity yet. New changes will appear here.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {activity.map(item => (
                        <div
                          key={item.id}
                          style={{
                            borderLeft: '3px solid #b8ccde',
                            paddingLeft: 12,
                          }}
                        >
                          <strong>
                            {employeeName(item.actor_id)}
                          </strong>
                          <p style={{ margin: '4px 0' }}>
                            {activityDescription(item)}
                          </p>
                          <div style={mutedStyle}>
                            {formatTimestamp(item.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                style={{ ...secondaryButton, marginTop: 16 }}
                disabled={detailLoading || busy}
                onClick={async () => {
                  setDetailLoading(true);
                  try {
                    await refreshDetails();
                  } catch (err) {
                    setError(err.message || 'Unable to refresh details.');
                  } finally {
                    setDetailLoading(false);
                  }
                }}
              >
                Refresh comments & activity
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
