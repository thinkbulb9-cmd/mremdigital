'use client';
import { FormEvent,useState } from 'react';
import { GraduationCap,LockKeyhole } from 'lucide-react';
export default function StaffLogin(){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e:FormEvent){
  e.preventDefault();setLoading(true);setError('');
  try{
   const response=await fetch('/api/staff/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Login unavailable');
   window.location.assign('/staff');
  }catch(e){setError(e instanceof Error?e.message:'Unable to login');}
  finally{setLoading(false);}
 }
 return <main className="loginBg"><div className="loginCard">
 <div className="brandMark"><GraduationCap/></div>
 <div className="eyebrow">MREM ACADEMIC CONTENT CONTROL</div>
 <h1>Staff Sign In</h1><p>For authorized HODs, librarians and super administrators. Department and source permissions are enforced on the server.</p>
 <div className="notice"><LockKeyhole size={16}/> Private Windows Server portal. Use your staff username and password.</div>
 <form onSubmit={submit}>
  <label htmlFor="staff-user">Staff username</label><input id="staff-user" required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} />
  <label htmlFor="staff-password">Password</label><input id="staff-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
  {error&&<p className="error" role="alert">{error}</p>}
  <button className="primary full" disabled={loading} type="submit">{loading?'Signing in...':'Sign in to staff portal'}</button>
 </form>
 <small>This is not the student login. Contact the library administrator for staff access.</small>
 </div></main>;
}
