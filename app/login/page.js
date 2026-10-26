
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import '../auth/activate/activate.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const proxiedFetch = async (input, init) => {
  const original = typeof input === 'string' ? input : input.url;
  const parsed = new URL(original);

  if (
    url &&
    parsed.hostname === new URL(url).hostname &&
    /^\/(auth|rest|storage)\/v1\//.test(parsed.pathname)
  ) {
    const endpoint =
      '/api/supabase-proxy?path=' +
      encodeURIComponent(parsed.pathname) +
      (parsed.search ? '&' + parsed.search.slice(1) : '');

    return fetch(endpoint, init);
  }

  return fetch(input, init);
};

const db =
  url && key
    ? createClient(url, key, {
        global: { fetch: proxiedFetch }
      })
    : null;

function isMissingTable(error) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /could not find the table/i.test(error?.message || '')
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const hash = new URLSearchParams(
      window.location.hash.slice(1)
    );

    const query = new URLSearchParams(
      window.location.search
    );

const flow =
  hash.get('type') ||
  query.get('type') ||
  query.get('flow') ||
  '';

    const isActivation =
      ['recovery', 'invite'].includes(flow) ||
      Boolean(
        hash.get('access_token') ||
        hash.get('error') ||
        query.get('token_hash') ||
        query.get('code')
      );

    if (isActivation) {
      const params = new URLSearchParams(query);
      params.set('flow', flow);

      window.location.replace(
        '/auth/activate?' +
          params.toString() +
          window.location.hash
      );

      return;
    }

    setChecking(false);
  }, []);

  async function submit(event) {
    event.preventDefault();

    setError('');
    setBusy(true);

    try {
      if (!db) {
        throw new Error(
          'CivicOps authentication is not configured.'
        );
      }

      const { error: loginError } =
        await db.auth.signInWithPassword({
          email: email.trim(),
          password
        });

      if (loginError) throw loginError;

      const enterprise = await db
        .from('enterprise_members')
        .select('organization_id')
        .limit(1);

      if (enterprise.error && !isMissingTable(enterprise.error)) {
        throw new Error(
          'Unable to verify your Enterprise access.'
        );
      }

      if (enterprise.data?.length) {
        window.location.assign(
          '/collaboration/enterprise'
        );
        return;
      }

      /*
       * Municipal membership verification:
       *
       * The municipal membership table and its
       * access policies must be confirmed before
       * enabling municipal redirects here.
       *
       * Never assume that absence of Enterprise
       * membership means Municipal access.
       */

      await db.auth.signOut();

      throw new Error(
        'Your account does not have an active Enterprise ' +
        'workspace membership. If you belong to Municipal ' +
        'CivicOps, contact your administrator while ' +
        'municipal membership verification is being configured.'
      );
    } catch (err) {
      setError(
        err.message || 'Unable to sign in.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="activate-page">
        <section className="activate-card">
          <h1>Checking sign-in link…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="activate-page">
      <section className="activate-card">
        <div className="activate-brand">
          CIVICOPS
        </div>

        <h1>Sign in to CivicOps</h1>

        <p>
          Secure access for authorized employees.
          Accounts are created by invitation only.
        </p>

        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
            />
          </label>

          <button
            disabled={busy}
            type="submit"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && (
          <p
            className="activate-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 18
          }}
        >
          <Link href="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <p
          style={{
            fontSize: 13,
            marginTop: 24,
            textAlign: 'center'
          }}
        >
          Need access? Contact your
          organization administrator
          to request an invitation.
        </p>
      </section>
    </main>
  );
}
