
import React, { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  ChevronRight,
  Target,
  Clock,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const SprintManager: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprint, setSelectedSprint] = useState<any>(null);
  const [sprintTasks, setSprintTasks] = useState<any[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  const fetchSprints = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      setSprints(data || []);
    } catch (err) {
      console.error('Failed to fetch sprints:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSprintTasks = async (sprintId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles:assigned_to ( display_name )')
        .eq('sprint_id', sprintId)
        .is('parent_task_id', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setSprintTasks(data || []);
    } catch (err) {
      console.error('Failed to fetch sprint tasks:', err);
    }
  };

  const fetchUnassignedTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, status')
        .eq('project_id', projectId)
        .is('sprint_id', null)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUnassignedTasks(data || []);
    } catch (_) {}
  };

  useEffect(() => { fetchSprints(); }, [projectId]);

  useEffect(() => {
    if (selectedSprint) {
      fetchSprintTasks(selectedSprint.id);
      fetchUnassignedTasks();
    } else {
      setSprintTasks([]);
      setUnassignedTasks([]);
    }
  }, [selectedSprint?.id]);

  const handleCreateSprint = async () => {
    if (!newName.trim() || !newStartDate || !newEndDate) return;
    setCreating(true);
    setCreateError('');
    try {
      const { data, error } = await supabase
        .from('sprints')
        .insert({
          project_id: projectId,
          name: newName.trim(),
          start_date: new Date(newStartDate).toISOString(),
          end_date: new Date(newEndDate).toISOString(),
          status: 'Planning',
        })
        .select()
        .single();
      if (error) throw error;
      // Optimistically add to list and also refetch to be sure
      if (data) setSprints(prev => [data, ...prev]);
      await fetchSprints();
      setShowCreateForm(false);
      setNewName('');
      setNewStartDate('');
      setNewEndDate('');
    } catch (err: any) {
      console.error('Failed to create sprint:', err);
      setCreateError(err?.message || 'Failed to create sprint. Check your database permissions.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSprint = async (sprint: any) => {
    try {
      // Unassign tasks first
      await supabase
        .from('tasks')
        .update({ sprint_id: null })
        .eq('sprint_id', sprint.id);
      const { error } = await supabase.from('sprints').delete().eq('id', sprint.id);
      if (error) throw error;
      setSprints(prev => prev.filter(s => s.id !== sprint.id));
      if (selectedSprint?.id === sprint.id) setSelectedSprint(null);
    } catch (err) { console.error('Failed to delete sprint:', err); }
  };

  const handleUpdateSprintStatus = async (sprintId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('sprints')
        .update({ status: newStatus })
        .eq('id', sprintId);
      if (error) throw error;
      setSprints(prev => prev.map(s => s.id === sprintId ? { ...s, status: newStatus } : s));
      if (selectedSprint?.id === sprintId) {
        setSelectedSprint((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err) { console.error('Failed to update sprint status:', err); }
  };

  const handleAssignTask = async (taskId: string) => {
    if (!selectedSprint) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ sprint_id: selectedSprint.id })
        .eq('id', taskId);
      if (error) throw error;
      setUnassignedTasks(prev => prev.filter(t => t.id !== taskId));
      await fetchSprintTasks(selectedSprint.id);
    } catch (err) { console.error('Failed to assign task:', err); }
  };

  const handleUnassignTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ sprint_id: null })
        .eq('id', taskId);
      if (error) throw error;
      setSprintTasks(prev => prev.filter(t => t.id !== taskId));
      await fetchUnassignedTasks();
    } catch (err) { console.error('Failed to unassign task:', err); }
  };

  const sprintStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'text-[var(--accent)] border-[var(--accent)] bg-[var(--accent)]/10';
      case 'Completed': return 'text-green-400 border-green-400 bg-green-400/10';
      default: return 'text-[var(--accent-blue)] border-[var(--accent-blue)] bg-[var(--accent-blue)]/10';
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return 'text-[var(--accent-pink)] border-[var(--accent-pink)]';
      case 'High': return 'text-orange-400 border-orange-400';
      case 'Medium': return 'text-[var(--accent-blue)] border-[var(--accent-blue)]';
      default: return 'opacity-40 border-[var(--border-color)]';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Completed': case 'Done': return 'text-green-400';
      case 'In Progress': return 'text-[var(--accent-blue)]';
      case 'Review': return 'text-yellow-400';
      default: return 'opacity-50';
    }
  };

  // Sprint progress
  const completedCount = sprintTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
  const progressPct = sprintTasks.length > 0 ? Math.round((completedCount / sprintTasks.length) * 100) : 0;

  // Calculate days remaining
  const getDaysRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="p-10 mono text-[14px] opacity-20 uppercase tracking-widest">Loading sprints...</div>;

  return (
    <div className="flex gap-8 min-h-[600px] animate-in fade-in duration-500">
      
      {/* Sprint List Panel */}
      <div className="w-[320px] flex-shrink-0 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <span className="ui-label opacity-40 font-bold flex items-center gap-2">
            <Zap size={14} className="text-[var(--accent)]" /> Sprints
          </span>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-[10px] mono font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all flex items-center gap-1"
          >
            <Plus size={12} /> New
          </button>
        </div>

        {/* Create Sprint Form */}
        {showCreateForm && (
          <div className="glass-panel p-6 space-y-4 border-[var(--accent-blue)]/30">
            <input
              type="text"
              placeholder="Sprint name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full glass-input rounded-sm py-2.5 px-4 text-[13px] mono"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[9px] mono uppercase tracking-widest opacity-40 font-bold">Start Date</span>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full glass-input rounded-sm py-2 px-3 text-[12px] mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] mono uppercase tracking-widest opacity-40 font-bold">End Date</span>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full glass-input rounded-sm py-2 px-3 text-[12px] mono"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateSprint}
                disabled={!newName.trim() || !newStartDate || !newEndDate || creating}
                className="flex-grow py-2.5 bg-[var(--accent-blue)] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-30 hover:opacity-90 transition-all"
              >
                {creating ? 'Creating...' : 'Create Sprint'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                className="px-3 py-2.5 glass-button text-[11px] transition-all"
              >
                <X size={14} />
              </button>
            </div>
            {createError && (
              <div className="text-[11px] mono text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-2">
                ⚠ {createError}
              </div>
            )}
          </div>
        )}

        {/* Sprint Cards */}
        {sprints.length === 0 && !showCreateForm && (
          <div className="glass-panel p-10 text-center border-dashed border-[var(--border-color)]">
            <Calendar size={24} className="mx-auto mb-3 opacity-20" />
            <span className="mono text-[12px] uppercase tracking-widest opacity-30">No sprints yet</span>
          </div>
        )}

        <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
          {sprints.map(sprint => {
            const daysLeft = getDaysRemaining(sprint.end_date);
            const isSelected = selectedSprint?.id === sprint.id;
            return (
              <div
                key={sprint.id}
                onClick={() => setSelectedSprint(isSelected ? null : sprint)}
                className={`glass-panel p-5 cursor-pointer transition-all group ${
                  isSelected ? 'border-[var(--accent)] shadow-lg glass-accent' : 'hover:border-[var(--accent-blue)]/30'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-grow min-w-0">
                    <span className="text-[14px] font-bold uppercase tracking-tight block truncate">{sprint.name}</span>
                    <span className="text-[10px] mono opacity-40">
                      {formatDate(sprint.start_date)} — {formatDate(sprint.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] mono font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${sprintStatusColor(sprint.status)}`}>
                      {sprint.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] mono">
                  {sprint.status === 'Active' && (
                    <span className={`flex items-center gap-1 ${daysLeft <= 3 ? 'text-[var(--accent-pink)]' : 'opacity-40'}`}>
                      <Clock size={10} /> {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSprint(sprint); }}
                    className="opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-red-400 transition-all ml-auto"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sprint Detail / Board View */}
      <div className="flex-grow min-w-0">
        {!selectedSprint ? (
          <div className="flex items-center justify-center h-full opacity-20">
            <div className="text-center space-y-3">
              <Calendar size={40} className="mx-auto" />
              <span className="mono text-[14px] uppercase tracking-widest block">Select a sprint</span>
              <span className="text-[12px] mono opacity-50">Or create a new one</span>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Sprint Header */}
            <div className="flex items-center justify-between pb-6 border-b border-[var(--border-sep)]">
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter">{selectedSprint.name}</h2>
                <div className="flex items-center gap-4 text-[11px] mono opacity-50">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(selectedSprint.start_date)} — {formatDate(selectedSprint.end_date)}</span>
                  <span className="flex items-center gap-1"><Target size={12} /> {sprintTasks.length} tasks</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {completedCount} completed</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedSprint.status === 'Planning' && (
                  <button
                    onClick={() => handleUpdateSprintStatus(selectedSprint.id, 'Active')}
                    className="px-5 py-2.5 bg-[var(--accent)] text-black text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    Start Sprint
                  </button>
                )}
                {selectedSprint.status === 'Active' && (
                  <button
                    onClick={() => handleUpdateSprintStatus(selectedSprint.id, 'Completed')}
                    className="px-5 py-2.5 bg-green-600 text-white text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    Complete Sprint
                  </button>
                )}
                <span className={`text-[10px] mono font-bold uppercase tracking-widest px-3 py-1.5 border rounded-sm ${sprintStatusColor(selectedSprint.status)}`}>
                  {selectedSprint.status}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] mono uppercase tracking-widest opacity-50">
                <span>Progress</span>
                <span className={`font-bold ${progressPct === 100 ? 'text-green-400' : 'text-[var(--accent)]'}`}>{progressPct}%</span>
              </div>
              <div className="h-2 bg-black/10 dark:bg-white/5 overflow-hidden rounded-sm">
                <div
                  className={`h-full transition-all duration-700 ${progressPct === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Sprint Task Board — Columns */}
            <div className="grid grid-cols-4 gap-4">
              {['To Do', 'In Progress', 'Review', 'Completed'].map(col => {
                const colTasks = sprintTasks.filter(t => t.status === col);
                return (
                  <div key={col} className="space-y-3">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-[var(--border-color)]/30">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor(col)}`}>{col}</span>
                      <span className="text-[10px] mono opacity-30">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[80px]">
                      {colTasks.map(task => (
                        <div
                          key={task.id}
                          className="glass-panel p-4 group transition-all hover:border-[var(--accent-blue)]/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[12px] font-bold leading-tight flex-grow">{task.title}</span>
                            <button
                              onClick={() => handleUnassignTask(task.id)}
                              className="opacity-0 group-hover:opacity-30 hover:!opacity-100 hover:text-red-400 transition-all shrink-0"
                              title="Remove from sprint"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-[9px] mono font-bold uppercase border px-1.5 py-0.5 ${priorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            {task.profiles?.display_name && (
                              <span className="text-[9px] mono opacity-40">{task.profiles.display_name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {colTasks.length === 0 && (
                        <div className="p-4 border border-dashed border-[var(--border-color)]/20 text-center">
                          <span className="text-[10px] mono opacity-20">Empty</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Tasks to Sprint */}
            <div className="pt-6 border-t border-[var(--border-sep)]">
              <div className="flex items-center gap-2 mb-4">
                <Plus size={14} className="text-[var(--accent-blue)]" />
                <span className="ui-label opacity-40 text-[10px]">Add Tasks to Sprint</span>
                <span className="text-[10px] mono opacity-30">({unassignedTasks.length} available)</span>
              </div>

              {unassignedTasks.length === 0 ? (
                <div className="glass-panel p-6 text-center border-dashed border-[var(--border-color)]">
                  <span className="mono text-[11px] uppercase tracking-widest opacity-30">All tasks assigned to sprints</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                  {unassignedTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 glass-panel group transition-all hover:border-[var(--accent-blue)]/30"
                    >
                      <button
                        onClick={() => handleAssignTask(task.id)}
                        className="w-7 h-7 border border-[var(--accent-blue)] text-[var(--accent-blue)] flex items-center justify-center shrink-0 hover:bg-[var(--accent-blue)] hover:text-white transition-all"
                      >
                        <Plus size={12} />
                      </button>
                      <span className="text-[12px] font-bold flex-grow truncate">{task.title}</span>
                      <span className={`text-[9px] mono font-bold uppercase border px-1.5 py-0.5 ${priorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className={`text-[9px] mono uppercase ${statusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SprintManager;
