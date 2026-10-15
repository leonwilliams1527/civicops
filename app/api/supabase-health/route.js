import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function GET(){
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/,'');
 if(!base)return NextResponse.json({ok:false,error:'Supabase URL missing'},{status:503});
 try{
  const u=new URL(base);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error('Invalid project URL');
  const res=await fetch(new URL('/auth/v1/health',u),{cache:'no-store',signal:AbortSignal.timeout(7000)});
  return NextResponse.json({ok:res.ok,upstreamStatus:res.status,...(!res.ok?{error:'Supabase health check did not succeed'}:{})},{status:res.ok?200:502});
 }catch(e){return NextResponse.json({ok:false,error:e.cause?.code||e.code||'Upstream network failure'},{status:502})}
}
