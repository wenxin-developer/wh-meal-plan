// 验证 token 对应的用户是否仍然存在
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.wh_orders;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== 'GET') {
    return new Response('Not Found', { headers: corsHeaders, status: 404 });
  }

  if (!kv) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // 解析 token
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let username = '';
  try {
    const decoded = decodeURIComponent(escape(atob(token)));
    const parts = decoded.split(':');
    if (parts.length >= 3 && parts[0]) {
      username = parts[0];
    }
  } catch(e) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!username) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 检查用户是否存在
  let users = {};
  try {
    const raw = await kv.get('users');
    if (raw) users = JSON.parse(raw);
  } catch(e) {}

  const exists = !!users[username];

  return new Response(JSON.stringify({ valid: exists }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
