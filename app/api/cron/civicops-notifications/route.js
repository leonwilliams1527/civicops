import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(obj,status=200)=>NextResponse.json(obj,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return json({error:'Unauthorized'},401);
 if(process.env.CIVICOPS_AUTOMATION_ENABLED!=='true')return json({ok:true,disabled:true});
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return json({error:'Missing server-only Supabase configuration'},503);
 const headers={'apikey':key,'authorization':`Bearer ${key}`,'content-type':'application/json'};
 const rpc=async(name,args)=>{const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),cache:'no-store'});if(!response.ok)throw Error(`${name} returned ${response.status}: ${(await response.text()).slice(0,200)}`);return response.json();};
 try{
  // This endpoint can run once daily from Vercel Cron; email delivery is a separate opt-in.
  const deadlines=await rpc('civicops_process_deadlines',{});
  const milestones=await rpc('civicops_process_milestone_deadlines',{});
  if(process.env.CIVICOPS_EMAIL_ENABLED!=='true')return json({ok:true,deadlines,milestones,email:'disabled'});
  const resend=process.env.RESEND_API_KEY,from=process.env.CIVICOPS_EMAIL_FROM;
  if(!resend||!from)return json({error:'Email enabled without RESEND_API_KEY and CIVICOPS_EMAIL_FROM'},503);
  const batch=await rpc('civicops_claim_email_batch',{p_limit:10});
  let sent=0,failed=0;
  for(const item of batch){
   try{
    const [notificationResponse,userResponse]=await Promise.all([
     fetch(`${base}/rest/v1/notifications?id=eq.${item.notification_id}&select=title,body,recipient_id`,{headers,cache:'no-store'}),
     fetch(`${base}/auth/v1/admin/users/${item.recipient_id}`,{headers,cache:'no-store'})
    ]);
    if(!notificationResponse.ok||!userResponse.ok)throw Error('Unable to load recipient or notification');
    const notification=(await notificationResponse.json())[0];
    const user=(await userResponse.json());
    if(!notification||notification.recipient_id!==item.recipient_id||!user.email)throw Error('Recipient or notification not found');
    // Re-check opt-out at delivery time, even for previously queued notifications.
    const pref=await fetch(`${base}/rest/v1/notification_preferences?user_id=eq.${item.recipient_id}&select=email_enabled`,{headers,cache:'no-store'});
    if(!pref.ok)throw Error('Unable to verify notification preferences');
    if((await pref.json())[0]?.email_enabled===false){await rpc('civicops_finish_email',{p_id:item.id,p_sent:true});continue;}
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${resend}`,'Content-Type':'application/json','Idempotency-Key':item.id},body:JSON.stringify({from,to:[user.email],subject:`CivicOps: ${notification.title}`,text:`${notification.title}\n\n${notification.body}\n\nOpen CivicOps to review the request.`}),cache:'no-store'});
    if(!response.ok)throw Error(`Resend HTTP ${response.status}: ${(await response.text()).slice(0,160)}`);
    await rpc('civicops_finish_email',{p_id:item.id,p_sent:true});sent++;
   }catch(error){failed++;try{await rpc('civicops_finish_email',{p_id:item.id,p_sent:false,p_error:String(error.message||error).slice(0,400)});}catch{ /* Retriable processing lease. */ }}
  }
  return json({ok:true,deadlines,milestones,email:{processed:batch.length,sent,failed}});
 }catch(error){return json({ok:false,error:String(error.message||error).slice(0,250)},500);}
}
