import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Building, Users, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useTheme } from './ThemeContext';
import { PENDING_REG_KEY } from './RegisterPage';

// ── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_INFO: Record<string, { icon: string; desc: string }> = {
  Admin: { icon: '👑', desc: 'Full system control. One per organization.' },
  'Project Manager': { icon: '📋', desc: 'Create & manage projects and team members.' },
  'Team Member': { icon: '👤', desc: 'Work on assigned tasks within projects.' },
};

type Stage = 'loading' | 'workspace' | 'role' | 'saving' | 'done' | 'error';

const EmailVerifiedPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState('');
  const [pendingData, setPendingData] = useState<{
    name: string;
    email: string;
    organization_name: string;
    team_size: string;
    role: string;
  } | null>(null);

  // Local form state for steps on this page
  const [orgName, setOrgName] = useState('');
  const [teamSize, setTeamSize] = useState('1-10');
  const [selectedRole, setSelectedRole] = useState('');
  const [orgError, setOrgError] = useState('');
  const [checkingOrg, setCheckingOrg] = useState(false);

  // ── On mount: wait for Supabase to process the token, then load pending data ─
  // Supabase may take a moment to exchange the token from the URL. We retry
  // getSession up to 10 times (every 1s) before giving up.
  useEffect(() => {
    const init = async () => {
      let session = null;

      // Retry loop: Supabase processes the email confirmation token
      // asynchronously. Give it up to 10 seconds.
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          session = sessionData.session;
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!session) {
        setError('This verification link has expired or already been used. Please request a new one.');
        setStage('error');
        return;
      }

      try {
        localStorage.setItem('token', session.access_token);

        // Load pending registration data saved during Step 1
        const saved = localStorage.getItem(PENDING_REG_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          setPendingData(data);
          setOrgName(data.organization_name || '');
          setTeamSize(data.team_size || '1-10');
          setSelectedRole(data.role || '');
        }

        setStage('workspace');
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
        setStage('error');
      }
    };

    init();
  }, []);

  // ── Resend verification email from error screen ──────────────────────────
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const handleResendFromError = async () => {
    const saved = localStorage.getItem(PENDING_REG_KEY);
    if (!saved) { navigate('/register'); return; }
    const { email } = JSON.parse(saved);
    if (!email) { navigate('/register'); return; }
    setResending(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/email-verified`;
      await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectTo } });
      setResendDone(true);
    } catch (_) {}
    finally { setResending(false); }
  };

  // ── Check if org already has an Admin ────────────────────────────────────
  const checkOrgAdminConflict = async (org: string): Promise<boolean> => {
    if (!org.trim()) return false;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_name', org.trim())
      .eq('role', 'Admin')
      .limit(1);
    return (data?.length ?? 0) > 0;
  };

  // ── Workspace → Role ─────────────────────────────────────────────────────
  const handleWorkspaceNext = () => {
    if (!orgName.trim()) {
      setOrgError('Organization name is required.');
      return;
    }
    setOrgError('');
    setStage('role');
  };

  // ── Final: save profile ──────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!selectedRole) return;

    setStage('saving');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Session not found. Please try signing in.');

      // Admin conflict check
      if (selectedRole === 'Admin') {
        setCheckingOrg(true);
        const hasConflict = await checkOrgAdminConflict(orgName);
        setCheckingOrg(false);
        if (hasConflict) {
          setError(`An Admin already exists for "${orgName}". Please choose a different org name or a different role.`);
          setStage('role');
          return;
        }
      }

      const name = pendingData?.name || sessionData?.session?.user?.email?.split('@')[0] || 'User';
      const email = pendingData?.email || sessionData?.session?.user?.email || '';

      // Upsert profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: name,
          email,
          role: selectedRole,
          organization_name: orgName.trim(),
        }, { onConflict: 'id' });
      if (profileErr) console.error('Profile upsert error:', profileErr);

      // Create employee record
      const { data: employeeData, error: employeeErr } = await supabase
        .from('employees')
        .insert({
          full_name: name,
          role: selectedRole,
          department: orgName.trim(),
          seniority_level: 'junior',
          is_available: true,
        })
        .select('employee_id')
        .single();
      if (employeeErr) console.error('Employee record error:', employeeErr);

      const userData = {
        id: userId,
        name,
        email,
        role: selectedRole,
        organization_name: orgName.trim(),
        employee_id: employeeData?.employee_id || null,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', sessionData?.session?.access_token || '');
      localStorage.removeItem(PENDING_REG_KEY);

      setStage('done');
      setTimeout(() => navigate('/projects'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration.');
      setStage('role');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="pt-32 pb-20 px-8 min-h-screen flex items-center justify-center w-full"
      style={{ background: 'radial-gradient(ellipse at center, rgba(var(--accent-rgb), 0.06) 0%, transparent 70%)' }}
    >
      <div className="w-full max-w-2xl glass-panel-elevated p-12">

        {/* ── Loading ── */}
        {stage === 'loading' && (
          <div className="text-center py-10">
            <Loader2 size={48} className="mx-auto mb-6 animate-spin text-[var(--accent)]" />
            <h2 className="text-2xl font-black uppercase tracking-wide mb-2">Confirming Your Email</h2>
            <p className="text-[13px] mono opacity-50">Please wait while we verify your account…</p>
          </div>
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <div className="text-center py-10">
            <AlertCircle size={48} className="mx-auto mb-6 text-red-400" />
            <h2 className="text-2xl font-black uppercase tracking-wide mb-4">Verification Failed</h2>
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold mono mb-8 text-left">
              {error}
            </div>
            {resendDone ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-[13px] mono mb-6 flex items-center gap-2 justify-center">
                <CheckCircle2 size={16} /> New verification email sent! Check your inbox.
              </div>
            ) : (
              <button
                onClick={handleResendFromError}
                disabled={resending}
                className="mb-4 flex items-center gap-2 mx-auto px-6 py-3 rounded-sm font-black text-xs uppercase tracking-[0.2em] bg-[var(--accent)] text-black disabled:opacity-50"
              >
                <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
            )}
            <button
              onClick={() => navigate('/register')}
              className={`px-8 py-3 rounded-sm font-black text-xs uppercase tracking-[0.2em] glass-button`}
            >
              Back to Register
            </button>
          </div>
        )}

        {/* ── Workspace step ── */}
        {stage === 'workspace' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 size={22} className="text-green-400" />
                <span className="text-green-400 font-black text-sm mono uppercase tracking-widest">Email Verified!</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight mb-1">Set Up Your Workspace</h2>
              <p className="text-[13px] mono opacity-40">
                Welcome{pendingData?.name ? `, ${pendingData.name}` : ''}! Now let's set up your organization.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="relative group">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10 group-focus-within:opacity-100 transition-opacity" size={18} />
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={orgName}
                  onChange={e => { setOrgName(e.target.value); setOrgError(''); }}
                  className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px]"
                />
              </div>
              {orgError && (
                <div className="flex items-center gap-1.5 ml-1">
                  <AlertCircle size={12} className="text-red-400 shrink-0" />
                  <span className="text-[11px] font-bold mono text-red-400">{orgError}</span>
                </div>
              )}
              <p className="text-[11px] mono opacity-40 pl-1">
                This links you to your company's environment. Exact name matters.
              </p>

              <div className="relative group">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10 group-focus-within:opacity-100 transition-opacity" size={18} />
                <select
                  className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px] appearance-none cursor-pointer"
                  value={teamSize}
                  onChange={e => setTeamSize(e.target.value)}
                >
                  <option value="1-10">Team Size: 1–10 members</option>
                  <option value="11-50">Team Size: 11–50 members</option>
                  <option value="51-200">Team Size: 51–200 members</option>
                  <option value="201+">Team Size: 201+ members</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleWorkspaceNext}
              className={`w-full py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              Proceed to Role Selection →
            </button>
          </div>
        )}

        {/* ── Role step ── */}
        {stage === 'role' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="mb-8">
              <h2 className="text-3xl font-black uppercase tracking-tight mb-1">Choose Your Role</h2>
              <p className="text-[13px] mono opacity-40">
                Joining <span className="text-[var(--accent)] font-black opacity-100">"{orgName}"</span>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold mono flex items-start gap-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {['Admin', 'Project Manager', 'Team Member'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => { setSelectedRole(role); setError(''); }}
                  className={`p-6 border rounded-sm transition-all flex flex-col items-center gap-3 ${
                    selectedRole === role
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-white/5 hover:border-white/20 bg-white/2'
                  }`}
                >
                  <span className="text-2xl">{ROLE_INFO[role].icon}</span>
                  <ShieldCheck size={20} className={selectedRole === role ? 'text-[var(--accent)]' : 'opacity-20'} />
                  <span className={`text-[13px] font-black uppercase tracking-widest text-center ${selectedRole === role ? 'text-[var(--accent)]' : 'opacity-40'}`}>
                    {role}
                  </span>
                  <span className={`text-[10px] mono text-center leading-relaxed ${selectedRole === role ? 'opacity-70' : 'opacity-20'}`}>
                    {ROLE_INFO[role].desc}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => { setStage('workspace'); setError(''); }}
                className="flex-1 py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 glass-button"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={!selectedRole || checkingOrg}
                className={`flex-[2] py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  theme === 'dark' ? 'bg-[var(--accent)] text-black' : 'bg-black text-white'
                }`}
              >
                {checkingOrg ? 'Checking...' : 'Create Account ✓'}
              </button>
            </div>
          </div>
        )}

        {/* ── Saving ── */}
        {stage === 'saving' && (
          <div className="text-center py-10">
            <Loader2 size={48} className="mx-auto mb-6 animate-spin text-[var(--accent)]" />
            <h2 className="text-2xl font-black uppercase tracking-wide mb-2">Creating Your Account</h2>
            <p className="text-[13px] mono opacity-50">Setting up your profile and workspace…</p>
          </div>
        )}

        {/* ── Done ── */}
        {stage === 'done' && (
          <div className="text-center py-10">
            <CheckCircle2 size={64} className="mx-auto mb-6 text-green-400 animate-in zoom-in-50 duration-300" />
            <h2 className="text-2xl font-black uppercase tracking-wide mb-2 text-green-400">Account Created!</h2>
            <p className="text-[13px] mono opacity-50">Redirecting you to your projects…</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default EmailVerifiedPage;
