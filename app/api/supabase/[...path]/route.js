import {NextResponse} from 'next/server';
export const runtime='nodejs';
const METHODS=['GET','POST','PATCH','PUT','DELETE'];
async function handler(request,{params}){
 const {path}=await params;
 if(!Array.isArray(path)||path.length<2||!['auth','rest'].includes(path[0])||path[1]!=='v1')return NextResponse.json({error:'Route not allowed'},{status:404});
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/,'');
 if(!base)return NextResponse.json({error:'Supabase URL missing on server'},{status:503});
 const target=new URL(base);
 if(target.protocol!=='https:'||!target.hostname.endsWith('.supabase.co'))return NextResponse.json({error:'Invalid Supabase configuration'},{status:503});
 target.pathname='/'+path.join('/');target.search=new URL(request.url).search;
 const headers=new Headers();
 for(const name of ['apikey','authorization','content-type','accept','prefer','x-client-info','accept-profile','content-profile','range','range-unit']){
   const value=request.headers.get(name);if(value)headers.set(name,value);
 }
 // Supply the configured public API key if the browser client did not forward one.
 if(!headers.has('apikey')){const publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();if(publicKey)headers.set('apikey',publicKey)}
 try{
  const upstream=await fetch(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(12000)});
  const responseHeaders=new Headers();
  for(const name of ['content-type','content-range','range-unit','location']){const v=upstream.headers.get(name);if(v)responseHeaders.set(name,v)}
  responseHeaders.set('Cache-Control','no-store');
  return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
 }catch(err){return NextResponse.json({error:'Supabase upstream connection failed',detail:err.cause?.code||err.code||'Network error'},{status:502})}
}
export async function GET(req,ctx){return handler(req,ctx)}
export async function POST(req,ctx){return handler(req,ctx)}
export async function PATCH(req,ctx){return handler(req,ctx)}
export async function PUT(req,ctx){return handler(req,ctx)}
export async function DELETE(req,ctx){return handler(req,ctx)}
