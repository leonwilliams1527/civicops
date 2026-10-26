
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
  // Enterprise invitations for existing users authenticate with a
  // Supabase magiclink, but still require the Enterprise invite flow.
  // The explicit flow parameter must not be overridden by OTP type.
  const explicitFlow = params.get('flow');
  if (explicitFlow === 'invite' || explicitFlow === 'recovery') {
    return explicitFlow;
  }
  const authType = hash.get('type') || params.get('type');
  return authType === 'invite' ? 'invite' : 'recovery';
}

export default function Activate() {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [flow, setFlow] = useState('recovery');

  const [invitationToken, setInvitationToken] =
    useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [destination, setDestination] =
    useState('/login');

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (!db) {
        setError(
          'Supabase authentication is not configured.'
        );
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

        const suppliedToken =
          params.get('invitation_token') || '';

        if (mounted && suppliedToken) {
          setInvitationToken(suppliedToken);
        }

        const linkError =
          params.get('error_description') ||
          hash.get('error_description');

        // An invite link may be consumed while the browser has already
        // established a valid session. Prefer the verified session when
        // resuming a pending invitation; never bypass token validation.
        const incomingCredential = Boolean(hash.get('access_token') || params.get('token_hash') || params.get('code'));
        const existing = incomingCredential ? null : await db.auth.getSession();
        let sessionEstablished = Boolean(existing?.data?.session);

        if (linkError && !sessionEstablished) {
          throw new Error(linkError.replace(/\+/g, ' '));
        }

        // -----------------------------------------
        // 1. Handle implicit Supabase auth links
        // -----------------------------------------

        if (
          !sessionEstablished &&
          hash.get('access_token') &&
          hash.get('refresh_token')
        ) {
          const { error: tokenError } =
            await db.auth.setSession({
              access_token: hash.get('access_token'),
              refresh_token: hash.get('refresh_token')
            });

          if (tokenError) {
            throw tokenError;
          }

          sessionEstablished = true;
        }

        // -----------------------------------------
        // 2. Handle token-hash links
        // -----------------------------------------

        if (
          !sessionEstablished &&
          params.get('token_hash')
        ) {
          const type =
            params.get('type') ||
            (currentFlow === 'invite'
              ? 'invite'
              : 'recovery');

          if (
            !['invite', 'recovery', 'magiclink', 'email', 'signup'].includes(type)
          ) {
            throw new Error(
              'Unsupported activation link type: ' + String(type).slice(0, 32)
            );
          }

          const { error: verifyError } =
            await db.auth.verifyOtp({
              token_hash: params.get('token_hash'),
              type: type === 'magiclink' ? 'email' : type
            });

          if (verifyError) {
            throw verifyError;
          }

          sessionEstablished = true;
        }

        // -----------------------------------------
        // 3. Handle Supabase PKCE links
        // -----------------------------------------

        if (
          !sessionEstablished &&
          params.get('code')
        ) {
          const { error: codeError } =
            await db.auth.exchangeCodeForSession(
              params.get('code')
            );

          if (codeError) {
            throw codeError;
          }

          sessionEstablished = true;
        }

        if (!sessionEstablished) {
          throw new Error(
            'Open the secure invitation or ' +
            'password-recovery link sent to ' +
            'your email address.'
          );
        }

        // -----------------------------------------
        // 4. Verify authenticated user
        // -----------------------------------------

        const {
          data: userData,
          error: userError
        } = await db.auth.getUser();

        if (
          userError ||
          !userData?.user
        ) {
          throw new Error(
            'This activation link is invalid ' +
            'or has expired.'
          );
        }

        // -----------------------------------------
        // 5. Validate invitation token format
        // -----------------------------------------

        if (currentFlow === 'invite') {
          if (
            !/^[a-f0-9]{64}$/i.test(suppliedToken)
          ) {
            throw new Error(
              'This invitation is missing its ' +
              'secure activation token. ' +
              'Contact your administrator ' +
              'for a new invitation.'
            );
          }
        }

        // -----------------------------------------
        // 6. Remove one-time auth credentials
        // while preserving invitation secret
        // -----------------------------------------

        const safeParams =
          new URLSearchParams({
            flow: currentFlow
          });

        if (
          currentFlow === 'invite' &&
          suppliedToken
        ) {
          safeParams.set(
            'invitation_token',
            suppliedToken
          );
        }

        window.history.replaceState(
          null,
          '',
          '/auth/activate?' +
            safeParams.toString()
        );

        if (mounted) {
          setAuthorized(true);
        }

      } catch (err) {
        if (mounted) {
          setError(
            err.message ||
            'Unable to verify activation link.'
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

    // -------------------------------------------
    // 1. Validate password
    // -------------------------------------------

    if (password.length < 12) {
      setError(
        'Your password must contain ' +
        'at least 12 characters.'
      );
      return;
    }

    if (password !== confirm) {
      setError(
        'The passwords do not match.'
      );
      return;
    }

    setBusy(true);

    try {
      if (!db) {
        throw new Error(
          'Authentication is unavailable.'
        );
      }

      // -----------------------------------------
      // 2. Verify current session
      // -----------------------------------------

      const {
        data: sessionData,
        error: sessionError
      } = await db.auth.getSession();

      if (
        sessionError ||
        !sessionData?.session
      ) {
        throw new Error(
          'Your session has expired. ' +
          'Request a new secure link.'
        );
      }

      // -----------------------------------------
      // 3. Update password
      // -----------------------------------------

      const {
        error: passwordError
      } = await db.auth.updateUser({
        password
      });

      if (passwordError) {
        throw passwordError;
      }

      // -----------------------------------------
      // 4. Get updated access token
      // -----------------------------------------

      const {
        data: updatedSession,
        error: updatedSessionError
      } = await db.auth.getSession();

      if (updatedSessionError) {
        throw updatedSessionError;
      }

      const accessToken =
        updatedSession?.session?.access_token;

      if (!accessToken) {
        throw new Error(
          'Unable to verify your updated session.'
        );
      }

      // -----------------------------------------
      // 5. Enterprise invitation activation
      // -----------------------------------------

      if (flow === 'invite') {
        if (
          !/^[a-f0-9]{64}$/i.test(invitationToken)
        ) {
          throw new Error(
            'A valid invitation token is required.'
          );
        }

        const response = await fetch(
          '/api/enterprise/invitations/accept',
          {
            method: 'POST',
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              invitation_token:
                invitationToken
            })
          }
        );

        const result =
          await response.json().catch(
            () => ({})
          );

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Your password was saved, but ' +
            'company access could not be ' +
            'activated. Contact your administrator.'
          );
        }

        if (!result.success) {
          throw new Error(
            'Company activation could not ' +
            'be confirmed.'
          );
        }

        setDestination(
          '/collaboration/enterprise'
        );

        // Clear invitation secret from URL
        window.history.replaceState(
          null,
          '',
          '/auth/activate?flow=invite'
        );

        setInvitationToken('');

      } else {
        // ---------------------------------------
        // 6. Password recovery
        // ---------------------------------------
        // Recovery never creates membership.
        // ---------------------------------------

        await fetch(
          '/api/auth/activation-complete',
          {
            method: 'POST',
            headers: {
              Authorization:
                `Bearer ${accessToken}`
            }
          }
        ).catch(() => {});

        setDestination('/login');
      }

      // -----------------------------------------
      // 7. Complete activation
      // -----------------------------------------

      setPassword('');
      setConfirm('');
      setSuccess(true);

    } catch (err) {
      setError(
        err.message ||
        'Unable to complete account activation.'
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
          <p>
            Verifying your secure link…
          </p>

        ) : success ? (
          <>
            <p>
              {flow === 'invite'
                ? 'Your Enterprise account has ' +
                  'been activated successfully. ' +
                  'Your company access and role ' +
                  'are managed by your administrator.'
                : 'Your password has been ' +
                  'updated successfully.'}
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
                ? 'Create a secure password to ' +
                  'finish activating your invited ' +
                  'employee account.'
                : 'Create a new password to ' +
                  'recover access to your account.'}
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
                    setPassword(
                      event.target.value
                    )
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
                    setConfirm(
                      event.target.value
                    )
                  }
                />
              </label>

              <button
                type="submit"
                disabled={busy}
              >
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
          <p
            className="activate-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <Link
          className="activate-back"
          href="/login"
        >
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
