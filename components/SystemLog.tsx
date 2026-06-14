
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'alert' | 'success' | 'system';
}

const SystemLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const mapActionToType = (action: string): LogEntry['type'] => {
    if (action.toLowerCase().includes('complet') || action.toLowerCase().includes('created')) return 'success';
    if (action.toLowerCase().includes('risk') || action.toLowerCase().includes('overdue')) return 'alert';
    if (action.toLowerCase().includes('progress') || action.toLowerCase().includes('review')) return 'system';
    return 'info';
  };

  useEffect(() => {
    let channel: any;

    const init = async () => {
      // Resolve current authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const userId = user.id;

      // Fetch only this user's activity logs
      try {
        // Try activity_logs first
        const { data: activityData, error: activityError } = await supabase
          .from('activity_logs')
          .select('action, details, created_at, user_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(15);

        if (!activityError && activityData && activityData.length > 0) {
          const entries: LogEntry[] = activityData.map((log: any) => {
            const time = new Date(log.created_at);
            const timestamp = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            return {
              time: timestamp,
              msg: log.details || log.action,
              type: mapActionToType(log.action),
            };
          });
          setLogs(entries);
          setLoading(false);
        } else {
          // Fallback: fetch recent task updates assigned to the current user
          const { data, error } = await supabase
            .from('tasks')
            .select('title, status, updated_at')
            .eq('assigned_to', userId)
            .order('updated_at', { ascending: false })
            .limit(10);

          if (!error && data && data.length > 0) {
            const entries: LogEntry[] = data.map((task: any) => {
              const time = new Date(task.updated_at);
              const timestamp = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
              let type: LogEntry['type'] = 'info';
              if (task.status === 'Completed' || task.status === 'Done') type = 'success';
              if (task.status === 'In Progress') type = 'system';
              return {
                time: timestamp,
                msg: `Task "${task.title}" updated to ${task.status}.`,
                type,
              };
            });
            setLogs(entries);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        setLoading(false);
      }

      // Subscribe to realtime inserts on activity_logs — only show own entries
      channel = supabase
        .channel('activity-log-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activity_logs' },
          (payload: any) => {
            const log = payload.new;
            // Only add to the feed if this log belongs to the current user
            if (log.user_id !== userId) return;
            const time = new Date(log.created_at);
            const timestamp = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
            const newEntry: LogEntry = {
              time: timestamp,
              msg: log.details || log.action,
              type: mapActionToType(log.action),
            };
            setLogs(prev => [...prev, newEntry]);
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="glass-panel rounded-none overflow-hidden bg-black/80 h-full flex flex-col">
      <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-white/2 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Terminal size={16} className="text-[var(--accent)]" />
          <span className="ui-label !opacity-100 text-[14px] font-black tracking-widest text-[var(--text-primary)]">Activity Log</span>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-none bg-[var(--accent)]"></span>
              <span className="text-[12px] mono opacity-40 font-bold tracking-widest uppercase text-[var(--text-primary)]">Live</span>
           </div>
           <Shield size={14} className="opacity-20 text-[var(--text-primary)]" />
        </div>
      </div>
      <div className="p-6 flex-grow overflow-y-auto custom-scrollbar mono text-[16px] space-y-3 bg-black/40" ref={logContainerRef}>
        {loading && (
          <div className="flex items-center justify-center h-full opacity-30">
            <span className="mono text-[14px] uppercase tracking-widest">Loading activity...</span>
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="flex items-center justify-center h-full opacity-30">
            <span className="mono text-[14px] uppercase tracking-widest">No system activity yet</span>
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-6 group hover:bg-white/5 transition-all py-1 px-2 border border-transparent hover:border-white/5">
            <span className="opacity-20 whitespace-nowrap font-bold text-[var(--text-primary)]">[{log.time}]</span>
            <span className={`opacity-80 group-hover:opacity-100 leading-relaxed font-medium ${
              log.type === 'alert' ? 'text-[var(--accent-pink)] font-black' : 
              log.type === 'success' ? 'text-[var(--accent)]' : 
              log.type === 'system' ? 'text-[var(--accent-blue)]' : 'text-white'
            }`}>
              <span className="opacity-40 font-black mr-2">&gt;</span>
              {log.msg}
            </span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default SystemLog;
