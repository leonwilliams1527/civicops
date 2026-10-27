
'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import '../enterprise.css';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const proxy=async(input,init)=>{
 const raw=typeof input==='string'?input:input.url;
 const p=new URL(raw);
 if(url&&p.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(p.pathname)){
  return fetch(
   '/api/supabase-proxy?path='+encodeURIComponent(p.pathname)+(p.search?'&'+p.search.slice(1):''),
   init
  );
 }
 return fetch(input,init);
};

const db=url&&key?createClient(url,key,{global:{fetch:proxy}}):null;

export default function Inspections(){
 const [uid,setUid]=useState(''),[orgs,setOrgs]=useState([]);
 const [org,setOrg]=useState('');
 const [facilities,setFacilities]=useState([]);
 const [assets,setAssets]=useState([]);
 const [inspections,setInspections]=useState([]);
 const [findings,setFindings]=useState([]);
 const [role,setRole]=useState('viewer');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(true);
 const [saving,setSaving]=useState(false);
 const [selected,setSelected]=useState('');

 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    if(!db)throw Error('Supabase not configured');
    const {data:{user},error:e}=await db.auth.getUser();
    if(e||!user)throw Error('Sign in to access enterprise inspections');
    if(live)setUid(user.id);
    const r=await db.from('enterprise_organizations')
     .select('id,name').order('name');
    if(r.error)throw r.error;
    if(live){
     setOrgs(r.data||[]);
     setOrg(r.data?.[0]?.id||'');
    }
   }catch(e){
    if(live)setError(e.message);
   }finally{
    if(live)setBusy(false);
   }
  })();
  return()=>{live=false};
 },[]);

 useEffect(()=>{
  if(!org||!uid)return;
  let live=true;
  setBusy(true);
  setSelected('');
  setInspections([]);
  setFindings([]);
  setError('');

  (async()=>{
   try{
    const [f,a,i,n,m]=await Promise.all([
     db.from('enterprise_facilities')
      .select('id,name').eq('organization_id',org),
     db.from('enterprise_assets')
      .select('id,name,facility_id').eq('organization_id',org),
     db.from('enterprise_inspections')
      .select('*').eq('organization_id',org)
      .order('inspection_date',{ascending:false}),
     db.from('enterprise_findings')
      .select('*').eq('organization_id',org),
     db.from('enterprise_members')
      .select('role').eq('organization_id',org).eq('user_id',uid).maybeSingle()
    ]);

    if(f.error||a.error||i.error||n.error||m.error){
     throw f.error||a.error||i.error||n.error||m.error;
    }

    if(live){
     setFacilities(f.data||[]);
     setAssets(a.data||[]);
     setInspections(i.data||[]);
     setFindings(n.data||[]);
     setRole(m.data?.role||'viewer');
    }
   }catch(e){
    if(live)setError(e.message);
   }finally{
    if(live)setBusy(false);
   }
  })();

  return()=>{live=false};
 },[org,uid]);

 const writable=['owner','admin','operator','manager'].includes(role);

 async function addInspection(e){
  e.preventDefault();
  if(!writable)return;
  setSaving(true);
  setError('');

  const form=e.currentTarget;
  const fd=new FormData(form);

  try{
   const r=await db.from('enterprise_inspections').insert({
    organization_id:org,
    facility_id:String(fd.get('facility_id')),
    title:String(fd.get('title')).trim(),
    inspection_date:String(fd.get('inspection_date')),
    inspector:String(fd.get('inspector')).trim()||null,
    status:'planned'
   }).select('*').single();

   if(r.error)throw r.error;

   setInspections(v=>[r.data,...v]);
   setSelected(r.data.id);
   form.reset();
  }catch(e){
   setError(e.message);
  }finally{
   setSaving(false);
  }
 }

 async function addFinding(e){
  e.preventDefault();
  if(!writable||!selected)return;
  setSaving(true);
  setError('');

  const form=e.currentTarget;
  const fd=new FormData(form);

  try{
   const r=await db.from('enterprise_findings').insert({
    organization_id:org,
    inspection_id:selected,
    title:String(fd.get('title')).trim(),
    severity:String(fd.get('severity')),
    recommendation:String(fd.get('recommendation')).trim()||null
   }).select('*').single();

   if(r.error)throw r.error;

   setFindings(v=>[r.data,...v]);
   form.reset();
  }catch(e){
   setError(e.message);
  }finally{
   setSaving(false);
  }
 }

 return (
  <main className="ent-page">
   <header className="ent-header">
    <div>
     <div className="ent-eyebrow">CIVICOPS / ENTERPRISE OPERATIONS</div>
     <h1>Inspections & Findings</h1>
     <p>Record inspections and track identified risks.</p>
    </div>
    <Link href="/collaboration/enterprise/assets">
     Assets & Equipment ↗
    </Link>
   </header>

   {error&&<div className="ent-error" role="alert">{error}</div>}

   {orgs.length>0&&<>
    <div className="ent-toolbar">
     <label>
      Organization
      <select value={org} onChange={e=>setOrg(e.target.value)}>
       {orgs.map(o=>
        <option key={o.id} value={o.id}>{o.name}</option>
       )}
      </select>
     </label>
    </div>

    <div className="ent-kpis">
     <div>
      <strong>{inspections.length}</strong>
      <span>Inspections</span>
     </div>
     <div>
      <strong>{findings.length}</strong>
      <span>Findings</span>
     </div>
     <div>
      <strong>{findings.filter(f=>f.severity==='critical'&&f.status!=='verified').length}</strong>
      <span>Critical findings</span>
     </div>
    </div>

    {writable&&
     <form className="ent-panel ent-form" onSubmit={addInspection}>
      <h2>Schedule inspection</h2>

      <label>
       Facility
       <select name="facility_id" required>
        {facilities.map(f=>
         <option key={f.id} value={f.id}>{f.name}</option>
        )}
       </select>
      </label>

      <label>
       Inspection title
       <input name="title" required maxLength="180"/>
      </label>

      <label>
       Inspection date
       <input
        name="inspection_date"
        type="date"
        required
        defaultValue={new Date().toISOString().slice(0,10)}
       />
      </label>

      <label>
       Inspector
       <input name="inspector" maxLength="160"/>
      </label>

      <button disabled={saving||!facilities.length}>
       {saving?'Saving…':'Create inspection'}
      </button>
     </form>
    }

    <div className="ent-columns">
     <section className="ent-panel">
      <h2>Inspection register</h2>

      {busy?
       <p>Loading…</p>:
       inspections.length===0?
       <p>No inspections recorded.</p>:
       <div className="ent-list">
        {inspections.map(i=>
         <button
          key={i.id}
          className={selected===i.id?'active':''}
          onClick={()=>setSelected(i.id)}
         >
          <span>
           <strong>{i.title}</strong>
           <small>
            {i.inspection_date} · {facilities.find(f=>f.id===i.facility_id)?.name||'Facility'} · {i.status}
           </small>
          </span>
         </button>
        )}
       </div>
      }
     </section>

     <aside className="ent-panel">
      <h2>Findings</h2>

      {!selected?
       <p>Select an inspection.</p>:
       <>
        {findings.filter(f=>f.inspection_id===selected).map(f=>
         <div key={f.id} className="ent-action">
          <strong>{f.title}</strong>
          <small>{f.severity} · {f.status}</small>
          <p>{f.recommendation||'No recommendation recorded'}</p>
         </div>
        )}

        {writable&&
         <form className="ent-form" onSubmit={addFinding}>
          <h3>Add finding</h3>

          <label>
           Finding
           <input name="title" required maxLength="180"/>
          </label>

          <label>
           Severity
           <select name="severity">
            <option>low</option>
            <option>medium</option>
            <option>high</option>
            <option>critical</option>
           </select>
          </label>

          <label>
           Recommended action
           <input name="recommendation" maxLength="500"/>
          </label>

          <button disabled={saving}>
           {saving?'Saving…':'Record finding'}
          </button>
         </form>
        }
       </>
      }
     </aside>
    </div>
   </>}
  </main>
 );
}
