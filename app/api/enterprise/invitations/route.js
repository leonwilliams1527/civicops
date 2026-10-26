
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function respond(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    if (!url || !anonKey || !serviceKey) {
      return respond('Invitation service is not configured.', 503);
    }

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';

    if (!token) return respond('Authentication required.', 401);

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false }
    });

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false }
    });

    const { data: identity, error: identityError } =
      await authClient.auth.getUser(token);

    if (identityError || !identity.user) {
      return respond('Invalid or expired session.', 401);
    }

    const body = await request.json();
    const organizationId = body.organization_id;
    const email = String(body.email || '').trim().toLowerCase();

    if (
      typeof organizationId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(organizationId)
    ) {
      return respond('Valid company ID required.', 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond('Valid employee email required.', 400);
    }

    // Check authorization against the selected company.
    const { data: membership, error: membershipError } =
      await adminClient
        .from('enterprise_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', identity.user.id)
        .maybeSingle();

    if (membershipError) {
      return respond('Unable to verify administrator access.', 500);
    }

    // Only company owners and administrators can invite.
    // Other delegated invitation roles can be added after
    // their database permissions are verified.
    if (!['owner', 'admin'].includes(membership?.role)) {
      return respond('Administrator permission required.', 403);
    }

    const { data: existingMember, error: existingError } =
      await adminClient
        .from('enterprise_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', identity.user.id)
        .maybeSingle();

    if (existingError) {
      return respond('Unable to validate membership.', 500);
    }

    // Never allow the browser to choose an administrative
    // role or create company membership directly.
    // This endpoint only issues the Auth invitation.
    // Company membership is provisioned separately after
    // verified invitation acceptance.

    const origin = new URL(request.url).origin;

    const { error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/activate?flow=invite`
      });

    if (inviteError) {
      return respond(
        'Unable to issue invitation. The address may already have an account, or email delivery may be unavailable.',
        400
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation email requested.'
    });
  } catch {
    return respond('Unable to process invitation.', 500);
  }
}
