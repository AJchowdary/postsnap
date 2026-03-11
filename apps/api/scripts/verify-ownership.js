/**
 * Dev-only: verify User B cannot access User A's post. Exit 0 on PASS, 1 on FAIL.
 * Reads SUPABASE_URL, SUPABASE_ANON_KEY, USER_A_EMAIL, USER_A_PASSWORD, USER_B_EMAIL, USER_B_PASSWORD, API_BASE_URL.
 */
const base = process.env.API_BASE_URL || 'http://localhost:4000';
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

function getToken(email, password) {
  return fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());
}

(async () => {
  if (!url || !anon || !process.env.USER_A_EMAIL || !process.env.USER_A_PASSWORD || !process.env.USER_B_EMAIL || !process.env.USER_B_PASSWORD) {
    console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, USER_A_EMAIL, USER_A_PASSWORD, USER_B_EMAIL, USER_B_PASSWORD');
    process.exit(1);
  }
  const dataA = await getToken(process.env.USER_A_EMAIL, process.env.USER_A_PASSWORD);
  const dataB = await getToken(process.env.USER_B_EMAIL, process.env.USER_B_PASSWORD);
  const tokenA = dataA.access_token;
  const tokenB = dataB.access_token;
  if (!tokenA || !tokenB) {
    console.error('Missing token. A:', dataA.error_description || 'ok', 'B:', dataB.error_description || 'ok');
    process.exit(1);
  }
  await fetch(base + '/api/v1/account/bootstrap', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA, 'Content-Type': 'application/json' },
  });
  const createBody = { template_id: 'auto', context_text: 'User A private post' };
  const createRes = await fetch(base + '/api/v1/posts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokenA, 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody),
  });
  const createData = await createRes.json();
  const postId = createData.post?.id ?? createData.id;
  if (!postId) {
    console.error('Create post failed');
    console.error('Request body sent:', JSON.stringify(createBody, null, 2));
    console.error('Response status:', createRes.status);
    console.error('Response JSON:', JSON.stringify(createData, null, 2));
    process.exit(1);
  }
  const getRes = await fetch(base + '/api/v1/posts/' + postId, {
    headers: { Authorization: 'Bearer ' + tokenB },
  });
  const status = getRes.status;
  if (status === 403 || status === 404) {
    console.log('PASS: B blocked (403/404)');
    process.exit(0);
  }
  console.log('FAIL: B accessed A\'s post (status ' + status + ')');
  process.exit(1);
})();
