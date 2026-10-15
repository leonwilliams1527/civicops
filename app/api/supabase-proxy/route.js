import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const methods=['GET','POST','PATCH','PUT','DELETE'];
async function handler(request){
 const config=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/,'');
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
 if(!config||!key)return NextResponse.json({error:'Supabase server configuration missing'},{status:503});
 const url=new URL(request.url);
 const path=url.searchParams.get('path');
 if(!path||!/^\/(auth|rest)\/v1\/[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))return NextResponse.json({error:'Invalid Supabase proxy path'},{status:400});
 let upstream;
 try{
  upstream=new URL(config);
  if(upstream.protocol!=='https:'||!upstream.hostname.endsWith('.supabase.co'))throw new Error('Invalid Supabase project configuration');
  upstream.pathname=path;
  url.searchParams.delete('path');upstream.search=url.searchParams.toString();
  const headers=new Headers();
  for(const name of ['authorization','content-type','accept','prefer','x-client-info','accept-profile','content-profile','range','range-unit']){
   const value=request.headers.get(name);if(value)headers.set(name,value);
  }
  // The server always supplies its configured public key, not a browser-provided replacement.
  headers.set('apikey',key);
  const response=await fetch(upstream,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const responseHeaders=new Headers({'cache-control':'no-store'});
  for(const name of ['content-type','content-range','range-unit']){const value=response.headers.get(name);if(value)responseHeaders.set(name,value)}
  // Never forward upstream redirects to arbitrary origins.
  if(response.status>=300&&response.status<400)return NextResponse.json({error:'Unexpected Supabase redirect',status:response.status},{status:502});
  return new Response(response.body,{status:response.status,headers:responseHeaders});
 }catch(error){return NextResponse.json({error:'Supabase proxy request failed',detail:error.cause?.code||error.code||error.message},{status:502})}
}
export async function GET(request){return handler(request)}
export async function POST(request){return handler(request)}
export async function PATCH(request){return handler(request)}
export async function PUT(request){return handler(request)}
export async function DELETE(request){return handler(request)}
