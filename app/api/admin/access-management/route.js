import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!secret)return reply({error:'Server authentication configuration is incomplete'},503);
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return reply({error:'Sign in required'},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user)return reply({error:'Session expired or invalid'},401);
  const [{data:membership,error:memberError},{data:superRow,error:superError},{data:ownerRow,error:ownerError}]=await Promise.all([
   admin.from('memberships').select('department,role').eq('user_id',user.id).maybeSingle(),
   admin.from('civicops_super_admins').select('user_id').eq('user_id',user.id).maybeSingle(),
   admin.from('civicops_platform_owner').select('user_id').eq('user_id',user.id).maybeSingle()
  ]);
  if(memberError||superError||ownerError)return reply({error:'Unable to verify access safely'},503);
  const isOwner=!!ownerRow,isSuper=!!superRow;
  if(!isOwner&&!isSuper&&membership?.role!=='admin')return reply({error:'Administrator access required'},403);
  let membersQuery=admin.from('memberships').select('user_id,department,role').order('department');
  if(!isOwner&&!isSuper)membersQuery=membersQuery.eq('department',membership.department);
  const {data:members,error:membersError}=await membersQuery;
  if(membersError)return reply({error:'Unable to load members'},503);
  const ids=(members||[]).map(m=>m.user_id);
  let profiles=[],superIds=[],ownerIds=[];
  if(ids.length){
   const [p,s,o]=await Promise.all([
    admin.from('user_profiles').select('user_id,full_name,designation').in('user_id',ids),
    admin.from('civicops_super_admins').select('user_id').in('user_id',ids),
    admin.from('civicops_platform_owner').select('user_id').in('user_id',ids)
   ]);
   if(p.error||s.error||o.error)return reply({error:'Unable to load account roles'},503);
   profiles=p.data||[];superIds=(s.data||[]).map(x=>x.user_id);ownerIds=(o.data||[]).map(x=>x.user_id);
  }
  const profileMap=new Map(profiles.map(p=>[p.user_id,p]));
  const users=(members||[]).map(m=>({user_id:m.user_id,department:m.department,role:m.role,full_name:profileMap.get(m.user_id)?.full_name||'',designation:profileMap.get(m.user_id)?.designation||'',access_level:ownerIds.includes(m.user_id)?'Platform Owner':superIds.includes(m.user_id)?'Super Admin':m.role==='admin'?'Department Admin':'Member'}));
  const {data:invites,error:inviteError}=await (isOwner||isSuper?admin.from('civicops_employee_invitations').select('id,email,full_name,department,role,status,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(200):admin.from('civicops_employee_invitations').select('id,email,full_name,department,role,status,created_at').eq('status','pending').eq('department',membership.department).order('created_at',{ascending:false}).limit(200));
  if(inviteError)return reply({error:'Unable to load pending invitations'},503);
  return reply({users,pending_invitations:invites||[],is_owner:isOwner,is_super:isSuper,department:membership?.department||null});
 }catch(e){console.error('Access management failed',e);return reply({error:'Could not load access management'},500);}
}
