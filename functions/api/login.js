// 登录 API
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.wh_orders;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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

  if (request.method !== 'POST') {
    return new Response('Not Found', { headers: corsHeaders, status: 404 });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '请输入用户名和密码' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 读取用户数据
    let users = {};
    try {
      const raw = await kv.get('users');
      if (raw) users = JSON.parse(raw);
    } catch(e) {}

    // 如果 KV 中没有用户数据，初始化默认用户
    if (Object.keys(users).length === 0) {
      users = {
        'wenxin': { password: '19990714', role: 'admin' },
        'houlan': { password: '112800', role: 'user' }
      };
      await kv.put('users', JSON.stringify(users));
    }

    // 验证
    const user = users[username];
    if (!user || user.password !== password) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // 生成 token: base64(username:role:timestamp) — UTF-8 安全
    const token = btoa(unescape(encodeURIComponent(username + ':' + user.role + ':' + Date.now())));

    return new Response(JSON.stringify({
      token: token,
      username: username,
      role: user.role
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: '请求格式错误' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
}
