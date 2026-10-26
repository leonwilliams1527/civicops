
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Initial employee roles only.
// Administrative roles must be granted separately
// through authorized access management.
const ALLOWED_ROLES = new Set([
  'viewer',
  'operator'
]);

function respondError(message, status = 400) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}

function createSupabaseClient(key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

function generateInvitationToken() {
  const token = randomBytes(32).toString('hex');

  const tokenHash = createHash('sha256')
    .update(token)
    .digest('hex');

  return { token, tokenHash };
}

async function getAuthenticatedAdmin(request, adminClient) {
  const authorization =
    request.headers.get('authorization') || '';

  const accessToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (!accessToken) {
    return {
      error: 'Authentication required.',
      status: 401
    };
  }

  const authClient = createSupabaseClient(anonKey);

  const { data, error } =
    await authClient.auth.getUser(accessToken);

  if (error || !data.user?.id) {
    return {
      error: 'Invalid or expired session.',
      status: 401
    };
  }

  return { user: data.user };
}

async function verifyCompanyAdmin(
  adminClient,
  organizationId,
  userId
) {
  const { data, error } = await adminClient
    .from('enterprise_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return {
      error: 'Unable to verify administrator access.',
      status: 500
    };
  }

  if (!['owner', 'admin'].includes(data?.role)) {
    return {
      error: 'Company administrator permission required.',
      status: 403
    };
  }

  return { authorized: true };
}

export async function POST(request) {
  try {
    if (!url || !anonKey || !serviceKey || !appUrl) {
      return respondError(
        'Invitation service is not fully configured.',
        503
      );
    }

    const adminClient = createSupabaseClient(serviceKey);

    // 1. Authenticate the requesting administrator.
    const auth = await getAuthenticatedAdmin(
      request,
      adminClient
    );

    if (auth.error) {
      return respondError(auth.error, auth.status);
    }

    // 2. Read invitation details.
    let body;

    try {
      body = await request.json();
    } catch {
      return respondError('Invalid request body.', 400);
    }

    const organizationId =
      String(body.organization_id || '').trim();

    const email =
      String(body.email || '').trim().toLowerCase();

    const displayName =
      String(body.display_name || '').trim();

    const jobTitle =
      String(body.job_title || '').trim();

    const proposedRole =
      String(body.role || 'viewer').trim();

    if (!UUID_PATTERN.test(organizationId)) {
      return respondError('Valid company ID required.', 400);
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return respondError('Valid employee email required.', 400);
    }

    if (!displayName || displayName.length > 150) {
      return respondError(
        'Employee name is required (maximum 150 characters).',
        400
      );
    }

    if (jobTitle.length > 150) {
      return respondError(
        'Job title must be 150 characters or fewer.',
        400
      );
    }

    if (!ALLOWED_ROLES.has(proposedRole)) {
      return respondError(
        'The selected employee role is not available for invitation.',
        400
      );
    }

    // 3. Confirm the inviter administers this company.
    const permission = await verifyCompanyAdmin(
      adminClient,
      organizationId,
      auth.user.id
    );

    if (permission.error) {
      return respondError(
        permission.error,
        permission.status
      );
    }

    // 4. Prevent duplicate pending invitations.
    const { data: existingInvitation, error: lookupError } =
      await adminClient
        .from('enterprise_invitations')
        .select('id, status, expires_at')
        .eq('organization_id', organizationId)
        .ilike('email', email)
        .eq('status', 'pending')
        .maybeSingle();

    if (lookupError) {
      return respondError(
        'Unable to check existing invitations.',
        500
      );
    }

    if (existingInvitation) {
      return respondError(
        'A pending invitation already exists for this employee. Revoke it before issuing another.',
        409
      );
    }

    // 5. Generate a cryptographically random secret.
    const { token, tokenHash } =
      generateInvitationToken();

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // 6. Save invitation before sending email.
    const { data: invitation, error: insertError } =
      await adminClient
        .from('enterprise_invitations')
        .insert({
          organization_id: organizationId,
          email,
          display_name: displayName,
          job_title: jobTitle || null,
          proposed_role: proposedRole,
          invited_by: auth.user.id,
          status: 'pending',
          expires_at: expiresAt,
          token_hash: tokenHash
        })
        .select('id')
        .single();

    if (insertError) {
      console.error(
        '[Enterprise Invitations] Insert error:',
        insertError.code
      );

      return respondError(
        'Unable to create the employee invitation.',
        500
      );
    }

    // 7. Construct the verified application redirect.
    let origin;

    try {
      origin = new URL(appUrl).origin;

      if (
        process.env.NODE_ENV === 'production' &&
        !origin.startsWith('https://')
      ) {
        throw new Error('HTTPS is required.');
      }
    } catch {
      await adminClient
        .from('enterprise_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitation.id);

      return respondError(
        'The application URL is not configured correctly.',
        503
      );
    }

    const redirectUrl = new URL(
      '/auth/activate',
      origin
    );

    redirectUrl.searchParams.set('flow', 'invite');
    redirectUrl.searchParams.set(
      'invitation_token',
      token
    );

    // 8. Send the Supabase invitation email.
    //
    // Important: inviteUserByEmail supports new Auth users.
    // Existing Auth users need a separate verified
    // invitation-delivery flow.
    const { error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectUrl.toString(),
          data: {
            display_name: displayName
          }
        }
      );

    if (inviteError) {
      console.error(
        '[Enterprise Invitations] Email error:',
        inviteError.message
      );

      // Do not leave a usable invitation after failed delivery.
      await adminClient
        .from('enterprise_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitation.id);

      return respondError(
        'Invitation delivery failed. The employee may already have an account, or the email service may be unavailable.',
        400
      );
    }

    // 9. Return success without exposing the secret.
    return NextResponse.json(
      {
        success: true,
        invitation_id: invitation.id,
        status: 'pending',
        expires_at: expiresAt,
        message: 'Employee invitation sent successfully.'
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' }
      }
    );

  } catch (error) {
    console.error(
      '[Enterprise Invitations] Unexpected error:',
      error
    );

    return respondError(
      'Unable to process the employee invitation.',
      500
    );
  }
}
