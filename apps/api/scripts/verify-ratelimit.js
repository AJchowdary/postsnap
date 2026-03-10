/**
 * Dev-only: call /api/v1/auth/me 6 times; PASS if 429 appears. Exit 0 on PASS, 1 on FAIL.
 * Reads SUPABASE_URL, SUPABASE_ANON_KEY, USER_A_EMAIL, USER_A_PASSWORD, API_BASE_URL.
 */
const base = process.env.API_BASE_URL || 'http://localhost:4000';
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

(async () => {
  if (!url || !anon || !process.env.USER_A_EMAIL || !process.env.USER_A_PASSWORD) {
    console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, USER_A_EMAIL, USER_A_PASSWORD');
    process.exit(1);
  }
  const r = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.USER_A_EMAIL,
      password: process.env.USER_A_PASSWORD,
    }),
  });
  const d = await r.json();
  const token = d.access_token;
  if (!token) {
    console.error('No token:', d.error_description || d);
    process.exit(1);
  }
  let got429 = false;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(base + '/api/v1/auth/me', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (res.status === 429) {
      got429 = true;
      break;
    }
  }
  if (got429) {
    console.log('PASS: 429 received');
    process.exit(0);
  }
  console.log('FAIL: no 429 after 6 requests');
  process.exit(1);
})();
