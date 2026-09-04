import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try { await login(email.trim(), password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in'); }
  };

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-8"><div className="rounded-xl bg-slate-800 p-3"><ShieldCheck className="h-7 w-7" /></div><div><h1 className="text-xl font-bold text-white">PNGee CyberGuard</h1><p className="text-sm text-slate-400">Secure administrator sign-in</p></div></div>
      <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" required className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white mb-5 outline-none focus:border-slate-400" />
      <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
      <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white mb-5 outline-none focus:border-slate-400" />
      {error && <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>}
      <button disabled={isLoading} className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{isLoading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </div>;
};
