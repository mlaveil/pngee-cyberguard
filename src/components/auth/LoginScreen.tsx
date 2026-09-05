import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

export const LoginScreen: React.FC = () => {
  const { refreshAuth, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api.login(email.trim(), password);
      if (result.mfaRequired && result.mfaChallenge) { setMfaChallenge(result.mfaChallenge); setCode(''); return; }
      await refreshAuth();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  };

  const submitMfa = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await api.verifyMfa(mfaChallenge!, useRecovery ? undefined : code.trim(), useRecovery ? code.trim() : undefined); setMfaChallenge(null); setCode(''); await refreshAuth(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to verify MFA'); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
    <form onSubmit={mfaChallenge ? submitMfa : submitPassword} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-8"><div className="rounded-xl bg-slate-800 p-3"><ShieldCheck className="h-7 w-7" /></div><div><h1 className="text-xl font-bold text-white">PNGee CyberGuard</h1><p className="text-sm text-slate-400">{mfaChallenge ? 'Multi-factor authentication' : 'Secure administrator sign-in'}</p></div></div>
      {!mfaChallenge ? <>
        <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="username" required className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white mb-5 outline-none focus:border-slate-400" />
        <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white mb-5 outline-none focus:border-slate-400" />
      </> : <>
        <p className="text-sm text-slate-400 mb-4">Enter the six-digit code from your authenticator app.</p>
        <label className="block text-sm font-medium text-slate-300 mb-2">{useRecovery ? 'Recovery code' : 'Authenticator code'}</label>
        <input value={code} onChange={e=>setCode(e.target.value)} inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code" autoFocus required className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-3 text-white mb-4 tracking-widest outline-none focus:border-slate-400" />
        <button type="button" onClick={()=>{setUseRecovery(!useRecovery);setCode('');}} className="text-xs text-slate-400 hover:text-white mb-5">{useRecovery ? 'Use authenticator code' : 'Use recovery code'}</button>
      </>}
      {error && <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</div>}
      <button disabled={busy || isLoading} className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? (mfaChallenge ? 'Verifying…' : 'Signing in…') : (mfaChallenge ? 'Verify and sign in' : 'Sign in')}</button>
      {mfaChallenge && <button type="button" onClick={()=>{setMfaChallenge(null);setCode('');setError('');}} className="w-full mt-3 text-sm text-slate-400 hover:text-white">Back to sign in</button>}
    </form>
  </div>;
};
