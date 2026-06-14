
import React, { useState, useEffect } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Clock,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

type SortField = 'title' | 'status' | 'priority' | 'assignee' | 'due_date';
type SortDir = 'asc' | 'desc';

const PHASES = ['Planning', 'Development', 'Testing', 'Deployment'] as const;
type Phase = typeof PHASES[number];

const priorityWeight: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const statusWeight: Record<string, number>   = { 'To Do': 0, 'In Progress': 1, 'Review': 2, 'Completed': 3, 'Done': 4 };

/* ── Phase colour config ─────────────────────────────────────────── */
const PHASE_META: Record<Phase, { dot: string; badge: string; header: string }> = {
  Planning:    { dot: 'bg-purple-500',  badge: 'text-purple-400 bg-purple-500/10 border-purple-500/30',  header: 'border-l-purple-500'  },
  Development: { dot: 'bg-blue-500',    badge: 'text-blue-400 bg-blue-500/10 border-blue-500/30',        header: 'border-l-blue-500'    },
  Testing:     { dot: 'bg-yellow-500',  badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',  header: 'border-l-yellow-500'  },
  Deployment:  { dot: 'bg-green-500',   badge: 'text-green-400 bg-green-500/10 border-green-500/30',     header: 'border-l-green-500'   },
};

const DEFAULT_PHASE_META = { dot: 'bg-gray-500', badge: 'opacity-40 bg-white/5 border-[var(--border-color)]', header: 'border-l-gray-500' };

/* ── Shared helpers ─────────────────────────────────────────────── */
const priorityColor = (p: string) => {
  switch (p) {
    case 'Critical': return 'text-[var(--accent-pink)] bg-[var(--accent-pink)]/10 border-[var(--accent-pink)]';
    case 'High':     return 'text-orange-400 bg-orange-400/10 border-orange-400';
    case 'Medium':   return 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]';
    default:         return 'opacity-50 bg-black/5 dark:bg-white/5 border-[var(--border-color)]';
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'Completed':
    case 'Done':         return 'text-green-400 bg-green-400/10';
    case 'In Progress':  return 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10';
    case 'Review':       return 'text-yellow-400 bg-yellow-400/10';
    default:             return 'opacity-60 bg-black/5 dark:bg-white/5';
  }
};

/* ── Task Row ────────────────────────────────────────────────────── */
const TaskRow: React.FC<{
  task: any;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  showPhaseTag: boolean; // false when already inside a phase section
}> = ({ task, index, isSelected, onClick, showPhaseTag }) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
    && task.status !== 'Completed' && task.status !== 'Done';
  const phaseMeta = PHASE_META[task.phase as Phase] ?? DEFAULT_PHASE_META;

  return (
    <div
      onClick={onClick}
      className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-[var(--border-color)]/30 cursor-pointer transition-all group ${
        isSelected
          ? 'bg-[var(--accent-blue)]/5 border-l-2 border-l-[var(--accent-blue)]'
          : 'hover:bg-black/3 dark:hover:bg-white/3'
      } ${index % 2 === 0 ? '' : 'bg-black/[0.02] dark:bg-white/[0.02]'}`}
    >
      {/* Task Name */}
      <div className="col-span-4 flex items-center gap-2 min-w-0">
        {/* Phase dot (always shown, small indicator) */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${phaseMeta.dot}`} title={task.phase || 'No phase'} />
        <span className="text-[13px] font-bold truncate group-hover:text-[var(--accent-blue)] transition-colors">
          {task.title}
        </span>
      </div>

      {/* Status */}
      <div className="col-span-2 flex items-center">
        <span className={`text-[10px] mono font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${statusColor(task.status)}`}>
          {task.status}
        </span>
      </div>

      {/* Priority */}
      <div className="col-span-2 flex items-center">
        <span className={`text-[10px] mono font-bold uppercase tracking-widest px-2 py-1 rounded-sm border ${priorityColor(task.priority)}`}>
          {task.priority || 'Medium'}
        </span>
      </div>

      {/* Phase tag — only shown when NOT in grouped mode */}
      <div className="col-span-1 flex items-center">
        {showPhaseTag && task.phase ? (
          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 border rounded-sm ${phaseMeta.badge}`}>
            {task.phase}
          </span>
        ) : (
          <span />
        )}
      </div>

      {/* Assignee */}
      <div className="col-span-2 flex items-center gap-2 min-w-0">
        {task.profiles?.display_name ? (
          <>
            <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-black text-[var(--accent-blue)]">
                {task.profiles.display_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-[12px] truncate opacity-70">{task.profiles.display_name}</span>
          </>
        ) : (
          <span className="text-[11px] opacity-30 italic">Unassigned</span>
        )}
      </div>

      {/* Due Date */}
      <div className="col-span-1 flex items-center">
        {task.due_date ? (
          <span className={`text-[11px] mono flex items-center gap-1 ${isOverdue ? 'text-[var(--accent-pink)] font-bold' : 'opacity-50'}`}>
            <Clock size={11} />
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-[11px] mono opacity-20">—</span>
        )}
      </div>
    </div>
  );
};

/* ── Phase Section (grouped mode) ───────────────────────────────── */
const PhaseSection: React.FC<{
  phase: Phase;
  tasks: any[];
  selectedTask: any;
  onSelect: (t: any) => void;
}> = ({ phase, tasks, selectedTask, onSelect }) => {
  const [collapsed, setCollapsed] = useState(false);
  const meta = PHASE_META[phase];
  const done = tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;

  return (
    <div className={`glass-panel overflow-hidden border-l-2 ${meta.header}`}>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} className="opacity-40" /> : <ChevronDown size={14} className="opacity-40" />}
        <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
        <span className="text-[12px] font-black uppercase tracking-widest">{phase}</span>
        <span className="text-[10px] mono opacity-40 ml-1">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        {done > 0 && (
          <span className="text-[10px] mono text-green-400 ml-auto">{done}/{tasks.length} done</span>
        )}
        {/* Mini progress bar */}
        <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full transition-all ${meta.dot}`}
            style={{ width: tasks.length > 0 ? `${Math.round((done / tasks.length) * 100)}%` : '0%' }}
          />
        </div>
      </button>

      {/* Tasks */}
      {!collapsed && tasks.length > 0 && (
        <>
          {/* Column headers for this section */}
          <div className="grid grid-cols-12 gap-4 px-6 py-2 border-t border-b border-[var(--border-color)]/50 bg-black/5 dark:bg-white/[0.02]">
            <span className="col-span-4 text-[9px] font-black uppercase tracking-widest opacity-30">Task</span>
            <span className="col-span-2 text-[9px] font-black uppercase tracking-widest opacity-30">Status</span>
            <span className="col-span-2 text-[9px] font-black uppercase tracking-widest opacity-30">Priority</span>
            <span className="col-span-1 text-[9px] font-black uppercase tracking-widest opacity-30"></span>
            <span className="col-span-2 text-[9px] font-black uppercase tracking-widest opacity-30">Assignee</span>
            <span className="col-span-1 text-[9px] font-black uppercase tracking-widest opacity-30">Due</span>
          </div>
          {tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              index={i}
              isSelected={selectedTask?.id === task.id}
              onClick={() => onSelect(task === selectedTask ? null : task)}
              showPhaseTag={false}
            />
          ))}
        </>
      )}
      {!collapsed && tasks.length === 0 && (
        <div className="px-6 py-4 text-[11px] mono opacity-20">No tasks in this phase.</div>
      )}
    </div>
  );
};

/* ── Main ListView ──────────────────────────────────────────────── */
const ListView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [tasks, setTasks]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchText, setSearchText]     = useState('');
  const [sortField, setSortField]       = useState<SortField>('priority');
  const [sortDir, setSortDir]           = useState<SortDir>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [groupByPhase, setGroupByPhase] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles:assigned_to ( display_name )')
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
      // Auto-enable group by phase if any task has a phase set
      if ((data || []).some((t: any) => t.phase)) setGroupByPhase(true);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [projectId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // Filter
  let filtered = tasks;
  if (searchText) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.profiles?.display_name?.toLowerCase().includes(q)
    );
  }
  if (filterStatus !== 'all')   filtered = filtered.filter(t => t.status === filterStatus);
  if (filterPriority !== 'all') filtered = filtered.filter(t => t.priority === filterPriority);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'title':    cmp = (a.title || '').localeCompare(b.title || ''); break;
      case 'status':   cmp = (statusWeight[a.status] ?? 5) - (statusWeight[b.status] ?? 5); break;
      case 'priority': cmp = (priorityWeight[a.priority] ?? 5) - (priorityWeight[b.priority] ?? 5); break;
      case 'assignee': cmp = (a.profiles?.display_name || 'zzz').localeCompare(b.profiles?.display_name || 'zzz'); break;
      case 'due_date': {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        cmp = da - db; break;
      }
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-20" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-[var(--accent-blue)]" />
      : <ArrowDown size={12} className="text-[var(--accent-blue)]" />;
  };

  // Count tasks that have a phase set (to decide whether to show toggle)
  const hasPhasedTasks = tasks.some(t => t.phase);

  if (loading) return <div className="p-10 mono text-[14px] opacity-20 uppercase tracking-widest">Loading tasks...</div>;

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 flex-grow max-w-[320px] glass-panel px-4 py-2.5">
          <Search size={14} className="opacity-30" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-grow bg-transparent text-[13px] mono outline-none text-black dark:text-white placeholder:text-gray-500"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="opacity-30 hover:opacity-100 transition-all">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter size={12} className="opacity-30" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="glass-input px-3 py-2 text-[11px] mono font-bold uppercase tracking-widest cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Review">Review</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="glass-input px-3 py-2 text-[11px] mono font-bold uppercase tracking-widest cursor-pointer"
        >
          <option value="all">All Priority</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Group by Phase toggle — only shown when phase data exists */}
        {hasPhasedTasks && (
          <button
            onClick={() => setGroupByPhase(g => !g)}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] font-black uppercase tracking-widest border rounded-sm transition-all ${
              groupByPhase
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40 text-[var(--accent)]'
                : 'border-[var(--border-color)] opacity-50 hover:opacity-100'
            }`}
          >
            <Layers size={13} /> Group by Phase
          </button>
        )}

        <span className="text-[11px] mono opacity-30 ml-auto">{sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── GROUPED MODE ── */}
      {groupByPhase ? (
        <div className="space-y-4">
          {PHASES.map(phase => {
            const phaseTasks = sorted.filter(t => t.phase === phase);
            const unphased   = phase === 'Development' ? sorted.filter(t => !t.phase) : [];
            const all = [...phaseTasks, ...unphased];
            return (
              <PhaseSection
                key={phase}
                phase={phase}
                tasks={all}
                selectedTask={selectedTask}
                onSelect={setSelectedTask}
              />
            );
          })}
        </div>
      ) : (
        /* ── FLAT MODE ── */
        <div className="glass-panel overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-black/5 dark:bg-white/5 border-b border-[var(--border-color)]">
            <button onClick={() => handleSort('title')} className="col-span-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all text-left">
              Task Name <SortIcon field="title" />
            </button>
            <button onClick={() => handleSort('status')} className="col-span-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all text-left">
              Status <SortIcon field="status" />
            </button>
            <button onClick={() => handleSort('priority')} className="col-span-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all text-left">
              Priority <SortIcon field="priority" />
            </button>
            <span className="col-span-1 text-[10px] font-black uppercase tracking-widest opacity-50">Phase</span>
            <button onClick={() => handleSort('assignee')} className="col-span-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all text-left">
              Assignee <SortIcon field="assignee" />
            </button>
            <button onClick={() => handleSort('due_date')} className="col-span-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all text-left">
              Due <SortIcon field="due_date" />
            </button>
          </div>

          {/* Rows */}
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            {sorted.length === 0 ? (
              <div className="p-10 text-center text-[12px] mono opacity-30 uppercase tracking-widest">
                {searchText || filterStatus !== 'all' || filterPriority !== 'all' ? 'No tasks match filters' : 'No tasks in this project'}
              </div>
            ) : (
              sorted.map((task, i) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={i}
                  isSelected={selectedTask?.id === task.id}
                  onClick={() => setSelectedTask(task === selectedTask ? null : task)}
                  showPhaseTag={true}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Selected Task Expansion */}
      {selectedTask && (
        <div className="glass-panel p-8 border-[var(--accent-blue)]/30 animate-in fade-in duration-200 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] mono uppercase tracking-widest opacity-40 font-bold">Task Details</span>
                {selectedTask.phase && (
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-sm ${PHASE_META[selectedTask.phase as Phase]?.badge ?? DEFAULT_PHASE_META.badge}`}>
                    {selectedTask.phase}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black uppercase tracking-tighter">{selectedTask.title}</h3>
            </div>
            <button onClick={() => setSelectedTask(null)} className="opacity-30 hover:opacity-100 transition-all">
              <X size={16} />
            </button>
          </div>
          {selectedTask.description && (
            <p className="text-[14px] opacity-70 leading-relaxed italic border-l-2 border-[var(--accent-blue)]/30 pl-4">
              {selectedTask.description}
            </p>
          )}
          <div className="flex items-center gap-6 text-[12px] mono">
            <span className={`font-bold ${statusColor(selectedTask.status)} px-2 py-0.5 rounded-sm`}>{selectedTask.status}</span>
            <span className="opacity-40">Created: {new Date(selectedTask.created_at).toLocaleDateString()}</span>
            {selectedTask.updated_at && (
              <span className="opacity-40">Updated: {new Date(selectedTask.updated_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListView;
