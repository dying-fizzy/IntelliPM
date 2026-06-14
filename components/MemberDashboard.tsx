
import React, { useEffect, useState, useRef } from 'react';
import { 
  Play, 
  Activity, 
  Clock, 
  Terminal,

  Flame,
  AlertOctagon,
  RefreshCw,
  Target,
  Pause,
  Square,
  MessageSquare,
  X,
  TrendingUp,
  Cpu,
  CheckCircle,
  ListChecks,
  CheckCircle2,
  Circle,
  Plus,
  Paperclip,
  Upload,
  FileText,
  Download,
  Trash2,
  Timer
} from 'lucide-react';
import SystemLog from './SystemLog';
import { useTheme } from './ThemeContext';
import { supabase } from '../supabaseClient';

const logActivity = async (action: string, entityType: string, entityId: string, details: string) => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await supabase.from('activity_logs').insert({
      user_id: user.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

const priorityWeight: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDurationShort = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const MemberDashboard: React.FC = () => {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Timer state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Total time per task
  const [taskTimeMap, setTaskTimeMap] = useState<Record<string, number>>({});
  // Daily tracked time
  const [dailyTime, setDailyTime] = useState(0);

  // Subtask state
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Attachment state
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{"name": "User"}');
  const [displayName, setDisplayName] = useState<string>(user.name || 'User');

  // Resolve real display name from auth session
  useEffect(() => {
    const resolve = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', authUser.id)
          .maybeSingle();
        if (profile?.display_name) setDisplayName(profile.display_name);
      }
    };
    resolve();
  }, []);

  const fetchTasks = async () => {
    try {
      // Use live Supabase auth session — RLS enforces scoping server-side.
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userId = authUser?.id || user.id;

      if (!userId) { setTasks([]); setLoading(false); return; }

      // Team Member view: only tasks directly assigned to them
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', userId)
        .is('parent_task_id', null)
        .not('status', 'in', '("Completed","Done")');

      if (error) throw error;

      const sorted = (data || []).sort((a: any, b: any) => {
        const pa = priorityWeight[a.priority] ?? 4;
        const pb = priorityWeight[b.priority] ?? 4;
        if (pa !== pb) return pa - pb;

        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });

      setTasks(sorted);

      // Fetch total time per task
      if (sorted.length > 0) {
        await fetchTaskTimes(sorted.map((t: any) => t.id));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskTimes = async (taskIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .select('task_id, duration')
        .in('task_id', taskIds)
        .not('duration', 'is', null);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((log: any) => {
        map[log.task_id] = (map[log.task_id] || 0) + (log.duration || 0);
      });
      setTaskTimeMap(map);
    } catch (_) {}
  };

  const fetchDailyTime = async () => {
    if (!user.id) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('time_logs')
        .select('duration')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .not('duration', 'is', null);
      if (error) throw error;
      const total = (data || []).reduce((sum: number, log: any) => sum + (log.duration || 0), 0);
      setDailyTime(total);
    } catch (_) {}
  };

  // Check for any running timer on load
  const checkActiveTimer = async () => {
    if (!user.id) return;
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .select('id, task_id, start_time')
        .eq('user_id', user.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();
      if (!error && data) {
        setActiveTimerTaskId(data.task_id);
        setActiveTimeLogId(data.id);
        setTimerStartTime(new Date(data.start_time));
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchTasks();
    fetchDailyTime();
    checkActiveTimer();
  }, []);

  // Live timer tick
  useEffect(() => {
    if (timerStartTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - timerStartTime.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerStartTime]);



  // ── Timer Handlers ──
  const handleStartTimer = async (taskId: string) => {
    // Stop any existing timer first
    if (activeTimeLogId) {
      await handleStopTimer();
    }

    try {
      const { data, error } = await supabase
        .from('time_logs')
        .insert({
          task_id: taskId,
          user_id: user.id || null,
          start_time: new Date().toISOString(),
        })
        .select('id, start_time')
        .single();
      if (error) throw error;
      setActiveTimerTaskId(taskId);
      setActiveTimeLogId(data.id);
      setTimerStartTime(new Date(data.start_time));
      await logActivity('Started timer', 'task', taskId, `Timer started on task`);
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimeLogId || !timerStartTime) return;
    try {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - timerStartTime.getTime()) / 1000);
      const { error } = await supabase
        .from('time_logs')
        .update({
          end_time: endTime.toISOString(),
          duration,
        })
        .eq('id', activeTimeLogId);
      if (error) throw error;

      // Update local state
      if (activeTimerTaskId) {
        setTaskTimeMap(prev => ({
          ...prev,
          [activeTimerTaskId!]: (prev[activeTimerTaskId!] || 0) + duration,
        }));
      }
      setDailyTime(prev => prev + duration);
      await logActivity('Stopped timer', 'task', activeTimerTaskId || '', `Timer stopped (${formatDuration(duration)})`);
    } catch (err) {
      console.error('Failed to stop timer:', err);
    } finally {
      setActiveTimerTaskId(null);
      setActiveTimeLogId(null);
      setTimerStartTime(null);
      setElapsedSeconds(0);
    }
  };

  // Fetch subtasks when a task is selected
  useEffect(() => {
    if (!selectedTask) {
      setSubtasks([]);
      setAttachments([]);
      return;
    }
    const fetchSubtasks = async () => {
      setSubtasksLoading(true);
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, title, status, created_at')
          .eq('parent_task_id', selectedTask.id)
          .order('created_at', { ascending: true });
        if (!error && data) setSubtasks(data);
        else setSubtasks([]);
      } catch (_) {
        setSubtasks([]);
      } finally {
        setSubtasksLoading(false);
      }
    };
    fetchSubtasks();
    fetchAttachments(selectedTask.id);
  }, [selectedTask?.id]);

  const fetchAttachments = async (taskId: string) => {
    setAttachmentsLoading(true);
    try {
      const res = await fetch(`/api/task-attachments/${taskId}`, {
        headers: { 'x-internal-key': 'intellipm_secret_key_123' }
      });
      if (!res.ok) throw new Error('Failed to fetch attachments');
      const data = await res.json();
      setAttachments(data);
    } catch (_) { setAttachments([]); }
    finally { setAttachmentsLoading(false); }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!selectedTask || files.length === 0) return;
    setUploading(true);
    const INTERNAL_KEY = 'intellipm_secret_key_123';
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch('/api/upload-attachment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': INTERNAL_KEY,
          },
          body: JSON.stringify({
            taskId: selectedTask.id,
            fileName: file.name,
            fileData,
            contentType: file.type,
            userId: user.id || null,
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Upload failed: ${res.status}`);
        }

        await logActivity('Uploaded file', 'task', selectedTask.id, `"${file.name}" attached to "${selectedTask.title}"`);
      }
      await fetchAttachments(selectedTask.id);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (att: any) => {
    const INTERNAL_KEY = 'intellipm_secret_key_123';
    try {
      const res = await fetch(`/api/attachments/${att.id}`, {
        method: 'DELETE',
        headers: { 'x-internal-key': INTERNAL_KEY }
      });
      if (!res.ok) throw new Error('Failed to delete attachment via proxy');
      
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      await logActivity('Deleted attachment', 'task', selectedTask.id, `"${att.file_name}" removed from "${selectedTask.title}"`);
    } catch (err) { console.error('Failed to delete attachment:', err); }
  };

  const handleMarkDone = async (task: any) => {
    try {
      // Stop timer if running on this task
      if (activeTimerTaskId === task.id) await handleStopTimer();

      const { error } = await supabase
        .from('tasks')
        .update({ status: 'Completed', updated_at: new Date().toISOString() })
        .eq('id', task.id);

      if (error) throw error;

      await logActivity('Completed task', 'task', task.id, `Task "${task.title}" marked as completed`);

      setTasks(prev => prev.filter(t => t.id !== task.id));
      if (selectedTask?.id === task.id) setSelectedTask(null);
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleStatusUpdate = async (task: any, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id);

      if (error) throw error;

      await logActivity(`Changed status to ${newStatus}`, 'task', task.id, `Task "${task.title}" moved to ${newStatus}`);
      fetchTasks();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // ── Subtask Handlers ──
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !selectedTask) return;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newSubtaskTitle.trim(),
          parent_task_id: selectedTask.id,
          project_id: selectedTask.project_id,
          status: 'To Do',
          priority: 'Medium',
        })
        .select('id, title, status, created_at')
        .single();

      if (error) throw error;
      if (data) setSubtasks(prev => [...prev, data]);
      setNewSubtaskTitle('');
      await logActivity('Created subtask', 'task', selectedTask.id, `Subtask "${newSubtaskTitle.trim()}" added to "${selectedTask.title}"`);
    } catch (err) {
      console.error('Failed to add subtask:', err);
    }
  };

  const handleToggleSubtask = async (subtask: any) => {
    const newStatus = (subtask.status === 'Completed' || subtask.status === 'Done') ? 'To Do' : 'Completed';
    const wasCompleted = subtask.status === 'Completed' || subtask.status === 'Done';
    setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s));
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', subtask.id);
      if (error) throw error;
      await logActivity(
        wasCompleted ? 'Reopened subtask' : 'Completed subtask',
        'task', selectedTask.id,
        `Subtask "${subtask.title}" ${wasCompleted ? 'reopened' : 'completed'}`
      );
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
      setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: subtask.status } : s));
    }
  };

  const subtaskProgress = subtasks.length > 0
    ? Math.round(subtasks.filter(s => s.status === 'Completed' || s.status === 'Done').length / subtasks.length * 100)
    : 0;

  if (loading) return <div className="p-10 mono text-[14px] opacity-20 uppercase tracking-widest">Loading your tasks...</div>;

  return (
    <div className="flex w-full min-h-full relative items-stretch">
      
      {/* Main Workspace Area */}
      <div className={`flex-grow flex-shrink min-w-0 transition-all duration-300 ease-in-out w-full pr-4`}>
        <div className="animate-in fade-in duration-700 space-y-12">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 border-b border-[var(--border-sep)] pb-12 dim-target">
            <div className="space-y-4">
              <span className={`ui-label block tracking-[0.4em] font-bold text-[var(--accent-blue)]`}>My Dashboard</span>
              <h1 className="uppercase tracking-tighter leading-none m-0 font-bold">Your Tasks</h1>
              <p className="text-[13px] mono opacity-40">
                Welcome back, <span className="text-[var(--accent-blue)] font-bold">{displayName.split(' ')[0]}</span>. Showing tasks assigned to you.
              </p>
              <div className="flex flex-wrap items-center gap-10 mono text-[14px] opacity-60 uppercase tracking-widest font-bold italic">
                 <div className="flex items-center gap-3"><Terminal size={18} className="text-[var(--accent-blue)]" /><span>Status: Active</span></div>
                 <div className="flex items-center gap-3"><Activity size={18} className="text-[var(--accent)]" /><span>{tasks.length} assigned task{tasks.length !== 1 ? 's' : ''}</span></div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Daily Time Tracked */}
              <div className="flex items-center gap-3 px-6 py-4 glass-panel">
                <Timer size={18} className="text-[var(--accent)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold leading-none">Today</span>
                  <span className="text-[16px] mono font-bold text-[var(--accent)]">{formatDurationShort(dailyTime)}</span>
                </div>
              </div>

              {/* Active Timer Badge */}
              {activeTimerTaskId && (
                <div className="flex items-center gap-3 px-6 py-4 glass-panel !border-[var(--accent)] bg-[var(--accent)]/5">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold leading-none">Timer Running</span>
                    <span className="text-[16px] mono font-bold text-[var(--accent)]">{formatDuration(elapsedSeconds)}</span>
                  </div>
                  <button
                    onClick={handleStopTimer}
                    className="ml-2 w-8 h-8 flex items-center justify-center bg-[var(--accent-pink)] text-white rounded-sm hover:scale-105 transition-transform"
                  >
                    <Square size={12} />
                  </button>
                </div>
              )}


            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-10">
              <div className="flex items-center justify-between px-2 dim-target">
                <span className="ui-label opacity-60 flex items-center gap-3 font-bold">
                  <Flame size={18} className="text-[var(--accent-pink)]" /> Active Tasks
                </span>
                <span className="text-[12px] mono opacity-30 uppercase tracking-[0.4em] font-bold">By Priority</span>
              </div>
              
              {tasks.length === 0 && (
                <div className="glass-panel p-16 text-center border-dashed border-[var(--border-color)]">
                  <span className="mono text-[14px] uppercase tracking-widest opacity-30">No tasks assigned to you</span>
                </div>
              )}

              <div className="space-y-8">
                {tasks.slice(0, 5).map((t: any) => {
                  const isTimerRunning = activeTimerTaskId === t.id;
                  const totalTime = taskTimeMap[t.id] || 0;
                  return (
                  <div 
                    key={t.id} 
                    onClick={() => setSelectedTask(t === selectedTask ? null : t)}
                    className={`glass-panel p-10 group transition-all flex flex-col md:flex-row items-center justify-between cursor-pointer gap-10 relative overflow-hidden hover:-translate-y-[2px] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${
                      'focus-target'
                    } ${selectedTask?.id === t.id ? `!border-[var(--accent)]` : ''} ${isTimerRunning ? '!border-[var(--accent)]' : ''}`}
                  >
                    <div className="flex items-center gap-10">
                      <div className={`w-16 h-16 border border-[var(--border-color)] flex items-center justify-center transition-all ${isTimerRunning ? `bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]` : 'bg-black/5 dark:bg-white/5'}`}>
                        <Target size={28} className={isTimerRunning ? 'animate-pulse' : 'opacity-10'} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-6">
                          <span className="text-[14px] font-bold text-[var(--accent-blue)] mono tracking-[0.3em]">{t.ipm_id || t.id?.substring(0, 8)}</span>
                          <span className={`text-[11px] mono font-bold uppercase tracking-widest border px-3 py-1 ${
                            t.priority === 'Critical' ? `border-[var(--accent-pink)] text-[var(--accent-pink)]` : 'border-slate-200 dark:border-white/10 opacity-40'
                          }`}>
                            {t.priority}
                          </span>
                          {t.due_date && (
                            <span className="text-[11px] mono opacity-40 flex items-center gap-1">
                              <Clock size={12} /> {new Date(t.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <h2 className="text-2xl uppercase tracking-tighter leading-none group-hover:text-[var(--accent-blue)] transition-colors m-0 font-bold">{t.title}</h2>
                        {/* Time logged */}
                        {(totalTime > 0 || isTimerRunning) && (
                          <div className="flex items-center gap-2 text-[11px] mono opacity-50">
                            <Timer size={12} className="text-[var(--accent)]" />
                            <span>{formatDurationShort(totalTime)}{isTimerRunning ? ` + ${formatDuration(elapsedSeconds)}` : ''} logged</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => isTimerRunning ? handleStopTimer() : handleStartTimer(t.id)} 
                        className={`w-14 h-14 flex items-center justify-center transition-all border ${isTimerRunning ? `bg-[var(--accent-pink)] border-[var(--accent-pink)] text-white` : 'border-[var(--border-color)] hover:border-[var(--accent-blue)]'}`}
                        title={isTimerRunning ? 'Stop Timer' : 'Start Timer'}
                      >
                        {isTimerRunning ? <Square size={16} /> : <Play size={20} className="ml-1" />}
                      </button>
                      <button
                        onClick={() => handleMarkDone(t)}
                        className={`px-10 py-4 bg-[var(--accent)] text-black text-[12px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all flex items-center gap-2`}
                      >
                        <CheckCircle size={14} /> Done
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="dim-target pt-10">
                <div className="glass-panel p-8 flex flex-wrap items-center gap-8 justify-center border-dashed border-[var(--border-color)]">
                  <span className="ui-label opacity-30 tracking-[0.2em]">Quick Update</span>
                  <button
                    onClick={() => selectedTask && handleStatusUpdate(selectedTask, 'To Do')}
                    className={`flex items-center gap-3 px-6 py-3 border border-[var(--accent-pink)] text-[var(--accent-pink)] text-[11px] font-bold uppercase hover:bg-[var(--accent-pink)] hover:text-white transition-all`}
                  >
                    <AlertOctagon size={14} /> Blocked
                  </button>
                  <button
                    onClick={() => selectedTask && handleStatusUpdate(selectedTask, 'Review')}
                    className={`flex items-center gap-3 px-6 py-3 border border-[var(--accent-blue)] text-[var(--accent-blue)] text-[11px] font-bold uppercase hover:bg-[var(--accent-blue)] hover:text-white transition-all`}
                  >
                    <RefreshCw size={14} /> Review
                  </button>
                  <button className="flex items-center gap-3 px-6 py-3 glass-panel text-[11px] font-bold uppercase hover:border-[var(--accent-blue)] transition-all">
                    <MessageSquare size={14} /> Note
                  </button>
                </div>
              </div>

              <div className="dim-target h-80">
                <SystemLog />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-12 dim-target">
              {/* Daily Time Summary */}
              <div className="glass-panel p-10 border-[var(--accent)]/30 relative overflow-hidden">
                <div className="flex items-center gap-6 mb-8 relative z-10">
                  <Timer size={24} className="text-[var(--accent)]" />
                  <span className="ui-label text-[var(--accent)] !opacity-100 font-bold">Time Tracking</span>
                </div>
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center p-4 bg-black/5 dark:bg-white/5 border border-[var(--border-color)]">
                    <span className="text-[12px] mono uppercase tracking-widest opacity-60 font-bold">Today</span>
                    <span className="text-[18px] mono font-bold text-[var(--accent)]">{formatDurationShort(dailyTime + (activeTimerTaskId ? elapsedSeconds : 0))}</span>
                  </div>
                  {activeTimerTaskId && (
                    <div className="flex items-center gap-3 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/30">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                      <span className="text-[11px] mono opacity-60 flex-grow">Active: {tasks.find(t => t.id === activeTimerTaskId)?.title?.substring(0, 25) || 'Task'}...</span>
                      <span className="text-[13px] mono font-bold text-[var(--accent)]">{formatDuration(elapsedSeconds)}</span>
                    </div>
                  )}
                  {!activeTimerTaskId && (
                    <div className="text-center p-4 opacity-30">
                      <span className="text-[11px] mono uppercase tracking-widest">No timer running</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel p-10">
                <div className="w-full h-full flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <span className="ui-label opacity-40">Performance</span>
                  </div>
                  <div className="flex-grow flex flex-col items-center justify-center opacity-30 border border-[var(--border-color)] p-6 bg-white/50 dark:bg-white/5 glass min-h-[120px]">
                    <TrendingUp size={32} className="mb-2" />
                    <span className="text-[11px] mono uppercase tracking-widest">Not enough data to display performance.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Detail Panel */}
      <div 
        className={`fixed bottom-0 right-0 z-[105] transition-transform duration-300 ease-in-out border-l border-[var(--glass-border)] glass-panel bg-[var(--bg-primary)] sm:glass-panel-elevated !rounded-none overflow-y-auto custom-scrollbar flex flex-col w-[100vw] sm:w-[450px] shadow-[0_0_50px_rgba(0,0,0,0.5)] ${selectedTask ? 'translate-x-0' : 'translate-x-[100%]'}`}
        style={{ top: 'calc(var(--header-height) + var(--system-status-height, 0px))' }}
      >
        {selectedTask && (
          <div className="w-[450px] flex flex-col min-h-full">
            {/* Header */}
            <div className="p-12 border-b border-[var(--border-sep)] flex justify-between items-center bg-[var(--bg-primary)]">
              <span className="ui-label opacity-40 font-bold">Task Details</span>
              <button onClick={() => setSelectedTask(null)} className="opacity-30 hover:opacity-100 hover:text-[var(--accent-blue)] p-2 transition-transform hover:scale-110">
                <X size={24} />
              </button>
            </div>

            {/* Description Section */}
            <div className="p-12 border-b border-[var(--border-sep)] space-y-6">
              <div className={`bg-[var(--accent-blue)] text-white px-4 py-1.5 text-[14px] font-bold inline-block tracking-widest`}>
                {selectedTask.ipm_id || selectedTask.id?.substring(0, 8)}
              </div>
              <h1 className="uppercase tracking-tighter leading-tight text-3xl m-0 font-bold text-[var(--text-primary)]">{selectedTask.title}</h1>
              {selectedTask.description && (
                <p className="opacity-80 text-[16px] leading-relaxed italic border-l-2 border-[var(--accent-blue)]/30 pl-6 text-[var(--text-body)]">
                  {selectedTask.description}
                </p>
              )}
              <div className="space-y-3 pt-4 border-t border-[var(--border-color)]/30 text-[14px]">
                <div className="flex justify-between">
                  <span className="opacity-50">Priority</span>
                  <span className={`font-bold ${selectedTask.priority === 'Critical' ? 'text-[var(--accent-pink)]' : ''}`}>{selectedTask.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Status</span>
                  <span className="font-bold">{selectedTask.status}</span>
                </div>
                {selectedTask.due_date && (
                  <div className="flex justify-between">
                    <span className="opacity-50">Due Date</span>
                    <span className="font-bold">{new Date(selectedTask.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                {/* Total time tracked on this task */}
                <div className="flex justify-between">
                  <span className="opacity-50">Time Logged</span>
                  <span className="font-bold text-[var(--accent)] flex items-center gap-1">
                    <Timer size={12} />
                    {formatDurationShort((taskTimeMap[selectedTask.id] || 0) + (activeTimerTaskId === selectedTask.id ? elapsedSeconds : 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Timer Control in Detail Panel ── */}
            <div className="p-12 border-b border-[var(--border-sep)]">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={14} className="text-[var(--accent)]" />
                <span className="ui-label opacity-40 text-[10px]">Timer</span>
              </div>
              {activeTimerTaskId === selectedTask.id ? (
                <div className="flex items-center gap-4">
                  <div className="flex-grow flex items-center gap-3 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/30 rounded-sm">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    <span className="mono font-bold text-[var(--accent)] text-[16px]">{formatDuration(elapsedSeconds)}</span>
                  </div>
                  <button
                    onClick={handleStopTimer}
                    className="px-6 py-4 bg-[var(--accent-pink)] text-white text-[12px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all"
                  >
                    <Square size={12} /> Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleStartTimer(selectedTask.id)}
                  className="w-full py-4 border border-[var(--accent)] text-[var(--accent)] text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[var(--accent)] hover:text-black transition-all"
                >
                  <Play size={14} /> Start Timer
                </button>
              )}
            </div>

            {/* ── Subtasks Section ── */}
            <div className="p-12 border-b border-[var(--border-sep)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListChecks size={14} className="text-[var(--accent)]" />
                  <span className="ui-label opacity-40 text-[10px]">Subtasks</span>
                  <span className="text-[10px] mono opacity-30">({subtasks.length})</span>
                </div>
                {subtasks.length > 0 && (
                  <span className={`text-[10px] mono font-bold ${subtaskProgress === 100 ? 'text-green-400' : 'text-[var(--accent)]'}`}>
                    {subtaskProgress}%
                  </span>
                )}
              </div>

              {subtasks.length > 0 && (
                <div className="h-1.5 bg-black/10 dark:bg-white/5 overflow-hidden rounded-sm mb-4">
                  <div
                    className={`h-full transition-all duration-500 ${subtaskProgress === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>
              )}

              <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar mb-4">
                {subtasksLoading && <span className="text-[12px] mono opacity-30">Loading subtasks...</span>}
                {!subtasksLoading && subtasks.length === 0 && (
                  <span className="text-[12px] mono opacity-30 italic">No subtasks yet. Add one below.</span>
                )}
                {subtasks.map((st: any) => {
                  const isDone = st.status === 'Completed' || st.status === 'Done';
                  return (
                    <div
                      key={st.id}
                      onClick={() => handleToggleSubtask(st)}
                      className={`flex items-center gap-3 p-3 rounded-sm border transition-all cursor-pointer group ${
                        isDone
                          ? 'border-[var(--accent)]/20 bg-[var(--accent)]/5'
                          : 'border-[var(--border-color)]/30 bg-black/5 dark:bg-white/5 hover:border-[var(--accent-blue)]/40'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-[var(--accent)] shrink-0" />
                      ) : (
                        <Circle size={16} className="opacity-30 group-hover:opacity-60 shrink-0 transition-opacity" />
                      )}
                      <span className={`text-[13px] font-medium flex-grow ${isDone ? 'line-through opacity-50' : ''}`}>
                        {st.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  className="flex-grow bg-black/5 dark:bg-white/5 border border-[var(--border-color)] rounded-sm py-2.5 px-4 text-[13px] mono outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="px-4 bg-[var(--accent)] text-black rounded-sm transition-all hover:opacity-90 disabled:opacity-30 flex items-center"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* ── Attachments Section ── */}
            <div className="p-12 border-b border-[var(--border-sep)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Paperclip size={14} className="text-[var(--accent-blue)]" />
                  <span className="ui-label opacity-40 text-[10px]">Attachments</span>
                  <span className="text-[10px] mono opacity-30">({attachments.length})</span>
                </div>
                <label className="text-[10px] mono font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all flex items-center gap-1 cursor-pointer">
                  <Upload size={12} /> Upload
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleFileUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
                }}
                className={`cursor-pointer block border-2 border-dashed rounded-sm p-4 mb-4 text-center transition-all ${
                  dragOver
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                    : 'border-[var(--border-color)]/30 hover:border-[var(--accent-blue)]/60'
                }`}
              >
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFileUpload(e.target.files);
                    e.target.value = '';
                  }}
                />
                {uploading ? (
                  <span className="text-[11px] mono opacity-50 animate-pulse">Uploading...</span>
                ) : (
                  <span className="text-[11px] mono opacity-30">Drag & drop or click to select files</span>
                )}
              </label>

              <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                {attachmentsLoading && <span className="text-[12px] mono opacity-30">Loading attachments...</span>}
                {!attachmentsLoading && attachments.length === 0 && (
                  <span className="text-[12px] mono opacity-30 italic">No files attached.</span>
                )}
                {attachments.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 rounded-sm border border-[var(--border-color)]/30 bg-black/5 dark:bg-white/5 group"
                  >
                    <FileText size={14} className="text-[var(--accent-blue)] shrink-0" />
                    <div className="flex-grow min-w-0">
                      <span className="text-[12px] font-bold truncate block">{att.file_name}</span>
                      <span className="text-[9px] mono opacity-30">
                        {att.profiles?.display_name || 'Unknown'} · {new Date(att.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all p-1"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(att)}
                      className="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-red-400 transition-all p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-12 space-y-4">
              <button
                onClick={() => handleMarkDone(selectedTask)}
                className={`w-full py-5 bg-[var(--accent)] text-black font-bold uppercase text-[12px] tracking-[0.4em] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2`}
              >
                <CheckCircle size={16} /> Mark Complete
              </button>
              <button
                onClick={() => handleStatusUpdate(selectedTask, 'Review')}
                className="w-full py-5 border border-[var(--border-color)] font-bold uppercase text-[12px] tracking-[0.4em] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--accent-blue)] transition-all"
              >
                Request Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberDashboard;
