/**
 * Dev-only: print Supabase access_token for a user. Usage: node scripts/get-token.js A|B
 * Reads USER_A_EMAIL/USER_A_PASSWORD or USER_B_EMAIL/USER_B_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY.
 * No secrets committed; use env vars only.
 */
const which = process.argv[2] === 'B' ? 'B' : 'A';
const email = which === 'B' ? process.env.USER_B_EMAIL : process.env.USER_A_EMAIL;
const password = which === 'B' ? process.env.USER_B_PASSWORD : process.env.USER_A_PASSWORD;
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon || !email || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, USER_' + which + '_EMAIL, USER_' + which + '_PASSWORD');
  process.exit(1);
}
fetch(url + '/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
  .then((r) => r.json())
  .then((d) => {
    if (d.access_token) console.log(d.access_token);
    else {
      console.error(d.error_description || JSON.stringify(d));
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
