
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../enterprise.css';

/*
 * CIVICOPS ENTERPRISE
 * Phase 35.2 — Employee Workspace
 *
 * Features:
 * - Organization selection
 * - Task creation
 * - Department-based employee assignments
 * - Employee profile names
 * - My assigned tasks
 * - Created-by-me and organization task views
 * - Status filtering
 * - Task status updates
 * - Workspace KPI cards
 */

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
    const path = encodeURIComponent(parsed.pathname);
    const query = parsed.search
      ? '&' + parsed.search.substring(1)
      : '';

    return fetch(
      '/api/supabase-proxy?path=' + path + query,
      init
    );
  }

  return fetch(input, init);
}

const db =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        global: {
          fetch: proxyFetch,
        },
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
  return (
    statuses.find(([id]) => id === value)?.[1] ||
    value ||
    'Unknown'
  );
}

function priorityColor(value) {
  switch (value) {
    case 'critical':
      return '#fee2e2';
    case 'high':
      return '#ffedd5';
    case 'medium':
      return '#fef3c7';
    default:
      return '#e2e8f0';
  }
}

function formatDate(value) {
  if (!value) return 'Not set';
  return String(value).substring(0, 10);
}

export default function EnterpriseWorkspace() {
  const [userId, setUserId] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');

  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentMembers, setDepartmentMembers] =
    useState([]);
  const [profiles, setProfiles] = useState([]);

  const [taskDepartment, setTaskDepartment] = useState('');
  const [form, setForm] = useState(initialForm);

  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState('mine');
  const [filter, setFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  /*
   * INITIALIZE AUTHENTICATION AND ORGANIZATIONS
   */
  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!db) {
          throw new Error(
            'Supabase environment variables are missing.'
          );
        }

        const authResult = await db.auth.getUser();

        if (authResult.error) {
          throw authResult.error;
        }

        const user = authResult.data?.user;

        if (!user) {
          throw new Error(
            'Please sign in to access your workspace.'
          );
        }

        const memberResult = await db
          .from('enterprise_members')
          .select('organization_id')
          .eq('user_id', user.id);

        if (memberResult.error) {
          throw memberResult.error;
        }

        const ids = [
          ...new Set(
            (memberResult.data || []).map(
              member => member.organization_id
            )
          ),
        ];

        let availableOrganizations = [];

        if (ids.length > 0) {
          const orgResult = await db
            .from('enterprise_organizations')
            .select('id,name')
            .in('id', ids)
            .order('name');

          if (orgResult.error) {
            throw orgResult.error;
          }

          availableOrganizations = orgResult.data || [];
        }

        if (!active) return;

        setUserId(user.id);
        setOrganizations(availableOrganizations);
        setOrganizationId(
          availableOrganizations[0]?.id || ''
        );
      } catch (err) {
        if (active) {
          setError(
            err.message || 'Unable to initialize workspace.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);

  /*
   * LOAD TASKS, EMPLOYEES, DEPARTMENTS AND PROFILES
   */
  async function loadWorkspace(orgId) {
    if (!orgId) {
      setTasks([]);
      setMembers([]);
      setDepartments([]);
      setDepartmentMembers([]);
      setProfiles([]);
      return;
    }

    const [
      taskResult,
      memberResult,
      departmentResult,
      assignmentResult,
    ] = await Promise.all([
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

    for (const result of [
      taskResult,
      memberResult,
      departmentResult,
      assignmentResult,
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    const loadedMembers = memberResult.data || [];

    const employeeIds = [
      ...new Set(
        loadedMembers.map(member => member.user_id)
      ),
    ];

    let loadedProfiles = [];

    if (employeeIds.length > 0) {
      const profileResult = await db
        .from('enterprise_employee_profiles')
        .select('user_id,display_name,job_title')
        .in('user_id', employeeIds);

      if (profileResult.error) {
        throw profileResult.error;
      }

      loadedProfiles = profileResult.data || [];
    }

    setTasks(taskResult.data || []);
    setMembers(loadedMembers);
    setDepartments(departmentResult.data || []);
    setDepartmentMembers(assignmentResult.data || []);
    setProfiles(loadedProfiles);
  }

  /*
   * REFRESH WORKSPACE WHEN ORGANIZATION CHANGES
   */
  useEffect(() => {
    if (!organizationId || !userId) return;

    let active = true;

    setLoading(true);
    setError('');

    async function load() {
      try {
        await loadWorkspace(organizationId);
      } catch (err) {
        if (active) {
          setError(
            err.message || 'Unable to load workspace.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [organizationId, userId]);

  /*
   * USER PERMISSIONS
   */
  const myRole = members.find(
    member => member.user_id === userId
  )?.role;

  const isManager = ['owner', 'admin', 'manager'].includes(
    myRole
  );

  /*
   * DEPARTMENTS AVAILABLE TO CURRENT USER
   */
  const allowedDepartments = useMemo(() => {
    return departments.filter(department => {
      if (isManager) return true;

      return departmentMembers.some(
        member =>
          member.department_id === department.id &&
          member.user_id === userId
      );
    });
  }, [
    departments,
    departmentMembers,
    isManager,
    userId,
  ]);

  /*
   * EMPLOYEES IN SELECTED DEPARTMENT
   */
  const assignableEmployees = useMemo(() => {
    if (!taskDepartment) return [];

    return members.filter(member =>
      departmentMembers.some(
        assignment =>
          assignment.department_id === taskDepartment &&
          assignment.user_id === member.user_id
      )
    );
  }, [
    members,
    departmentMembers,
    taskDepartment,
  ]);

  /*
   * EMPLOYEE DISPLAY NAME
   */
  function employeeName(id) {
    if (!id) return 'Unassigned';

    const profile = profiles.find(
      person => person.user_id === id
    );

    if (profile?.display_name) {
      return id === userId
        ? `${profile.display_name} (You)`
        : profile.display_name;
    }

    if (id === userId) return 'You';

    return `Employee ${String(id).slice(0, 8)}`;
  }

  function departmentName(id) {
    if (!id) return 'Not assigned';

    return (
      departments.find(
        department => department.id === id
      )?.name || 'Not assigned'
    );
  }

  /*
   * TASK METRICS
   */
  const today = new Date().toLocaleDateString('en-CA');

  const myTasks = useMemo(
    () =>
      tasks.filter(
        task => task.assigned_to === userId
      ),
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

  /*
   * TASK BOARD FILTERS
   */
  const visibleTasks = useMemo(() => {
    let result = tasks;

    if (view === 'mine') {
      result = result.filter(
        task => task.assigned_to === userId
      );
    } else if (view === 'created') {
      result = result.filter(
        task => task.created_by === userId
      );
    } else if (!isManager) {
      result = result.filter(
        task =>
          task.assigned_to === userId ||
          task.created_by === userId
      );
    }

    if (filter !== 'all') {
      result = result.filter(
        task => task.status === filter
      );
    }

    return result;
  }, [
    tasks,
    view,
    filter,
    userId,
    isManager,
  ]);

  /*
   * CREATE TASK
   */
  async function createTask(event) {
    event.preventDefault();

    if (busy) return;

    if (
      !organizationId ||
      !form.title.trim() ||
      !taskDepartment ||
      !form.assigned_to
    ) {
      setError(
        'Enter a task title, select a department, and select an assignee.'
      );
      return;
    }

    const departmentAllowed = allowedDepartments.some(
      department => department.id === taskDepartment
    );

    const employeeAllowed = assignableEmployees.some(
      employee => employee.user_id === form.assigned_to
    );

    if (!departmentAllowed || !employeeAllowed) {
      setError(
        'The selected department or assignee is not valid.'
      );
      return;
    }

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
          department_id: taskDepartment,
          assigned_to: form.assigned_to,
          created_by: userId,
          priority: form.priority,
          due_date: form.due_date || null,
          status: 'todo',
        });

      if (result.error) {
        throw result.error;
      }

      await loadWorkspace(organizationId);

      setForm({ ...initialForm });
      setTaskDepartment('');
      setShowForm(false);
      setMessage('Task created successfully.');
    } catch (err) {
      setError(
        err.message || 'Unable to create task.'
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * UPDATE TASK STATUS
   */
  async function updateTaskStatus(task, nextStatus) {
    if (busy || task.status === nextStatus) return;

    const canUpdate =
      isManager ||
      task.created_by === userId ||
      task.assigned_to === userId;

    if (!canUpdate) {
      setError(
        'You do not have permission to update this task.'
      );
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await db
        .from('enterprise_tasks')
        .update({
          status: nextStatus,
        })
        .eq('id', task.id)
        .eq('organization_id', organizationId);

      if (result.error) {
        throw result.error;
      }

      await loadWorkspace(organizationId);
      setMessage('Task status updated successfully.');
    } catch (err) {
      setError(
        err.message || 'Unable to update task.'
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * PAGE RENDER
   */
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

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/collaboration/enterprise/employees">
            Employee Directory →
          </Link>

          <Link href="/collaboration/enterprise/dashboard">
            Executive Dashboard →
          </Link>
        </div>
      </header>

      {error && (
        <div
          className="ent-error"
          role="alert"
          style={{ marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {message && (
        <p
          role="status"
          style={{
            color: '#176346',
            marginBottom: 16,
          }}
        >
          {message}
        </p>
      )}

      <section
        className="ent-panel"
        style={{ marginBottom: 16 }}
      >
        <label>
          <strong>Organization</strong>

          <select
            value={organizationId}
            disabled={loading || organizations.length === 0}
            onChange={event => {
              setOrganizationId(event.target.value);
              setShowForm(false);
              setTaskDepartment('');
              setForm({ ...initialForm });
              setMessage('');
              setView('mine');
              setFilter('all');
            }}
            style={{
              ...inputStyle,
              marginTop: 8,
            }}
          >
            {organizations.length === 0 && (
              <option value="">
                No organization available
              </option>
            )}

            {organizations.map(organization => (
              <option
                key={organization.id}
                value={organization.id}
              >
                {organization.name}
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
          {/* WORKSPACE METRICS */}
          <div
            className="ent-kpis"
            style={{ marginBottom: 20 }}
          >
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

          {/* TASK MANAGEMENT */}
          <section
            className="ent-panel"
            style={{ marginBottom: 16 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ marginTop: 0 }}>
                  Task management
                </h2>

                <p>
                  Create assignments and track work across
                  your organization.
                </p>
              </div>

              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  setShowForm(previous => !previous);
                  setError('');
                  setMessage('');
                }}
              >
                {showForm ? 'Cancel' : '+ Create task'}
              </button>
            </div>

            {/* CREATE TASK FORM */}
            {showForm && (
              <form
                onSubmit={createTask}
                style={{
                  ...cardStyle,
                  marginTop: 16,
                }}
              >
                <h3>Create a task</h3>

                <div
                  style={{
                    display: 'grid',
                    gap: 14,
                  }}
                >
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

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(190px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {/* DEPARTMENT SELECTION */}
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
                        <option value="">
                          Select department
                        </option>

                        {allowedDepartments.map(department => (
                          <option
                            key={department.id}
                            value={department.id}
                          >
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* ASSIGNEE SELECTION */}
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
                        <option value="">
                          Select assignee
                        </option>

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

                    {/* PRIORITY */}
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
                          <option
                            key={priority}
                            value={priority}
                          >
                            {priority.charAt(0).toUpperCase() +
                              priority.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* DUE DATE */}
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
                      No departments are available for your
                      account. Ask an administrator to create
                      a department and assign you to it.
                    </p>
                  )}

                  {taskDepartment &&
                    assignableEmployees.length === 0 && (
                      <p style={mutedStyle}>
                        This department has no assigned
                        employees. Add employees through the
                        Employee Directory first.
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
                      style={{
                        ...buttonStyle,
                        opacity:
                          busy ||
                          !form.title.trim() ||
                          !taskDepartment ||
                          !form.assigned_to
                            ? 0.55
                            : 1,
                      }}
                    >
                      {busy ? 'Saving…' : 'Create task'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          {/* TASK BOARD */}
          <section className="ent-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0 }}>
                Task board
              </h2>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {/* TASK VIEW */}
                <select
                  aria-label="Task view"
                  value={view}
                  onChange={event =>
                    setView(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: 'auto',
                  }}
                >
                  <option value="mine">
                    Assigned to me
                  </option>

                  <option value="created">
                    Created by me
                  </option>

                  <option value="all">
                    {isManager
                      ? 'All organization tasks'
                      : 'My related tasks'}
                  </option>
                </select>

                {/* STATUS FILTER */}
                <select
                  aria-label="Task status filter"
                  value={filter}
                  onChange={event =>
                    setFilter(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    width: 'auto',
                  }}
                >
                  <option value="all">
                    All statuses
                  </option>

                  {statuses.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {visibleTasks.length === 0 ? (
              <p style={mutedStyle}>
                No tasks match the selected view.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                }}
              >
                {visibleTasks.map(task => {
                  const isOverdue =
                    task.due_date &&
                    formatDate(task.due_date) < today &&
                    !['completed', 'cancelled'].includes(
                      task.status
                    );

                  const canUpdate =
                    isManager ||
                    task.created_by === userId ||
                    task.assigned_to === userId;

                  return (
                    <article
                      key={task.id}
                      style={cardStyle}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h3
                            style={{
                              margin: '0 0 8px',
                            }}
                          >
                            {task.title}
                          </h3>

                          {task.description && (
                            <p>{task.description}</p>
                          )}
                        </div>

                        <span
                          style={{
                            background: priorityColor(
                              task.priority
                            ),
                            padding: '5px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {task.priority || 'medium'}
                        </span>
                      </div>

                      {/* TASK DETAILS */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 16,
                          marginTop: 10,
                          marginBottom: 14,
                          ...mutedStyle,
                        }}
                      >
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
                          <span
                            style={{
                              color: isOverdue
                                ? '#b91c1c'
                                : 'inherit',
                              fontWeight: isOverdue
                                ? 700
                                : 400,
                            }}
                          >
                            {formatDate(task.due_date)}
                            {isOverdue ? ' — Overdue' : ''}
                          </span>
                        </span>
                      </div>

                      {/* STATUS CONTROL */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 13,
                          }}
                        >
                          Status
                        </strong>

                        <select
                          aria-label={`Status for ${task.title}`}
                          value={task.status || 'todo'}
                          disabled={busy || !canUpdate}
                          onChange={event =>
                            updateTaskStatus(
                              task,
                              event.target.value
                            )
                          }
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

                        {!canUpdate && (
                          <span style={mutedStyle}>
                            View only
                          </span>
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
    </main>
  );
}
