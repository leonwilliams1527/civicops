'use client';
import {useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import '../auth/activate/activate.css';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proxiedFetch=async(input,init)=>{
 const original=typeof input==='string'?input:input.url;
 const parsed=new URL(original);
 if(url&&parsed.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(parsed.pathname)){
  const endpoint='/api/supabase-proxy?path='+encodeURIComponent(parsed.pathname)+(parsed.search?'&'+parsed.search.slice(1):'');
  return fetch(endpoint,init);
 }
 return fetch(input,init);
};
const db=url&&key?createClient(url,key,{global:{fetch:proxiedFetch}}):null;
export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e){
  e.preventDefault();setError('');setBusy(true);
  try{
   if(!db)throw Error('CivicOps authentication is not configured.');
   const {error}=await db.auth.signInWithPassword({email:email.trim(),password});
   if(error)throw error;
   window.location.assign('/collaboration');
  }catch(err){setError(err.message||'Sign-in failed.');}
  finally{setBusy(false);}
 }
 return <main className="activate-page"><section className="activate-card">
  <div className="activate-brand">CIVICOPS</div><h1>Sign in to CivicOps</h1>
  <p>Use your organization email and password.</p>
  <form onSubmit={submit}>
   <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button disabled={busy} type="submit">{busy?'Signing in…':'Sign in'}</button>
  </form>
  {error?<p className="activate-error" role="alert">{error}</p>:null}
  <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:12,marginTop:18}}>
   <Link href="/forgot-password">First-time account setup</Link>
   <Link href="/forgot-password">Forgot password?</Link>
  </div>
  <p style={{fontSize:13,marginTop:24}}>Employee accounts are created by invitation only.</p>
 </section></main>;
}
