
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, Clock, Users, Link2,
  RefreshCw, ChevronRight, CheckCircle, TrendingUp,
  XCircle, AlertCircle, Info
} from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
interface RiskItem {
  type: 'overdue' | 'blocked' | 'inactive' | 'workload';
  severity: 'high' | 'medium' | 'low';
  label: string;
  description: string;
  count: number;
  affectedNames: string[];
  weight: number;
}

interface RiskResult {
  score: number;
  label: 'Low' | 'Medium' | 'High';
  items: RiskItem[];
  totalTasks: number;
  calculatedAt: Date;
  mlRisk?: {
     overall_risk_level: string;
     risk_score: number;
     predicted_delay_days: number;
     predicted_budget_overrun_pct: number;
     bert_risk: string;
     bert_confidence: number;
     extracted_info: any;
  };
}

/* ─────────────────────────────────────────────────────
   RISK ENGINE
───────────────────────────────────────────────────── */
const INACTIVE_DAYS = 7;
const OVERLOADED_TASKS = 6;
const OVERLOADED_AVAIL = 40;

export async function computeRisk(projectId: string | null): Promise<RiskResult> {
  const now = new Date();
  const inactiveThreshold = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  /* ── 1. Fetch all tasks for this project ── */
  let taskQuery = supabase
    .from('tasks')
    .select('id, title, status, due_date, updated_at, assigned_to');
  if (projectId) taskQuery = taskQuery.eq('project_id', projectId);
  const { data: tasks = [] } = await taskQuery;

  const activeTasks = (tasks || []).filter(
    (t: any) => t.status !== 'Completed' && t.status !== 'Done' && t.status !== 'Cancelled'
  );
  const totalTasks = Math.max((tasks || []).length, 1);

  /* ── 2. Overdue tasks ── */
  const overdueTasks = activeTasks.filter(
    (t: any) => t.due_date && new Date(t.due_date) < now
  );

  /* ── 3. Blocked tasks (have at least one uncompleted dependency) ── */
  let blockedTasks: any[] = [];
  if ((tasks || []).length > 0) {
    const taskIds = (tasks || []).map((t: any) => t.id);
    const { data: deps = [] } = await supabase
      .from('task_dependencies')
      .select('task_id, depends_on_task_id')
      .in('task_id', taskIds);

    if ((deps || []).length > 0) {
      // Find which dependency tasks are NOT completed
      const depTaskIds = [...new Set((deps || []).map((d: any) => d.depends_on_task_id))];
      const { data: depTasks = [] } = await supabase
        .from('tasks')
        .select('id, status')
        .in('id', depTaskIds);

      const incompleteDepsSet = new Set(
        (depTasks || [])
          .filter((t: any) => t.status !== 'Completed' && t.status !== 'Done')
          .map((t: any) => t.id)
      );

      // A task is blocked if any of its dependencies are incomplete
      const blockedIds = new Set<string>();
      (deps || []).forEach((d: any) => {
        if (incompleteDepsSet.has(d.depends_on_task_id)) {
          blockedIds.add(d.task_id);
        }
      });

      blockedTasks = activeTasks.filter((t: any) => blockedIds.has(t.id));
    }
  }

  /* ── 4. Inactive tasks (not updated in 7+ days, still active) ── */
  const inactiveTasks = activeTasks.filter(
    (t: any) => t.updated_at && t.updated_at < inactiveThreshold
  );

  /* ── 5. Overloaded users ── */
  let overloadedUserNames: string[] = [];
  if (projectId) {
    // Task counts per user in this project
    const { data: memberTasks = [] } = await supabase
      .from('tasks')
      .select('assigned_to')
      .eq('project_id', projectId)
      .not('status', 'in', '("Completed","Done","Cancelled")');

    const taskCounts: Record<string, number> = {};
    (memberTasks || []).forEach((t: any) => {
      if (t.assigned_to) taskCounts[t.assigned_to] = (taskCounts[t.assigned_to] || 0) + 1;
    });

    // Get employees availability
    const { data: employees = [] } = await supabase
      .from('employees')
      .select('full_name, availability_percentage, is_available');

    // Get profile names for user ids
    const userIds = Object.keys(taskCounts);
    if (userIds.length > 0) {
      const { data: profiles = [] } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);

      const empMap: Record<string, { avail: number; isAvail: boolean }> = {};
      (employees || []).forEach((e: any) => {
        empMap[e.full_name?.toLowerCase().trim()] = {
          avail: e.availability_percentage ?? 100,
          isAvail: e.is_available ?? true,
        };
      });

      (profiles || []).forEach((p: any) => {
        const count = taskCounts[p.id] || 0;
        const empKey = p.display_name?.toLowerCase().trim() || '';
        const emp = empMap[empKey];
        const avail = emp?.avail ?? 100;
        const isAvail = emp?.isAvail ?? true;

        if (!isAvail || avail < OVERLOADED_AVAIL || count >= OVERLOADED_TASKS) {
          overloadedUserNames.push(p.display_name || 'Unknown');
        }
      });
    }
  }

  /* ── 6. Score calculation ── */
  const raw =
    overdueTasks.length * 0.4 +
    blockedTasks.length * 0.3 +
    inactiveTasks.length * 0.2 +
    overloadedUserNames.length * 0.1;

  const score = Math.min(100, Math.round((raw / totalTasks) * 100));
  const label: 'Low' | 'Medium' | 'High' =
    score <= 30 ? 'Low' : score <= 70 ? 'Medium' : 'High';

  /* ── 7. Build risk items list ── */
  const items: RiskItem[] = [];

  if (overdueTasks.length > 0) {
    items.push({
      type: 'overdue',
      severity: overdueTasks.length >= 5 ? 'high' : overdueTasks.length >= 2 ? 'medium' : 'low',
      label: 'Overdue Tasks',
      description: `${overdueTasks.length} task${overdueTasks.length !== 1 ? 's are' : ' is'} past deadline`,
      count: overdueTasks.length,
      affectedNames: overdueTasks.slice(0, 4).map((t: any) => t.title),
      weight: 0.4,
    });
  }

  if (blockedTasks.length > 0) {
    items.push({
      type: 'blocked',
      severity: blockedTasks.length >= 3 ? 'high' : 'medium',
      label: 'Blocked Tasks',
      description: `${blockedTasks.length} task${blockedTasks.length !== 1 ? 's have' : ' has'} unresolved dependencies`,
      count: blockedTasks.length,
      affectedNames: blockedTasks.slice(0, 4).map((t: any) => t.title),
      weight: 0.3,
    });
  }

  if (inactiveTasks.length > 0) {
    items.push({
      type: 'inactive',
      severity: inactiveTasks.length >= 5 ? 'high' : inactiveTasks.length >= 2 ? 'medium' : 'low',
      label: 'Stale Tasks',
      description: `${inactiveTasks.length} task${inactiveTasks.length !== 1 ? 's have' : ' has'} not been updated in ${INACTIVE_DAYS}+ days`,
      count: inactiveTasks.length,
      affectedNames: inactiveTasks.slice(0, 4).map((t: any) => t.title),
      weight: 0.2,
    });
  }

  if (overloadedUserNames.length > 0) {
    items.push({
      type: 'workload',
      severity: overloadedUserNames.length >= 3 ? 'high' : 'medium',
      label: 'Overloaded Members',
      description: `${overloadedUserNames.length} team member${overloadedUserNames.length !== 1 ? 's are' : ' is'} overloaded`,
      count: overloadedUserNames.length,
      affectedNames: overloadedUserNames.slice(0, 4),
      weight: 0.1,
    });
  }

  return { score, label, items, totalTasks, calculatedAt: now };
}

/* ─────────────────────────────────────────────────────
   HELPER: Risk label styling
───────────────────────────────────────────────────── */
const riskStyle = (label: 'Low' | 'Medium' | 'High') => {
  if (label === 'High') return { color: '#FF007A', glow: '#FF007A40', bg: 'bg-red-500/10 border-red-500/20 text-red-400' };
  if (label === 'Medium') return { color: '#FFA500', glow: '#FFA50040', bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400' };
  return { color: '#39FF14', glow: '#39FF1440', bg: 'bg-green-500/10 border-green-500/20 text-green-400' };
};

const typeIcon = (type: RiskItem['type']) => {
  if (type === 'overdue') return { Icon: Clock, color: 'text-red-400', bg: 'bg-red-500/10' };
  if (type === 'blocked') return { Icon: Link2, color: 'text-orange-400', bg: 'bg-orange-500/10' };
  if (type === 'inactive') return { Icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  return { Icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' };
};

const severityBadge = (s: RiskItem['severity']) => {
  if (s === 'high') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (s === 'medium') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  return 'text-green-400 bg-green-500/10 border-green-500/20';
};

/* ─────────────────────────────────────────────────────
   RISK BAR
───────────────────────────────────────────────────── */
const RiskBar: React.FC<{ score: number; label: 'Low' | 'Medium' | 'High' }> = ({ score, label }) => {
  const barColor =
    label === 'High' ? '#FF007A' :
    label === 'Medium' ? '#FFA500' :
    '#39FF14';

  const glowColor =
    label === 'High' ? '#FF007A55' :
    label === 'Medium' ? '#FFA50055' :
    '#39FF1455';

  return (
    <div className="space-y-2 w-full">
      {/* Labels */}
      <div className="flex justify-between items-center">
        <span className="text-[9px] mono font-bold uppercase tracking-widest opacity-30">Risk Level</span>
        <span className="text-[9px] mono font-bold uppercase tracking-widest opacity-30">{score} / 100</span>
      </div>

      {/* Track */}
      <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden">
        {/* Zone shading: green 0–30, yellow 30–70, red 70–100 */}
        <div className="absolute inset-y-0 left-0 w-[30%] bg-green-500/10 rounded-l-full" />
        <div className="absolute inset-y-0 left-[30%] w-[40%] bg-orange-500/10" />
        <div className="absolute inset-y-0 left-[70%] w-[30%] bg-red-500/10 rounded-r-full" />

        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${score}%`,
            background: barColor,
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        />

        {/* Tick marks at 30 and 70 */}
        <div className="absolute inset-y-0 left-[30%] w-px bg-white/10" />
        <div className="absolute inset-y-0 left-[70%] w-px bg-white/10" />
      </div>

      {/* Zone labels */}
      <div className="flex text-[8px] mono font-bold uppercase tracking-widest">
        <span className="w-[30%] text-green-500/50">Low</span>
        <span className="w-[40%] text-center text-orange-500/50">Medium</span>
        <span className="w-[30%] text-right text-red-500/50">High</span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   RISK GAUGE (SVG)
───────────────────────────────────────────────────── */
const RiskGauge: React.FC<{ score: number; label: 'Low' | 'Medium' | 'High' }> = ({ score, label }) => {
  const style = riskStyle(label);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * score) / 100;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 148, height: 148 }}>
      <svg width="148" height="148" viewBox="0 0 148 148" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="74" cy="74" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="opacity-10" />
        {/* Progress */}
        <circle
          cx="74" cy="74" r={radius}
          fill="none"
          stroke={style.color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
          style={{ filter: `drop-shadow(0 0 6px ${style.color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black mono leading-none">{score}</span>
        <span className="text-[9px] mono opacity-40 font-bold uppercase tracking-widest mt-1">out of 100</span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   ACTION SUGGESTION
───────────────────────────────────────────────────── */
const actionFor = (item: RiskItem, onTabSwitch?: (tab: string) => void): { text: string; tab?: string } => {
  if (item.type === 'overdue') return { text: 'Review and reassign overdue tasks on the Board', tab: 'board' };
  if (item.type === 'blocked') return { text: 'Resolve blocking dependencies to unblock waiting tasks', tab: 'board' };
  if (item.type === 'inactive') return { text: 'Check in on stale tasks — they may be stuck or forgotten', tab: 'list' };
  return { text: 'Redistribute tasks from overloaded team members', tab: 'members' };
};

/* ─────────────────────────────────────────────────────
   RISKS TAB (MAIN)
───────────────────────────────────────────────────── */
interface RisksTabProps {
  projectId: string;
  onTabSwitch?: (tab: string) => void;
}

const RisksTab: React.FC<RisksTabProps> = ({ projectId, onTabSwitch }) => {
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await computeRisk(projectId);
      
      // ── AI Predictive Risk (BERT + LightGBM) ──
      try {
        if (projectId) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token || '';
          
          const mlRes = await fetch(`/api/projects/${projectId}/ml-risk`, {
             headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (mlRes.ok) {
             const mlData = await mlRes.json();
             r.mlRisk = mlData; 
          } else {
             console.log('ML Risk fetch failed:', mlRes.status, await mlRes.text());
          }
        }
      } catch (mlErr) {
        console.warn('Could not fetch ML risk:', mlErr);
      }
      
      setResult(r);
    } catch (err: any) {
      console.error('Risk calculation error:', err);
      setError(err.message || 'Failed to calculate risk.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { calculate(); }, [calculate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-30">
        <Shield size={36} className="animate-pulse" />
        <span className="mono text-[13px] uppercase tracking-widest">Calculating risk…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 text-center border border-red-500/20">
        <XCircle size={28} className="mx-auto mb-3 text-red-400 opacity-60" />
        <p className="mono text-[13px] text-red-400">{error}</p>
        <button onClick={calculate} className="mt-4 px-4 py-2 text-[11px] font-black uppercase tracking-widest border border-[var(--border-color)] hover:border-[var(--accent)] transition-all">
          Retry
        </button>
      </div>
    );
  }

  if (!result) return null;

  const style = riskStyle(result.label);
  const timeAgo = Math.round((Date.now() - result.calculatedAt.getTime()) / 1000);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
          <Shield size={14} /> Risk Analysis
        </h2>
        <button
          onClick={calculate}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-30 hover:opacity-100 transition-all"
        >
          <RefreshCw size={12} /> Recalculate
        </button>
      </div>

      {/* ── SECTION 0: AI Predictive Intelligence (ML) ── */}
      {result.mlRisk && (
        <div className="glass-panel p-8 border border-[var(--accent)]/30 relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 bg-[var(--accent)] text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 z-10 shadow-lg">
            BERT & LightGBM Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* AI Risk Score */}
             <div className="flex flex-col items-center justify-center p-6 bg-black/20 rounded-sm border border-white/5">
                <span className="text-[10px] mono uppercase tracking-widest opacity-50 mb-2">AI Risk Score</span>
                <span className="text-4xl font-black mono text-[var(--accent)] drop-shadow-[0_0_12px_rgba(57,255,20,0.4)]">
                   {result.mlRisk.risk_score}%
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest mt-3 px-3 py-1 border rounded-sm" style={{borderColor: result.mlRisk.overall_risk_level === 'HIGH' ? '#ff3b30' : result.mlRisk.overall_risk_level === 'MEDIUM' ? '#ff9500' : '#34c759', color: result.mlRisk.overall_risk_level === 'HIGH' ? '#ff3b30' : result.mlRisk.overall_risk_level === 'MEDIUM' ? '#ff9500' : '#34c759'}}>
                   {result.mlRisk.overall_risk_level} PROBABILITY
                </span>
             </div>
             
             {/* Timeline Delay */}
             <div className="flex flex-col items-center justify-center p-6 bg-black/20 rounded-sm border border-white/5">
                <span className="text-[10px] mono uppercase tracking-widest opacity-50 mb-2">Predicted Delay</span>
                <span className={`text-4xl font-black mono drop-shadow-md ${result.mlRisk.predicted_delay_days > 0 ? 'text-red-400' : 'text-green-400'}`}>
                   {result.mlRisk.predicted_delay_days > 0 ? '+' : ''}{result.mlRisk.predicted_delay_days}
                </span>
                <span className="text-[11px] mono opacity-40 mt-3 font-bold">Days Added To Timeline</span>
             </div>

             {/* Budget Overrun */}
             <div className="flex flex-col items-center justify-center p-6 bg-black/20 rounded-sm border border-white/5">
                <span className="text-[10px] mono uppercase tracking-widest opacity-50 mb-2">Budget Variance</span>
                <span className={`text-4xl font-black mono drop-shadow-md ${result.mlRisk.predicted_budget_overrun_pct > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                   {result.mlRisk.predicted_budget_overrun_pct > 0 ? '+' : ''}{result.mlRisk.predicted_budget_overrun_pct}%
                </span>
                <span className="text-[11px] mono opacity-40 mt-3 font-bold">Expected Overrun</span>
             </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 flex items-start gap-3">
             <Info size={14} className="mt-0.5 text-[var(--accent)] shrink-0" />
             <p className="text-[11px] mono opacity-60 leading-relaxed">
               <strong>Semantic Analysis (BERT):</strong> {typeof result.mlRisk.bert_risk === 'string' ? result.mlRisk.bert_risk.toUpperCase() : 'UNKNOWN'} Risk (Confidence: {Math.round(result.mlRisk.bert_confidence * 100)}%). 
               Extracted timeline: {result.mlRisk.extracted_info?.Estimated_Timeline_Months}mo, Budget: ${result.mlRisk.extracted_info?.Project_Budget_USD?.toLocaleString()}, Team Size: {result.mlRisk.extracted_info?.team_size}.
             </p>
          </div>
        </div>
      )}

      {/* ── SECTION 1: Standard Rule-Based Risk Overview ── */}
      <div className="glass-panel p-8">
        {/* Horizontal risk bar — spans full width */}
        <div className="mb-8">
          <RiskBar score={result.score} label={result.label} />
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-10">

          {/* Gauge */}
          <div className="shrink-0 flex flex-col items-center gap-4">
            <RiskGauge score={result.score} label={result.label} />
            <span
              className={`text-[11px] font-black uppercase tracking-widest px-4 py-1.5 border rounded-sm ${style.bg}`}
            >
              {result.label} Risk
            </span>
          </div>

          {/* Summary metrics */}
          <div className="flex-grow space-y-5">
            <div>
              <h3 className="text-[22px] font-black uppercase tracking-tight leading-none">
                Risk Score: {result.score}/100
              </h3>
              <p className="text-[12px] mono opacity-40 mt-1">
                Calculated from {result.totalTasks} task{result.totalTasks !== 1 ? 's' : ''} •
                {' '}{timeAgo < 5 ? ' just now' : ` ${timeAgo}s ago`}
              </p>
            </div>

            {/* Factor bars */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Overdue', count: result.items.find(i => i.type === 'overdue')?.count || 0, color: 'bg-red-500', weight: '40%' },
                { label: 'Blocked', count: result.items.find(i => i.type === 'blocked')?.count || 0, color: 'bg-orange-500', weight: '30%' },
                { label: 'Stale', count: result.items.find(i => i.type === 'inactive')?.count || 0, color: 'bg-yellow-500', weight: '20%' },
                { label: 'Overloaded', count: result.items.find(i => i.type === 'workload')?.count || 0, color: 'bg-blue-500', weight: '10%' },
              ].map(f => (
                <div key={f.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] mono font-bold uppercase opacity-50">{f.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black mono">{f.count}</span>
                      <span className="text-[8px] mono opacity-30">×{f.weight}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${f.color} rounded-full transition-all duration-700`}
                      style={{ width: f.count > 0 ? `${Math.min(100, (f.count / result.totalTasks) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {result.items.length === 0 && (
              <div className="flex items-center gap-3 py-3 text-green-400">
                <CheckCircle size={18} />
                <span className="text-[13px] font-bold">No active risks detected for this project.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Risk Breakdown ── */}
      {result.items.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest opacity-40">Risk Breakdown</h3>
          <div className="glass-panel overflow-hidden divide-y divide-[var(--border-color)]">
            {result.items.map((item) => {
              const { Icon, color, bg } = typeIcon(item.type);
              return (
                <div key={item.type} className="flex items-start gap-5 p-5 hover:bg-white/3 transition-colors">
                  {/* Icon */}
                  <div className={`w-10 h-10 ${bg} rounded-sm flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={16} className={color} />
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[14px] font-black uppercase tracking-tight">{item.label}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm ${severityBadge(item.severity)}`}>
                        {item.severity}
                      </span>
                      <span className="text-[11px] mono opacity-50">{item.description}</span>
                    </div>

                    {/* Affected names */}
                    {item.affectedNames.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.affectedNames.map((name, i) => (
                          <span
                            key={i}
                            className="text-[10px] mono px-2.5 py-1 bg-white/5 border border-[var(--border-color)] rounded-sm truncate max-w-[200px]"
                          >
                            {name}
                          </span>
                        ))}
                        {item.count > 4 && (
                          <span className="text-[10px] mono px-2.5 py-1 opacity-30">+{item.count - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Weight badge */}
                  <div className="shrink-0 text-right">
                    <span className="text-[9px] mono opacity-30 uppercase">weight</span>
                    <div className="text-[14px] font-black mono opacity-60">{Math.round(item.weight * 100)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 3: Suggested Actions ── */}
      {result.items.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest opacity-40">Suggested Actions</h3>
          <div className="glass-panel overflow-hidden divide-y divide-[var(--border-color)]">
            {result.items.map((item) => {
              const action = actionFor(item);
              const { Icon, color } = typeIcon(item.type);
              return (
                <div key={item.type} className="flex items-center gap-5 p-4 group">
                  <Icon size={15} className={`${color} opacity-70 shrink-0`} />
                  <span className="text-[13px] flex-grow">{action.text}</span>
                  {action.tab && onTabSwitch && (
                    <button
                      onClick={() => onTabSwitch(action.tab!)}
                      className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 shrink-0"
                    >
                      Go <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No risks state */}
      {result.items.length === 0 && (
        <div className="glass-panel p-12 text-center border-dashed border-[var(--border-color)]">
          <CheckCircle size={36} className="mx-auto mb-4 text-green-400 opacity-60" />
          <h3 className="text-[16px] font-black uppercase tracking-tight text-green-400 mb-2">All Clear</h3>
          <p className="text-[12px] mono opacity-40">
            No overdue, blocked, stale, or workload issues detected. Keep it up.
          </p>
        </div>
      )}

      {/* Methodology note */}
      <div className="flex items-start gap-3 p-4 bg-white/2 border border-[var(--border-color)] rounded-sm">
        <Info size={13} className="mt-0.5 opacity-30 shrink-0" />
        <p className="text-[10px] mono opacity-30 leading-relaxed">
          Score = (overdue×0.4 + blocked×0.3 + stale×0.2 + overloaded×0.1) ÷ total tasks × 100.
          Stale threshold: {INACTIVE_DAYS} days. Overloaded: ≥{OVERLOADED_TASKS} tasks or &lt;{OVERLOADED_AVAIL}% availability.
          All data pulled live from the database.
        </p>
      </div>

    </div>
  );
};

export default RisksTab;
