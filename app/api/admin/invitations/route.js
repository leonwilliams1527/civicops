
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import { civicopsEmail } from '../../../../lib/civicops-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Only non-administrative employee roles can be invited.
// Administrative access is managed separately.
const ALLOWED_ROLES = new Set([
  'viewer',
  'operator'
]);

function respondError(message, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store'
      }
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

  return {
    token,
    tokenHash
  };
}

async function getAuthenticatedAdmin(request) {
  const authorization =
    request.headers.get('authorization') || '';

  const accessToken =
    authorization.startsWith('Bearer ')
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

  return {
    user: data.user
  };
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

  return {
    authorized: true
  };
}

async function revokeInvitation(adminClient, invitationId) {
  const { error } = await adminClient
    .from('enterprise_invitations')
    .update({
      status: 'revoked'
    })
    .eq('id', invitationId)
    .eq('status', 'pending');

  if (error) {
    console.error(
      '[Enterprise Invitations] Failed to revoke invitation:',
      error.code
    );
  }

  return !error;
}

async function sendResendInvitation({
  email,
  displayName,
  actionUrl
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.CIVICOPS_EMAIL_FROM;

  if (!apiKey || !emailFrom) {
    throw new Error('Resend configuration missing.');
  }

  const subject = 'Your CivicOps Enterprise Invitation';

  const text = [
    `Hello ${displayName},`,
    '',
    'You have been invited to join CivicOps Enterprise.',
    '',
    'Use the secure link below to activate your account:',
    '',
    actionUrl,
    '',
    'Your company invitation expires in 7 days.',
    '',
    'If you were not expecting this invitation,',
    'you can safely ignore this email.',
    '',
    'CivicOps Enterprise'
  ].join('\n');

  const html = civicopsEmail({
    title: subject,
    body:
      `Hello ${displayName},\n\n` +
      'You have been invited to join CivicOps Enterprise. ' +
      'Activate your employee account using the secure ' +
      'button below.\n\n' +
      'Your company invitation expires in 7 days.',
    actionUrl,
    actionLabel: 'Activate My Account'
  });

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject,
        text,
        html
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    }
  );

  if (!response.ok) {
    console.error(
      '[Enterprise Invitations] Resend delivery rejected:',
      response.status
    );

    return {
      success: false
    };
  }

  const result = await response.json();

  if (!result?.id) {
    return {
      success: false
    };
  }

  return {
    success: true,
    messageId: result.id
  };
}

export async function POST(request) {
  let adminClient;
  let invitationId;
  let deliveryAccepted = false;

  try {
    // 1. Validate required configuration.
    if (
      !url ||
      !anonKey ||
      !serviceKey ||
      !appUrl ||
      !process.env.RESEND_API_KEY ||
      !process.env.CIVICOPS_EMAIL_FROM
    ) {
      return respondError(
        'Enterprise invitation service is not fully configured.',
        503
      );
    }

    adminClient = createSupabaseClient(serviceKey);

    // 2. Authenticate administrator.
    const auth = await getAuthenticatedAdmin(request);

    if (auth.error) {
      return respondError(auth.error, auth.status);
    }

    // 3. Parse request.
    let body;

    try {
      body = await request.json();
    } catch {
      return respondError(
        'Invalid request body.',
        400
      );
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

    // 4. Validate employee details.
    if (!UUID_PATTERN.test(organizationId)) {
      return respondError(
        'Valid company ID required.',
        400
      );
    }

    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254
    ) {
      return respondError(
        'Valid employee email required.',
        400
      );
    }

    if (
      displayName.length < 1 ||
      displayName.length > 150
    ) {
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

    // 5. Verify administrator belongs to company.
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

    // 6. Prevent duplicate pending invitations.
    const {
      data: existingInvitation,
      error: lookupError
    } = await adminClient
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
        'A pending invitation already exists for this employee. ' +
        'Revoke it before issuing another.',
        409
      );
    }

    // 7. Generate cryptographically secure invitation token.
    const { token, tokenHash } =
      generateInvitationToken();

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // 8. Validate Enterprise application URL.
    let origin;

    try {
      const parsed = new URL(appUrl);
      origin = parsed.origin;

      if (
        parsed.protocol !== 'https:' &&
        !(
          process.env.NODE_ENV !== 'production' &&
          parsed.hostname === 'localhost'
        )
      ) {
        throw new Error('HTTPS is required.');
      }
    } catch {
      return respondError(
        'NEXT_PUBLIC_APP_URL must be a valid HTTPS Enterprise URL.',
        503
      );
    }

    // 9. Store invitation without granting company access.
    const {
      data: invitation,
      error: insertError
    } = await adminClient
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

    if (insertError || !invitation?.id) {
      console.error(
        '[Enterprise Invitations] Insert failed:',
        insertError?.code
      );

      return respondError(
        'Unable to create employee invitation.',
        500
      );
    }

    invitationId = invitation.id;

    // 10. Create the Enterprise activation redirect.
    const redirectUrl = new URL(
      '/auth/activate',
      origin
    );

    redirectUrl.searchParams.set(
      'flow',
      'invite'
    );

    redirectUrl.searchParams.set(
      'invitation_token',
      token
    );

    // 11. Generate a Supabase one-time authentication link.
    // This generates the link without sending Supabase email.
    const {
      data: authLink,
      error: linkError
    } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: redirectUrl.toString(),
        data: {
          display_name: displayName
        }
      }
    });

    if (
      linkError ||
      !authLink?.properties?.action_link
    ) {
      console.error(
        '[Enterprise Invitations] Authentication link error:',
        linkError?.message
      );

      await revokeInvitation(
        adminClient,
        invitationId
      );

      return respondError(
        'Unable to generate secure activation link.',
        502
      );
    }

    // 12. Deliver branded invitation through Resend.
    let delivery;

    try {
      delivery = await sendResendInvitation({
        email,
        displayName,
        actionUrl: authLink.properties.action_link
      });
    } catch (error) {
      console.error(
        '[Enterprise Invitations] Resend request failed:',
        error?.message
      );

      delivery = {
        success: false
      };
    }

    if (!delivery.success) {
      await revokeInvitation(
        adminClient,
        invitationId
      );

      return respondError(
        'Invitation email could not be sent through Resend.',
        502
      );
    }

    deliveryAccepted = true;

    // 13. Return success without exposing secrets.
    return NextResponse.json(
      {
        success: true,
        invitation_id: invitationId,
        status: 'pending',
        expires_at: expiresAt,
        message:
          'Employee invitation accepted by the email provider.'
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );

  } catch (error) {
    console.error(
      '[Enterprise Invitations] Unexpected error:',
      error?.message
    );

    // Revoke any invitation that failed before delivery
    // was accepted by the email provider.
    if (
      adminClient &&
      invitationId &&
      !deliveryAccepted
    ) {
      await revokeInvitation(
        adminClient,
        invitationId
      );
    }

    return respondError(
      'Unable to process the employee invitation.',
      500
    );
  }
}
