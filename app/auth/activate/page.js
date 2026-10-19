'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import './activate.css';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proxiedFetch=async(input,init)=>{
 const original=typeof input==='string'?input:input.url;
 const parsed=new URL(original);
 if(parsed.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(parsed.pathname)){
  const endpoint='/api/supabase-proxy?path='+encodeURIComponent(parsed.pathname)+(parsed.search?'&'+parsed.search.slice(1):'');
  return fetch(endpoint,init);
 }
 return fetch(input,init);
};
const db=url&&key?createClient(url,key,{global:{fetch:proxiedFetch},auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}):null;
export default function Activate(){
 const [ready,setReady]=useState(false),[authorized,setAuthorized]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
 useEffect(()=>{
  if(!db){setError('Supabase configuration is missing.');setReady(true);return;}
  let mounted=true;
  const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{if(mounted&&session?.user)setAuthorized(true);});
  async function init(){
   try{
    const params=new URLSearchParams(window.location.search);
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const linkError=params.get('error_description')||hash.get('error_description');
    if(linkError)throw Error(linkError.replace(/\+/g,' '));
    // Recovery links using the implicit flow carry credentials in the URL hash.
    // Explicitly establish the session before displaying password creation.
    if(hash.get('access_token')&&hash.get('refresh_token')){
     const {error:tokenError}=await db.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});
     if(tokenError)throw tokenError;
     window.history.replaceState(null,'',window.location.pathname+'?flow='+encodeURIComponent(hash.get('type')||params.get('flow')||'recovery'));
    }
    const tokenHash=params.get('token_hash');
    const type=params.get('type');
    if(tokenHash&&['invite','recovery'].includes(type)){
     const result=await db.auth.verifyOtp({token_hash:tokenHash,type});
     if(result.error)throw result.error;
    }else if(params.get('code')){
     const result=await db.auth.exchangeCodeForSession(params.get('code'));
     if(result.error)throw result.error;
    }
    const {data,error:sessionError}=await db.auth.getSession();
    if(sessionError)throw sessionError;
    if(!mounted)return;
    if(data.session?.user)setAuthorized(true);
    else setError('This invitation or recovery link is invalid, expired, or already used. Request a new password link from CivicOps sign-in.');
   }catch(err){if(mounted)setError(err.message||'Unable to verify the link.');}
   finally{if(mounted)setReady(true);}
  }
  init();
  return()=>{mounted=false;subscription.unsubscribe()};
 },[]);
 async function savePassword(event){
  event.preventDefault();setError('');
  if(password.length<12){setError('Use a password with at least 12 characters.');return;}
  if(password!==confirm){setError('The passwords do not match.');return;}
  setBusy(true);
  try{
   const {data,error:sessionError}=await db.auth.getSession();
   if(sessionError||!data.session)throw Error('Your link has expired. Request a new password link.');
   const {error:passwordError}=await db.auth.updateUser({password});
   if(passwordError)throw passwordError;
   const {data:updatedSession}=await db.auth.getSession();
   if(updatedSession.session?.access_token){
    // Best effort audit transition; successful password setup is not rolled back
    // if the administration audit endpoint is temporarily unavailable.
    await fetch('/api/auth/activation-complete',{method:'POST',headers:{Authorization:'Bearer '+updatedSession.session.access_token}}).catch(()=>{});
   }
   setSuccess(true);setPassword('');setConfirm('');
  }catch(err){setError(err.message||'Could not set your password.');}
  finally{setBusy(false);}
 }
 return <main className="activate-page"><section className="activate-card"><div className="activate-brand">CIVICOPS</div><h1>{success?'Password saved': 'Set your account password'}</h1>
 {!ready?<p>Verifying your secure link…</p>:success?<><p>Your password has been saved. Your department and access level remain assigned by your administrator.</p><Link className="activate-button" href="/collaboration">Continue to CivicOps →</Link></>:authorized?<><p>Create a password to complete account setup or recover access.</p><form onSubmit={savePassword}><label>New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><button type="submit" disabled={busy}>{busy?'Saving…':'Save password'}</button></form></>:null}
 {error?<p className="activate-error" role="alert">{error}</p>:null}
 <Link className="activate-back" href="/login">← Back to sign in</Link><p><Link href="/forgot-password">Request a new password link</Link></p></section></main>;
}
