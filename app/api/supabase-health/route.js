import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/,'');
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
 if(!base||!key)return NextResponse.json({ok:false,error:'Missing Supabase URL or publishable key in Vercel environment variables'},{status:503});
 try{
  const u=new URL(base);
  if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co'))throw Error('Invalid Supabase project URL');
  // Supabase API gateway requires an apikey even for the auth health endpoint.
  const headers={'apikey':key};
  // Legacy anon JWTs can also be used as bearer credentials; modern publishable keys are not JWTs.
  if(key.startsWith('eyJ'))headers.authorization=`Bearer ${key}`;
  const res=await fetch(new URL('/auth/v1/health',u),{headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
  return NextResponse.json({ok:res.ok,upstreamStatus:res.status,...(!res.ok?{error:res.status===401?'Supabase rejected the configured API key':'Supabase health endpoint returned an error'}:{})},{status:res.ok?200:502,headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({ok:false,error:e.message==='Invalid Supabase project URL'?e.message:e.cause?.code||e.code||'Upstream network failure'},{status:502})}
}
