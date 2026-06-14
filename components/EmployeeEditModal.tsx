import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, User, Briefcase, BarChart2, DollarSign, Loader } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Employee {
  employee_id: string;
  full_name: string;
  role?: string;
  department?: string;
  seniority_level?: string;
  experience_years?: number;
  max_hours_per_week?: number;
  availability_percentage?: number;
  is_available?: boolean;
  monthly_rate?: number;
  location?: string;
}

interface Skill {
  id?: string;
  employee_id: string;
  skill_name: string;
  skill_level: number;
  years_experience?: number;
  category?: string;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface Props {
  employeeId: string | null; // the employee_id string (EMP001 etc.)
  fullName: string;
  onClose: () => void;
  onSaved: () => void;
}

const SENIORITY_OPTIONS = ['junior', 'mid', 'senior'];
const CATEGORY_OPTIONS = ['core', 'common'];

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="text-[var(--accent)] opacity-60">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mono">{label}</span>
    <div className="flex-1 h-[1px] bg-[var(--border-color)]" />
  </div>
);

const EmployeeEditModal: React.FC<Props> = ({ employeeId, fullName, onClose, onSaved }) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // New skill form
  const [newSkill, setNewSkill] = useState({ skill_name: '', skill_level: 5, years_experience: 0, category: 'common' });

  useEffect(() => {
    if (!employeeId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const [empRes, skillRes] = await Promise.all([
          supabase.from('employees').select('*').eq('employee_id', employeeId).single(),
          supabase.from('employee_skills').select('*').eq('employee_id', employeeId),
        ]);
        if (empRes.data) setEmployee(empRes.data);
        if (skillRes.data) setSkills(skillRes.data);
      } catch (err) {
        setError('Failed to load employee data.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [employeeId]);

  const updateField = (field: keyof Employee, value: any) => {
    setEmployee(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const updateSkillLevel = (idx: number, level: number) => {
    setSkills(prev => prev.map((s, i) => i === idx ? { ...s, skill_level: level } : s));
  };

  const deleteSkill = (idx: number) => {
    setSkills(prev => prev.map((s, i) => i === idx ? { ...s, _deleted: true } : s));
  };

  const addSkill = () => {
    if (!newSkill.skill_name.trim()) return;
    setSkills(prev => [...prev, { ...newSkill, employee_id: employeeId!, _isNew: true }]);
    setNewSkill({ skill_name: '', skill_level: 5, years_experience: 0, category: 'common' });
  };

  const handleSave = async () => {
    if (!employee || !employeeId) return;
    setSaving(true);
    setError('');

    try {
      // Update employee record
      const { error: empErr } = await supabase
        .from('employees')
        .update({
          role: employee.role,
          department: employee.department,
          seniority_level: employee.seniority_level,
          experience_years: employee.experience_years,
          max_hours_per_week: employee.max_hours_per_week,
          availability_percentage: employee.availability_percentage,
          is_available: employee.is_available,
          monthly_rate: employee.monthly_rate,
          location: employee.location,
        })
        .eq('employee_id', employeeId);

      if (empErr) throw new Error(empErr.message);

      // Delete removed skills
      const toDelete = skills.filter(s => s._deleted && s.id);
      for (const s of toDelete) {
        await supabase.from('employee_skills').delete().eq('id', s.id!);
      }

      // Upsert existing + new skills
      const toUpsert = skills
        .filter(s => !s._deleted)
        .map(({ _isNew, _deleted, ...s }) => s);

      if (toUpsert.length > 0) {
        const { error: skillErr } = await supabase
          .from('employee_skills')
          .upsert(toUpsert, { onConflict: 'employee_id,skill_name' });
        if (skillErr) throw new Error(skillErr.message);
      }

      setSuccess(true);
      setTimeout(() => { onSaved(); onClose(); }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const visibleSkills = skills.filter(s => !s._deleted);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 glass-modal-overlay z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[500px] z-50 flex flex-col
                      animate-in slide-in-from-right duration-300 glass-panel-elevated !rounded-none !rounded-l-xl">

        {/* Panel Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent)] mono">Employee · {employeeId}</span>
            </div>
            <h2 className="text-lg font-black uppercase tracking-tighter">{fullName}</h2>
          </div>
          <button onClick={onClose} className="p-2 opacity-40 hover:opacity-100 rounded-sm transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center h-40 opacity-30">
              <Loader size={24} className="animate-spin" />
            </div>
          ) : !employee ? (
            <div className="text-center opacity-30 mono text-[13px] mt-12">No employee record found.</div>
          ) : (
            <>
              {/* Error / Success */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] mono rounded-sm">{error}</div>
              )}
              {success && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-[12px] mono rounded-sm">
                  ✓ Changes saved successfully
                </div>
              )}

              {/* Work Info */}
              <div>
                <SectionHeader icon={<Briefcase size={14} />} label="Work Info" />
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Role</label>
                    <input
                      value={employee.role || ''}
                      onChange={e => updateField('role', e.target.value)}
                      placeholder="e.g. Full Stack Developer"
                      className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Department</label>
                    <input
                      value={employee.department || ''}
                      onChange={e => updateField('department', e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Seniority</label>
                      <select
                        value={employee.seniority_level || 'junior'}
                        onChange={e => updateField('seniority_level', e.target.value)}
                        className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono appearance-none cursor-pointer"
                      >
                        {SENIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Experience (yrs)</label>
                      <input
                        type="number" min={0} step={0.5}
                        value={employee.experience_years ?? ''}
                        onChange={e => updateField('experience_years', parseFloat(e.target.value))}
                        className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Location</label>
                    <input
                      value={employee.location || ''}
                      onChange={e => updateField('location', e.target.value)}
                      placeholder="e.g. Remote / Karachi"
                      className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono"
                    />
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div>
                <SectionHeader icon={<BarChart2 size={14} />} label="Capacity" />
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Max hrs/week</label>
                      <input
                        type="number" min={0} max={168}
                        value={employee.max_hours_per_week ?? ''}
                        onChange={e => updateField('max_hours_per_week', parseInt(e.target.value))}
                        className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Availability %</label>
                      <input
                        type="number" min={0} max={100}
                        value={employee.availability_percentage ?? ''}
                        onChange={e => updateField('availability_percentage', parseFloat(e.target.value))}
                        className="w-full glass-input rounded-sm px-3 py-2.5 text-[13px] mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('is_available', !employee.is_available)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${employee.is_available ? 'bg-green-500' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${employee.is_available ? 'left-6' : 'left-1'}`} />
                    </button>
                    <span className="text-[12px] mono opacity-60">
                      {employee.is_available ? 'Available for assignment' : 'Not available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div>
                <SectionHeader icon={<DollarSign size={14} />} label="Financials" />
                <div>
                  <label className="text-[10px] mono uppercase tracking-widest opacity-40 block mb-1">Monthly Rate ($)</label>
                  <input
                    type="number" min={0}
                    value={employee.monthly_rate ?? ''}
                    onChange={e => updateField('monthly_rate', parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-[var(--border-color)] rounded-sm px-3 py-2.5 text-[13px] mono outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Skills */}
              <div>
                <SectionHeader icon={<User size={14} />} label="Skills" />

                {visibleSkills.length === 0 && (
                  <p className="text-[12px] mono opacity-30 mb-4">No skills added yet.</p>
                )}

                <div className="space-y-2 mb-4">
                  {visibleSkills.map((skill, idx) => {
                    const realIdx = skills.indexOf(skill);
                    return (
                      <div key={skill.id || idx} className="flex items-center gap-3 py-2 px-3 glass-panel group">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold truncate">{skill.skill_name}</p>
                          <span className={`text-[10px] mono px-1.5 py-0.5 rounded-sm ${skill.category === 'core' ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'opacity-40'}`}>
                            {skill.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] mono opacity-40">Level</span>
                          <input
                            type="number" min={1} max={10}
                            value={skill.skill_level}
                            onChange={e => updateSkillLevel(realIdx, Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                            className="w-12 glass-input rounded-sm px-2 py-1 text-[12px] mono text-center"
                          />
                          <span className="text-[10px] mono opacity-30">/10</span>
                        </div>
                        <button
                          onClick={() => deleteSkill(realIdx)}
                          className="p-1.5 opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add Skill Form */}
                <div className="glass-panel border-dashed p-4 space-y-3">
                  <p className="text-[10px] mono uppercase tracking-widest opacity-40">Add Skill</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Skill name"
                      value={newSkill.skill_name}
                      onChange={e => setNewSkill(p => ({ ...p, skill_name: e.target.value }))}
                      className="glass-input rounded-sm px-3 py-2 text-[12px] mono"
                    />
                    <select
                      value={newSkill.category}
                      onChange={e => setNewSkill(p => ({ ...p, category: e.target.value }))}
                      className="glass-input rounded-sm px-3 py-2 text-[12px] mono appearance-none cursor-pointer"
                    >
                      {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[11px] mono opacity-40 whitespace-nowrap">Level:</span>
                      <input
                        type="range" min={1} max={10}
                        value={newSkill.skill_level}
                        onChange={e => setNewSkill(p => ({ ...p, skill_level: parseInt(e.target.value) }))}
                        className="flex-1 accent-[var(--accent)]"
                      />
                      <span className="text-[12px] font-black mono w-6 text-center">{newSkill.skill_level}</span>
                    </div>
                    <button
                      onClick={addSkill}
                      disabled={!newSkill.skill_name.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 rounded-sm text-[11px] font-bold mono uppercase tracking-wider hover:bg-[var(--accent)]/20 transition-all disabled:opacity-30"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && employee && (
          <div className="p-6 border-t border-[var(--border-color)] flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 glass-button rounded-sm text-[11px] font-bold mono uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] py-3 bg-[var(--accent)] text-black rounded-sm text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default EmployeeEditModal;
