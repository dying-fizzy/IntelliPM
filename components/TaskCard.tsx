
import React from 'react';
import { User, Clock, ListChecks, Lock } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TaskCardProps {
  task: any;
  onClick: (task: any) => void;
  subtaskInfo?: { total: number; completed: number };
  isBlocked?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, subtaskInfo, isBlocked }) => {
  const { theme } = useTheme();
  
  const getPriorityColor = () => {
    switch (task.priority) {
      case 'Critical': return 'var(--accent-pink)';
      case 'High': return '#FF8A00';
      case 'Medium': return 'var(--accent-blue)';
      default: return 'var(--border-color)';
    }
  };

  const getTimeLeft = () => {
    if (!task.due_date) return null;
    const now = new Date();
    const due = new Date(task.due_date);
    const diff = due.getTime() - now.getTime();
    if (diff <= 0) return 'Overdue';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d left`;
    return `${hours}h left`;
  };

  const timeLeft = getTimeLeft();
  const isOverdue = timeLeft === 'Overdue';
  const assigneeName = task.profiles?.display_name || task.assignee_name;

  const subtaskProgress = subtaskInfo && subtaskInfo.total > 0
    ? Math.round((subtaskInfo.completed / subtaskInfo.total) * 100)
    : 0;

  return (
    <div 
      onClick={() => onClick(task)}
      className={`glass-panel group active:scale-[0.98] relative overflow-hidden flex flex-col cursor-pointer hover:-translate-y-[2px] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] ${
        isBlocked ? '!border-red-500/40' : ''
      }`}
    >
      {/* Blocked Badge */}
      {isBlocked && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
          <Lock size={10} className="text-red-400" />
          <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Blocked</span>
        </div>
      )}

      <div className="flex">
        <div 
          className="w-[6px] shrink-0 group-hover:w-[10px] transition-all" 
          style={{ backgroundColor: getPriorityColor() }}
        />

        <div className="flex-grow p-6 flex flex-col">
          {/* Title */}
          <h4 className="text-[16px] font-bold uppercase tracking-tight mb-6 leading-tight text-[var(--text-primary)]">
            {task.title}
          </h4>
          
          {/* Footer: Priority + Deadline + Assignee */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Priority Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-[var(--border-color)]">
                <span className="text-[12px] font-bold mono opacity-60">{task.priority || 'Medium'}</span>
              </div>

              {/* Deadline */}
              {timeLeft && (
                <div className={`flex items-center gap-1.5 text-[12px] mono font-bold whitespace-nowrap ${isOverdue ? 'text-[var(--accent-pink)]' : 'opacity-50'}`}>
                  <Clock size={12} className="shrink-0" /> {timeLeft}
                </div>
              )}
            </div>
            
            {/* Assignee */}
            {assigneeName ? (
              <div className="flex items-center gap-2 px-2 py-1 bg-black/5 dark:bg-white/5 border border-[var(--border-color)] max-w-[140px]">
                <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-[var(--accent-blue)]">{assigneeName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-[11px] mono font-bold truncate opacity-70">{assigneeName}</span>
              </div>
            ) : (
              <div className="w-7 h-7 glass border border-[var(--border-color)] flex items-center justify-center">
                <User size={14} className="opacity-20" />
              </div>
            )}
          </div>

          {/* Subtask Indicator */}
          {subtaskInfo && subtaskInfo.total > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--border-color)]/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-[11px] mono font-bold opacity-60">
                  <ListChecks size={12} className="text-[var(--accent-blue)]" />
                  <span>{subtaskInfo.completed}/{subtaskInfo.total} subtasks</span>
                </div>
                <span className={`text-[10px] mono font-bold ${subtaskProgress === 100 ? 'text-green-400' : 'text-[var(--accent)]'}`}>
                  {subtaskProgress}%
                </span>
              </div>
              <div className="h-1 bg-black/10 dark:bg-white/5 overflow-hidden rounded-sm">
                <div
                  className={`h-full transition-all duration-500 ${subtaskProgress === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'}`}
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
