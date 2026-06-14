
import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import {
  User, Briefcase, Activity, Settings, Camera, X, Check,
  Plus, ChevronDown, Lock, Eye, EyeOff, Moon, Sun,
  Bell, BellOff, Cpu, CheckCircle, Clock, FolderOpen,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ─────────────────────────────────────────────────────
   TAB BUTTON
───────────────────────────────────────────────────── */
const TabButton = ({ id, label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-6 py-4 transition-all border-l-2 text-left ${active
      ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]'
      : 'border-transparent opacity-50 hover:opacity-100 hover:bg-white/5'
    }`}
  >
    <Icon size={18} />
    <span className="text-[13px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

/* ─────────────────────────────────────────────────────
   SKILL DB TYPE
───────────────────────────────────────────────────── */
interface DbSkill {
  id?: string;
  employee_id: string;
  skill_name: string;
  skill_level: number;      // 1–10
  years_experience: number;
  category: 'core' | 'common';
  _deleted?: boolean;
  _isNew?: boolean;
}

const CURATED_SKILLS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  // Frontend
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'HTML/CSS', 'Tailwind CSS', 'Redux', 'Zustand',
  // Backend & DB
  'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'Spring Boot', '.NET', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL',
  // DevOps & Cloud
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform', 'CI/CD', 'Linux', 'Nginx',
  // AI & Data
  'Machine Learning', 'Data Science', 'PyTorch', 'TensorFlow', 'Pandas', 'OpenAI API', 'LangChain',
  // Other
  'UI/UX Design', 'Figma', 'System Architecture', 'Agile/Scrum', 'Cybersecurity', 'Blockchain'
].sort();

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────── */
const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    title: '',
    bio: '',
    avatarUrl: ''
  });

  // Skills state — backed by employee_skills table
  const [dbSkills, setDbSkills] = useState<DbSkill[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsMsg, setSkillsMsg] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState(5);
  const [newSkillYears, setNewSkillYears] = useState(0);
  const [newSkillCategory, setNewSkillCategory] = useState<'core' | 'common'>('common');

  // Activity state
  const [activityStats, setActivityStats] = useState({
    completedTasks: 0,
    activeTasks: 0,
    totalProjects: 0,
  });
  const [activityLoading, setActivityLoading] = useState(true);

  // Settings state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // ── Load profile data ──
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setProfile({
            name: data.display_name || '',
            email: data.email || user.email || '',
            title: data.job_title || '',
            bio: data.bio || '',
            avatarUrl: data.avatar_url || ''
          });

          // ── Load skills from employee_skills table ──
          const { data: empData } = await supabase
            .from('employees')
            .select('employee_id, full_name')
            .ilike('full_name', data.display_name || '');

          const empId = empData?.[0]?.employee_id || null;
          setMyEmployeeId(empId);

          if (empId) {
            const { data: skillData } = await supabase
              .from('employee_skills')
              .select('*')
              .eq('employee_id', empId);
            if (skillData) setDbSkills(skillData);
          }
          setSkillsLoading(false);
        }
      } catch (err) {
        console.error('Profile load error:', err);
      }
    };
    fetchProfile();
  }, []);

  // ── Load activity stats ──
  useEffect(() => {
    const fetchActivity = async () => {
      setActivityLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) { setActivityLoading(false); return; }

      try {
        const [completedRes, activeRes, projectsRes] = await Promise.all([
          supabase.from('tasks').select('*', { count: 'exact', head: true })
            .eq('assigned_to', user.id)
            .in('status', ['Completed', 'Done']),
          supabase.from('tasks').select('*', { count: 'exact', head: true })
            .eq('assigned_to', user.id)
            .not('status', 'in', '("Completed","Done")'),
          supabase.from('project_members').select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        setActivityStats({
          completedTasks: completedRes.count || 0,
          activeTasks: activeRes.count || 0,
          totalProjects: projectsRes.count || 0,
        });
      } catch (err) {
        console.error('Activity stats error:', err);
      } finally {
        setActivityLoading(false);
      }
    };
    fetchActivity();
  }, []);

  // ── Save profile ──
  const saveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setSaveMessage('');

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: profile.name,
          email: profile.email,
          job_title: profile.title,
          bio: profile.bio,
          avatar_url: profile.avatarUrl,
        });

      if (error) throw error;

      // Update localStorage name
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.name = profile.name;
      localStorage.setItem('user', JSON.stringify(storedUser));

      setSaveMessage('Profile saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMessage('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Image upload ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setProfile(prev => ({ ...prev, avatarUrl: url }));
    }
  };

  // ── Skills (DB-backed) ──
  const addSkillLocal = () => {
    const name = newSkillName.trim();
    if (!name) return;
    if (dbSkills.some(s => !s._deleted && s.skill_name.toLowerCase() === name.toLowerCase())) return;
    const empId = myEmployeeId || '__pending__';
    setDbSkills(prev => [...prev, {
      employee_id: empId,
      skill_name: name,
      skill_level: newSkillLevel,
      years_experience: newSkillYears,
      category: newSkillCategory,
      _isNew: true,
    }]);
    setNewSkillName('');
    setNewSkillLevel(5);
    setNewSkillYears(0);
  };

  const removeSkillLocal = (name: string) => {
    setDbSkills(prev => prev.map(s => s.skill_name === name ? { ...s, _deleted: true } : s));
  };

  const updateSkillLevel = (name: string, level: number) => {
    setDbSkills(prev => prev.map(s => s.skill_name === name ? { ...s, skill_level: level } : s));
  };

  const saveSkills = async () => {
    if (!myEmployeeId) {
      setSkillsMsg('No employee record found. Please contact an admin.');
      return;
    }
    setSkillsSaving(true);
    setSkillsMsg('');
    try {
      // Delete removed skills
      const toDelete = dbSkills.filter(s => s._deleted && s.id);
      for (const s of toDelete) {
        await supabase.from('employee_skills').delete().eq('id', s.id!);
      }
      // Upsert active skills
      const toUpsert = dbSkills
        .filter(s => !s._deleted)
        .map(({ _isNew, _deleted, ...s }) => ({ ...s, employee_id: myEmployeeId }));
      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('employee_skills')
          .upsert(toUpsert, { onConflict: 'employee_id,skill_name' });
        if (error) throw error;
      }
      // Re-fetch fresh state
      const { data: fresh } = await supabase
        .from('employee_skills')
        .select('*')
        .eq('employee_id', myEmployeeId);
      if (fresh) setDbSkills(fresh);
      // Update profile.skills_completed if >= 3 skills
      const activeSkillsCount = toUpsert.length + (fresh?.length || 0) - toDelete.length;
      if (activeSkillsCount >= 3) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ skills_completed: true }).eq('id', user.id);
        }
      }

      setSkillsMsg('Skills saved successfully!');
      setTimeout(() => setSkillsMsg(''), 3000);
    } catch (err: any) {
      setSkillsMsg('Failed to save skills. Please try again.');
    } finally {
      setSkillsSaving(false);
    }
  };

  const levelColor = (level: number) => {
    if (level >= 8) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (level >= 5) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  };

  const levelLabel = (level: number) => {
    if (level >= 8) return 'Expert';
    if (level >= 5) return 'Mid';
    return 'Beginner';
  };

  // ── Password change ──
  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordSuccess('Password updated successfully!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    }
  };

  // ── Input class ──
  const inputClass = "w-full p-4 glass-input text-[14px] mono font-bold rounded-sm";

  return (
    <div className="flex flex-col md:flex-row min-h-[600px] gap-8 animate-in fade-in duration-700 w-full pb-24">

      {/* ── Sidebar Nav ── */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="glass-panel h-full py-6">
          <div className="px-6 mb-8">
            <span className="ui-label block tracking-[0.2em] opacity-40 mb-2">My Account</span>
            <h2 className="text-xl font-black uppercase tracking-tighter">Profile</h2>
          </div>
          <nav className="space-y-1">
            <TabButton id="profile" label="Profile" icon={User} active={activeTab === 'profile'} onClick={setActiveTab} />
            <TabButton id="skills" label="Work & Skills" icon={Briefcase} active={activeTab === 'skills'} onClick={setActiveTab} />
            <TabButton id="activity" label="Activity" icon={Activity} active={activeTab === 'activity'} onClick={setActiveTab} />
            <TabButton id="settings" label="Settings" icon={Settings} active={activeTab === 'settings'} onClick={setActiveTab} />
          </nav>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-grow glass-panel p-10 min-h-[600px]">

        {/* ═══════════════ PROFILE TAB ═══════════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-10 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-6">
              <div>
                <h3 className="text-2xl font-black uppercase mb-2">User Profile</h3>
                <p className="text-[13px] opacity-60 mono">Manage your personal information.</p>
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="bg-[var(--accent)] text-black px-6 py-3 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Check size={14} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {saveMessage && (
              <div className={`p-3 text-[12px] font-bold mono ${saveMessage.includes('success') ? 'text-green-400 bg-green-500/10 border border-green-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
                {saveMessage}
              </div>
            )}

            <div className="flex gap-8 items-start">
              {/* Avatar */}
              <div className="relative group cursor-pointer shrink-0">
                <div className="w-32 h-32 rounded-sm bg-black/10 dark:bg-white/10 overflow-hidden border border-[var(--border-color)] flex items-center justify-center">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="opacity-20" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-sm">
                  <Camera size={24} />
                </div>
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} accept="image/*" />
                <p className="text-[9px] mono opacity-30 text-center mt-2 uppercase">Click to upload</p>
              </div>

              {/* Fields */}
              <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase opacity-60">Full Name</label>
                  <input
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase opacity-60">Email</label>
                  <input
                    value={profile.email}
                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                    placeholder="Your email address"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase opacity-60">Job Title</label>
                  <input
                    value={profile.title}
                    onChange={e => setProfile({ ...profile, title: e.target.value })}
                    placeholder="e.g. Frontend Developer"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-full space-y-2">
                  <label className="text-[11px] font-bold uppercase opacity-60">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    className={`${inputClass} h-24 resize-none`}
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ WORK & SKILLS TAB ═══════════════ */}
        {activeTab === 'skills' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-6">
              <div>
                <h3 className="text-2xl font-black uppercase mb-1">My Skills</h3>
                <p className="text-[13px] opacity-60 mono">Manage your skills — saved to your employee profile.</p>
              </div>
              <button
                onClick={saveSkills}
                disabled={skillsSaving || !myEmployeeId}
                className="bg-[var(--accent)] text-black px-6 py-3 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-30 rounded-sm"
              >
                <Check size={14} /> {skillsSaving ? 'Saving...' : 'Save Skills'}
              </button>
            </div>

            {skillsMsg && (
              <div className={`p-3 text-[12px] font-bold mono rounded-sm ${
                skillsMsg.includes('success') ? 'text-green-400 bg-green-500/10 border border-green-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}>{skillsMsg}</div>
            )}

            {!myEmployeeId && !skillsLoading && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] mono rounded-sm">
                ⚠ No employee record linked to your account. Ask an admin to create one.
              </div>
            )}

            {/* Add skill row */}
            <div className="p-5 glass-panel border-dashed space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Add Skill</p>
              <div className="flex flex-wrap gap-3">
                <select
                  value={newSkillName}
                  onChange={e => setNewSkillName(e.target.value)}
                  className="flex-1 min-w-[160px] py-2.5 px-4 glass-input text-[13px] mono rounded-sm appearance-none cursor-pointer"
                >
                  <option value="">— Select a skill —</option>
                  {CURATED_SKILLS.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
                <select
                  value={newSkillCategory}
                  onChange={e => setNewSkillCategory(e.target.value as 'core' | 'common')}
                  className="py-2.5 px-3 glass-input text-[13px] mono rounded-sm appearance-none cursor-pointer"
                >
                  <option value="core">Core</option>
                  <option value="common">Common</option>
                </select>
                <div className="flex items-center gap-2 py-2.5 px-4 border border-[var(--border-color)] rounded-sm">
                  <span className="text-[11px] mono opacity-40">Lvl</span>
                  <input
                    type="range" min={1} max={10}
                    value={newSkillLevel}
                    onChange={e => setNewSkillLevel(parseInt(e.target.value))}
                    className="w-24 accent-[var(--accent)]"
                  />
                  <span className="text-[13px] font-black mono w-5">{newSkillLevel}</span>
                </div>
                <div className="flex items-center gap-2 py-2.5 px-4 border border-[var(--border-color)] rounded-sm">
                  <span className="text-[11px] mono opacity-40">Yrs</span>
                  <input
                    type="number" min={0} step={0.5}
                    value={newSkillYears}
                    onChange={e => setNewSkillYears(parseFloat(e.target.value) || 0)}
                    className="w-14 bg-transparent outline-none text-[13px] mono font-bold text-center"
                  />
                </div>
                <button
                  onClick={addSkillLocal}
                  disabled={!newSkillName.trim()}
                  className="py-2.5 px-5 bg-[var(--accent)] text-black font-black text-[11px] uppercase tracking-widest rounded-sm hover:opacity-90 disabled:opacity-30 transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Skill tags */}
            {skillsLoading ? (
              <div className="py-10 text-center opacity-30 mono text-[13px]">Loading skills...</div>
            ) : dbSkills.filter(s => !s._deleted).length === 0 ? (
              <div className="py-14 text-center border border-dashed border-[var(--border-color)] rounded-sm">
                <Briefcase size={32} className="mx-auto mb-4 opacity-10" />
                <p className="text-[13px] mono opacity-30">No skills yet. Add your first skill above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] mono uppercase tracking-widest opacity-40">
                    {dbSkills.filter(s => !s._deleted).length} skill{dbSkills.filter(s => !s._deleted).length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dbSkills.filter(s => !s._deleted).map(skill => (
                    <div
                      key={skill.skill_name}
                      className={`group flex items-center gap-2.5 pl-3.5 pr-2 py-2 border rounded-sm text-[12px] font-bold transition-all hover:shadow-sm ${
                        levelColor(skill.skill_level)
                      }`}
                    >
                      {/* name */}
                      <span>{skill.skill_name}</span>

                      {/* badge: level label */}
                      <span className="text-[9px] uppercase tracking-widest font-black opacity-60">
                        {levelLabel(skill.skill_level)} · {skill.skill_level}/10
                        {skill.years_experience ? ` · ${skill.years_experience}yr` : ''}
                      </span>

                      {/* inline level edit – shown on hover */}
                      <input
                        type="range" min={1} max={10}
                        value={skill.skill_level}
                        onChange={e => updateSkillLevel(skill.skill_name, parseInt(e.target.value))}
                        className="w-16 accent-current opacity-0 group-hover:opacity-70 transition-opacity cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      />

                      {/* remove */}
                      <button
                        onClick={() => removeSkillLocal(skill.skill_name)}
                        className="ml-0.5 opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:text-red-400 transition-all rounded-sm"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] mono opacity-20 pt-1">Hover a skill to adjust level or remove it.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ ACTIVITY TAB ═══════════════ */}
        {activeTab === 'activity' && (
          <div className="space-y-10 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="border-b border-[var(--border-color)] pb-6">
              <h3 className="text-2xl font-black uppercase mb-2">Your Activity</h3>
              <p className="text-[13px] opacity-60 mono">Overview of your work and contributions.</p>
            </div>

            {activityLoading ? (
              <div className="p-12 text-center opacity-30 mono text-[13px]">Loading your stats...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Completed */}
                <div className="glass-panel p-8 flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-green-500/10 rounded-sm flex items-center justify-center mb-4">
                    <CheckCircle size={24} className="text-green-400" />
                  </div>
                  <div className="text-3xl font-black mono text-green-400 mb-2">{activityStats.completedTasks}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest opacity-40">Tasks Completed</div>
                </div>

                {/* Active */}
                <div className="glass-panel p-8 flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-[var(--accent-blue)]/10 rounded-sm flex items-center justify-center mb-4">
                    <Clock size={24} className="text-[var(--accent-blue)]" />
                  </div>
                  <div className="text-3xl font-black mono text-[var(--accent-blue)] mb-2">{activityStats.activeTasks}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest opacity-40">Active Tasks</div>
                </div>

                {/* Projects */}
                <div className="glass-panel p-8 flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-[var(--accent)]/10 rounded-sm flex items-center justify-center mb-4">
                    <FolderOpen size={24} className="text-[var(--accent)]" />
                  </div>
                  <div className="text-3xl font-black mono text-[var(--accent)] mb-2">{activityStats.totalProjects}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest opacity-40">Projects Involved</div>
                </div>
              </div>
            )}

            {/* Completion ratio */}
            {!activityLoading && (activityStats.completedTasks + activityStats.activeTasks > 0) && (
              <div className="glass-panel p-8">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-widest opacity-40">Completion Rate</span>
                  <span className="text-[14px] font-black mono text-[var(--accent)]">
                    {Math.round((activityStats.completedTasks / (activityStats.completedTasks + activityStats.activeTasks)) * 100)}%
                  </span>
                </div>
                <div className="relative h-3 bg-black/10 dark:bg-white/5 rounded-sm overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[var(--accent)] transition-all duration-700 rounded-sm"
                    style={{ width: `${Math.round((activityStats.completedTasks / (activityStats.completedTasks + activityStats.activeTasks)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] mono opacity-30 mt-2 font-bold uppercase">
                  <span>{activityStats.completedTasks} completed</span>
                  <span>{activityStats.activeTasks} in progress</span>
                </div>
              </div>
            )}

            {!activityLoading && activityStats.completedTasks === 0 && activityStats.activeTasks === 0 && (
              <div className="glass-panel p-12 text-center border-dashed border-[var(--border-color)]">
                <Activity size={32} className="mx-auto mb-4 opacity-15" />
                <p className="text-[13px] mono opacity-30">No tasks assigned to you yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SETTINGS TAB ═══════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-10 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="border-b border-[var(--border-color)] pb-6">
              <h3 className="text-2xl font-black uppercase mb-2">Settings</h3>
              <p className="text-[13px] opacity-60 mono">Account security and preferences.</p>
            </div>

            {/* Password */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Lock size={16} className="opacity-40" />
                <h4 className="text-[14px] font-black uppercase">Change Password</h4>
              </div>

              {passwordSuccess && (
                <div className="p-3 text-[12px] font-bold mono text-green-400 bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                  <Check size={14} /> {passwordSuccess}
                </div>
              )}

              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="px-6 py-3 glass-button text-[11px] font-bold uppercase tracking-widest rounded-sm"
                >
                  Update Password
                </button>
              ) : (
                <div className="p-6 glass-panel space-y-4 max-w-md">
                  {passwordError && (
                    <div className="p-3 text-[12px] font-bold mono text-red-400 bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                      <AlertTriangle size={14} /> {passwordError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase opacity-60">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="Min. 6 characters"
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase opacity-60">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Re-enter password"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handlePasswordChange}
                      className="bg-[var(--accent)] text-black px-5 py-2.5 text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all rounded-sm"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => { setShowPasswordForm(false); setPasswordError(''); }}
                      className="px-5 py-2.5 glass-button text-[11px] font-bold uppercase tracking-widest rounded-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className="space-y-6 border-t border-[var(--border-color)] pt-8">
              <h4 className="text-[14px] font-black uppercase flex items-center gap-3">
                <Settings size={16} className="opacity-40" /> Preferences
              </h4>

              {/* Theme */}
              <div className="flex items-center justify-between p-4 glass-panel">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon size={16} className="opacity-60" /> : <Sun size={16} className="opacity-60" />}
                  <div>
                    <div className="text-[13px] font-bold">Theme</div>
                    <div className="text-[10px] mono opacity-40">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleTheme()}
                  className={`w-12 h-7 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-[var(--accent)]' : 'bg-black/20'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md ${theme === 'dark' ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between p-4 glass-panel">
                <div className="flex items-center gap-3">
                  {notificationsEnabled ? <Bell size={16} className="opacity-60" /> : <BellOff size={16} className="opacity-60" />}
                  <div>
                    <div className="text-[13px] font-bold">Notifications</div>
                    <div className="text-[10px] mono opacity-40">{notificationsEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
                <button
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className={`w-12 h-7 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-[var(--accent)]' : 'bg-black/20'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow-md ${notificationsEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {/* AI Settings placeholder */}
            <div className="space-y-4 border-t border-[var(--border-color)] pt-8">
              <h4 className="text-[14px] font-black uppercase flex items-center gap-3">
                <Cpu size={16} className="opacity-40" /> AI Settings
              </h4>
              <div className="flex flex-col items-center justify-center py-12 px-8 glass-panel border-dashed">
                <Cpu size={32} className="opacity-10 mb-4" />
                <p className="text-[13px] mono opacity-30 text-center">
                  AI sensitivity and risk detection settings will be available once the AI engine is connected.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SettingsPage;
