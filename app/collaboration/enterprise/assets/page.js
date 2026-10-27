
'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import '../enterprise.css';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proxy=async(input,init)=>{const raw=typeof input==='string'?input:input.url,p=new URL(raw);if(url&&p.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(p.pathname))return fetch('/api/supabase-proxy?path='+encodeURIComponent(p.pathname)+(p.search?'&'+p.search.slice(1):''),init);return fetch(input,init)};
const db=url&&key?createClient(url,key,{global:{fetch:proxy}}):null;

export default function Assets(){
 const [grants,setGrants]=useState([]),[uid,setUid]=useState(''),[orgs,setOrgs]=useState([]),[org,setOrg]=useState(''),[facilities,setFacilities]=useState([]),[assets,setAssets]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[role,setRole]=useState('viewer');

 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    if(!db)throw Error('Supabase not configured');
    const {data:{user},error:e}=await db.auth.getUser();
    if(e||!user)throw Error('Sign in to access enterprise assets');
    if(live)setUid(user.id);
    const r=await db.from('enterprise_organizations').select('id,name').order('name');
    if(r.error)throw r.error;
    if(live){setOrgs(r.data||[]);setOrg(r.data?.[0]?.id||'')}
   }catch(e){if(live)setError(e.message)}
   finally{if(live)setBusy(false)}
  })();
  return()=>{live=false}
 },[]);

 useEffect(()=>{
  if(!org||!uid)return;
  let live=true;
  setBusy(true);setAssets([]);setFacilities([]);setError('');
  (async()=>{
   try{
    const [f,a,m,g]=await Promise.all([
     db.from('enterprise_facilities').select('id,name').eq('organization_id',org).order('name'),
     db.from('enterprise_assets').select('*').eq('organization_id',org).order('name'),
     db.from('enterprise_members').select('role').eq('organization_id',org).eq('user_id',uid).maybeSingle(),
     db.from('enterprise_delegated_tasks').select('facility_id,task_type,target_id,status,expires_at').eq('organization_id',org).eq('assigned_to',uid).in('status',['assigned','in_progress','rejected'])
    ]);
    if(f.error||a.error||m.error||g.error)throw f.error||a.error||m.error||g.error;
    if(live){
     setFacilities(f.data||[]);
     setAssets(a.data||[]);
     setRole(m.data?.role||'viewer');setGrants((g.data||[]).filter(x=>!x.expires_at||new Date(x.expires_at)>new Date()));setGrants((g.data||[]).filter(x=>!x.expires_at||new Date(x.expires_at)>new Date()))
    }
   }catch(e){if(live)setError(e.message)}
   finally{if(live)setBusy(false)}
  })();
  return()=>{live=false}
 },[org,uid]);

 async function add(e){
  e.preventDefault();
  if(!['owner','admin','operator','manager'].includes(role)&&!grants.some(g=>g.task_type==='asset_register'&&g.facility_id===String(new FormData(e.currentTarget).get('facility_id'))&&!g.target_id))return;
  setSaving(true);setError('');
  const form=e.currentTarget,fd=new FormData(form);
  const payload={
   organization_id:org,
   facility_id:String(fd.get('facility_id')),
   asset_tag:String(fd.get('asset_tag')).trim(),
   name:String(fd.get('name')).trim(),
   category:String(fd.get('category')),
   condition:String(fd.get('condition'))
  };
  try{
   const r=await db.from('enterprise_assets').insert(payload).select('*').single();
   if(r.error)throw r.error;
   setAssets(v=>[...v,r.data].sort((a,b)=>a.name.localeCompare(b.name)));
   form.reset()
  }catch(e){setError(e.message)}
  finally{setSaving(false)}
 }

 return <main className="ent-page">
  <header className="ent-header">
   <div>
    <div className="ent-eyebrow">CIVICOPS / ENTERPRISE OPERATIONS</div>
    <h1>Assets & Equipment</h1>
    <p>Track equipment at each facility.</p>
   </div>
   <Link href="/collaboration/enterprise">Locations & Facilities ↗</Link>
  </header>

  {error&&<div className="ent-error" role="alert">{error}</div>}

  {orgs.length>0&&<>
   <div className="ent-toolbar">
    <label>Organization <select value={org} onChange={e=>setOrg(e.target.value)}>
     {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
    </select></label>
   </div>

   <div className="ent-kpis">
    <div><strong>{assets.length}</strong><span>Registered assets</span></div>
    <div><strong>{assets.filter(a=>['attention','critical'].includes(a.condition)).length}</strong><span>Need attention</span></div>
    <div><strong>{facilities.length}</strong><span>Facilities</span></div>
   </div>

   {(['owner','admin','operator','manager'].includes(role)||grants.some(g=>g.task_type==='asset_register'&&!g.target_id))&&<form className="ent-panel ent-form" onSubmit={add}>
    <h2>Register equipment</h2>
    <label>Facility<select name="facility_id" required>
     {facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
    </select></label>
    <label>Asset tag<input name="asset_tag" required maxLength="80"/></label>
    <label>Equipment name<input name="name" required maxLength="160"/></label>
    <label>Category<select name="category">
     <option>electrical</option><option>generator</option><option>hvac</option><option>mechanical</option><option>other</option>
    </select></label>
    <label>Condition<select name="condition">
     <option>unknown</option><option>good</option><option>attention</option><option>critical</option><option>retired</option>
    </select></label>
    <button disabled={saving||!facilities.length}>{saving?'Saving…':'Add asset'}</button>
   </form>}

   <section className="ent-panel">
    <h2>Equipment register</h2>
    {busy?<p>Loading…</p>:assets.length===0?<p>No equipment registered yet.</p>:
     <div className="ent-list">
      {assets.map(a=><div key={a.id} style={{padding:12,borderBottom:'1px solid #e5e7eb'}}>
       <strong>{a.name}</strong>
       <p>{a.asset_tag} · {a.category} · {facilities.find(f=>f.id===a.facility_id)?.name||'Facility'} · {a.condition}</p>
      </div>)}
     </div>}
   </section>
  </>}
 </main>;
}
