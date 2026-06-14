import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { Mail, Lock, ArrowRight, UserCheck, Shield, Crown, AlertCircle } from 'lucide-react';
import SocialAuth from './SocialAuth';
import { supabase } from '../supabaseClient';

// ── Validation helpers ───────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email: string): string {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address (e.g. you@company.com).';
  return '';
}

function validatePassword(password: string): string {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return '';
}

// ── FieldError component ─────────────────────────────────────────────────────
const FieldError: React.FC<{ msg: string }> = ({ msg }) =>
  msg ? (
    <div className="flex items-center gap-1.5 mt-1.5 ml-1">
      <AlertCircle size={12} className="text-red-400 shrink-0" />
      <span className="text-[11px] font-bold mono text-red-400">{msg}</span>
    </div>
  ) : null;

// ── AuthPage ─────────────────────────────────────────────────────────────────
const AuthPage: React.FC = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Project Manager' | 'Team Member' | 'Admin'>('Project Manager');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: '', password: '' });

  // Per-field validation errors (shown on blur or submit attempt)
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === 'email') setFieldErrors(prev => ({ ...prev, email: validateEmail(formData.email) }));
    if (field === 'password') setFieldErrors(prev => ({ ...prev, password: validatePassword(formData.password) }));
  };

  const handleChange = (field: 'email' | 'password', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error as user types if already touched
    if (touched[field]) {
      if (field === 'email') setFieldErrors(prev => ({ ...prev, email: validateEmail(value) }));
      if (field === 'password') setFieldErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Touch all fields and validate
    const emailErr = validateEmail(formData.email);
    const passwordErr = validatePassword(formData.password);
    setFieldErrors({ email: emailErr, password: passwordErr });
    setTouched({ email: true, password: true });
    if (emailErr || passwordErr) return;

    setLoading(true);
    setError('');

    try {
      // 1. Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      // 2. Fetch the user's profile to get their actual registered role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, display_name, email')
        .eq('id', data.user.id)
        .single();

      // 3. If profile cannot be fetched, abort login immediately
      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error('Your account profile could not be found. Please contact support or register again.');
      }

      // 4. STRICT role check — the selected role MUST match the profile's stored role.
      const actualRole: string = profile.role;
      if (actualRole !== selectedRole) {
        await supabase.auth.signOut();
        throw new Error(
          `Access denied. This account is registered as "${actualRole}". ` +
          `You selected "${selectedRole}". Please choose the correct role or use the right account.`
        );
      }

      // 5. Build user session and store it
      const userData = {
        id: data.user.id,
        name: profile.display_name || data.user.email?.split('@')[0],
        email: data.user.email,
        role: actualRole,
      };

      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', data.session?.access_token || '');

      // 6. Navigate to the app
      navigate('/projects');
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="pt-32 pb-20 px-8 min-h-screen flex items-center justify-center w-full"
      style={{ background: 'radial-gradient(ellipse at center, rgba(var(--accent-rgb), 0.04) 0%, transparent 70%)' }}
    >
      <div className="w-full max-w-xl glass-panel-elevated p-12">
        <div className="mb-10">
          <span className="ui-label text-[var(--accent)] mb-2 block tracking-[0.3em]">Welcome Back</span>
          <h2 className="text-4xl font-black mb-2 tracking-tighter uppercase">Sign In</h2>
          <p className="opacity-40 text-sm mono">Sign in to your IntelliPM workspace.</p>
        </div>

        {/* Role Selection Tabs */}
        <div className="flex gap-2 mb-8">
          {(['Project Manager', 'Team Member', 'Admin'] as const).map((role) => {
            const Icon = role === 'Project Manager' ? Shield : role === 'Team Member' ? UserCheck : Crown;
            const label = role === 'Project Manager' ? 'Project Manager' : role === 'Team Member' ? 'Team Member' : 'Admin';
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                  selectedRole === role
                    ? 'bg-[var(--accent)] text-black border border-[var(--accent)]'
                    : 'bg-white/5 border border-[var(--border-color)] opacity-70 hover:opacity-100 hover:border-[var(--accent)]/50 hover:bg-white/10'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>

        {/* Global error (auth errors only, not field validation) */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] font-bold mono flex items-start gap-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mb-10" noValidate>
          {/* Email */}
          <div>
            <div className={`relative group transition-all ${fieldErrors.email && touched.email ? 'ring-1 ring-red-500/50 rounded-sm' : ''}`}>
              <Mail
                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-opacity ${fieldErrors.email && touched.email ? 'text-red-400 opacity-80 z-10' : 'opacity-50 z-10 group-focus-within:opacity-100'}`}
                size={18}
              />
              <input
                type="email"
                id="login-email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-xs"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
              />
            </div>
            <FieldError msg={touched.email ? fieldErrors.email : ''} />
          </div>

          {/* Password */}
          <div>
            <div className={`relative group transition-all ${fieldErrors.password && touched.password ? 'ring-1 ring-red-500/50 rounded-sm' : ''}`}>
              <Lock
                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-opacity ${fieldErrors.password && touched.password ? 'text-red-400 opacity-80 z-10' : 'opacity-50 z-10 group-focus-within:opacity-100'}`}
                size={18}
              />
              <input
                type="password"
                id="login-password"
                placeholder="Your password"
                autoComplete="current-password"
                required
                className="w-full pl-12 pr-4 py-4 rounded-sm glass-input mono text-xs"
                value={formData.password}
                onChange={e => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
              />
            </div>
            <FieldError msg={touched.password ? fieldErrors.password : ''} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 mt-2 rounded-sm font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-[var(--accent)] text-black hover:opacity-90'
                : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90'
            }`}
          >
            {loading
              ? 'Signing in...'
              : `Sign In as ${selectedRole === 'Project Manager' ? 'PM' : selectedRole === 'Team Member' ? 'Member' : 'Admin'}`}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <SocialAuth />

        <div className="mt-12 pt-8 border-t border-[var(--border-color)] text-center">
          <p className="text-[11px] mono uppercase opacity-40">
            Don't have an account?
            <Link to="/register" className="ml-2 font-black text-[var(--accent)] hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
