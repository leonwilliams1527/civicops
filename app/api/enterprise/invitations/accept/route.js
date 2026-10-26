
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function failure(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    if (!url || !anonKey || !serviceKey) {
      return failure('Invitation service unavailable.', 503);
    }

    const header = request.headers.get('authorization') || '';
    const jwt = header.startsWith('Bearer ')
      ? header.slice(7)
      : '';

    if (!jwt) {
      return failure('Authentication required.', 401);
    }

    const { invitation_token: invitationToken } =
      await request.json();

    if (
      typeof invitationToken !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(invitationToken)
    ) {
      return failure('Valid invitation token required.', 400);
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false }
    });

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false }
    });

    const { data, error } =
      await authClient.auth.getUser(jwt);

    if (error || !data.user?.id || !data.user?.email) {
      return failure('Invalid authenticated session.', 401);
    }

    const hash = createHash('sha256')
      .update(invitationToken)
      .digest('hex');

    const result = await adminClient.rpc(
      'enterprise_accept_invitation',
      {
        p_token_hash: hash,
        p_user_id: data.user.id,
        p_email: data.user.email
      }
    );

    if (result.error) {
      return failure(
        'Invitation cannot be accepted. It may be expired, revoked, already used, or associated with another email.',
        403
      );
    }

    return NextResponse.json({
      success: true,
      organization_id: result.data,
      redirect_to: '/collaboration/enterprise'
    });
  } catch {
    return failure('Unable to complete activation.', 500);
  }
}
