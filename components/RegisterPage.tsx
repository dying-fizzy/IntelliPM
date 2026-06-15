import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import {
  User, Mail, Lock, ArrowRight, AlertCircle, RefreshCw, MailCheck, CheckCircle2,
} from 'lucide-react';
import SocialAuth from './SocialAuth';
import { supabase } from '../supabaseClient';

// ── Key for localStorage pending registration data ───────────────────────────
export const PENDING_REG_KEY = 'intellipm_pending_registration';

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

// ── Main Component ───────────────────────────────────────────────────────────
const RegisterPage: React.FC = () => {
  const { theme } = useTheme();

  // Two views: 'form' = credentials, 'verify' = check your email
  const [view, setView] = useState<'form' | 'verify'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const handleBlur = (field: 'name' | 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const validators = { name: validateName, email: validateEmail, password: validatePassword };
    setFieldErrors(prev => ({ ...prev, [field]: validators[field](formData[field]) }));
  };

  const handleFieldChange = (field: 'name' | 'email' | 'password', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const validators = { name: validateName, email: validateEmail, password: validatePassword };
      setFieldErrors(prev => ({ ...prev, [field]: validators[field](value) }));
    }
  };

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

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      // Use root URL — Supabase appends #access_token=... so no hash fragments here
      const redirectTo = window.location.origin;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateName(formData.name);
    const emailErr = validateEmail(formData.email);
    const passErr = validatePassword(formData.password);
    setFieldErrors({ name: nameErr, email: emailErr, password: passErr });
    setTouched({ name: true, email: true, password: true });
    if (nameErr || emailErr || passErr) return;

    setLoading(true);
    setError('');
    try {
      // Save registration data so EmailVerifiedPage can use it
      localStorage.setItem(PENDING_REG_KEY, JSON.stringify({
        name: formData.name,
        email: formData.email,
        organization_name: '',
        team_size: '1-10',
        role: '',
      }));

      // Use root URL — Supabase appends #access_token=... which would clash with HashRouter's #/route
      const redirectTo = window.location.origin;
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: formData.name },
        },
      });

      if (authError) throw authError;
      if (!data.user) throw new Error('Could not create account. Please try again.');

      if (data.session) {
        // Email confirmation is disabled in Supabase → already verified
        localStorage.setItem('token', data.session.access_token);
        window.location.hash = '/email-verified';
      } else {
        // Normal flow: verification email sent
        setView('verify');
        startResendCooldown();
      }
    } catch (err: any) {
      const msg: string = err.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        // Instead of showing an error, silently re-send the verification email
        try {
          const redirectTo = window.location.origin;
          await supabase.auth.resend({ type: 'signup', email: formData.email, options: { emailRedirectTo: redirectTo } });
          setView('verify');
          startResendCooldown();
        } catch {
          setError('An account with this email exists but is not yet verified. Please check your inbox or use "Resend Email".');
          setView('verify');
        }
      } else if (msg.toLowerCase().includes('rate limit')) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = passwordStrength(formData.password);

  // ── "Check your email" screen ────────────────────────────────────────────
  if (view === 'verify') {
    return (
      <div
        className="pt-32 pb-20 px-8 min-h-screen flex items-center justify-center w-full overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, rgba(var(--accent-rgb), 0.04) 0%, transparent 70%)' }}
      >
        <div className="w-full max-w-xl glass-panel-elevated p-12 relative text-center">
          {/* Icon */}
          <div
            className="w-24 h-24 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-8"
            style={{ boxShadow: '0 0 60px rgba(var(--accent-rgb), 0.2)' }}
          >
            <MailCheck size={42} className="text-[var(--accent)]" />
          </div>

          <h2 className="text-3xl font-black uppercase tracking-tight mb-3">Check Your Inbox</h2>
          <p className="text-[13px] mono opacity-50 mb-1">We sent a confirmation link to:</p>
          <p className="text-[16px] font-black mono mb-8" style={{ color: 'var(--accent)' }}>
            {formData.email}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold mono flex items-start gap-3 text-left">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-white/4 border border-white/8 rounded-sm p-5 text-left mb-8">
            <p className="text-[12px] mono opacity-70 leading-loose">
              <span className="font-black opacity-100 block mb-2">📧 What to do next:</span>
              <span className="flex items-start gap-2 mb-1"><CheckCircle2 size={12} className="shrink-0 mt-0.5 text-green-400" /> Open the email from <strong>IntelliPM / Supabase</strong></span>
              <span className="flex items-start gap-2 mb-1"><CheckCircle2 size={12} className="shrink-0 mt-0.5 text-green-400" /> Click the <strong>"Confirm your email"</strong> button</span>
              <span className="flex items-start gap-2"><CheckCircle2 size={12} className="shrink-0 mt-0.5 text-green-400" /> You'll be taken back here to finish setting up your account</span>
            </p>
          </div>

          {/* Resend & back */}
          <p className="text-[11px] mono opacity-40 mb-3">Didn't receive it? Check your spam folder, or:</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="flex items-center gap-2 mx-auto text-[12px] mono font-black uppercase tracking-widest transition-all disabled:opacity-30 mb-10"
            style={{ color: resendCooldown > 0 ? undefined : 'var(--accent)' }}
          >
            <RefreshCw size={12} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
          </button>

          <button
            type="button"
            onClick={() => { setView('form'); setError(''); }}
            className="text-[12px] mono opacity-40 hover:opacity-70 transition-opacity underline underline-offset-2"
          >
            ← Back to sign up form
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <div
      className="pt-32 pb-20 px-8 min-h-screen flex items-center justify-center w-full overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(var(--accent-rgb), 0.04) 0%, transparent 70%)' }}
    >
      <div className="w-full max-w-xl glass-panel-elevated p-12 relative">
        <div className="mb-10">
          <span className="ui-label text-[var(--accent)] mb-2 block tracking-[0.3em]">Get Started</span>
          <h2 className="text-4xl font-black mb-2 tracking-tighter uppercase">Create Account</h2>
          <p className="opacity-40 text-sm mono">Join IntelliPM and start managing your projects smarter.</p>
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold mono flex items-start gap-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
                placeholder="Full name"
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
                placeholder="Work email"
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
                placeholder="Password (min 8 chars, 1 uppercase, 1 number)"
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 ${
              theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
            }`}
          >
            {loading ? 'Creating account…' : <>Create Account <ArrowRight size={18} /></>}
          </button>
        </form>

        {/* Social Auth */}
        <div className="mt-10">
          <SocialAuth />
        </div>

        <div className="mt-10 pt-8 border-t border-[var(--border-color)] text-center">
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
