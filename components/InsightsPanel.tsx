
import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, ChevronRight, Clock, Users, Link2, AlertCircle, TrendingDown } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
type InsightSeverity = 'critical' | 'warning' | 'info';
type InsightType = 'overdue' | 'blocked' | 'workload' | 'inactive' | 'progress';

interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;                 // short headline
  detail: string;                // one-sentence explanation
  action?: string;               // recommended action label
  actionTab?: string;            // which workspace tab to jump to
}

/* ─────────────────────────────────────────────────────
   STYLE MAPS
───────────────────────────────────────────────────── */
const severityStyles: Record<InsightSeverity, { border: string; bg: string; dot: string; text: string }> = {
  critical: {
    border: 'border-red-500/25',
    bg: 'bg-red-500/5',
    dot: 'bg-red-500',
    text: 'text-red-400',
  },
  warning: {
    border: 'border-orange-500/25',
    bg: 'bg-orange-500/5',
    dot: 'bg-orange-500',
    text: 'text-orange-400',
  },
  info: {
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
  },
};

const typeIcon: Record<InsightType, React.ElementType> = {
  overdue: Clock,
  blocked: Link2,
  workload: Users,
  inactive: AlertCircle,
  progress: TrendingDown,
};

/* ─────────────────────────────────────────────────────
   INSIGHT ENGINE  (rule-based, mirrors risk engine)
───────────────────────────────────────────────────── */
const INACTIVE_DAYS = 7;
const OVERLOAD_TASKS = 6;
const OVERLOAD_AVAIL = 40;

async function generateInsights(projectId: string): Promise<Insight[]> {
  const now = new Date();
  const inactiveThreshold = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const insights: Insight[] = [];

  /* ── 1. Fetch tasks ── */
  const { data: tasks = [] } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, updated_at, assigned_to, priority, profiles:assigned_to(display_name)')
    .eq('project_id', projectId);

  const active = (tasks || []).filter(
    (t: any) => t.status !== 'Completed' && t.status !== 'Done' && t.status !== 'Cancelled'
  );
  const total = (tasks || []).length;

  /* ── 2. Overdue: pick the most critical one ── */
  const overdue = active.filter(
    (t: any) => t.due_date && new Date(t.due_date) < now
  ).sort((a: any, b: any) => {
    // Sort by priority then by how overdue they are
    const pri = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return (pri[b.priority as keyof typeof pri] || 2) - (pri[a.priority as keyof typeof pri] || 2);
  });

  if (overdue.length > 0) {
    const worst = overdue[0] as any;
    const daysLate = Math.floor((now.getTime() - new Date(worst.due_date).getTime()) / 86400000);
    const assignee = worst.profiles?.display_name;
    insights.push({
      id: `overdue-${worst.id}`,
      type: 'overdue',
      severity: overdue.length >= 3 || worst.priority === 'Critical' ? 'critical' : 'warning',
      title: overdue.length === 1
        ? `"${worst.title}" is overdue`
        : `${overdue.length} tasks are overdue`,
      detail: overdue.length === 1
        ? `${daysLate}d past deadline${assignee ? ` — assigned to ${assignee}` : ''}.`
        : `The most critical is "${worst.title}" (${daysLate}d late).`,
      action: 'Review on Board',
      actionTab: 'board',
    });
  }

  /* ── 3. Blocked tasks ── */
  if ((tasks || []).length > 0) {
    const taskIds = (tasks || []).map((t: any) => t.id);
    const { data: deps = [] } = await supabase
      .from('task_dependencies')
      .select('task_id, depends_on_task_id')
      .in('task_id', taskIds);

    if ((deps || []).length > 0) {
      const depIds = [...new Set((deps || []).map((d: any) => d.depends_on_task_id))];
      const { data: depTasks = [] } = await supabase
        .from('tasks').select('id, status').in('id', depIds);

      const incompleteSet = new Set(
        (depTasks || [])
          .filter((t: any) => t.status !== 'Completed' && t.status !== 'Done')
          .map((t: any) => t.id)
      );

      const blockedIds = new Set<string>();
      (deps || []).forEach((d: any) => {
        if (incompleteSet.has(d.depends_on_task_id)) blockedIds.add(d.task_id);
      });

      const blocked = active.filter((t: any) => blockedIds.has(t.id));
      if (blocked.length > 0) {
        const first = blocked[0] as any;
        insights.push({
          id: `blocked-${first.id}`,
          type: 'blocked',
          severity: blocked.length >= 3 ? 'critical' : 'warning',
          title: blocked.length === 1
            ? `"${first.title}" is waiting on a blocker`
            : `${blocked.length} tasks are blocked`,
          detail: `${blocked.length === 1 ? 'This task has' : 'These tasks have'} unresolved dependencies preventing progress.`,
          action: 'See Dependencies',
          actionTab: 'board',
        });
      }
    }
  }

  /* ── 4. Overloaded members ── */
  const { data: memberTasks = [] } = await supabase
    .from('tasks')
    .select('assigned_to, profiles:assigned_to(display_name)')
    .eq('project_id', projectId)
    .not('status', 'in', '("Completed","Done","Cancelled")');

  const counts: Record<string, { count: number; name: string }> = {};
  (memberTasks || []).forEach((t: any) => {
    if (t.assigned_to) {
      if (!counts[t.assigned_to]) {
        counts[t.assigned_to] = { count: 0, name: t.profiles?.display_name || 'Unknown' };
      }
      counts[t.assigned_to].count++;
    }
  });

  const { data: employees = [] } = await supabase
    .from('employees')
    .select('full_name, availability_percentage, is_available');

  const empMap: Record<string, { avail: number; isAvail: boolean }> = {};
  (employees || []).forEach((e: any) => {
    empMap[e.full_name?.toLowerCase().trim()] = {
      avail: e.availability_percentage ?? 100,
      isAvail: e.is_available ?? true,
    };
  });

  const overloaded = Object.values(counts).filter(({ count, name }) => {
    const emp = empMap[name.toLowerCase().trim()];
    return count >= OVERLOAD_TASKS || (emp && (!emp.isAvail || emp.avail < OVERLOAD_AVAIL));
  });

  if (overloaded.length > 0) {
    const first = overloaded[0];
    insights.push({
      id: `workload-${first.name}`,
      type: 'workload',
      severity: overloaded.length >= 2 ? 'critical' : 'warning',
      title: overloaded.length === 1
        ? `${first.name} is overloaded`
        : `${overloaded.length} members are overloaded`,
      detail: overloaded.length === 1
        ? `${first.name} has ${first.count} active tasks — consider redistributing.`
        : `${overloaded.map(o => o.name).slice(0, 2).join(' and ')} have too many tasks assigned.`,
      action: 'View Members',
      actionTab: 'members',
    });
  }

  /* ── 5. Stale tasks (inactive 7+ days) ── */
  const stale = active.filter(
    (t: any) => t.updated_at && t.updated_at < inactiveThreshold
  );
  if (stale.length > 0 && insights.length < 3) {
    const first = stale[0] as any;
    insights.push({
      id: `stale-${first.id}`,
      type: 'inactive',
      severity: 'info',
      title: stale.length === 1
        ? `"${first.title}" hasn't moved in ${INACTIVE_DAYS}+ days`
        : `${stale.length} tasks are stale`,
      detail: `${stale.length === 1 ? 'This task' : 'These tasks'} may be forgotten or stuck — a quick check-in can help.`,
      action: 'Review in List',
      actionTab: 'list',
    });
  }

  /* ── 6. Low progress warning ── */
  if (total >= 5 && insights.length < 3) {
    const completed = (tasks || []).filter(
      (t: any) => t.status === 'Completed' || t.status === 'Done'
    ).length;
    const pct = Math.round((completed / total) * 100);
    if (pct < 20 && active.length > 0) {
      insights.push({
        id: 'progress-low',
        type: 'progress',
        severity: 'info',
        title: `Only ${pct}% of tasks completed`,
        detail: `${completed} of ${total} tasks done. The project may need a sprint review or re-prioritization.`,
        action: 'Open Sprints',
        actionTab: 'sprints',
      });
    }
  }

  // Cap at 3
  return insights.slice(0, 3);
}

/* ─────────────────────────────────────────────────────
   INSIGHT CARD
───────────────────────────────────────────────────── */
const InsightCard: React.FC<{
  insight: Insight;
  onDismiss: (id: string) => void;
  onAction: (tab: string) => void;
}> = ({ insight, onDismiss, onAction }) => {
  const s = severityStyles[insight.severity];
  const Icon = typeIcon[insight.type];

  return (
    <div
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-sm border
        ${s.border} ${s.bg}
        animate-in fade-in slide-in-from-top-1 duration-300
        group
      `}
    >
      {/* Severity dot */}
      <div className={`w-1.5 h-1.5 rounded-full ${s.dot} mt-1.5 shrink-0 animate-pulse`} />

      {/* Icon */}
      <Icon size={13} className={`${s.text} shrink-0 mt-0.5`} />

      {/* Content */}
      <div className="flex-grow min-w-0">
        <p className="text-[12px] font-bold leading-tight truncate">{insight.title}</p>
        <p className="text-[10px] mono opacity-50 mt-0.5 leading-relaxed line-clamp-1">{insight.detail}</p>
      </div>

      {/* Action link */}
      {insight.action && insight.actionTab && (
        <button
          onClick={() => onAction(insight.actionTab!)}
          className={`
            shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider
            opacity-0 group-hover:opacity-100 transition-opacity
            ${s.text}
          `}
        >
          {insight.action} <ChevronRight size={10} />
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(insight.id)}
        className="shrink-0 opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity ml-1"
      >
        <X size={12} />
      </button>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   INSIGHTS PANEL (MAIN EXPORT)
───────────────────────────────────────────────────── */
interface InsightsPanelProps {
  projectId: string;
  onTabSwitch: (tab: string) => void;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ projectId, onTabSwitch }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await generateInsights(projectId);
      setInsights(all);
    } catch (err) {
      console.error('InsightsPanel error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const visible = insights.filter(i => !dismissed.has(i.id));

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  // Nothing to show
  if (!loading && visible.length === 0) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 opacity-20">
        <Sparkles size={11} className="animate-pulse text-[var(--accent)]" />
        <span className="text-[10px] mono uppercase tracking-widest">Generating insights…</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in duration-400">
      {/* Header strip */}
      <div className="flex items-center gap-2">
        <Sparkles size={11} className="text-[var(--accent)]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] opacity-70">
          Smart Insights
        </span>
        <span className="text-[9px] mono opacity-20">— {visible.length} suggestion{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {visible.map(insight => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onDismiss={handleDismiss}
            onAction={onTabSwitch}
          />
        ))}
      </div>
    </div>
  );
};

export default InsightsPanel;
