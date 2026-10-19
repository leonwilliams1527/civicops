'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import Link from 'next/link';
import './admin.css';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const proxiedFetch=async(input,init)=>{const original=typeof input==='string'?input:input.url;const parsed=new URL(original);if(parsed.hostname===new URL(url).hostname&&/^\/(auth|rest|storage)\/v1\//.test(parsed.pathname)){const path='/api/supabase-proxy?path='+encodeURIComponent(parsed.pathname)+(parsed.search?'&'+parsed.search.slice(1):'');return fetch(path,init);}return fetch(input,init);};
const db=url&&key?createClient(url,key,{global:{fetch:proxiedFetch}}):null;
export default function Admin(){
 const [inviteOpen,setInviteOpen]=useState(false),[inviteForm,setInviteForm]=useState({full_name:'',email:'',department:'',role:'member'}),[inviteRows,setInviteRows]=useState([]),[inviteDepartments,setInviteDepartments]=useState([]),[isSuper,setIsSuper]=useState(false),[inviteBusy,setInviteBusy]=useState(false),[inviteMessage,setInviteMessage]=useState('');
 const [session,setSession]=useState(null),[membership,setMembership]=useState(null),[events,setEvents]=useState([]),[requests,setRequests]=useState([]),[imports,setImports]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[members,setMembers]=useState([]),[names,setNames]=useState({}),[roleBusy,setRoleBusy]=useState(''),[roleMessage,setRoleMessage]=useState('');
 useEffect(()=>{if(!db){setError('Supabase configuration missing');setLoading(false);return;}let live=true;async function start(){const {data,error:e}=await db.auth.getSession();if(!live)return;if(e)setError(e.message);setSession(data?.session||null);setLoading(false);}start();const {data}=db.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>{live=false;data.subscription.unsubscribe();};},[]);
 useEffect(()=>{if(!session?.user?.id){setMembership(null);return;}let live=true;async function load(){setLoading(true);setError('');const m=await db.from('memberships').select('department,role').eq('user_id',session.user.id).maybeSingle();if(!live)return;if(m.error){setError(m.error.message);setLoading(false);return;}setMembership(m.data);if(m.data?.role!=='admin'){setLoading(false);return;}const [a,r,i,membersResult]=await Promise.all([db.from('civicops_audit_events').select('id,event_type,entity_type,entity_id,department,details,created_at').order('created_at',{ascending:false}).limit(100),db.from('update_requests').select('id,status,due_date,priority,assigned_department'),db.from('spreadsheet_imports').select('id,department,row_count,created_at').order('created_at',{ascending:false}).limit(100),db.from('memberships').select('user_id,department,role').order('department')]);if(!live)return;if(a.error||r.error||i.error||membersResult.error)setError(a.error?.message||r.error?.message||i.error?.message||membersResult.error?.message);else{setMembers(membersResult.data||[]);const ids=(membersResult.data||[]).map(x=>x.user_id);if(ids.length){const p=await db.from('user_profiles').select('user_id,full_name,designation').in('user_id',ids);if(!p.error&&live)setNames(Object.fromEntries((p.data||[]).map(x=>[x.user_id,x])));}setEvents(a.data||[]);setRequests(r.data||[]);setImports(i.data||[]);}setLoading(false);}load();return()=>{live=false;};},[session?.user?.id]);
 async function invitationRequest(method,payload){
  if(!session?.access_token)throw Error('Sign in again');
  const response=await fetch('/api/admin/invitations',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:method==='GET'?undefined:JSON.stringify(payload),cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Invitation request failed');
  return result;
 }
 async function refreshInvites(){
  try{const result=await invitationRequest('GET');setInviteRows(result.invitations||[]);setInviteDepartments(result.departments||[]);setIsSuper(!!result.isSuper);setInviteForm(old=>({...old,department:result.departments?.includes(old.department)?old.department:(result.departments?.[0]||'')}));}
  catch(e){setInviteMessage(e.message);}
 }
 useEffect(()=>{if(membership?.role==='admin'&&session?.access_token)refreshInvites();},[membership?.role,session?.access_token]);
 async function submitInvite(event){
  event.preventDefault();setInviteBusy(true);setInviteMessage('');
  try{const result=await invitationRequest('POST',inviteForm);setInviteMessage(result.message||'Invitation sent');setInviteOpen(false);setInviteForm(old=>({...old,full_name:'',email:'',role:'member'}));await refreshInvites();}
  catch(e){setInviteMessage(e.message);}finally{setInviteBusy(false);}
 }
 async function inviteAction(id,action){
  if(action==='revoke'&&!window.confirm('Revoke this pending invitation?'))return;
  setInviteBusy(true);setInviteMessage('');
  try{const result=await invitationRequest('PATCH',{id,action});setInviteMessage(result.message||'Updated');await refreshInvites();}
  catch(e){setInviteMessage(e.message);}finally{setInviteBusy(false);}
 }
 async function changeRole(member){
  const next=member.role==='admin'?'member':'admin';
  if(!isSuper){setRoleMessage('Only Super Admin can change administrator roles.');return;}
  if(!window.confirm(`Change ${names[member.user_id]?.full_name||member.user_id} to ${next}?`))return;
  setRoleBusy(member.user_id);setRoleMessage('');
  const result=await db.rpc('civicops_set_member_role',{p_user_id:member.user_id,p_new_role:next});
  if(result.error)setRoleMessage('Role change failed: '+result.error.message);
  else {setMembers(old=>old.map(x=>x.user_id===member.user_id?{...x,role:next}:x));setRoleMessage('Role updated and audit event recorded.');const a=await db.from('civicops_audit_events').select('id,event_type,entity_type,entity_id,department,details,created_at').order('created_at',{ascending:false}).limit(100);if(!a.error)setEvents(a.data||[]);}
  setRoleBusy('');
 }
 const overdue=requests.filter(r=>r.status!=='Completed'&&r.due_date&&r.due_date<new Date().toISOString().slice(0,10)).length;
 return <main className="co-admin"><Link href="/collaboration">← Back to Dashboard</Link><p className="eyebrow">CIVICOPS / PILOT ADMINISTRATION</p><h1>Administration & Audit</h1><p>Administrator oversight and employee role management. Department membership and file permissions are unchanged.</p>
 {!session&&!loading?<div className="notice">Sign in from the Collaboration dashboard to continue.</div>:null}
 {membership&&membership.role!=='admin'?<div className="notice">Administrator access required.</div>:null}
 {error?<div className="notice error" role="alert">{error}</div>:null}
 {loading?<p>Loading…</p>:null}
 {membership?.role==='admin'&&!loading?<><div className="metrics"><section><strong>{requests.length}</strong><span>Visible requests</span></section><section><strong>{overdue}</strong><span>Overdue visible requests</span></section><section><strong>{imports.length}</strong><span>Recent imports</span></section><section><strong>{events.length}</strong><span>Recent audit events</span></section></div><section className="panel"><div className="co-admin-heading"><h2>Manage employee access</h2><button type="button" className="primary" onClick={()=>setInviteOpen(!inviteOpen)}>{inviteOpen?'Close invitation':'+ Invite employee'}</button></div><p>Invite employees to your department. Super Admins can invite across departments and grant administrator access. Role changes are audited.</p>
 {inviteMessage?<p role="status" className="notice">{inviteMessage}</p>:null}
 {inviteOpen?<form className="invite-form" onSubmit={submitInvite}>
  <label>Full name<input required minLength={2} maxLength={120} value={inviteForm.full_name} onChange={e=>setInviteForm({...inviteForm,full_name:e.target.value})} placeholder="Employee name"/></label>
  <label>Work email<input required type="email" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})} placeholder="employee@organization.org"/></label>
  <label>Department<select required value={inviteForm.department} onChange={e=>setInviteForm({...inviteForm,department:e.target.value})}>{inviteDepartments.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
  <label>Access level<select value={inviteForm.role} onChange={e=>setInviteForm({...inviteForm,role:e.target.value})}><option value="member">Employee</option>{isSuper?<option value="admin">Department Admin</option>:null}</select></label>
  <button className="primary" type="submit" disabled={inviteBusy||!inviteForm.department}>{inviteBusy?'Sending…':'Send invitation'}</button>
 </form>:null}
 <h3>Pending invitations</h3><div className="tablewrap"><table><thead><tr><th>Employee</th><th>Email</th><th>Department</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>{inviteRows.map(x=><tr key={x.id}><td>{x.full_name}</td><td>{x.email}</td><td>{x.department}</td><td>{x.role==='admin'?'Department Admin':'Employee'}</td><td>{x.status}</td><td>{x.status==='pending'?<><button type="button" disabled={inviteBusy} onClick={()=>inviteAction(x.id,'resend')}>Resend</button> <button type="button" disabled={inviteBusy} onClick={()=>inviteAction(x.id,'revoke')}>Revoke</button></>:'—'}</td></tr>)}</tbody></table>{inviteRows.length===0?<p>No invitations yet.</p>:null}</div>{roleMessage&&<p role="status">{roleMessage}</p>}<div className="tablewrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Role</th><th>Action</th></tr></thead><tbody>{members.map(m=><tr key={m.user_id}><td>{names[m.user_id]?.full_name||m.user_id}<br/><small>{names[m.user_id]?.designation||''}</small></td><td>{m.department}</td><td>{m.role}</td><td><button type="button" disabled={!isSuper||roleBusy!==''||m.user_id===session.user.id} onClick={()=>changeRole(m)}>{m.user_id===session.user.id?'Your account':!isSuper?'Super Admin only':roleBusy===m.user_id?'Saving…':m.role==='admin'?'Remove admin':'Make admin'}</button></td></tr>)}</tbody></table></div></section><section className="panel"><h2>Recent audit activity</h2><p>New request changes and imports are recorded after the Phase 12 migration. Earlier actions are not backfilled.</p><div className="tablewrap"><table><thead><tr><th>When</th><th>Event</th><th>Department</th><th>Record</th><th>Details</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString()}</td><td>{e.event_type}</td><td>{e.department||'—'}</td><td title={e.entity_id}>{e.entity_type}</td><td><code>{JSON.stringify(e.details)}</code></td></tr>)}</tbody></table></div>{events.length===0?<p>No audit events yet. Change a request or import a new spreadsheet to test.</p>:null}</section><section className="panel"><h2>Pilot security checklist</h2><ul><li>Confirm ordinary members cannot open this admin page's audit data.</li><li>Verify Permitting cannot read Water Quality-only spreadsheet records or files.</li><li>Confirm request changes appear in the audit log after refresh.</li><li>Keep pilot data fictional until a formal security review is completed.</li><li>Resend email delivery and automated scheduling remain disabled.</li></ul></section></>:null}</main>;
}
