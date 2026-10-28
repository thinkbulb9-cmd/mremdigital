'use client';
import { useState } from 'react';
import { GraduationCap, LockKeyhole } from 'lucide-react';
export default function LoginForm(){
 const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 async function login(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');
  try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
   if(!r.ok){setError((await r.json()).error||'Login failed');return;}
   window.location.assign('/');
  }catch{setError('Cannot reach the server');}finally{setLoading(false);}
 }
 return <div className="loginCard"><div className="brandMark"><GraduationCap size={26}/></div>
 <div className="eyebrow">MREM RESOURCE PORTAL</div><h1>Welcome to the<br/>Digital Library.</h1>
 <p>Access academic materials from the college&apos;s connected storage.</p>
 <div className="notice"><LockKeyhole size={16}/> Pilot access only. Student SSO is required before a public launch.</div>
 <form onSubmit={login}><label htmlFor="password">Portal password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter pilot access password"/>
 {error&&<div className="error">{error}</div>}<button disabled={loading} className="primary full">{loading?'Signing in...':'Enter Library →'}</button></form>
 <small>Authorized college users only.</small></div>;
}
