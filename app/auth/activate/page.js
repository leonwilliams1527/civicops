
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import './activate.css';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const proxiedFetch = async (input, init) => {
  const original =
    typeof input === 'string' ? input : input.url;

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
        global: { fetch: proxiedFetch },
        auth: {
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true
        }
      })
    : null;

function getFlow(params, hash) {
  const type =
    hash.get('type') ||
    params.get('type') ||
    params.get('flow');

  return type === 'invite' ? 'invite' : 'recovery';
}

export default function Activate() {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [flow, setFlow] = useState('recovery');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [destination, setDestination] = useState('/login');

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (!db) {
        setError('Supabase authentication is not configured.');
        setReady(true);
        return;
      }

      try {
        const params = new URLSearchParams(
          window.location.search
        );

        const hash = new URLSearchParams(
          window.location.hash.replace(/^#/, '')
        );

        const currentFlow = getFlow(params, hash);

        if (mounted) {
          setFlow(currentFlow);
        }

        const linkError =
          params.get('error_description') ||
          hash.get('error_description');

        if (linkError) {
          throw new Error(
            linkError.replace(/\+/g, ' ')
          );
        }

        let sessionEstablished = false;

        // Supabase implicit invitation/recovery links.
        if (
          hash.get('access_token') &&
          hash.get('refresh_token')
        ) {
          const { error: tokenError } =
            await db.auth.setSession({
              access_token: hash.get('access_token'),
              refresh_token: hash.get('refresh_token')
            });

          if (tokenError) throw tokenError;

          sessionEstablished = true;
        }

        // Token-hash invitation/recovery links.
        if (!sessionEstablished && params.get('token_hash')) {
          const type =
            params.get('type') ||
            (currentFlow === 'invite'
              ? 'invite'
              : 'recovery');

          if (!['invite', 'recovery'].includes(type)) {
            throw new Error('Unsupported activation link.');
          }

          const { error: verifyError } =
            await db.auth.verifyOtp({
              token_hash: params.get('token_hash'),
              type
            });

          if (verifyError) throw verifyError;

          sessionEstablished = true;
        }

        // Supabase PKCE links.
        if (!sessionEstablished && params.get('code')) {
          const { error: codeError } =
            await db.auth.exchangeCodeForSession(
              params.get('code')
            );

          if (codeError) throw codeError;

          sessionEstablished = true;
        }

        if (!sessionEstablished) {
          throw new Error(
            'Open the secure invitation or password-recovery ' +
            'link sent to your email address.'
          );
        }

        const { data, error: sessionError } =
          await db.auth.getUser();

        if (sessionError || !data.user) {
          throw new Error(
            'This activation link is invalid or expired.'
          );
        }

        // Remove one-time credentials from the address bar.
        window.history.replaceState(
          null,
          '',
          '/auth/activate?flow=' +
            encodeURIComponent(currentFlow)
        );

        if (mounted) {
          setAuthorized(true);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err.message || 'Unable to verify activation link.'
          );
        }
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  async function savePassword(event) {
    event.preventDefault();
    setError('');

    if (password.length < 12) {
      setError(
        'Your password must contain at least 12 characters.'
      );
      return;
    }

    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      if (!db) {
        throw new Error('Authentication is unavailable.');
      }

      const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error(
          'Your session has expired. Request a new secure link.'
        );
      }

      const { error: passwordError } =
        await db.auth.updateUser({ password });

      if (passwordError) throw passwordError;

      const { data: updatedSession } =
        await db.auth.getSession();

      const token = updatedSession.session?.access_token;

      if (!token) {
        throw new Error(
          'Unable to verify your updated session.'
        );
      }

      if (flow === 'invite') {
        /*
         * The server must:
         * 1. Authenticate this bearer token.
         * 2. Verify an outstanding invitation for this user.
         * 3. Confirm the invitation's company and expiry.
         * 4. Reject revoked or already-consumed invitations.
         * 5. Create membership and employee profile atomically.
         * 6. Mark the invitation accepted.
         *
         * Never trust a company ID supplied by the browser.
         */
        const response = await fetch(
          '/api/enterprise/invitations/accept',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const result = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.error ||
              'Your password was saved, but company access ' +
              'could not be activated. Contact your administrator.'
          );
        }

        setDestination('/collaboration/enterprise');
      } else {
        /*
         * Recovery must not create a new membership.
         * The existing audit endpoint is best-effort only.
         */
        await fetch('/api/auth/activation-complete', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).catch(() => {});

        setDestination('/login');
      }

      setPassword('');
      setConfirm('');
      setSuccess(true);
    } catch (err) {
      setError(
        err.message || 'Unable to complete account activation.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="activate-page">
      <section className="activate-card">
        <div className="activate-brand">
          CIVICOPS
        </div>

        <h1>
          {success
            ? flow === 'invite'
              ? 'Account activated'
              : 'Password updated'
            : flow === 'invite'
              ? 'Activate your CivicOps account'
              : 'Set your account password'}
        </h1>

        {!ready ? (
          <p>Verifying your secure link…</p>
        ) : success ? (
          <>
            <p>
              {flow === 'invite'
                ? 'Your account has been activated. ' +
                  'Your company access is managed by your administrator.'
                : 'Your password has been updated successfully.'}
            </p>

            <Link
              className="activate-button"
              href={destination}
            >
              {flow === 'invite'
                ? 'Continue to Enterprise →'
                : 'Return to sign in →'}
            </Link>
          </>
        ) : authorized ? (
          <>
            <p>
              {flow === 'invite'
                ? 'Create a secure password to finish ' +
                  'setting up your invited employee account.'
                : 'Create a new password to recover access.'}
            </p>

            <form onSubmit={savePassword}>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                />
              </label>

              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={confirm}
                  onChange={(event) =>
                    setConfirm(event.target.value)
                  }
                />
              </label>

              <button type="submit" disabled={busy}>
                {busy
                  ? 'Saving…'
                  : flow === 'invite'
                    ? 'Activate account'
                    : 'Save password'}
              </button>
            </form>
          </>
        ) : null}

        {error && (
          <p className="activate-error" role="alert">
            {error}
          </p>
        )}

        <Link className="activate-back" href="/login">
          ← Back to sign in
        </Link>

        <p>
          <Link href="/forgot-password">
            Request a new password link
          </Link>
        </p>
      </section>
    </main>
  );
}
