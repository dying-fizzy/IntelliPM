
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { mapSupabaseError } from '../errorMessages';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId?: string;
}

interface Profile {
  id: string;
  display_name: string;
  job_title: string | null;
}

interface Project {
  id: string;
  name: string;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onCreated, projectId }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'To Do',
    assigned_to: '',
    project_id: projectId || '',
    due_date: '',
    category: '',
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      const [profileRes, projectRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, job_title').order('display_name'),
        supabase.from('projects').select('id, name').eq('status', 'Active').order('name'),
      ]);
      if (profileRes.data) setProfiles(profileRes.data);
      if (projectRes.data) setProjects(projectRes.data);
    };
    fetchData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      setError('You must be logged in to create a task.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        status: formData.status,
        assigned_to: formData.assigned_to || null,
        project_id: projectId || formData.project_id || null,
        due_date: formData.due_date || null,
        category: formData.category.trim() || null,
      };

      console.log('[TaskModal] Inserting task:', payload);

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert(payload)
        .select()
        .single();

      if (insertError) {
        console.error('[TaskModal] Insert error:', insertError);
        throw new Error(mapSupabaseError(insertError, 'creating task'));
      }

      console.log('[TaskModal] Task created:', data);

      // Activity log (non-blocking)
      supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'Created task',
        entity_type: 'task',
        entity_id: data?.id || null,
        details: `Task "${formData.title}" created`,
      }).then(({ error: logErr }) => {
        if (logErr) console.warn('[TaskModal] Log failed:', logErr);
      });

      // Reset & close
      setFormData({ title: '', description: '', priority: 'Medium', status: 'To Do', assigned_to: '', project_id: projectId || '', due_date: '', category: '' });
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('[TaskModal] Failed:', err);
      setError(mapSupabaseError(err, 'creating task'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full glass-input p-3 text-[13px] mono text-[var(--text-primary)]";
  const sectionLabel = "text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-4 block";

  return (
    <div className="glass-modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl glass-panel-elevated animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 border-b border-[var(--glass-border)] sticky top-0 bg-[var(--bg-primary)] z-10">
          <div>
            <span className="ui-label text-[var(--accent-blue)]">New Task</span>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Create Task</h2>
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

          {/* Task Details */}
          <div>
            <span className={sectionLabel}>Task Details</span>
            <div className="space-y-5">
              <div>
                <label className="ui-label block mb-2 opacity-40">Task Title *</label>
                <input
                  type="text" required
                  placeholder="e.g. Design homepage wireframe"
                  className={inputClass}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="ui-label block mb-2 opacity-40">Description</label>
                <textarea
                  placeholder="What needs to be done?"
                  rows={3}
                  className={`${inputClass} resize-none`}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <span className={sectionLabel}>Classification</span>
            <div className="grid grid-cols-2 gap-5">
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
              <div>
                <label className="ui-label block mb-2 opacity-40">Status</label>
                <div className="relative">
                  <select
                    className={`${inputClass} appearance-none cursor-pointer pr-10`}
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>Review</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="ui-label block mb-2 opacity-40">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Frontend, Backend, Design"
                  className={inputClass}
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              <div>
                <label className="ui-label block mb-2 opacity-40">Due Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div>
            <span className={sectionLabel}>Assignment</span>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="ui-label block mb-2 opacity-40">Assign To</label>
                <div className="relative">
                  <select
                    className={`${inputClass} appearance-none cursor-pointer pr-10`}
                    value={formData.assigned_to}
                    onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}{p.job_title ? ` — ${p.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                </div>
              </div>
              {!projectId && (
                <div>
                  <label className="ui-label block mb-2 opacity-40">Project</label>
                  <div className="relative">
                    <select
                      className={`${inputClass} appearance-none cursor-pointer pr-10`}
                      value={formData.project_id}
                      onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                    >
                      <option value="">No project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !formData.title.trim()}
            className="w-full bg-[var(--accent)] text-black py-4 font-black uppercase text-xs tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
