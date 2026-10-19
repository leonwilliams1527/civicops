import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export async function POST(request){
 try{
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return NextResponse.json({error:'Sign-in required'},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return NextResponse.json({error:'Server configuration missing'},{status:503});
  const publicClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await publicClient.auth.getUser(token);
  if(error||!user)return NextResponse.json({error:'Invalid session'},{status:401});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:membership,error:membershipError}=await admin.from('memberships').select('department,role').eq('user_id',user.id).maybeSingle();
  if(membershipError||!membership)return NextResponse.json({error:'Account has no authorized department membership'},{status:403});
  const {error:updateError}=await admin.from('civicops_employee_invitations')
   .update({status:'accepted',accepted_at:new Date().toISOString()})
   .eq('invited_user_id',user.id).eq('status','pending');
  if(updateError)throw updateError;
  return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:'Activation could not be recorded'},{status:500});}
}
