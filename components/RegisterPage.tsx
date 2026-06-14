import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import {
  User, Mail, Lock, Building, Users, ShieldCheck,
  ArrowRight, ArrowLeft, AlertCircle, CheckCircle2,
  RefreshCw, MailCheck,
} from 'lucide-react';
import SocialAuth from './SocialAuth';
import { supabase } from '../supabaseClient';

// ── Tiny ✓ inline component ──────────────────────────────────────────────────
function Check(props: any) { return <span {...props}>✓</span>; }

// ── Role metadata ────────────────────────────────────────────────────────────
const ROLE_INFO: Record<string, { icon: string; desc: string }> = {
  Admin: { icon: '👑', desc: 'Full system control. One per organization.' },
  'Project Manager': { icon: '📋', desc: 'Create & manage projects and team members.' },
  'Team Member': { icon: '👤', desc: 'Work on assigned tasks within projects.' },
};

// ── Validation helpers ───────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const NAME_REGEX  = /^[a-zA-Z\s'\-]+$/;

function validateName(name: string): string {
  if (!name.trim()) return 'Full name is required.';
  if (!NAME_REGEX.test(name.trim())) return 'Name must contain only letters, spaces, hyphens, or apostrophes.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  return '';
}

function validateEmail(email: string): string {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email (e.g. you@company.com).';
  return '';
}

function validatePassword(password: string): string {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return '';
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 3) return { score, label: 'Fair', color: '#f59e0b' };
  if (score === 4) return { score, label: 'Good', color: '#22c55e' };
  return { score, label: 'Strong', color: '#10b981' };
}

// ── FieldError ───────────────────────────────────────────────────────────────
const FieldError: React.FC<{ msg: string }> = ({ msg }) =>
  msg ? (
    <div className="flex items-center gap-1.5 mt-1.5 ml-1">
      <AlertCircle size={12} className="text-red-400 shrink-0" />
      <span className="text-[11px] font-bold mono text-red-400">{msg}</span>
    </div>
  ) : null;

// ── Key for localStorage pending registration data ───────────────────────────
export const PENDING_REG_KEY = 'intellipm_pending_registration';

// ── Main Component ───────────────────────────────────────────────────────────
const RegisterPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Steps: 1 = Credentials, 2 = Check Email, 3 = Workspace, 4 = Role
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingOrg, setCheckingOrg] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    organization_name: '',
    team_size: '1-10',
    role: '',
  });

  // Per-field errors and touched state for Step 1
  const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ── Step 1 real-time validation ──────────────────────────────────────────
  const handleBlur = (field: 'name' | 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const validators = { name: validateName, email: validateEmail, password: validatePassword };
    setFieldErrors(prev => ({ ...prev, [field]: validators[field](formData[field]) }));
  };

  const handleFieldChange = (field: 'name' | 'email' | 'password', value: string) => {
    updateField(field, value);
    if (touched[field]) {
      const validators = { name: validateName, email: validateEmail, password: validatePassword };
      setFieldErrors(prev => ({ ...prev, [field]: validators[field](value) }));
    }
  };

  // ── Cleanup cooldown timer on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  // ── Poll for session when user is waiting for email confirmation (Step 2) ──
  // This handles the case where the user clicks the link in another tab or
  // the same tab, and the SIGNED_IN event may have already fired.
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, 2000));
        if (cancelled) break;
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          localStorage.setItem('token', data.session.access_token);
          setStep(3);
          break;
        }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [step]);

  const startResendCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Check if org already has an admin ───────────────────────────────────
  const checkOrgAdminConflict = async (orgName: string): Promise<boolean> => {
    if (!orgName.trim()) return false;
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_name', orgName.trim())
      .eq('role', 'Admin')
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  };

  // ── Step 1 → trigger signUp → show "check email" screen ─────────────────
  const handleStep1Submit = async () => {
    const nameErr = validateName(formData.name);
    const emailErr = validateEmail(formData.email);
    const passErr = validatePassword(formData.password);
    setFieldErrors({ name: nameErr, email: emailErr, password: passErr });
    setTouched({ name: true, email: true, password: true });
    if (nameErr || emailErr || passErr) return;

    setLoading(true);
    setError('');
    try {
      // Save partial registration data so EmailVerifiedPage can finish it
      const pendingData = {
        name: formData.name,
        email: formData.email,
        // We do NOT store the password in localStorage
        organization_name: formData.organization_name,
        team_size: formData.team_size,
        role: formData.role,
      };
      localStorage.setItem(PENDING_REG_KEY, JSON.stringify(pendingData));

      // For HashRouter apps, the redirect URL must include the full hash path
      // so Supabase brings the user back to the right route after confirmation.
      const redirectTo = `${window.location.origin}${window.location.pathname}#/email-verified`;

      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: formData.name,
          },
        },
      });

      if (authError) throw authError;
      if (!data.user) throw new Error('Could not create account. Please try again.');

      // If Supabase auto-confirmed (email confirmations disabled in project settings),
      // skip the "check email" step and go straight to workspace
      if (data.session) {
        // Already confirmed — store the session and continue registration
        localStorage.setItem('token', data.session.access_token);
        setStep(3);
      } else {
        // Email confirmation email sent — show "check your inbox" screen
        setStep(2);
        startResendCooldown();
      }
    } catch (err: any) {
      localStorage.removeItem(PENDING_REG_KEY);
      const msg: string = err.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (msg.toLowerCase().includes('rate limit')) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend confirmation email ────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/email-verified`;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      startResendCooldown();
    } catch (err: any) {
      setError(err.message || 'Failed to resend confirmation email.');
    }
  };

  // ── Step 3 (Workspace) validation ────────────────────────────────────────
  const handleStep3Next = async () => {
    if (!formData.organization_name.trim()) {
      setError('Organization name is required.');
      return;
    }
    setError('');
    setStep(4);
  };

  // ── Step 4 (Role) → Final submit ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { handleStep1Submit(); return; }
    if (step < 4) { setStep(prev => prev + 1); return; }
    if (!formData.role) { setError('Please select a role.'); return; }

    setLoading(true);
    setError('');
    try {
      if (formData.role === 'Admin') {
        setCheckingOrg(true);
        const hasConflict = await checkOrgAdminConflict(formData.organization_name);
        setCheckingOrg(false);
        if (hasConflict) {
          setError(
            `An Admin already exists for "${formData.organization_name}". ` +
            `Please choose a different organization name or register as a different role.`
          );
          setLoading(false);
          return;
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Session expired. Please verify your email first.');

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: formData.name,
          email: formData.email,
          role: formData.role,
          organization_name: formData.organization_name,
        }, { onConflict: 'id' });
      if (profileError) console.error('Profile upsert error:', profileError);

      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .insert({
          full_name: formData.name,
          role: formData.role,
          department: formData.organization_name,
          seniority_level: 'junior',
          is_available: true,
        })
        .select('employee_id')
        .single();
      if (employeeError) console.error('Employee record error:', employeeError);

      const token = sessionData?.session?.access_token || '';
      const userData = {
        id: userId,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        organization_name: formData.organization_name,
        employee_id: employeeData?.employee_id || null,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', token);
      localStorage.removeItem(PENDING_REG_KEY);
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
      setCheckingOrg(false);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  // ── Step indicator ───────────────────────────────────────────────────────
  const STEPS = ['Credentials', 'Verify Email', 'Workspace', 'Role'];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-12">
      {[1, 2, 3, 4].map((s) => (
        <React.Fragment key={s}>
          <div className={`flex flex-col items-center gap-2 ${step >= s ? 'opacity-100' : 'opacity-20'}`}>
            <div
              className={`w-8 h-8 rounded-sm flex items-center justify-center font-black text-xs border transition-all ${
                step === s
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : step > s
                  ? 'bg-green-500/20 text-green-500 border-green-500'
                  : 'border-[var(--border-color)]'
              }`}
            >
              {step > s ? <Check size={14} /> : s}
            </div>
            <span className="text-[10px] mono uppercase font-bold tracking-widest text-center max-w-[60px] leading-tight">
              {STEPS[s - 1]}
            </span>
          </div>
          {s < 4 && (
            <div className={`flex-1 h-[1px] mx-2 transition-colors ${step > s ? 'bg-green-500' : 'bg-[var(--border-color)]'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const pwStrength = passwordStrength(formData.password);

  return (
    <div
      className="pt-32 pb-20 px-8 min-h-screen flex items-center justify-center w-full overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(var(--accent-rgb), 0.04) 0%, transparent 70%)' }}
    >
      <div className="w-full max-w-3xl glass-panel-elevated p-12 relative">
        <div className="mb-10">
          <span className="ui-label text-[var(--accent)] mb-2 block tracking-[0.3em]">Get Started</span>
          <h2 className="text-4xl font-black mb-2 tracking-tighter uppercase">Create Account</h2>
          <p className="opacity-40 text-sm mono">Set up your IntelliPM workspace in a few simple steps.</p>
        </div>

        {renderStepIndicator()}

        {/* Global error */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold mono flex items-start gap-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>

          {/* ── Step 1: Credentials ───────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
              {/* Full Name */}
              <div>
                <div className={`relative group ${fieldErrors.name && touched.name ? 'ring-1 ring-red-500/50 rounded-sm' : ''}`}>
                  <User
                    className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity ${fieldErrors.name && touched.name ? 'text-red-400 opacity-80' : 'opacity-50 group-focus-within:opacity-100'}`}
                    size={18}
                  />
                  <input
                    type="text"
                    id="reg-name"
                    placeholder="e.g. Jane Smith"
                    autoComplete="name"
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px]"
                    value={formData.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                  />
                </div>
                <FieldError msg={touched.name ? fieldErrors.name : ''} />
              </div>

              {/* Email */}
              <div>
                <div className={`relative group ${fieldErrors.email && touched.email ? 'ring-1 ring-red-500/50 rounded-sm' : ''}`}>
                  <Mail
                    className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity ${fieldErrors.email && touched.email ? 'text-red-400 opacity-80' : 'opacity-50 group-focus-within:opacity-100'}`}
                    size={18}
                  />
                  <input
                    type="email"
                    id="reg-email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px]"
                    value={formData.email}
                    onChange={e => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                  />
                </div>
                <FieldError msg={touched.email ? fieldErrors.email : ''} />
              </div>

              {/* Password */}
              <div>
                <div className={`relative group ${fieldErrors.password && touched.password ? 'ring-1 ring-red-500/50 rounded-sm' : ''}`}>
                  <Lock
                    className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity ${fieldErrors.password && touched.password ? 'text-red-400 opacity-80' : 'opacity-50 group-focus-within:opacity-100'}`}
                    size={18}
                  />
                  <input
                    type="password"
                    id="reg-password"
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    autoComplete="new-password"
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px]"
                    value={formData.password}
                    onChange={e => handleFieldChange('password', e.target.value)}
                    onBlur={() => handleBlur('password')}
                  />
                </div>
                {/* Password strength bar */}
                {formData.password && (
                  <div className="mt-2 ml-1">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className="flex-1 h-[3px] rounded-full transition-all duration-300"
                          style={{ background: i <= pwStrength.score ? pwStrength.color : 'rgba(255,255,255,0.08)' }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] mono font-bold" style={{ color: pwStrength.color }}>
                      {pwStrength.label}
                    </span>
                  </div>
                )}
                <FieldError msg={touched.password ? fieldErrors.password : ''} />
              </div>
            </div>
          )}

          {/* ── Step 2: Check Your Email ──────────────────────────────── */}
          {step === 2 && (
            <div className="animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="text-center py-6">
                {/* Animated envelope icon */}
                <div className="w-20 h-20 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-6"
                  style={{ boxShadow: '0 0 40px rgba(var(--accent-rgb), 0.15)' }}>
                  <MailCheck size={36} className="text-[var(--accent)]" />
                </div>

                <h3 className="text-2xl font-black uppercase tracking-wide mb-3">Check Your Inbox</h3>
                <p className="text-[13px] mono opacity-60 leading-relaxed max-w-md mx-auto">
                  We sent a confirmation email to:
                </p>
                <p className="text-[15px] font-black mono mt-1 mb-6" style={{ color: 'var(--accent)' }}>
                  {formData.email}
                </p>

                <div className="bg-white/4 border border-white/8 rounded-sm p-5 text-left max-w-md mx-auto mb-6">
                  <p className="text-[12px] mono opacity-70 leading-relaxed">
                    <span className="font-black opacity-100 block mb-2">📧 What to do next:</span>
                    1. Open the email from <span className="text-[var(--accent)] font-bold">Supabase / IntelliPM</span><br />
                    2. Click the <span className="font-black opacity-100">"Confirm your email"</span> button<br />
                    3. You'll be brought back here automatically to finish setting up your account
                  </p>
                </div>

                <p className="text-[11px] mono opacity-40 mb-2">Didn't receive it? Check your spam folder, or:</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="flex items-center gap-1.5 mx-auto text-[12px] mono font-black uppercase tracking-widest transition-all disabled:opacity-30"
                  style={{ color: resendCooldown > 0 ? undefined : 'var(--accent)' }}
                >
                  <RefreshCw size={12} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Workspace ─────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <div className="relative group">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10 group-focus-within:opacity-100 transition-opacity" size={18} />
                <input
                  type="text"
                  id="reg-org"
                  placeholder="e.g. Acme Corp"
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px]"
                  value={formData.organization_name}
                  onChange={e => updateField('organization_name', e.target.value)}
                />
              </div>
              <p className="text-[11px] mono opacity-40 pl-1">
                This links you to your company's environment. Exact name matters — it must match your colleagues' entries.
              </p>
              <div className="relative group">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10 group-focus-within:opacity-100 transition-opacity" size={18} />
                <select
                  id="reg-team-size"
                  className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-[14px] appearance-none cursor-pointer"
                  value={formData.team_size}
                  onChange={e => updateField('team_size', e.target.value)}
                >
                  <option value="1-10">Team Size: 1–10 members</option>
                  <option value="11-50">Team Size: 11–50 members</option>
                  <option value="51-200">Team Size: 51–200 members</option>
                  <option value="201+">Team Size: 201+ members</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Step 4: Role ──────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
              <p className="text-[12px] mono opacity-40 mb-6">
                Joining <span className="text-[var(--accent)] font-bold opacity-100">"{formData.organization_name}"</span>. Select your role:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Admin', 'Project Manager', 'Team Member'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    id={`role-${role.toLowerCase().replace(' ', '-')}`}
                    onClick={() => { updateField('role', role); setError(''); }}
                    className={`p-6 border rounded-sm transition-all flex flex-col items-center gap-3 group ${
                      formData.role === role
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-white/5 hover:border-white/20 bg-white/2'
                    }`}
                  >
                    <span className="text-2xl">{ROLE_INFO[role].icon}</span>
                    <ShieldCheck size={20} className={formData.role === role ? 'text-[var(--accent)]' : 'opacity-20'} />
                    <span className={`text-[13px] font-black uppercase tracking-widest text-center ${formData.role === role ? 'text-[var(--accent)]' : 'opacity-40'}`}>
                      {role}
                    </span>
                    <span className={`text-[10px] mono text-center leading-relaxed ${formData.role === role ? 'opacity-70' : 'opacity-20'}`}>
                      {ROLE_INFO[role].desc}
                    </span>
                  </button>
                ))}
              </div>
              {formData.role === 'Admin' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] mono flex items-start gap-2">
                  <span className="shrink-0">⚠</span>
                  <span>Only one Admin is allowed per organization. If an Admin already exists for "{formData.organization_name}", your registration will be blocked.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation Buttons ────────────────────────────────────── */}
          <div className="flex gap-4 pt-4">
            {step > 1 && step !== 2 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 glass-button"
              >
                <ArrowLeft size={18} /> Back
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={handleStep1Submit}
                disabled={loading}
                className={`flex-[2] py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
                }`}
              >
                {loading ? 'Sending verification...' : <>Continue <ArrowRight size={18} /></>}
              </button>
            )}

            {/* Step 2: no action button — user must click the email link */}
            {step === 2 && (
              <div className="flex-1 py-4 text-center text-[11px] mono opacity-40 uppercase tracking-widest">
                Waiting for email confirmation…
              </div>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleStep3Next}
                className={`flex-[2] py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
                }`}
              >
                Proceed to Role <ArrowRight size={18} />
              </button>
            )}

            {step === 4 && (
              <button
                type="submit"
                disabled={loading || checkingOrg || !formData.role}
                className={`flex-[2] py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  theme === 'dark' ? 'bg-[var(--accent)] text-black' : 'bg-black text-white'
                }`}
              >
                {loading || checkingOrg ? 'Creating Account...' : <>Create Account <Check size={18} /></>}
              </button>
            )}
          </div>
        </form>

        {step === 1 && (
          <div className="mt-10">
            <SocialAuth />
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-[var(--border-color)] text-center">
          <p className="text-[14px] mono uppercase opacity-40">
            Already have an account?
            <Link to="/login" className="ml-2 font-black text-[var(--accent)] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
