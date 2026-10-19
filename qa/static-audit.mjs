import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[
 ['Public login route',()=>read('app/login/page.js').includes('Forgot password?')],
 ['Public password recovery',()=>read('app/forgot-password/page.js').includes('resetPasswordForEmail')],
 ['Activation uses authenticated password update',()=>read('app/auth/activate/page.js').includes('auth.updateUser({password})')],
 ['No client-side service-role secret in auth pages',()=>!['app/login/page.js','app/forgot-password/page.js','app/auth/activate/page.js'].some(p=>read(p).includes('SUPABASE_SERVICE_ROLE_KEY'))],
 ['Admin invitations authenticate bearer token',()=>read('app/api/admin/invitations/route.js').includes('auth.auth.getUser(token)')],
 ['Admin invitation authorization',()=>read('app/api/admin/invitations/route.js').includes("membership.role!=='admin'")],
 ['Admin invitation department boundary',()=>read('app/api/admin/invitations/route.js').includes('department!==c.membership.department')],
 ['Pending invitation filtering',()=>read('app/api/admin/invitations/route.js').includes("inv.status==='pending'")],
 ['Cron requires secret',()=>read('app/api/cron/civicops-notifications/route.js').includes('process.env.CRON_SECRET')],
 ['Email delivery opt-in',()=>read('app/api/cron/civicops-notifications/route.js').includes("CIVICOPS_EMAIL_ENABLED!=='true'")],
 ['No open public registration on login',()=>!read('app/login/page.js').includes('signUp(')],
 ['Project includes SQL migrations',()=>fs.readdirSync(path.join(root,'supabase')).some(f=>f.endsWith('.sql'))],
];
let failed=0;
for(const [label,test] of checks){let ok=false;try{ok=Boolean(test())}catch{};console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++}
console.log(`\n${checks.length-failed}/${checks.length} static checks passed.`);
if(failed)process.exitCode=1;
