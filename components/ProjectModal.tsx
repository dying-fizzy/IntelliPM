
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ChevronDown, Check, Plus, Tag } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { mapSupabaseError } from '../errorMessages';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface TeamMember {
  id: string;
  display_name: string;
  job_title: string | null;
}

const PROJECT_TYPES = [
  'Software Development',
  'Marketing Campaign',
  'Design',
  'Research',
  'Operations',
  'Personal',
  'Other',
];

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project_type: 'Software Development',
    priority: 'Medium',
    start_date: '',
    end_date: '',
    budget: '',
    status: 'Active',
  });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch team members when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, job_title')
          .order('display_name');
        if (!error && data) setTeamMembers(data);
      } catch (_) {}
    };
    fetchMembers();
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleMember = (id: string) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // ── Step 1: Resolve identity from live Supabase auth session (not localStorage) ──
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setError('You must be logged in to create a project. Please sign in again.');
        setSubmitting(false);
        return;
      }

      // ── Step 2: Ensure profile exists for this user ──
      let ownerId: string = authUser.id;

      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profileCheck) {
        // Auto-create profile if missing (handles edge cases after OAuth)
        console.warn('[ProjectModal] Profile missing, auto-creating...');
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            display_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            email: authUser.email,
            role: localUser.role || 'Project Manager',
          }, { onConflict: 'id' });

        if (upsertErr) {
          console.error('[ProjectModal] Profile auto-create failed:', upsertErr);
          // Continue anyway — project can still be created
        }
      }

      // ── Step 3: Build project payload with owner_id always set ──
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        project_type: formData.project_type,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        priority: formData.priority,
        status: formData.status,
        tags: tags.length > 0 ? tags : null,
        owner_id: ownerId, // Always set — guaranteed from live auth
      };

      console.log('[ProjectModal] Inserting project:', payload);

      // ── Step 4: Insert project ──
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error('[ProjectModal] Insert error:', insertError);
        throw new Error(mapSupabaseError(insertError, 'creating project'));
      }

      console.log('[ProjectModal] Project created:', data);

      // ── Step 5: Add creator as Owner in project_members (client-side safety net
      // on top of the DB trigger handle_new_project) ──
      if (ownerId && data?.id) {
        await supabase
          .from('project_members')
          .upsert({ project_id: data.id, user_id: ownerId, role: 'Owner' }, { onConflict: 'project_id,user_id' });
      }

      // Insert additional selected members (excluding the owner to avoid duplicates)
      const additionalMembers = selectedMembers.filter(id => id !== ownerId);
      if (additionalMembers.length > 0 && data?.id) {
        const memberRows = additionalMembers.map(userId => ({
          project_id: data.id,
          user_id: userId,
          role: 'Member',
        }));

        const { error: memberError } = await supabase
          .from('project_members')
          .insert(memberRows);

        if (memberError) {
          console.warn('[ProjectModal] Member assignment failed:', memberError);
        }
      }

      // Log activity (non-blocking)
      supabase.from('activity_logs').insert({
        user_id: ownerId,
        action: 'Created project',
        entity_type: 'project',
        entity_id: data?.id || null,
        details: `Project "${formData.name}" created (${formData.project_type})`,
      }).then(({ error: logErr }) => {
        if (logErr) console.warn('[ProjectModal] Log failed:', logErr);
      });

      // Reset & close
      setFormData({ name: '', description: '', project_type: 'Software Development', priority: 'Medium', start_date: '', end_date: '', budget: '', status: 'Active' });
      setSelectedMembers([]);
      setTags([]);
      setTagInput('');
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('[ProjectModal] Failed:', err);
      setError(err.message || 'An unexpected error occurred while creating the project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionLabel = "text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-4 block";
  const inputClass = "w-full glass-input p-3 text-[13px] mono text-[var(--text-primary)]";

  return (
    <div className="glass-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl glass-panel-elevated animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 border-b border-[var(--glass-border)] sticky top-0 bg-[var(--bg-primary)] z-10">
          <div>
            <span className="ui-label text-[var(--accent)]">New Project</span>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Create Project</h2>
          </div>
          <button onClick={onClose} className="opacity-30 hover:opacity-100 transition-opacity"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-bold mono flex items-start gap-3">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Section 1: Core Details ── */}
          <div>
            <span className={sectionLabel}>Project Details</span>
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="ui-label block mb-2 opacity-40">Project Name *</label>
                <input
                  type="text" required
                  placeholder="e.g. Website Redesign"
                  className={inputClass}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="ui-label block mb-2 opacity-40">Description</label>
                <textarea
                  placeholder="What is this project about?"
                  rows={3}
                  className={`${inputClass} resize-none`}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="ui-label block mb-2 opacity-40">Project Type</label>
                <div className="relative">
                  <select
                    className={`${inputClass} appearance-none cursor-pointer pr-10`}
                    value={formData.project_type}
                    onChange={e => setFormData({ ...formData, project_type: e.target.value })}
                  >
                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="ui-label block mb-2 opacity-40">Priority</label>
                <div className="relative">
                  <select
                    className={`${inputClass} appearance-none cursor-pointer pr-10`}
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Timeline ── */}
          <div>
            <span className={sectionLabel}>Timeline</span>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="ui-label block mb-2 opacity-40">Start Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="ui-label block mb-2 opacity-40">End Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ── Section 3: Team ── */}
          <div>
            <span className={sectionLabel}>Team Members</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                className={`${inputClass} text-left flex items-center justify-between cursor-pointer`}
              >
                <span className={selectedMembers.length === 0 ? 'opacity-40' : ''}>
                  {selectedMembers.length === 0
                    ? 'Select team members...'
                    : `${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={14} className={`opacity-30 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showMemberDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border-color)] shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                  {teamMembers.length === 0 && (
                    <div className="p-4 text-center text-[12px] mono opacity-30">No team members found</div>
                  )}
                  {teamMembers.map(member => {
                    const isSelected = selectedMembers.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        className={`w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors text-[13px] ${isSelected ? 'bg-[var(--accent)]/10' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
                          {isSelected && <Check size={12} className="text-black" />}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-bold truncate">{member.display_name}</div>
                          {member.job_title && <div className="text-[10px] opacity-40 mono">{member.job_title}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected member chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedMembers.map(id => {
                  const member = teamMembers.find(m => m.id === id);
                  return member ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[11px] font-bold mono"
                    >
                      {member.display_name}
                      <button type="button" onClick={() => toggleMember(id)} className="opacity-40 hover:opacity-100">
                        <X size={10} />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* ── Section 4: Optional ── */}
          <div>
            <span className={sectionLabel}>Optional</span>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="ui-label block mb-2 opacity-40">Status</label>
                <div className="relative">
                  <select
                    className={`${inputClass} appearance-none cursor-pointer pr-10`}
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="ui-label block mb-2 opacity-40">Budget ($)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className={inputClass}
                  value={formData.budget}
                  onChange={e => setFormData({ ...formData, budget: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="ui-label block mb-2 opacity-40">Tags</label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 z-10" />
                    <input
                      type="text"
                      placeholder="Add a tag and press Enter..."
                      className={`${inputClass} pl-9`}
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="px-4 border border-[var(--border-color)] text-[var(--text-primary)] rounded-sm hover:bg-white/5 disabled:opacity-20 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 text-[11px] font-bold mono text-[var(--accent-blue)]"
                      >
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} className="opacity-40 hover:opacity-100">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !formData.name.trim()}
            className="w-full bg-[var(--accent)] text-black py-4 font-black uppercase text-xs tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
