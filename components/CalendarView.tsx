
import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  User,
  Calendar
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const CalendarView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles:assigned_to ( display_name )')
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [projectId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Group tasks by date
  const tasksByDate: Record<string, any[]> = {};
  tasks.forEach(task => {
    const d = new Date(task.due_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString();
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(task);
    }
  });

  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const priorityDot = (p: string) => {
    switch (p) {
      case 'Critical': return 'bg-[var(--accent-pink)]';
      case 'High': return 'bg-orange-400';
      case 'Medium': return 'bg-[var(--accent-blue)]';
      default: return 'bg-gray-400';
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'Completed': case 'Done': return 'text-green-400 bg-green-400/10';
      case 'In Progress': return 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10';
      case 'Review': return 'text-yellow-400 bg-yellow-400/10';
      default: return 'opacity-50 bg-black/5 dark:bg-white/5';
    }
  };

  // Build calendar grid cells
  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ type: 'empty', day: 0 });
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ type: 'day', day: d });
  }

  if (loading) return <div className="p-10 mono text-[14px] opacity-20 uppercase tracking-widest">Loading calendar...</div>;

  return (
    <div className="animate-in fade-in duration-500 relative">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-black uppercase tracking-tighter">{monthName} {year}</h2>
          <button
            onClick={goToday}
            className="text-[10px] mono font-bold uppercase tracking-widest px-3 py-1.5 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-all"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 glass-button rounded-sm">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-2 glass-button rounded-sm">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-[1px] mb-[1px]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center py-3 text-[10px] font-black uppercase tracking-widest opacity-40">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-[1px] bg-[var(--border-color)]/20">
        {cells.map((cell, i) => {
          if (cell.type === 'empty') {
            return <div key={`empty-${i}`} className="min-h-[110px] bg-white/[0.01]" />;
          }
          const dayTasks = tasksByDate[cell.day.toString()] || [];
          const todayClass = isToday(cell.day);
          return (
            <div
              key={cell.day}
              className={`min-h-[110px] p-2 transition-colors ${
                todayClass
                  ? 'bg-[var(--accent)]/5 border border-[var(--accent)]/20'
                  : 'bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[12px] font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                  todayClass ? 'bg-[var(--accent)] text-black' : 'opacity-60'
                }`}>
                  {cell.day}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[9px] mono opacity-30">{dayTasks.length}</span>
                )}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left px-2 py-1.5 text-[10px] font-bold truncate flex items-center gap-1.5 transition-all hover:opacity-80 glass-panel !rounded-lg !border-[rgba(255,255,255,0.06)]"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot(task.priority)}`} />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] mono opacity-40 pl-1">+{dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal Overlay */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-overlay animate-in fade-in duration-200" onClick={() => setSelectedTask(null)}>
          <div className="w-[480px] glass-panel-elevated" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-primary)]">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Task Details</span>
              <button onClick={() => setSelectedTask(null)} className="opacity-30 hover:opacity-100 transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-5">
              <h2 className="text-xl font-black uppercase tracking-tighter">{selectedTask.title}</h2>
              {selectedTask.description && (
                <p className="text-[14px] opacity-70 leading-relaxed italic border-l-2 border-[var(--accent-blue)]/30 pl-4">
                  {selectedTask.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold block">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold ${statusBadge(selectedTask.status)}`}>
                    {selectedTask.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold block">Priority</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${priorityDot(selectedTask.priority)}`} />
                    <span className="font-bold">{selectedTask.priority || 'Medium'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold block">Due Date</span>
                  <span className="font-bold flex items-center gap-1">
                    <Clock size={12} className="opacity-40" />
                    {new Date(selectedTask.due_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold block">Assignee</span>
                  <span className="font-bold flex items-center gap-1">
                    <User size={12} className="opacity-40" />
                    {selectedTask.profiles?.display_name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
