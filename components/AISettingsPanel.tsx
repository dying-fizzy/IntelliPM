
import React, { useState, useEffect } from 'react';
import { Sparkles, Save, RotateCcw, CheckCircle, AlertTriangle, Power } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
interface AISettings {
  smart_assign_enabled: boolean;
  weight_skill: number;
  weight_level: number;
  weight_experience: number;
  weight_availability: number;
}

const DEFAULTS: AISettings = {
  smart_assign_enabled: true,
  weight_skill: 40,
  weight_level: 25,
  weight_experience: 20,
  weight_availability: 15,
};

/* ─────────────────────────────────────────────────────
   SLIDER ROW
───────────────────────────────────────────────────── */
const SliderRow: React.FC<{
  label: string;
  description: string;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
  color: string;
}> = ({ label, description, value, defaultValue, onChange, color }) => {
  const changed = value !== defaultValue;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider">{label}</span>
            {changed && (
              <span className="text-[8px] mono px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 rounded-sm uppercase tracking-widest">
                modified
              </span>
            )}
          </div>
          <p className="text-[10px] mono opacity-40 mt-0.5">{description}</p>
        </div>
        <span className={`text-[20px] font-black mono shrink-0 ${color}`}>{value}</span>
      </div>

      {/* Slider */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] mono opacity-30 w-4">0</span>
        <div className="relative flex-grow h-6 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-150 ${color.replace('text-', 'bg-')}`}
              style={{ width: `${value}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="absolute w-full opacity-0 cursor-pointer h-6"
            style={{ zIndex: 1 }}
          />
          {/* Custom thumb */}
          <div
            className={`absolute w-4 h-4 rounded-full border-2 border-current ${color} bg-[var(--bg-primary)] pointer-events-none transition-all duration-150`}
            style={{ left: `calc(${value}% - 8px)` }}
          />
        </div>
        <span className="text-[9px] mono opacity-30 w-6 text-right">100</span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   AI SETTINGS PANEL (MAIN EXPORT)
───────────────────────────────────────────────────── */
const AISettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AISettings>(DEFAULTS);
  const [saved, setSaved] = useState<AISettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    supabase
      .from('ai_settings')
      .select('*')
      .eq('id', 'default')
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          const loaded: AISettings = {
            smart_assign_enabled: data.smart_assign_enabled ?? true,
            weight_skill: data.weight_skill ?? 40,
            weight_level: data.weight_level ?? 25,
            weight_experience: data.weight_experience ?? 20,
            weight_availability: data.weight_availability ?? 15,
          };
          setSettings(loaded);
          setSaved(loaded);
        }
        setLoading(false);
      });
  }, []);

  const isDirty =
    settings.smart_assign_enabled !== saved.smart_assign_enabled ||
    settings.weight_skill !== saved.weight_skill ||
    settings.weight_level !== saved.weight_level ||
    settings.weight_experience !== saved.weight_experience ||
    settings.weight_availability !== saved.weight_availability;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_settings')
        .update({
          smart_assign_enabled: settings.smart_assign_enabled,
          weight_skill: settings.weight_skill,
          weight_level: settings.weight_level,
          weight_experience: settings.weight_experience,
          weight_availability: settings.weight_availability,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'default');

      if (error) throw error;
      setSaved({ ...settings });
      setToast({ type: 'success', msg: 'AI settings saved. Changes take effect on next use.' });
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleReset = () => setSettings(DEFAULTS);

  const totalWeight =
    settings.weight_skill + settings.weight_level + settings.weight_experience + settings.weight_availability;

  const isOverBudget = totalWeight > 100;

  if (loading) {
    return (
      <div className="glass-panel p-12 flex items-center justify-center gap-3 opacity-30">
        <Sparkles size={18} className="animate-pulse" />
        <span className="mono text-[12px] uppercase tracking-widest">Loading AI settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-sm border shadow-2xl text-[12px] font-bold mono animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Section 1: Smart Assign Toggle ── */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-2.5 bg-white/2">
          <div className="w-5 h-5 rounded-sm bg-[var(--accent)]/10 flex items-center justify-center">
            <Sparkles size={11} className="text-[var(--accent)]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">Smart Assign</span>
          <span className="ml-auto text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">AI</span>
        </div>

        <div className="p-6 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-tight">Enable Smart Assignment</p>
            <p className="text-[11px] mono opacity-40 mt-1 leading-relaxed">
              When enabled, team members can use the "Suggest Best Assignee" button in task drawers.
              Disabling removes the feature globally for all users.
            </p>
          </div>

          {/* Toggle */}
          <button
            onClick={() => setSettings(s => ({ ...s, smart_assign_enabled: !s.smart_assign_enabled }))}
            className={`shrink-0 relative w-12 h-6 rounded-full transition-all duration-300 ${
              settings.smart_assign_enabled ? 'bg-[var(--accent)]' : 'bg-white/10'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${
              settings.smart_assign_enabled ? 'left-7' : 'left-1'
            }`} />
          </button>
        </div>

        {/* Status label */}
        <div className={`px-6 py-3 border-t border-[var(--border-color)] flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mono ${
          settings.smart_assign_enabled ? 'text-green-400' : 'text-gray-500'
        }`}>
          <Power size={10} />
          {settings.smart_assign_enabled ? 'Active — Smart Assign is available to all users' : 'Disabled — Smart Assign is hidden from all users'}
        </div>
      </div>

      {/* ── Section 2: Weight Sliders ── */}
      <div className="glass-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-white/2">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">Scoring Weights</span>
          <div className="ml-auto flex items-center gap-3">
            {/* Weight budget indicator */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] mono opacity-40">Total:</span>
              <span className={`text-[11px] font-black mono ${isOverBudget ? 'text-red-400' : 'opacity-60'}`}>
                {totalWeight}
              </span>
              {isOverBudget && (
                <span className="text-[8px] text-red-400 mono">⚠ exceeds 100</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <p className="text-[10px] mono opacity-30 leading-relaxed -mt-2">
            These weights control how much each factor influences the Smart Assign score.
            Higher numbers = more influence. Changes apply on next use.
          </p>

          <SliderRow
            label="Skill Match"
            description="How closely the employee's skills match the task's required skills"
            value={settings.weight_skill}
            defaultValue={DEFAULTS.weight_skill}
            onChange={v => setSettings(s => ({ ...s, weight_skill: v }))}
            color="text-emerald-400"
          />
          <SliderRow
            label="Skill Level"
            description="The proficiency level of matched skills (1–10 scale)"
            value={settings.weight_level}
            defaultValue={DEFAULTS.weight_level}
            onChange={v => setSettings(s => ({ ...s, weight_level: v }))}
            color="text-blue-400"
          />
          <SliderRow
            label="Experience"
            description="Total years of career experience in relevant domains"
            value={settings.weight_experience}
            defaultValue={DEFAULTS.weight_experience}
            onChange={v => setSettings(s => ({ ...s, weight_experience: v }))}
            color="text-violet-400"
          />
          <SliderRow
            label="Availability"
            description="Current availability percentage of the employee"
            value={settings.weight_availability}
            defaultValue={DEFAULTS.weight_availability}
            onChange={v => setSettings(s => ({ ...s, weight_availability: v }))}
            color="text-amber-400"
          />
        </div>

        {/* Action row */}
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center gap-3 bg-white/2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-80 transition-all"
          >
            <RotateCcw size={11} /> Reset to Defaults
          </button>

          <div className="flex-grow" />

          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--accent)] text-black text-[11px] font-black uppercase tracking-widest rounded-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Save size={12} className="animate-pulse" /> Saving…</>
            ) : (
              <><Save size={12} /> Save Changes</>
            )}
          </button>
        </div>
      </div>

      {/* ── How it affects scoring ── */}
      <div className="glass-panel p-5 space-y-3">
        <p className="text-[9px] font-black uppercase tracking-widest opacity-30">How scoring works</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Skill Match',   value: settings.weight_skill,        color: 'bg-emerald-500/20 text-emerald-400', cap: 100 },
            { label: 'Skill Level',   value: settings.weight_level,        color: 'bg-blue-500/20 text-blue-400',     cap: 100 },
            { label: 'Experience',    value: settings.weight_experience,   color: 'bg-violet-500/20 text-violet-400', cap: 100 },
            { label: 'Availability',  value: settings.weight_availability, color: 'bg-amber-500/20 text-amber-400',   cap: 100 },
          ].map(f => (
            <div key={f.label} className={`flex items-center justify-between px-3 py-2 rounded-sm ${f.color}`}>
              <span className="text-[10px] font-bold">{f.label}</span>
              <span className="text-[12px] font-black mono">{f.value}pts</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] mono opacity-25 leading-relaxed">
          Scores are capped at 100. Seniority fit (±10) and overload penalty (−15) are fixed and cannot be adjusted.
        </p>
      </div>
    </div>
  );
};

export default AISettingsPanel;
