'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import './enterprise.css';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proxy=async(input,init)=>{const raw=typeof input==='string'?input:input.url;const parsed=new URL(raw);if(url&&parsed.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(parsed.pathname)){return fetch('/api/supabase-proxy?path='+encodeURIComponent(parsed.pathname)+(parsed.search?'&'+parsed.search.slice(1):''),init);}return fetch(input,init);};
const db=url&&key?createClient(url,key,{global:{fetch:proxy}}):null;
export default function Enterprise(){
 const [user,setUser]=useState(null),[orgs,setOrgs]=useState([]),[orgId,setOrgId]=useState(''),[facilities,setFacilities]=useState([]),[actions,setActions]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[filter,setFilter]=useState('all'),[selected,setSelected]=useState(''),[adding,setAdding]=useState(false),[saving,setSaving]=useState(false),[authorized,setAuthorized]=useState(false),[accessChecked,setAccessChecked]=useState(false);
 useEffect(()=>{if(!db){setError('Supabase configuration is missing');setBusy(false);return;}let active=true;db.auth.getUser().then(async({data,error:e})=>{if(!active)return;if(e||!data.user){setBusy(false);return;}setUser(data.user);const membership=await db.from('enterprise_members').select('organization_id,role').eq('user_id',data.user.id).in('role',['owner','admin']);if(membership.error){setError(membership.error.message);setAccessChecked(true);setBusy(false);return;}const ids=(membership.data||[]).map(m=>m.organization_id);setAccessChecked(true);setAuthorized(ids.length>0);if(!ids.length){setBusy(false);return;}const r=await db.from('enterprise_organizations').select('id,name,slug').in('id',ids).order('name');if(!active)return;if(r.error)setError(r.error.message);else{setOrgs(r.data||[]);setOrgId(r.data?.[0]?.id||'');}setBusy(false);});return()=>{active=false};},[]);
 useEffect(()=>{if(!db||!orgId)return;let active=true;setBusy(true);Promise.all([db.from('enterprise_facilities').select('*').eq('organization_id',orgId).order('name'),db.from('enterprise_actions').select('*').eq('organization_id',orgId)]).then(([f,a])=>{if(!active)return;if(f.error||a.error)setError(f.error?.message||a.error?.message);else{setError('');setFacilities(f.data||[]);setActions(a.data||[]);}setBusy(false);});return()=>{active=false};},[orgId]);
 const visible=useMemo(()=>facilities.filter(f=>filter==='all'||f.status===filter),[facilities,filter]);const chosen=facilities.find(f=>f.id===selected);const activeActions=actions.filter(a=>a.facility_id===selected);
 async function addFacility(e){if(!authorized)return;e.preventDefault();const fd=new FormData(e.currentTarget);const lat=fd.get('latitude'),lng=fd.get('longitude');if(Boolean(lat)!==Boolean(lng)){setError('Enter both latitude and longitude, or neither.');return;}setSaving(true);setError('');const payload={organization_id:orgId,name:String(fd.get('name')).trim(),region:String(fd.get('region')).trim()||null,address:String(fd.get('address')).trim()||null,latitude:lat?Number(lat):null,longitude:lng?Number(lng):null,status:'operational'};const r=await db.from('enterprise_facilities').insert(payload).select('*').single();setSaving(false);if(r.error){setError(r.error.message);return;}setFacilities(v=>[...v,r.data].sort((a,b)=>a.name.localeCompare(b.name)));setAdding(false);setSelected(r.data.id);}
 if(accessChecked&&!authorized)return <main className="ent-page"><h1>Locations restricted</h1><p>Your account has no authorized facility assignments. Contact your administrator.</p><Link href="/collaboration/enterprise/workspace">My Workspace</Link></main>;
 return <main className="ent-page"><header className="ent-header"><div><div className="ent-eyebrow">CIVICOPS / ENTERPRISE OPERATIONS</div><h1>Locations & Facilities</h1><p>One secure workspace for facilities, site status and corrective actions.</p></div></header>
 {error&&<div role="alert" className="ent-error">{error}</div>}
 {!user&&!busy?<section className="ent-panel">Please <Link href="/login">sign in</Link> to access your organization workspace.</section>:null}
 {user&&!busy&&orgs.length===0?<section className="ent-panel"><h2>No enterprise workspace assigned</h2><p>Your account has no enterprise organization membership. A trusted platform administrator must provision an organization and assign your account. Existing municipal access remains unchanged.</p></section>:null}
 {orgs.length>0&&<><div className="ent-toolbar"><label>Organization <select value={orgId} onChange={e=>{setOrgId(e.target.value);setSelected('')}}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><button onClick={()=>setAdding(v=>!v)}>+ Add facility</button></div><div className="ent-kpis">{[['Facilities',facilities.length],['Attention needed',facilities.filter(f=>f.status==='attention'||f.status==='critical').length],['Open actions',actions.filter(a=>!['resolved','verified'].includes(a.status)).length],['Mapped locations',facilities.filter(f=>f.latitude!=null&&f.longitude!=null).length]].map(([label,n])=><div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>
 {adding&&<form className="ent-panel ent-form" onSubmit={addFacility}><h2>New facility</h2><label>Facility name<input name="name" required maxLength="160"/></label><label>Region<input name="region" maxLength="160"/></label><label>Address<input name="address" maxLength="250"/></label><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90"/></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180"/></label><p>Enter only verified coordinates. No facility positions are inferred.</p><button disabled={saving}>{saving?'Saving…':'Save facility'}</button></form>}
 <div className="ent-columns"><section className="ent-panel"><div className="ent-row"><h2>Facility register</h2><select aria-label="Filter facility status" value={filter} onChange={e=>setFilter(e.target.value)}>{['all','operational','attention','critical','inactive'].map(s=><option key={s} value={s}>{s==='all'?'All statuses':s}</option>)}</select></div>{busy?<p>Loading…</p>:visible.length===0?<p>No facilities match. Add a verified facility to get started.</p>:<div className="ent-list">
{visible.map(f=>
  <button
    key={f.id}
    className={selected===f.id?'active':''}
    onClick={()=>setSelected(f.id)}
    onDoubleClick={() =>
      window.location.assign(
        '/collaboration/enterprise/facilities/' +
        encodeURIComponent(f.id)
      )
    }
  >
<span><strong>{f.name}</strong><small>{f.region||'Region not specified'} · {f.latitude!=null?'Mapped':'Coordinates pending'}</small></span><em data-status={f.status}>{f.status}</em></button>)}</div>}</section><aside className="ent-panel"><h2>{chosen?.name||'Facility details'}</h2>{!chosen?<p>Select a facility to view its details and outstanding actions.</p>:<><p>{chosen.address||'Address not recorded'}</p><p>Region: {chosen.region||'Not specified'}</p><p>Status: <strong>{chosen.status}</strong></p><p>Coordinates: {chosen.latitude!=null?`${chosen.latitude}, ${chosen.longitude}`:'Not verified'}</p><h3>Corrective actions</h3>{activeActions.length?activeActions.map(a=><div className="ent-action" key={a.id}><strong>{a.title}</strong><small>{a.priority} · {a.status}</small></div>):<p>No actions recorded for this facility.</p>}</>}</aside></div></>}
 </main>;
}
