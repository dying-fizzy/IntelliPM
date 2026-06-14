
import React, { useState, useEffect } from 'react';
import { X, Play, Square, Clock, CheckCircle, Sparkles, UserCheck, Loader, AlertTriangle, ChevronRight, User, ChevronDown, RotateCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { matchTaskLive, MatchResult, TaskDifficulty, DynamicWeights } from '../taskMatcher';
import { AISectionHeader, AITooltipButton } from './AILabel';

interface TaskDrawerProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

/* ── Difficulty mapping from task fields ── */
function inferDifficulty(task: any): TaskDifficulty {
  const complexity = task.complexity ?? 5;
  const priority   = (task.priority || '').toLowerCase();
  if (priority === 'critical' || complexity >= 8) return 'high';
  if (priority === 'low'      || complexity <= 3) return 'low';
  return 'medium';
}

/* ── Recommendation colour ── */
const recColor = (r: string) => {
  if (r === 'strong') return 'text-green-400 border-green-500/30 bg-green-500/10';
  if (r === 'good')   return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
  if (r === 'fair')   return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  return 'text-red-400 border-red-500/30 bg-red-500/10';
};

/* ── Confidence level ──
 * Derived purely from match score.
 *  >= 70  → High   (green)
 *  >= 45  → Medium (yellow)
 *  < 45   → Low    (red)
 */
const getConfidence = (score: number): { label: string; color: string; bg: string } => {
  if (score >= 70) return { label: 'High',   color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' };
  if (score >= 45) return { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' };
  return             { label: 'Low',    color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' };
};

/* ── Plain-English explanation builder ──
 *
 * Derives three KPI labels + one human sentence from a MatchResult.
 * All language is simple and jargon-free.
 */
function buildExplanation(c: MatchResult): {
  sentence: string;
  skillPct: number;
  expYears: string;
  availLevel: string;
  availColor: string;
} {
  // ─ Skill match % (breakdown.skill_match out of 40) ─
  const skillPct = Math.round((c.breakdown.skill_match / 40) * 100);

  // ─ Experience years (breakdown.experience out of 20, where 20 = 10+ yrs) ─
  const rawYears = Math.round((c.breakdown.experience / 20) * 10);
  const expYears = rawYears >= 10 ? '10+ yrs' : rawYears <= 1 ? '< 1 yr' : `~${rawYears} yrs`;

  // ─ Availability (breakdown.availability out of 15) ─
  const availPct = Math.round((c.breakdown.availability / 15) * 100);
  let availLevel: string;
  let availColor: string;
  if (availPct >= 80)      { availLevel = 'Available';       availColor = 'text-green-400'; }
  else if (availPct >= 50) { availLevel = 'Mostly free';     availColor = 'text-yellow-400'; }
  else if (availPct >= 25) { availLevel = 'Moderately busy'; availColor = 'text-orange-400'; }
  else                     { availLevel = 'Very busy';       availColor = 'text-red-400'; }

  // ─ Sentence assembly ─
  const parts: string[] = [];

  // Skills part
  if (c.matched_skills.length >= 2) {
    parts.push(`Strong in ${c.matched_skills.slice(0, 2).join(' & ')}`);
  } else if (c.matched_skills.length === 1) {
    parts.push(`Knows ${c.matched_skills[0]}`);
  } else if (skillPct === 0) {
    parts.push('Limited skill overlap');
  }

  // Experience part
  if (rawYears >= 7) {
    parts.push('highly experienced');
  } else if (rawYears >= 3) {
    parts.push(`${rawYears} years experience`);
  } else if (rawYears >= 1) {
    parts.push('some relevant experience');
  }

  // Availability part
  if (availPct >= 80) {
    parts.push('available this week');
  } else if (availPct >= 50) {
    parts.push('mostly available');
  } else {
    parts.push('limited availability');
  }

  // Seniority override
  if (c.breakdown.seniority_adjustment > 0 && parts.length < 2) {
    parts.push(`${c.seniority_level} level fits this task`);
  }

  const sentence = parts.length > 0
    ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
      (parts.slice(1).length > 0 ? ', ' + parts.slice(1).join(', ') : '')
    : 'Best available match';

  return { sentence, skillPct, expYears, availLevel, availColor };
}

const TaskDrawer: React.FC<TaskDrawerProps> = ({ task, isOpen, onClose, onUpdate }) => {
  const [timerActive, setTimerActive] = useState(false);
  const [seconds, setSeconds]         = useState(0);

  /* ── Smart Recommend state ── */
  const [matching, setMatching]                   = useState(false);
  const [results, setResults]                     = useState<MatchResult[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchResult | null>(null);
  const [matchError, setMatchError]               = useState('');
  const [aiUnavailable, setAiUnavailable]         = useState(false);
  const [assigning, setAssigning]                 = useState(false);
  const [assignedMsg, setAssignedMsg]             = useState('');
  const [showRecommend, setShowRecommend]         = useState(false);

  /* ── Manual assign state ── */
  const [members, setMembers]                     = useState<any[]>([]);
  const [manualAssignee, setManualAssignee]       = useState<string>(task?.assigned_to || '');
  const [manualSaving, setManualSaving]           = useState(false);
  const [manualSavedMsg, setManualSavedMsg]       = useState('');

  /* ── AI Settings (loaded from DB) ── */
  const [aiEnabled, setAiEnabled]     = useState(true);
  const [aiWeights, setAiWeights]     = useState<DynamicWeights | undefined>(undefined);

  /* Load AI settings once on mount */
  useEffect(() => {
    supabase
      .from('ai_settings')
      .select('smart_assign_enabled, weight_skill, weight_level, weight_experience, weight_availability')
      .eq('id', 'default')
      .single()
      .then(({ data }) => {
        if (data) {
          setAiEnabled(data.smart_assign_enabled ?? true);
          setAiWeights({
            skill_match:  data.weight_skill,
            skill_level:  data.weight_level,
            experience:   data.weight_experience,
            availability: data.weight_availability,
          });
        }
      });
  }, []);

  /* Load project members for the manual dropdown */
  useEffect(() => {
    if (!task?.project_id) return;
    supabase
      .from('project_members')
      .select('user_id, profiles:user_id ( id, display_name )')
      .eq('project_id', task.project_id)
      .then(({ data }) => {
        if (data) {
          setMembers(data.map((m: any) => m.profiles).filter(Boolean));
        }
      });
  }, [task?.project_id]);

  /* Reset on different task */
  useEffect(() => {
    setResults([]);
    setSelectedCandidate(null);
    setMatchError('');
    setAiUnavailable(false);
    setAssignedMsg('');
    setManualSavedMsg('');
    setManualAssignee(task?.assigned_to || '');
    setShowRecommend(false);
  }, [task?.id]);

  useEffect(() => {
    let interval: any;
    if (timerActive) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  if (!task) return null;

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const formatTime = (s: number) => {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  /* ── Run the matching engine — return top 10 ── */
  const handleSuggest = async () => {
    setMatching(true);
    setMatchError('');
    setAiUnavailable(false);
    setResults([]);
    setSelectedCandidate(null);

    // 12-second client-side timeout (separate from server's 20 s)
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setMatching(false);
      setAiUnavailable(true);
      setMatchError('AI unavailable — request timed out. Please assign manually using the dropdown above.');
    }, 12000);

    try {
      const requiredSkills: string[] = [];
      if (task.category)     requiredSkills.push(task.category);
      if (task.tags?.length) requiredSkills.push(...task.tags);
      if (requiredSkills.length === 0 && task.title) {
        requiredSkills.push(...task.title.split(' ').filter((w: string) => w.length > 4));
      }

      const difficulty = inferDifficulty(task);

      const matches = await matchTaskLive(supabase, {
        required_skills: requiredSkills,
        difficulty,
        estimated_hours: task.planned_points ?? undefined,
      }, 10, aiWeights);

      clearTimeout(timeoutId);
      if (timedOut) return; // timeout already handled UI

      if (matches.length === 0) {
        // Soft warning — not a failure, just means no data yet
        setMatchError('No available employees found. Make sure team members have skills set and are marked as available.');
      } else {
        setResults(matches);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (timedOut) return;

      const msg = err.message || '';
      const isNetwork  = /fetch|network|failed to fetch/i.test(msg);
      const isTimeout  = /timed out/i.test(msg);

      if (isNetwork || isTimeout) {
        setAiUnavailable(true);
        setMatchError('AI unavailable — cannot reach the matching service. Please assign manually using the dropdown above.');
      } else {
        // Non-critical error — show inline, don’t mark as unavailable
        setMatchError(msg || 'Matching failed. Please try again.');
      }
    } finally {
      if (!timedOut) setMatching(false);
    }
  };

  /* ── Manual assign ── */
  const handleManualAssign = async (profileId: string) => {
    setManualAssignee(profileId);
    setManualSaving(true);
    setManualSavedMsg('');
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: profileId || null, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      if (error) throw error;

      const chosen = members.find(m => m.id === profileId);
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      await supabase.from('activity_logs').insert({
        user_id:     currentUser.id,
        action:      'Manually assigned task',
        entity_type: 'task',
        entity_id:   task.id,
        details:     chosen ? `Assigned to ${chosen.display_name}` : 'Unassigned',
      });

      setManualSavedMsg(chosen ? `Saved — ${chosen.display_name}` : 'Unassigned');
      onUpdate();
    } catch (err: any) {
      setManualSavedMsg('Failed to save');
    } finally {
      setManualSaving(false);
      setTimeout(() => setManualSavedMsg(''), 3000);
    }
  };

  const handleAssign = async () => {
    if (!selectedCandidate) return;
    setAssigning(true);

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name')
        .ilike('display_name', selectedCandidate.full_name)
        .single();

      const { error } = await supabase
        .from('tasks')
        .update({
          assigned_to: profileData?.id ?? null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) throw error;

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      await supabase.from('activity_logs').insert({
        user_id:     currentUser.id,
        action:      'Smart-assigned task',
        entity_type: 'task',
        entity_id:   task.id,
        details:     `Assigned to ${selectedCandidate.full_name} (${selectedCandidate.score}% match) via Smart Recommend`,
      });

      setAssignedMsg(`✓ Assigned to ${selectedCandidate.full_name}`);
      onUpdate();
    } catch (err: any) {
      setMatchError(err.message || 'Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`glass-modal-overlay fixed inset-0 z-[105] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div className={`fixed inset-y-0 right-0 w-[500px] z-[110] glass-panel-elevated !rounded-none border-l border-[var(--glass-border)] transition-transform duration-500 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">

          {/* Header */}
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
              <span className="bg-[var(--accent)] text-black px-2 py-0.5 rounded-sm text-[13px] font-black mono">
                {task.ipm_id || task.id?.substring(0, 8)}
              </span>
              <span className="ui-label opacity-30">Task Details</span>
            </div>
            <button onClick={onClose} className="opacity-30 hover:opacity-100 transition-all"><X size={20} /></button>
          </div>

          <h2 className="text-3xl font-black uppercase tracking-tight mb-4 leading-none">{task.title}</h2>
          <p className="text-sm opacity-50 mb-8 leading-relaxed">{task.description || 'No description provided for this task.'}</p>

          {/* Time Tracker */}
          <div className="glass-panel p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="ui-label opacity-40 flex items-center gap-2"><Clock size={12} /> Time Tracker</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-4xl font-black mono tracking-tighter">{formatTime(seconds)}</span>
              <button
                onClick={() => setTimerActive(!timerActive)}
                className={`p-4 rounded-full transition-all ${timerActive ? 'bg-pink-500 text-white animate-pulse' : 'bg-[var(--accent)] text-black'}`}
              >
                {timerActive ? <Square size={20} /> : <Play size={20} className="ml-1" />}
              </button>
            </div>
          </div>

          {/* Task Info */}
          <div className="mb-8">
            <span className="ui-label block mb-4 opacity-40">Task Info</span>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <span className="opacity-50">Priority</span>
                <span className="font-bold">{task.priority || 'Medium'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">Status</span>
                <span className="font-bold">{task.status}</span>
              </div>
              {task.category && (
                <div className="flex justify-between">
                  <span className="opacity-50">Category</span>
                  <span className="font-bold">{task.category}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex justify-between">
                  <span className="opacity-50">Due Date</span>
                  <span className="font-bold">{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}

              {/* ── Assignee row: dropdown + AI button ── */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="opacity-50 flex items-center gap-1.5">
                    <User size={12} className="opacity-60" />
                    Assignee
                  </span>
                  {manualSaving && <span className="text-[10px] mono opacity-40"><Loader size={10} className="inline animate-spin mr-1" />Saving…</span>}
                  {!manualSaving && manualSavedMsg && <span className="text-[10px] mono text-green-400">✓ {manualSavedMsg}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {/* Manual dropdown */}
                  <div className="relative flex-grow">
                    <select
                      value={manualAssignee}
                      onChange={e => handleManualAssign(e.target.value)}
                      disabled={manualSaving}
                      className="w-full appearance-none glass-input px-3 py-2.5 pr-8 text-[12px] mono font-bold cursor-pointer rounded-sm disabled:opacity-40 hover:border-[var(--accent)]/40"
                    >
                      <option value="">Unassigned</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.display_name}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                  </div>

                  {/* AI Recommend toggle */}
                  {aiEnabled && (
                    <button
                      onClick={() => {
                        setShowRecommend(r => !r);
                        // If opening and no results yet, auto-run
                        if (!showRecommend && results.length === 0 && !assignedMsg) {
                          handleSuggest();
                        }
                      }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider border rounded-sm transition-all whitespace-nowrap ${
                        showRecommend
                          ? 'bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]'
                          : 'border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/10'
                      }`}
                      title="Get AI-powered recommendations"
                    >
                      <Sparkles size={12} />
                      {matching ? <Loader size={10} className="animate-spin" /> : 'Recommend'}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ── SMART RECOMMEND (collapsible) ── */}
          {showRecommend && (
          <div className="mb-8 border border-[var(--accent)]/20 rounded-sm overflow-hidden animate-in fade-in duration-200">
            <AISectionHeader
              title="Smart Recommend"
              subtitle="ranked by skill, experience & availability"
            />

            <div className="p-5 space-y-4">

              {/* Disabled */}
              {!aiEnabled ? (
                <div className="flex items-center gap-3 py-3 opacity-40">
                  <AlertTriangle size={14} />
                  <p className="text-[11px] mono">Smart Assign is currently disabled by your administrator.</p>
                </div>
              ) : assignedMsg ? (
                /* Success */
                <div className="flex items-center gap-2 text-green-400 text-[13px] font-bold mono">
                  <UserCheck size={16} /> {assignedMsg}
                </div>
              ) : (
                <>
                  {/* CTA */}
                  {results.length === 0 && (
                    <AITooltipButton
                      label="Smart Recommend"
                      tooltip="Scores every available team member against this task's skill requirements, experience, and workload — then ranks them for you to choose."
                      badgeLabel="Smart Assign"
                      onClick={handleSuggest}
                      disabled={matching}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)] rounded-sm text-[11px] font-black uppercase tracking-widest hover:bg-[var(--accent)]/10 transition-all disabled:opacity-40 active:scale-[0.98]"
                    >
                      {matching
                        ? <><Loader size={14} className="animate-spin" /> Analysing team…</>
                        : <><Sparkles size={14} /> ✨ Smart Recommend</>
                      }
                    </AITooltipButton>
                  )}

                  {/* Error / AI unavailable states */}
                  {aiUnavailable ? (
                    /* ── AI Unavailable callout ── */
                    <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-grow">
                          <p className="text-[12px] font-black text-amber-400">AI Unavailable</p>
                          <p className="text-[10px] mono opacity-60 mt-0.5 leading-relaxed">
                            {matchError || 'Could not reach the recommendation engine.'}
                          </p>
                        </div>
                      </div>
                      {/* Manual assign nudge */}
                      <div className="flex items-center gap-2 pl-6">
                        <div className="w-4 h-px bg-amber-400/40" />
                        <p className="text-[9px] mono text-amber-400/70">
                          Use the <span className="font-black">Assignee dropdown above</span> to assign manually.
                        </p>
                      </div>
                      <button
                        onClick={() => { setAiUnavailable(false); setMatchError(''); handleSuggest(); }}
                        className="w-full flex items-center justify-center gap-2 py-2 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-wider rounded-sm hover:bg-amber-500/10 transition-all"
                      >
                        <RotateCcw size={10} /> Try Again
                      </button>
                    </div>
                  ) : matchError ? (
                    /* ── Soft warning (no employees / partial failure) ── */
                    <div className="flex items-start gap-2 text-[11px] mono text-amber-400">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      {matchError}
                    </div>
                  ) : null}

                  {/* ── Ranked candidate list ── */}
                  {results.length > 0 && !selectedCandidate && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-40">
                          {results.length} candidates ranked — click to assign
                        </p>
                        <button
                          onClick={() => { setResults([]); setMatchError(''); }}
                          className="text-[9px] mono opacity-30 hover:opacity-100 transition-opacity"
                        >
                          Re-run
                        </button>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                        {results.map((candidate, idx) => {
                          const isTop = idx === 0;
                          const color = recColor(candidate.recommendation);
                          const { sentence, skillPct, expYears, availLevel, availColor } = buildExplanation(candidate);

                          return (
                            <button
                              key={candidate.employee_id}
                              onClick={() => setSelectedCandidate(candidate)}
                              className={`w-full flex items-center gap-3 p-3 rounded-sm border transition-all text-left group hover:scale-[1.01] active:scale-[0.99] ${
                                isTop
                                  ? `${color} shadow-sm`
                                  : 'border-[var(--border-color)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5'
                              }`}
                            >
                              {/* Rank + avatar */}
                              <div className="relative shrink-0">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black ${
                                  isTop ? 'bg-current/20' : 'bg-white/5'
                                }`}>
                                  {candidate.full_name.charAt(0).toUpperCase()}
                                </div>
                                {isTop && (
                                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--accent)] text-black text-[8px] font-black rounded-full flex items-center justify-center">1</span>
                                )}
                                {!isTop && (
                                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white/10 text-[8px] font-black rounded-full flex items-center justify-center opacity-50">{idx + 1}</span>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-black truncate">{candidate.full_name}</span>
                                  {isTop && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[var(--accent)]/20 text-[var(--accent)] rounded-sm shrink-0">Best</span>}
                                </div>
                                <p className="text-[10px] mono opacity-50 truncate capitalize">
                                  {candidate.seniority_level} · {candidate.role || 'Team Member'}
                                </p>
                                {/* Plain-English sentence */}
                                <p className="text-[9px] mono opacity-60 mt-0.5 italic truncate">"{sentence}"</p>
                                {/* Stat pills */}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[8px] mono font-bold px-1.5 py-0.5 rounded-sm bg-white/5 opacity-70">
                                    🧠 {skillPct}% skill
                                  </span>
                                  <span className="text-[8px] mono font-bold px-1.5 py-0.5 rounded-sm bg-white/5 opacity-70">
                                    📅 {expYears}
                                  </span>
                                  <span className={`text-[8px] mono font-bold px-1.5 py-0.5 rounded-sm bg-white/5 ${availColor}`}>
                                    ⚡ {availLevel}
                                  </span>
                                </div>
                              </div>

                              {/* Score + Confidence */}
                              <div className="shrink-0 text-right">
                                <span className={`text-[18px] font-black mono leading-none ${
                                  candidate.score >= 70 ? 'text-green-400' :
                                  candidate.score >= 45 ? 'text-yellow-400' : 'text-red-400'
                                }`}>{candidate.score}%</span>
                                <p className="text-[8px] mono opacity-40">match</p>
                                {/* Confidence badge */}
                                <span className={`inline-block mt-1 text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 border rounded-sm ${getConfidence(candidate.score).bg} ${getConfidence(candidate.score).color}`}>
                                  {getConfidence(candidate.score).label}
                                </span>
                              </div>

                              <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
                            </button>
                          );
                        })}
                      </div>

                      {/* Footer note */}
                      <div className="flex items-start gap-2 opacity-25 hover:opacity-50 transition-opacity pt-1">
                        <Sparkles size={10} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                        <p className="text-[9px] mono leading-relaxed">
                          Ranked by skill match, proficiency, experience, and availability. No external AI — powered by your team's skill database.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Confirm assignment panel ── */}
                  {selectedCandidate && (() => {
                    const { sentence, skillPct, expYears, availLevel, availColor } = buildExplanation(selectedCandidate);
                    return (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Confirm Assignment</p>

                        {/* Selected card */}
                        <div className={`border rounded-sm p-4 space-y-3 ${recColor(selectedCandidate.recommendation)}`}>
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-full bg-current/20 flex items-center justify-center text-[18px] font-black shrink-0">
                              {selectedCandidate.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-grow min-w-0">
                              <p className="text-[15px] font-black truncate">{selectedCandidate.full_name}</p>
                              <p className="text-[11px] mono opacity-60 capitalize">
                                {selectedCandidate.seniority_level} · {selectedCandidate.role || 'Team Member'}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-[22px] font-black mono">{selectedCandidate.score}%</span>
                              <p className="text-[8px] mono opacity-40">match</p>
                              {/* Confidence badge — prominent in confirm panel */}
                              <span className={`inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-sm ${
                                getConfidence(selectedCandidate.score).bg
                              } ${getConfidence(selectedCandidate.score).color}`}>
                                Confidence: {getConfidence(selectedCandidate.score).label}
                              </span>
                            </div>
                          </div>

                          {/* Plain-English sentence */}
                          <p className="text-[11px] mono italic opacity-70 border-l-2 border-current/30 pl-3">
                            "{sentence}"
                          </p>

                          {/* KPI stat row — 4 cells */}
                          <div className="grid grid-cols-4 gap-2 pt-1">
                            <div className="text-center bg-black/10 rounded-sm px-2 py-2">
                              <p className="text-[16px] font-black mono leading-none">{skillPct}%</p>
                              <p className="text-[8px] mono opacity-50 mt-0.5">Skill match</p>
                            </div>
                            <div className="text-center bg-black/10 rounded-sm px-2 py-2">
                              <p className="text-[14px] font-black mono leading-none">{expYears}</p>
                              <p className="text-[8px] mono opacity-50 mt-0.5">Experience</p>
                            </div>
                            <div className="text-center bg-black/10 rounded-sm px-2 py-2">
                              <p className={`text-[12px] font-black mono leading-none ${availColor}`}>{availLevel}</p>
                              <p className="text-[8px] mono opacity-50 mt-0.5">Availability</p>
                            </div>
                            <div className="text-center bg-black/10 rounded-sm px-2 py-2">
                              <p className={`text-[13px] font-black mono leading-none ${getConfidence(selectedCandidate.score).color}`}>
                                {getConfidence(selectedCandidate.score).label}
                              </p>
                              <p className="text-[8px] mono opacity-50 mt-0.5">Confidence</p>
                            </div>
                          </div>

                          {/* Matched skill chips */}
                          {selectedCandidate.matched_skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {selectedCandidate.matched_skills.slice(0, 4).map(s => (
                                <span key={s} className="text-[8px] mono px-1.5 py-0.5 bg-green-500/15 text-green-300 rounded-sm">✓ {s}</span>
                              ))}
                              {selectedCandidate.missing_skills.slice(0, 2).map(s => (
                                <span key={s} className="text-[8px] mono px-1.5 py-0.5 bg-red-500/10 text-red-300/70 rounded-sm">✗ {s}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Action row */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleAssign}
                            disabled={assigning}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-sm text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40 ${recColor(selectedCandidate.recommendation)} hover:brightness-125`}
                          >
                            {assigning
                              ? <><Loader size={12} className="animate-spin" /> Assigning…</>
                              : <><UserCheck size={13} /> Assign {selectedCandidate.full_name.split(' ')[0]}</>
                            }
                          </button>
                          <button
                            onClick={() => setSelectedCandidate(null)}
                            className="px-4 py-3 border border-[var(--border-color)] rounded-sm text-[10px] font-bold mono uppercase opacity-50 hover:opacity-100 transition-all"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          )} {/* end showRecommend */}

          {/* Action Bar */}
          <div className="pt-8 border-t border-white/5 grid grid-cols-2 gap-4 mt-auto">
            <button
              onClick={() => handleStatusChange('Review')}
              className="py-4 border border-white/10 rounded-sm font-black text-[13px] uppercase tracking-widest hover:bg-white/5 transition-all"
            >
              Request Review
            </button>
            <button
              onClick={() => handleStatusChange('Completed')}
              className="py-4 bg-green-600 text-white rounded-sm font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-green-700"
            >
              <CheckCircle size={16} /> Complete
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskDrawer;
