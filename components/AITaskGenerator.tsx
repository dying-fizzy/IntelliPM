import React, { useState, useEffect } from 'react';
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

// ── Call Groq REST API directly from the browser ──────────────────────────
// This bypasses the backend entirely, so Render cold-starts are irrelevant.
async function callGroqDirect(prompt: string): Promise<string> {
  const apiKey = process.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key not configured.');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a project management AI. Respond with valid JSON only. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1400,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

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
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);

  // Load team members from Supabase directly when modal opens
  useEffect(() => {
    const fetchMembers = async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from('project_members')
        .select('profiles(id, display_name, role)')
        .eq('project_id', projectId);

      if (!error && data) {
        setTeamMembers(
          data
            .filter((m: any) => m.profiles)
            .map((m: any) => ({
              id: m.profiles.id,
              name: m.profiles.display_name,
              role: m.profiles.role,
            }))
        );
      }
    };
    fetchMembers();
  }, [projectId]);

  const handleGenerate = async () => {
    setStage('generating');
    setLoading(true);
    setError('');

    try {
      const memberNames = teamMembers.length > 0 ? teamMembers.map(m => m.name).join(', ') : null;
      const memberContext = teamMembers.length > 0
        ? `TEAM MEMBERS (assign every task to one of these exact names):\n${teamMembers.map((m, i) => `${i + 1}. ${m.name} — ${m.role}`).join('\n')}`
        : "No team members. Use 'Unassigned' for all tasks.";

      const prompt = `You are a senior project manager. Generate EXACTLY 15 to 20 unique, realistic tasks for this project, ordered chronologically.

Project Name: ${projectName}
Project Description: ${projectDescription}
Project Type: Software Development

${memberContext}

Return ONLY valid JSON with this exact structure:
{"tasks": [{"title": "Task name", "priority": "High", "assignee": "Member name", "estimated_days": 3}]}

Rules:
1. Generate EXACTLY 15 to 20 tasks, ordered from planning to deployment.
2. priority must be exactly: High, Medium, or Low.
3. assignee MUST be one of: ${memberNames || 'Unassigned'}. Do NOT invent names.
4. Distribute tasks evenly. Every member gets at least one task.
5. estimated_days must be an integer between 1 and 14.
6. No duplicate tasks. Be specific and actionable.`;

      const text = await callGroqDirect(prompt);

      // Robust JSON extraction
      const firstBrace = text.indexOf('{');
      const lastBrace  = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('Could not parse AI response. Please try again.');

      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      let rawTasks = parsed.tasks || parsed;
      if (!Array.isArray(rawTasks)) rawTasks = [rawTasks];

      // Map assignee names → UUIDs with round-robin fallback
      const mapped = rawTasks.map((t: any, idx: number) => {
        const aiName = (t.assignee || '').toLowerCase().trim();
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(t.estimated_days) || 3));

        // Tier 1: fuzzy match
        const match = teamMembers.find(m => {
          const mn = m.name.toLowerCase();
          return mn === aiName || mn.includes(aiName) || aiName.includes(mn) ||
                 mn.split(' ')[0] === aiName.split(' ')[0];
        });

        if (match) {
          return { ...t, priority: t.priority || 'Medium', status: 'To Do',
                   assigned_to: match.id, assignee_name: match.name,
                   due_date: d.toISOString().split('T')[0] };
        }

        // Tier 2: round-robin if no match but members exist
        if (teamMembers.length > 0) {
          const fb = teamMembers[idx % teamMembers.length];
          return { ...t, priority: t.priority || 'Medium', status: 'To Do',
                   assigned_to: fb.id, assignee_name: fb.name,
                   due_date: d.toISOString().split('T')[0] };
        }

        // Tier 3: no members at all
        return { ...t, priority: t.priority || 'Medium', status: 'To Do',
                 assigned_to: null, assignee_name: 'Unassigned',
                 due_date: d.toISOString().split('T')[0] };
      });

      setTasks(mapped);
      setStage('done');
    } catch (err: any) {
      setError(err.message || 'Generation failed. Please try again.');
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
                Generate a starter task list for <strong className="opacity-90">"{projectName}"</strong> based on project scope.
                {teamMembers.length > 0
                  ? ` Tasks will be assigned across ${teamMembers.length} team member${teamMembers.length > 1 ? 's' : ''}.`
                  : ' Add team members to get smart assignments.'}
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
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium opacity-90 leading-snug">{t.title}</p>
                      <p className="text-[10px] opacity-40 uppercase tracking-wider mt-0.5">
                        Assignee: <span className="text-[var(--accent)] opacity-80">{t.assignee_name || 'Unassigned'}</span>
                      </p>
                    </div>

                    <input
                      type="date"
                      value={t.due_date || ''}
                      onChange={(e) => {
                        const updated = [...tasks];
                        updated[i] = { ...updated[i], due_date: e.target.value };
                        setTasks(updated);
                      }}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-sm outline-none focus:border-[var(--accent)] transition-colors"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'rgba(255,255,255,0.7)' }}
                    />

                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.Low}`}>
                      {t.priority}
                    </span>

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
