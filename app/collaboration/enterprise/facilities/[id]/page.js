
'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import '../../enterprise.css';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proxy=async(input,init)=>{const raw=typeof input==='string'?input:input.url,p=new URL(raw);if(url&&p.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(p.pathname))return fetch('/api/supabase-proxy?path='+encodeURIComponent(p.pathname)+(p.search?'&'+p.search.slice(1):''),init);return fetch(input,init)};
const db=url&&key?createClient(url,key,{global:{fetch:proxy}}):null;

const tabs=[
 ['all','All records'],
 ['assets','Assets & equipment'],
 ['inspections','Inspections'],
 ['findings','Findings & risks'],
 ['actions','Corrective actions'],
 ['contractors','Contractors & vendors'],
 ['employees','Employees & teams'],
 ['workorders','Work orders'],
 ['projects','Projects'],
 ['procurement','Procurement & finance'],
 ['documents','Documents']
];

const planned={
 contractors:'Contractor profiles, contracts, certifications, and multi-site assignments will appear here when the company-wide vendor module is released.',
 employees:'Employee directory, departmental roles, and location assignments will appear here when Enterprise workforce management is released.',
 workorders:'Preventive and reactive work orders, assigned technicians, deadlines, and completion evidence will appear here when Work Orders is released.',
 projects:'Company projects, milestones, budgets, and cross-department tasks will appear here when Enterprise Projects is released.',
 procurement:'Purchase requests, purchase orders, contract spending, and budgets will appear here when Procurement & Finance is released.',
 documents:'Facility-specific documents, permits, warranties, and compliance records will appear here when Enterprise Documents is released.'
};

export default function Facility360(){
 const params=useParams(),id=Array.isArray(params?.id)?params.id[0]:params?.id;
 const [facility,setFacility]=useState(null),[assets,setAssets]=useState([]),[inspections,setInspections]=useState([]),[findings,setFindings]=useState([]),[actions,setActions]=useState([]),[tab,setTab]=useState('all'),[search,setSearch]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true);

 useEffect(()=>{let live=true;async function load(){setBusy(true);setError('');try{
  if(!db||!id)throw Error('Workspace is not configured');
  const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('Sign in to view this facility');
  const f=await db.from('enterprise_facilities').select('*').eq('id',id).maybeSingle();if(f.error)throw f.error;if(!f.data)throw Error('Facility not found or access denied');
  const org=f.data.organization_id;
  const [a,i,ac]=await Promise.all([
   db.from('enterprise_assets').select('*').eq('organization_id',org).eq('facility_id',id).order('name'),
   db.from('enterprise_inspections').select('*').eq('organization_id',org).eq('facility_id',id).order('inspection_date',{ascending:false}),
   db.from('enterprise_actions').select('*').eq('organization_id',org).eq('facility_id',id)
  ]);
  for(const r of [a,i,ac])if(r.error)throw r.error;
  const inspectionIds=(i.data||[]).map(x=>x.id);
  let findingRows=[];
  if(inspectionIds.length){const fr=await db.from('enterprise_findings').select('*').eq('organization_id',org).in('inspection_id',inspectionIds);if(fr.error)throw fr.error;findingRows=fr.data||[]}
  if(live){setFacility(f.data);setAssets(a.data||[]);setInspections(i.data||[]);setActions(ac.data||[]);setFindings(findingRows)}
 }catch(e){if(live)setError(e.message||'Unable to load facility')}finally{if(live)setBusy(false)}}load();return()=>{live=false}},[id]);

 const hasCoords=facility&&facility.latitude!=null&&facility.longitude!=null&&Number.isFinite(Number(facility.latitude))&&Number.isFinite(Number(facility.longitude))&&Math.abs(Number(facility.latitude))<=90&&Math.abs(Number(facility.longitude))<=180;
 const lat=Number(facility?.latitude),lon=Number(facility?.longitude);
 const mapUrl=hasCoords?`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent([lon-.015,lat-.01,lon+.015,lat+.01].join(','))}&layer=mapnik&marker=${encodeURIComponent(lat+','+lon)}`:null;

 const items=useMemo(()=>[
  ...assets.map(x=>({type:'assets',title:x.name,detail:`${x.asset_tag} · ${x.category} · ${x.condition}`,id:x.id})),
  ...inspections.map(x=>({type:'inspections',title:x.title,detail:`${x.inspection_date} · ${x.status}`,id:x.id})),
  ...findings.map(x=>({type:'findings',title:x.title,detail:`${x.severity} · ${x.status} · ${x.recommendation||'No recommendation'}`,id:x.id})),
  ...actions.map(x=>({type:'actions',title:x.title,detail:`${x.priority||'Priority not set'} · ${x.status}`,id:x.id}))
 ],[assets,inspections,findings,actions]);

 const visible=items.filter(x=>(tab==='all'||x.type===tab)&&`${x.title} ${x.detail}`.toLowerCase().includes(search.toLowerCase()));
 const count=(t)=>t==='all'?items.length:items.filter(x=>x.type===t).length;

 return <main className="ent-page">
  <header className="ent-header"><div><div className="ent-eyebrow">CIVICOPS / ENTERPRISE OPERATIONS / FACILITY 360</div><h1>{facility?.name||'Facility overview'}</h1><p>{facility?.address||facility?.region||'Facility operational records'}</p></div><Link href="/collaboration/enterprise">← All facilities</Link></header>
  {error&&<div className="ent-error" role="alert">{error}</div>}
  {busy?<section className="ent-panel">Loading facility records…</section>:facility&&<>
   <div className="ent-kpis"><div><strong>{assets.length}</strong><span>All registered assets</span></div><div><strong>{inspections.length}</strong><span>Inspections</span></div><div><strong>{findings.length}</strong><span>Findings & risks</span></div><div><strong>{actions.filter(x=>!['resolved','verified'].includes(x.status)).length}</strong><span>Open corrective actions</span></div></div>
   <div className="ent-columns"><section className="ent-panel"><h2>Facility location</h2>{mapUrl?<><iframe title={`Map of ${facility.name}`} src={mapUrl} style={{width:'100%',height:320,border:0,borderRadius:10}} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><p><a href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=15/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`} target="_blank" rel="noopener noreferrer">Open interactive map ↗</a></p></>:<p>No verified coordinates recorded for this facility. Add latitude and longitude in the facility record to display its map.</p>}</section>
   <aside className="ent-panel"><h2>Facility information</h2><p><strong>Status:</strong> {facility.status}</p><p><strong>Region:</strong> {facility.region||'Not specified'}</p><p><strong>Address:</strong> {facility.address||'Not specified'}</p><p><strong>Coordinates:</strong> {hasCoords?`${lat}, ${lon}`:'Not verified'}</p><p>Existing records are queried by facility and organization; database RLS must independently enforce tenant access.</p></aside></div>
   <section className="ent-panel"><h2>Facility 360 — company-wide record views</h2><p>Choose an operational area to see records belonging to this facility. Company-wide modules under development are clearly identified and do not display invented data.</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>{tabs.map(([value,label])=><button key={value} type="button" onClick={()=>setTab(value)} aria-pressed={tab===value} style={{padding:'9px 12px',borderRadius:8,border:'1px solid #cad5e2',background:tab===value?'#174b70':'white',color:tab===value?'white':'#17314b',cursor:'pointer'}}>{label} ({count(value)})</button>)}</div>
   <label>Search this facility's records <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search equipment, inspections, findings or actions" style={{display:'block',width:'100%',padding:12,margin:'8px 0 16px',border:'1px solid #cad5e2',borderRadius:8}}/></label>
   {planned[tab]?<p role="status" style={{padding:16,background:'#f1f5f9',borderRadius:8}}><strong>Coming in a future phase:</strong> {planned[tab]}</p>:visible.length?<div className="ent-list">{visible.map(x=><div key={x.type+x.id} style={{padding:14,borderBottom:'1px solid #e5e7eb'}}><strong>{x.title}</strong><p style={{margin:'4px 0'}}>{tabs.find(t=>t[0]===x.type)?.[1]} · {x.detail}</p></div>)}</div>:<p>No existing records match this filter.</p>}
   <p><Link href="/collaboration/enterprise/assets">Manage company assets ↗</Link> · <Link href="/collaboration/enterprise/inspections">Manage company inspections ↗</Link></p>
   </section>
  </>}
 </main>;
}
