// 菜品管理 API — 读写 Cloudflare KV
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.wh_orders;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (!kv) {
    return new Response(JSON.stringify({
      error: 'KV not bound',
      env_keys: Object.keys(env).join(',')
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // GET — 获取所有菜品
  if (request.method === 'GET') {
    try {
      const data = await kv.get('menu') || 'null';
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

  // POST — 保存完整菜单（整体覆盖）
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      await kv.put('menu', JSON.stringify(body));
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
