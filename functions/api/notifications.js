// 消息中心 API — Cloudflare KV
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.wh_orders;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401
    });
  }

  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // GET — 获取通知列表
  if (request.method === 'GET') {
    try {
      const data = await kv.get('notifications') || '[]';
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

  // POST — 新增一条通知
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const list = JSON.parse(await kv.get('notifications') || '[]');

      const notification = {
        id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: body.type || 'general',
        icon: body.icon || '📌',
        title: body.title || '',
        body: body.body || '',
        link: body.link || '',
        read: false,
        createdAt: Date.now()
      };

      list.unshift(notification);

      // 只保留最近 50 条
      const trimmed = list.slice(0, 50);
      await kv.put('notifications', JSON.stringify(trimmed));

      return new Response(JSON.stringify({ success: true, id: notification.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  }

  // PUT — 标记已读（单条或全部）
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const list = JSON.parse(await kv.get('notifications') || '[]');

      if (body.readAll) {
        // 全部已读
        list.forEach(n => n.read = true);
      } else if (body.id) {
        // 单条已读
        const item = list.find(n => n.id === body.id);
        if (item) item.read = true;
      } else if (body.dismissId) {
        // 单条删除
        const idx = list.findIndex(n => n.id === body.dismissId);
        if (idx !== -1) list.splice(idx, 1);
      }

      // 清理超过 7 天的
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const cleaned = list.filter(n => Date.now() - n.createdAt < sevenDays);

      await kv.put('notifications', JSON.stringify(cleaned));

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

  return new Response('Not Found', { headers: corsHeaders, status: 404 });
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
