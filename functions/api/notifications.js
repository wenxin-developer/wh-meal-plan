// 消息中心 API — Cloudflare KV (per-user read status)
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

  const username = getUsername(request);
  if (!username) {
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

  // GET — 获取通知列表 (filtered for current user)
  if (request.method === 'GET') {
    try {
      const list = JSON.parse(await kv.get('notifications') || '[]');

      // 清理超过 7 天的
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const cleaned = list.filter(n => Date.now() - n.createdAt < sevenDays);
      if (cleaned.length !== list.length) {
        await kv.put('notifications', JSON.stringify(cleaned));
      }

      // 过滤掉当前用户已删除的通知
      const visible = cleaned.filter(n => !(n.dismissedBy || []).includes(username));

      return new Response(JSON.stringify(visible), {
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
        readBy: [],
        dismissedBy: [],
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

  // PUT — 标记已读/删除 (per-user)
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const list = JSON.parse(await kv.get('notifications') || '[]');

      if (body.readAll) {
        // 全部已读 — 只标记当前用户
        list.forEach(n => {
          if (!n.readBy) n.readBy = [];
          if (!n.readBy.includes(username)) n.readBy.push(username);
        });
      } else if (body.id) {
        // 单条已读
        const item = list.find(n => n.id === body.id);
        if (item) {
          if (!item.readBy) item.readBy = [];
          if (!item.readBy.includes(username)) item.readBy.push(username);
        }
      } else if (body.dismissId) {
        // 单条删除 — 只标记当前用户已删除
        const item = list.find(n => n.id === body.dismissId);
        if (item) {
          if (!item.dismissedBy) item.dismissedBy = [];
          if (!item.dismissedBy.includes(username)) item.dismissedBy.push(username);
        }
      }

      await kv.put('notifications', JSON.stringify(list));

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

function getUsername(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(token)));
    const parts = decoded.split(':');
    return parts.length >= 3 && parts[0] ? parts[0] : null;
  } catch(e) {
    return null;
  }
}
