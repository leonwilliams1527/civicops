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
  return fetch('/api/supabase-proxy?path='+encodeURIComponent(parsed.pathname)+(parsed.search?'&'+parsed.search.slice(1):''),init);
 }
 return fetch(input,init);
};
const db=url&&key?createClient(url,key,{global:{fetch:proxiedFetch}}):null;
export default function ForgotPassword(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(e){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   if(!db)throw Error('CivicOps authentication is not configured.');
   const redirectTo=window.location.origin+'/auth/activate?flow=recovery';
   const {error}=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo});
   if(error)throw error;
   setMessage('If this email has an account, a secure password link will arrive shortly. Check spam or junk folders.');
  }catch(err){setError(err.message||'Unable to send password link.');}
  finally{setBusy(false);}
 }
 return <main className="activate-page"><section className="activate-card">
  <div className="activate-brand">CIVICOPS</div><h1>Set or reset your password</h1>
  <p>For invited employees setting a password for the first time, and existing employees who forgot theirs.</p>
  <form onSubmit={submit}>
   <label>Work email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button type="submit" disabled={busy}>{busy?'Sending…':'Email secure password link'}</button>
  </form>
  {message?<p role="status">{message}</p>:null}
  {error?<p role="alert" className="activate-error">{error}</p>:null}
  <Link className="activate-back" href="/login">← Back to sign in</Link>
 </section></main>;
}
