// Shared LokToken purchase endpoint. The database decides the price, rank,
// stock, and ownership; callers can only name a catalog SKU.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ ok: false, error: 'missing_auth' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ ok: false, error: 'server_config' }, 500);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const appKey = typeof body.appKey === 'string' ? body.appKey : '';
  const sku = typeof body.sku === 'string' ? body.sku : '';
  const idemKey = typeof body.idemKey === 'string' ? body.idemKey : '';
  if (!appKey || !sku || !idemKey || appKey.length > 80 || sku.length > 200 || idemKey.length > 200) {
    return json({ ok: false, error: 'missing_fields' }, 400);
  }

  const { error: bootstrapError } = await admin.rpc('lok_bootstrap_account', {
    p_account: userData.user.id,
    p_handle: null,
  });
  if (bootstrapError) return json({ ok: false, error: 'account_unavailable' }, 500);

  const { data, error } = await admin.rpc('lok_spend', {
    p_account: userData.user.id,
    p_app_key: appKey,
    p_sku: sku,
    p_idem: idemKey,
  });
  if (error) return json({ ok: false, error: 'purchase_unavailable' }, 500);
  return json(data);
});
