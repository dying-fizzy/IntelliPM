import React, { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Props {
  projectId: string;
  projectName: string;
  projectDescription: string;
  onClose: () => void;
  onTasksInserted: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  High: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Low: 'bg-green-500/20 text-green-400 border border-green-500/30',
};

const AITaskGenerator: React.FC<Props> = ({
  projectId,
  projectName,
  projectDescription,
  onClose,
  onTasksInserted,
}) => {
  const [stage, setStage] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setStage('generating');
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          description: projectDescription,
          projectType: 'Software Development',
          complexity: 5,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Generation failed.');
      }

      const data = await response.json();
      const mappedTasks = data.tasks.map((t: any) => {
        const d = new Date();
        d.setDate(d.getDate() + (t.estimated_days || 3));
        return { ...t, due_date: d.toISOString().split('T')[0] };
      });
      setTasks(mappedTasks);
      setStage('done');
    } catch (err: any) {
      setError(err.message || 'Generation failed.');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleInsert = async () => {
    if (tasks.length === 0) return;
    setLoading(true);
    try {
      const rows = tasks.map(t => ({
        project_id: projectId,
        title: t.title,
        priority: t.priority,
        status: t.status || 'To Do',
        assigned_to: t.assigned_to,
        due_date: t.due_date ? new Date(t.due_date).toISOString() : null,
      }));

      const { error: insertErr } = await supabase.from('tasks').insert(rows);
      if (insertErr) throw insertErr;

      onTasksInserted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to insert tasks.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-secondary, #1a1a1a)',
          border: '1px solid var(--border-color)',
          maxHeight: '80vh',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0" style={{ background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-3">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <span className="text-[13px] font-black uppercase tracking-widest">AI Task Generator</span>
          </div>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity p-1">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: 'var(--bg-secondary)' }}>

          {/* IDLE */}
          {stage === 'idle' && (
            <>
              <p className="text-[13px] opacity-60 leading-relaxed">
                Generate a starter task list for <strong className="opacity-90">"{projectName}"</strong> based on project scope. Tasks will be automatically assigned to your team members.
              </p>
              <button
                onClick={handleGenerate}
                className="w-full bg-[var(--accent)] text-black py-3 text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all rounded-sm"
              >
                <Sparkles size={14} /> Generate with AI
              </button>
            </>
          )}

          {/* GENERATING */}
          {stage === 'generating' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 size={32} className="text-[var(--accent)] animate-spin" />
              <p className="text-[12px] mono opacity-40 uppercase tracking-widest">AI is thinking…</p>
            </div>
          )}

          {/* DONE */}
          {stage === 'done' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400 text-[12px] font-bold uppercase tracking-widest">
                  <CheckCircle2 size={14} /> {tasks.length} task{tasks.length !== 1 ? 's' : ''} generated & assigned
                </div>
                <span className="text-[10px] mono opacity-30">Click × to remove a task</span>
              </div>

              {/* Task list */}
              <div className="space-y-2">
                {tasks.length === 0 && (
                  <p className="text-[12px] mono opacity-40 italic text-center py-4">All tasks removed. Regenerate or close.</p>
                )}
                {tasks.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 rounded-sm"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)' }}
                  >
                    {/* Task title + assignee — takes all remaining space */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium opacity-90 leading-snug">{t.title}</p>
                      <p className="text-[10px] opacity-40 uppercase tracking-wider mt-0.5">
                        Assignee: <span className="text-[var(--accent)] opacity-80">{t.assignee_name || 'Unassigned'}</span>
                      </p>
                    </div>

                    {/* Due date */}
                    <input
                      type="date"
                      value={t.due_date || ''}
                      onChange={(e) => {
                        const updated = [...tasks];
                        updated[i] = { ...updated[i], due_date: e.target.value };
                        setTasks(updated);
                      }}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-sm outline-none focus:border-[var(--accent)] transition-colors"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-color)',
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    />

                    {/* Priority badge */}
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.Low}`}>
                      {t.priority}
                    </span>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveTask(i)}
                      className="shrink-0 opacity-30 hover:opacity-100 hover:text-red-400 transition-all p-1 rounded"
                      title="Remove this task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {error && <p className="text-red-400 text-[12px] mono">{error}</p>}
            </>
          )}

          {/* ERROR */}
          {stage === 'error' && (
            <>
              <p className="text-red-400 text-[13px] mono">{error}</p>
              <button
                onClick={handleGenerate}
                className="w-full border border-[var(--border-color)] py-3 text-[11px] font-black uppercase tracking-widest hover:border-[var(--accent)] transition-all rounded-sm"
              >
                Try Again
              </button>
            </>
          )}
        </div>

        {/* ── Footer Actions (shown only in done stage) ── */}
        {stage === 'done' && (
          <div
            className="flex gap-3 px-6 py-4 border-t border-[var(--border-color)] shrink-0"
            style={{ background: 'var(--bg-secondary)' }}
          >
            <button
              onClick={handleInsert}
              disabled={loading || tasks.length === 0}
              className="flex-1 bg-[var(--accent)] text-black py-3 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all rounded-sm"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {loading ? 'Adding…' : `Add ${tasks.length} Task${tasks.length !== 1 ? 's' : ''} to Board`}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-3 border border-[var(--border-color)] text-[11px] font-black uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-all rounded-sm"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AITaskGenerator;
