import {civicopsEmail} from '../../../../lib/civicops-email';
import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const departments=['Water Quality','GIS','Permitting','Engineering','Project Management','Finance'];
const getClients=()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!secret)throw Error('Missing server-only Supabase configuration');
 return {auth:createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),
 admin:createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})};
};
async function context(request){
 const {auth,admin}=getClients();
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return {error:'Authentication required',status:401};
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user)return {error:'Invalid session',status:401};
 const {data:membership,error:memberError}=await admin.from('memberships').select('department,role').eq('user_id',user.id).maybeSingle();
 if(memberError){
  console.error('CivicOps invitations membership query failed',{code:memberError.code,message:memberError.message});
  return {error:'Membership lookup failed. Check the server Supabase service-role key and project URL.',code:memberError.code||'membership_query_error',status:503};
 }
 if(!membership){
  console.error('CivicOps invitations: no membership for authenticated user',{userId:user.id});
  return {error:'No membership found for this signed-in account. Verify you are using the owner account.',code:'membership_missing',status:403};
 }
 if(membership.role!=='admin')return {error:'Administrator access required',code:'not_admin',status:403};
 const {data:superRow,error:superError}=await admin.from('civicops_super_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(superError){
  console.error('CivicOps invitations super-admin lookup failed',{code:superError.code,message:superError.message});
  return {error:'Super Admin lookup failed. Verify the Phase 22.1 migration and server credentials.',code:superError.code||'super_admin_query_error',status:503};
 }
 return {admin,user,membership,isSuper:!!superRow};
}
export async function GET(request){
 try{
  const c=await context(request);if(c.error)return respond({error:c.error,code:c.code||'access_error'},c.status);
  let query=c.admin.from('civicops_employee_invitations').select('id,email,full_name,department,role,status,created_at,accepted_at').order('created_at',{ascending:false}).limit(150);
  if(!c.isSuper)query=query.eq('department',c.membership.department);
  const {data,error}=await query;
  if(error)throw error;
  return respond({invitations:(data||[]).filter(inv=>inv.status==='pending'),isSuper:c.isSuper,departments:c.isSuper?departments:[c.membership.department]});
 }catch(e){return respond({error:String(e.message||e)},500);}
}
export async function POST(request){
 try{
  const c=await context(request);if(c.error)return respond({error:c.error,code:c.code||'access_error'},c.status);
  const body=await request.json();
  const email=String(body.email||'').trim().toLowerCase();
  const fullName=String(body.full_name||'').trim();
  const department=String(body.department||'');
  const role=String(body.role||'member');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return respond({error:'Enter a valid email'},400);
  if(fullName.length<2||fullName.length>120)return respond({error:'Enter a full name (2–120 characters)'},400);
  if(!departments.includes(department)||!['member','admin'].includes(role))return respond({error:'Invalid department or role'},400);
  if(!c.isSuper&&(department!==c.membership.department||role!=='member'))
   return respond({error:'Department admins can invite employees in their own department; only Super Admin can grant admin roles'},403);
  const {data:pending,error:pendingError}=await c.admin.from('civicops_employee_invitations').select('id').eq('email',email).eq('status','pending').maybeSingle();
  if(pendingError)throw pendingError;
  if(pending)return respond({error:'An invitation is already pending for this email'},409);
  // Search all pages to avoid missing an existing identity in a large organization.
  let page=1,found=false;
  while(page<=100){
   const {data:existing,error:listError}=await c.admin.auth.admin.listUsers({page,perPage:1000});
   if(listError)throw listError;
   if((existing?.users||[]).some(u=>u.email?.toLowerCase()===email)){found=true;break;}
   if((existing?.users||[]).length<1000)break;
   page++;
  }
  if(found)return respond({error:'This email already has an account. Manage its existing membership instead.'},409);
  const site=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;
  if(!site.startsWith('https://')&&!site.startsWith('http://localhost:'))return respond({error:'Configure NEXT_PUBLIC_SITE_URL to the public HTTPS CivicOps URL'},503);
  const redirectTo=new URL('/auth/activate?flow=invite',site).toString();
  const {data:invited,error:inviteError}=await c.admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{full_name:fullName}});
  if(inviteError||!invited?.user) return respond({error:inviteError?.message||'Invite failed'},400);
  const uid=invited.user.id;
  const {error:membershipError}=await c.admin.from('memberships').insert({user_id:uid,department,role});
  const {error:profileError}=await c.admin.from('user_profiles').upsert({user_id:uid,full_name:fullName},{onConflict:'user_id'});
  const {error:recordError}=await c.admin.from('civicops_employee_invitations').insert({email,full_name:fullName,department,role,invited_user_id:uid,invited_by:c.user.id});
  if(membershipError||profileError||recordError){
   // Fail closed: remove the newly invited identity if provisioning was incomplete.
   await c.admin.auth.admin.deleteUser(uid);
   return respond({error:'Invitation could not be provisioned; no access granted. '+(membershipError||profileError||recordError).message},500);
  }
  await c.admin.from('civicops_audit_events').insert({event_type:'membership.invited',entity_type:'membership',entity_id:uid,actor_id:c.user.id,department,details:{email,role}});
  return respond({ok:true,message:'Invitation sent via Supabase Auth'},201);
 }catch(e){return respond({error:String(e.message||e)},500);}
}
export async function PATCH(request){
 try{
  const c=await context(request);if(c.error)return respond({error:c.error,code:c.code||'access_error'},c.status);
  const {id,action}=await request.json();
  if(!['revoke','resend'].includes(action)||!id)return respond({error:'Invalid action'},400);
  const {data:inv,error}=await c.admin.from('civicops_employee_invitations').select('*').eq('id',id).maybeSingle();
  if(error||!inv||inv.status!=='pending')return respond({error:'Pending invitation not found'},404);
  if(!c.isSuper&&inv.department!==c.membership.department)return respond({error:'Not authorized'},403);
  const {data:userResult,error:userError}=await c.admin.auth.admin.getUserById(inv.invited_user_id);
  if(userError||!userResult?.user)return respond({error:'Invited user not found'},404);
  if(userResult.user.email_confirmed_at){
   await c.admin.from('civicops_employee_invitations').update({status:'accepted',accepted_at:new Date().toISOString()}).eq('id',id);
   return respond({error:'Invitation has already been accepted; manage this employee instead'},409);
  }
  if(action==='resend'){
   // Supabase's inviteUserByEmail cannot reliably re-invite an existing identity.
   // Generate a fresh one-time invite link and send through configured Resend.
   if(!process.env.RESEND_API_KEY||!process.env.CIVICOPS_EMAIL_FROM)
    return respond({error:'Resend requires RESEND_API_KEY and CIVICOPS_EMAIL_FROM on the server'},503);
   const redirectTo=new URL('/auth/activate?flow=invite',process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin).toString();
   const {data:link,error:linkError}=await c.admin.auth.admin.generateLink({type:'invite',email:inv.email,options:{redirectTo}});
   if(linkError||!link?.properties?.action_link)return respond({error:linkError?.message||'Could not create invite link'},500);
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.CIVICOPS_EMAIL_FROM,to:[inv.email],subject:'Your CivicOps invitation',text:`You have been invited to CivicOps. Accept your invitation here:\n\n${link.properties.action_link}\n\nIf you did not expect this invitation, ignore this email.`,html:civicopsEmail({title:'Your CivicOps invitation',body:'You have been invited to CivicOps. Activate your employee account using the secure link below.',actionUrl:link.properties.action_link,actionLabel:'Activate my account'})})});
   if(!response.ok)return respond({error:'Email provider could not send invitation'},502);
   return respond({ok:true,message:'Invitation resent'});
  }
  const {error:deleteError}=await c.admin.auth.admin.deleteUser(inv.invited_user_id);
  if(deleteError)return respond({error:deleteError.message},500);
  await c.admin.from('civicops_employee_invitations').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('id',id);
  await c.admin.from('civicops_audit_events').insert({event_type:'membership.invitation_revoked',entity_type:'membership',entity_id:inv.invited_user_id,actor_id:c.user.id,department:inv.department,details:{email:inv.email}});
  return respond({ok:true,message:'Invitation revoked'});
 }catch(e){return respond({error:String(e.message||e)},500);}
}
