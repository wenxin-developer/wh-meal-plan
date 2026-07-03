// 点菜数据 API — 读写 Cloudflare KV（需登录）
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.wh_orders;

  // 允许跨域
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // 验证登录
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401
    });
  }

  // 调试：检查 KV 是否可用
  if (!kv) {
    return new Response(JSON.stringify({
      error: 'KV not bound',
      env_keys: Object.keys(env).join(',')
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  if (request.method === 'GET') {
    try {
      const data = await kv.get('orders') || '{}';
      return new Response(data, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      await kv.put('orders', JSON.stringify(body));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  return new Response('Not Found', {
    headers: corsHeaders,
    status: 404
  });
}

function checkAuth(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return false;
  try {
    const decoded = decodeURIComponent(escape(atob(token)));
    const parts = decoded.split(':');
    return parts.length >= 3 && parts[0] && parts[1];
  } catch(e) {
    return false;
  }
}
