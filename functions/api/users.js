// 用户管理 API — 仅管理员可操作
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.wh_orders;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (!kv) {
    return new Response(JSON.stringify({ error: '服务未就绪' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // 验证管理员身份
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  let currentUser = null;

  if (token) {
    try {
      const parts = atob(token).split(':');
      if (parts.length >= 3 && parts[1] === 'admin') {
        currentUser = parts[0];
      }
    } catch(e) {}
  }

  if (!currentUser) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403
    });
  }

  // 读取用户数据
  let users = {};
  try {
    const raw = await kv.get('users');
    if (raw) users = JSON.parse(raw);
  } catch(e) {}

  // GET — 获取用户列表（不返回密码）
  if (request.method === 'GET') {
    const list = Object.keys(users).map(name => ({
      username: name,
      role: users[name].role
    }));
    return new Response(JSON.stringify(list), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // POST — 添加用户
  if (request.method === 'POST') {
    try {
      const { username, password, role } = await request.json();

      if (!username || !password) {
        return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      if (username.length < 2 || username.length > 20) {
        return new Response(JSON.stringify({ error: '用户名长度2-20个字符' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      if (password.length < 4) {
        return new Response(JSON.stringify({ error: '密码至少4个字符' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      if (users[username]) {
        return new Response(JSON.stringify({ error: '用户名已存在' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      users[username] = { password: password, role: role || 'user' };
      await kv.put('users', JSON.stringify(users));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch(e) {
      return new Response(JSON.stringify({ error: '请求格式错误' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
  }

  // DELETE — 删除用户
  if (request.method === 'DELETE') {
    try {
      const { username } = await request.json();

      if (!username) {
        return new Response(JSON.stringify({ error: '请指定用户名' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      if (username === currentUser) {
        return new Response(JSON.stringify({ error: '不能删除自己' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }

      if (!users[username]) {
        return new Response(JSON.stringify({ error: '用户不存在' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }

      delete users[username];
      await kv.put('users', JSON.stringify(users));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch(e) {
      return new Response(JSON.stringify({ error: '请求格式错误' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
  }

  return new Response('Not Found', { headers: corsHeaders, status: 404 });
}
