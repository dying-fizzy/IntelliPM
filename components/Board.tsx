
/**
 * INTELLIPM PRESENTATION CODE FLOW (BOARD):
 * 1. Board.tsx is the primary Kanban UI that renders task lists.
 * 2. Fetches tasks for the specific project via Supabase `tasks` table on load.
 * 3. Handles Drag & Drop logic natively or via lightweight HTML5 dnd mechanics.
 * 4. Optimistically updates the UI while syncing status changes (`To Do` -> `In Progress`) back to Supabase.
 * 5. Uses real-time listeners (if configured) or fast polling to keep team members in sync.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Search, LayoutGrid, X, Plus, User, Clock, MessageSquare, Send, ListChecks, CheckCircle2, Circle, Lock, Link2, Trash2, AlertTriangle, Paperclip, Upload, FileText, Download, AtSign, Timer, Play, Square } from 'lucide-react';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import { useTheme } from './ThemeContext';
import { supabase } from '../supabaseClient';
import { notifyMentions, notifyTaskStatusChange, parseMentions } from '../notificationHelper';
import { loadRolePermissions, canCurrentUserSync } from '../permissionHelper';
import { auditStatusChange, auditCreate, auditDelete } from '../auditLogger';

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

const Board: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filterText, setFilterText] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  // Subtask state
  const [subtaskMap, setSubtaskMap] = useState<Record<string, { total: number; completed: number }>>({});
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Dependency state
  const [blockedMap, setBlockedMap] = useState<Record<string, boolean>>({});
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [depsLoading, setDepsLoading] = useState(false);
  const [showDepPicker, setShowDepPicker] = useState(false);

  // Attachment state
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Mention state
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);

  // Timer state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [activeTimeLogId, setActiveTimeLogId] = useState<string | null>(null);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [taskTimeMap, setTaskTimeMap] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      // Also fetch all profiles for @mentions
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name');
      if (profilesData) setAllProfiles(profilesData);
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles:assigned_to ( display_name )
        `)
        .is('parent_task_id', null)
        .order('updated_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);

      // Fetch subtask counts + dependency blocked state
      await Promise.all([
        fetchSubtaskCounts(data || []),
        fetchBlockedState(data || []),
      ]);
    } catch (e) {
      console.error('Fetch error:', e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch total time per task
  const fetchTaskTimes = async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
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

  // ── Timer Handlers ──
  const handleStartTimer = async (taskId: string) => {
    if (activeTimeLogId) await handleStopTimer();
    try {
      const { data, error } = await supabase
        .from('time_logs')
        .insert({ task_id: taskId, user_id: user.id || null, start_time: new Date().toISOString() })
        .select('id, start_time')
        .single();
      if (error) throw error;
      setActiveTimerTaskId(taskId);
      setActiveTimeLogId(data.id);
      setTimerStartTime(new Date(data.start_time));
    } catch (err) { console.error('Failed to start timer:', err); }
  };

  const handleStopTimer = async () => {
    if (!activeTimeLogId || !timerStartTime) return;
    try {
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - timerStartTime.getTime()) / 1000);
      const { error } = await supabase
        .from('time_logs')
        .update({ end_time: endTime.toISOString(), duration })
        .eq('id', activeTimeLogId);
      if (error) throw error;
      if (activeTimerTaskId) {
        setTaskTimeMap(prev => ({ ...prev, [activeTimerTaskId!]: (prev[activeTimerTaskId!] || 0) + duration }));
      }
    } catch (err) { console.error('Failed to stop timer:', err); }
    finally {
      setActiveTimerTaskId(null);
      setActiveTimeLogId(null);
      setTimerStartTime(null);
      setElapsedSeconds(0);
    }
  };

  const fetchSubtaskCounts = async (mainTasks: any[]) => {
    if (mainTasks.length === 0) { setSubtaskMap({}); return; }
    try {
      const ids = mainTasks.map(t => t.id);
      const { data, error } = await supabase
        .from('tasks')
        .select('id, parent_task_id, status')
        .in('parent_task_id', ids);
      if (error) throw error;
      const map: Record<string, { total: number; completed: number }> = {};
      (data || []).forEach((st: any) => {
        if (!map[st.parent_task_id]) map[st.parent_task_id] = { total: 0, completed: 0 };
        map[st.parent_task_id].total++;
        if (st.status === 'Completed' || st.status === 'Done') map[st.parent_task_id].completed++;
      });
      setSubtaskMap(map);
    } catch (err) {
      console.error('Subtask counts error:', err);
    }
  };

  const fetchBlockedState = async (mainTasks: any[]) => {
    if (mainTasks.length === 0) { setBlockedMap({}); return; }
    try {
      const ids = mainTasks.map(t => t.id);
      // Fetch all dependencies for these tasks
      const { data: deps, error: depsError } = await supabase
        .from('task_dependencies')
        .select('task_id, depends_on_task_id')
        .in('task_id', ids);
      if (depsError) throw depsError;
      if (!deps || deps.length === 0) { setBlockedMap({}); return; }

      // Get unique dependency target ids
      const depTargetIds = [...new Set(deps.map((d: any) => d.depends_on_task_id))];
      const { data: depTasks, error: depTasksError } = await supabase
        .from('tasks')
        .select('id, status')
        .in('id', depTargetIds);
      if (depTasksError) throw depTasksError;

      // Build status lookup
      const statusMap: Record<string, string> = {};
      (depTasks || []).forEach((t: any) => { statusMap[t.id] = t.status; });

      // A task is blocked if ANY of its dependencies are not Completed/Done
      const blocked: Record<string, boolean> = {};
      deps.forEach((d: any) => {
        const depStatus = statusMap[d.depends_on_task_id];
        if (depStatus !== 'Completed' && depStatus !== 'Done') {
          blocked[d.task_id] = true;
        }
      });
      setBlockedMap(blocked);
    } catch (err) {
      console.error('Blocked state error:', err);
    }
  };

  // Fetch subtasks for the selected task
  const fetchSubtasks = async (taskId: string) => {
    setSubtasksLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, created_at')
        .eq('parent_task_id', taskId)
        .order('created_at', { ascending: true });
      if (!error && data) setSubtasks(data);
      else setSubtasks([]);
    } catch (_) { setSubtasks([]); }
    finally { setSubtasksLoading(false); }
  };

  // Fetch dependencies for the selected task
  const fetchDependencies = async (taskId: string) => {
    setDepsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select('id, depends_on_task_id')
        .eq('task_id', taskId);
      if (error) throw error;
      if (!data || data.length === 0) { setDependencies([]); setDepsLoading(false); return; }

      // Fetch the task details for each dependency
      const depIds = data.map((d: any) => d.depends_on_task_id);
      const { data: depTasks, error: depErr } = await supabase
        .from('tasks')
        .select('id, title, status')
        .in('id', depIds);
      if (depErr) throw depErr;

      // Merge
      const merged = data.map((d: any) => {
        const task = (depTasks || []).find((t: any) => t.id === d.depends_on_task_id);
        return { ...d, task };
      });
      setDependencies(merged);
    } catch (err) {
      console.error('Deps fetch error:', err);
      setDependencies([]);
    } finally {
      setDepsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    checkActiveTimer();
    loadRolePermissions(user.role || 'Team Member').then(setPerms);
  }, []);

  // Timer tick
  useEffect(() => {
    if (timerStartTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - timerStartTime.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerStartTime]);

  // Fetch task times whenever tasks change
  useEffect(() => {
    if (tasks.length > 0) fetchTaskTimes(tasks.map(t => t.id));
  }, [tasks.length]);

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

  // Fetch notes, subtasks, dependencies, and attachments when a task is selected
  useEffect(() => {
    if (!selectedTask) {
      setNotes([]); setSubtasks([]); setDependencies([]); setAttachments([]); setShowDepPicker(false);
      return;
    }
    const fetchNotes = async () => {
      setNotesLoading(true);
      try {
        const { data, error } = await supabase
          .from('task_notes')
          .select(`*, profiles:user_id ( display_name )`)
          .eq('task_id', selectedTask.id)
          .order('created_at', { ascending: true });
        if (!error && data) setNotes(data);
        else setNotes([]);
      } catch (_) { setNotes([]); }
      finally { setNotesLoading(false); }
    };
    fetchNotes();
    fetchSubtasks(selectedTask.id);
    fetchDependencies(selectedTask.id);
    fetchAttachments(selectedTask.id);
  }, [selectedTask?.id]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedTask) return;
    try {
      // Parse mentions
      const mentions = parseMentions(newNote, allProfiles);
      const mentionsJson = mentions.map(m => ({ id: m.id, display_name: m.display_name }));

      const { data, error } = await supabase
        .from('task_notes')
        .insert({
          task_id: selectedTask.id,
          user_id: user.id || null,
          content: newNote.trim(),
          mentions: mentionsJson,
        })
        .select(`*, profiles:user_id ( display_name )`)
        .single();
      if (error) throw error;
      if (data) setNotes(prev => [...prev, data]);

      // Create notifications for mentioned users
      if (mentions.length > 0) {
        const mentionedIds = mentions
          .map(m => m.id)
          .filter(id => id !== user.id); // Don't notify yourself
        await notifyMentions(mentionedIds, user.name || 'Someone', selectedTask.title, selectedTask.id);
      }

      setNewNote('');
      setShowMentionDropdown(false);
      await logActivity('Added note', 'task', selectedTask.id, `Note added to "${selectedTask.title}"`);
    } catch (err) { console.error('Failed to add note:', err); }
  };

  // @Mention input handling
  const handleNoteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewNote(value);
    const cursorPos = e.target.selectionStart || 0;
    setMentionCursorPos(cursorPos);

    // Detect if user is typing after @
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (profile: any) => {
    // Replace the @query with @display_name
    const textBeforeCursor = newNote.substring(0, mentionCursorPos);
    const textAfterCursor = newNote.substring(mentionCursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.substring(0, atIndex) + `@${profile.display_name} ` + textAfterCursor;
    setNewNote(newText);
    setShowMentionDropdown(false);
    setMentionQuery('');
  };

  const filteredProfiles = allProfiles.filter(
    p => p.display_name?.toLowerCase().includes(mentionQuery) && p.id !== user.id
  );

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
      if (data) {
        setSubtasks(prev => [...prev, data]);
        setSubtaskMap(prev => {
          const existing = prev[selectedTask.id] || { total: 0, completed: 0 };
          return { ...prev, [selectedTask.id]: { ...existing, total: existing.total + 1 } };
        });
      }
      setNewSubtaskTitle('');
      await logActivity('Created subtask', 'task', selectedTask.id, `Subtask "${newSubtaskTitle.trim()}" added to "${selectedTask.title}"`);
    } catch (err) { console.error('Failed to add subtask:', err); }
  };

  const handleToggleSubtask = async (subtask: any) => {
    const newStatus = (subtask.status === 'Completed' || subtask.status === 'Done') ? 'To Do' : 'Completed';
    const wasCompleted = subtask.status === 'Completed' || subtask.status === 'Done';
    setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s));
    setSubtaskMap(prev => {
      const existing = prev[selectedTask.id] || { total: 0, completed: 0 };
      const delta = wasCompleted ? -1 : 1;
      return { ...prev, [selectedTask.id]: { ...existing, completed: existing.completed + delta } };
    });
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', subtask.id);
      if (error) throw error;
      await logActivity(wasCompleted ? 'Reopened subtask' : 'Completed subtask', 'task', selectedTask.id, `Subtask "${subtask.title}" ${wasCompleted ? 'reopened' : 'completed'}`);
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
      setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, status: subtask.status } : s));
    }
  };

  // ── Dependency Handlers ──
  const handleAddDependency = async (depTaskId: string) => {
    if (!selectedTask) return;
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .insert({ task_id: selectedTask.id, depends_on_task_id: depTaskId });
      if (error) throw error;
      // Refresh dependencies and blocked state
      await fetchDependencies(selectedTask.id);
      await fetchBlockedState(tasks);
      setShowDepPicker(false);
      const depTask = tasks.find(t => t.id === depTaskId);
      await logActivity('Added dependency', 'task', selectedTask.id, `"${selectedTask.title}" now depends on "${depTask?.title || depTaskId}"`);
    } catch (err) { console.error('Failed to add dependency:', err); }
  };

  const handleRemoveDependency = async (depId: string, depTitle: string) => {
    try {
      const { error } = await supabase.from('task_dependencies').delete().eq('id', depId);
      if (error) throw error;
      setDependencies(prev => prev.filter(d => d.id !== depId));
      await fetchBlockedState(tasks);
      await logActivity('Removed dependency', 'task', selectedTask.id, `Dependency on "${depTitle}" removed from "${selectedTask.title}"`);
    } catch (err) { console.error('Failed to remove dependency:', err); }
  };

  const handleStatusChange = async (task: any, newStatus: string) => {
    // Block completion if dependencies are incomplete
    if ((newStatus === 'Completed' || newStatus === 'Done') && blockedMap[task.id]) {
      alert('Cannot complete this task — it has unmet dependencies. Complete the blocking tasks first.');
      return;
    }

    const prevTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t));
    setSelectedTask((prev: any) => prev?.id === task.id ? { ...prev, status: newStatus } : prev);
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
      if (error) { setTasks(prevTasks); throw error; }
      await logActivity(`Changed status to ${newStatus}`, 'task', task.id, `Task "${task.title}" moved to ${newStatus}`);
      await auditStatusChange(task.id, task.title, task.status, newStatus);
      // Notify the assigned user about the status change
      if (task.assigned_to && task.assigned_to !== user.id) {
        await notifyTaskStatusChange(task.assigned_to, user.name || 'Someone', task.title, newStatus, task.id);
      }
      // Refresh blocked state since this task completing may unblock others
      if (newStatus === 'Completed' || newStatus === 'Done') {
        await fetchBlockedState(tasks);
      }
    } catch (err) { console.error('Failed to update status:', err); }
  };

  // Render note content with highlighted @mentions
  const renderNoteContent = (content: string) => {
    const parts = content.split(/(@\w[\w\s]*?)(?=\s@|\s[^@]|[.,!?;:]|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-[var(--accent-blue)] font-bold">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const columns = ['To Do', 'In Progress', 'Review', 'Completed'];

  const filteredTasks = filterText
    ? tasks.filter(t =>
        t.title?.toLowerCase().includes(filterText.toLowerCase()) ||
        t.profiles?.display_name?.toLowerCase().includes(filterText.toLowerCase()) ||
        t.priority?.toLowerCase().includes(filterText.toLowerCase())
      )
    : tasks;

  const allEmpty = !loading && tasks.length === 0;

  const selectedSubtaskProgress = subtasks.length > 0
    ? Math.round(subtasks.filter(s => s.status === 'Completed' || s.status === 'Done').length / subtasks.length * 100)
    : 0;

  // Check if current selected task is blocked
  const isSelectedBlocked = selectedTask ? blockedMap[selectedTask.id] === true : false;
  const unblockedDeps = dependencies.filter(d => d.task && (d.task.status === 'Completed' || d.task.status === 'Done'));
  const blockedDeps = dependencies.filter(d => d.task && d.task.status !== 'Completed' && d.task.status !== 'Done');

  // Available tasks for dependency picker (exclude self, existing deps, subtasks)
  const depPickerTasks = tasks.filter(t =>
    t.id !== selectedTask?.id &&
    !dependencies.some((d: any) => d.depends_on_task_id === t.id)
  );

  return (
    <div className="flex w-full min-h-full relative items-stretch">

      {/* Main Board Workspace */}
      <div className="flex flex-col transition-all duration-300 ease-in-out h-full overflow-x-hidden flex-grow min-w-0 pr-4">
        {!projectId && (
        <div className="flex justify-between items-end mb-12">
          <div className="space-y-4">
            <span className="ui-label block tracking-[0.4em] font-bold text-[var(--accent-blue)]">Task Board</span>
            <h1 className="uppercase tracking-tighter leading-none m-0 font-bold">Task Board</h1>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowTaskModal(true)}
              className="bg-[var(--accent)] text-black px-6 py-3 rounded-sm text-[12px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              <Plus size={16} /> Create Task
            </button>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10 group-focus-within:text-[var(--accent-blue)] transition-all" size={16} />
              <input
                type="text"
                placeholder="Filter by title, assignee, priority..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              className="glass-input rounded-sm py-3 pl-12 pr-6 text-[14px] mono w-80 placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>
        )}
        {projectId && (
          <div className="mb-6">
            <div className="relative group inline-block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10 group-focus-within:text-[var(--accent-blue)] transition-all" size={16} />
              <input
                type="text"
                placeholder="Filter tasks..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="glass-input rounded-sm py-3 pl-12 pr-6 text-[14px] mono w-80 placeholder:text-gray-500"
              />
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64 opacity-30">
            <span className="mono text-[14px] uppercase tracking-widest">Loading tasks...</span>
          </div>
        )}

        {allEmpty && (
          <div className="glass-panel p-16 text-center border-dashed border-[var(--border-color)]">
            <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
            <h4 className="text-xl font-bold opacity-40 uppercase tracking-widest">No tasks yet</h4>
            <p className="text-[14px] opacity-30 mt-2 mono">Create your first task to get started.</p>
          </div>
        )}

        {!loading && tasks.length > 0 && (
          <div className="flex gap-8 overflow-x-auto pb-8 h-full custom-scrollbar">
            {columns.map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col);
              return (
                <div key={col} className="flex-[0_0_auto] min-w-[320px] lg:flex-1 lg:min-w-[320px] flex flex-col min-h-[600px] h-full">
                  <div className="flex flex-col gap-3 mb-6 px-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-bold uppercase tracking-widest opacity-90 text-[var(--text-primary)]">{col}</span>
                        <span className="text-[12px] mono opacity-50 px-2 py-0.5 border border-[var(--border-color)] bg-white/[0.04]">{colTasks.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-grow glass-panel p-6 space-y-6 min-h-[500px] overflow-y-auto custom-scrollbar">
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={(t) => setSelectedTask(t.id === selectedTask?.id ? null : t)}
                        subtaskInfo={subtaskMap[task.id]}
                        isBlocked={blockedMap[task.id] === true}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="h-32 border border-dashed border-[var(--border-color)] flex flex-col items-center justify-center opacity-20">
                        <LayoutGrid size={32} />
                        <span className="text-[11px] mono uppercase tracking-widest mt-2">No tasks</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Backdrop overlay for smaller screens */}
      {selectedTask && (
        <div 
          className="absolute inset-0 bg-black/20 z-[90] backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSelectedTask(null)}
        />
      )}

      {/* Right Detail Panel */}
      <div
        className={`fixed bottom-0 right-0 z-[105] transition-transform duration-300 ease-in-out border-l border-[var(--glass-border)] glass-panel bg-[var(--bg-primary)] sm:glass-panel-elevated !rounded-none overflow-y-auto custom-scrollbar flex flex-col w-[100vw] sm:w-[450px] shadow-[0_0_50px_rgba(0,0,0,0.5)] ${selectedTask ? 'translate-x-0' : 'translate-x-[100%]'}`}
        style={{ top: 'calc(var(--header-height) + var(--system-status-height, 0px))' }}
      >
        {selectedTask && (
          <div className="w-full flex flex-col min-h-full">
            {/* Header */}
            <div className="p-8 border-b border-[var(--border-sep)] flex justify-between items-center bg-[var(--bg-primary)]">
              <span className="ui-label opacity-40 font-bold">Task Details</span>
              <button onClick={() => setSelectedTask(null)} className="opacity-90 hover:opacity-100 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black px-4 py-2 rounded-sm transition-all focus:outline-none flex items-center gap-2">
                <X size={14} className="shrink-0" /> <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Close</span>
              </button>
            </div>

            {/* Blocked Warning Banner */}
            {isSelectedBlocked && (
              <div className="px-8 py-4 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3">
                <Lock size={14} className="text-red-400 shrink-0" />
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-red-400 block">Blocked</span>
                  <span className="text-[10px] mono opacity-60">
                    {blockedDeps.map(d => `"${d.task?.title}"`).join(', ')}
                    {' '}must be completed first
                  </span>
                </div>
              </div>
            )}

            {/* Task Info Section */}
            <div className="p-8 border-b border-[var(--border-sep)] space-y-6">
              <h1 className="uppercase tracking-tighter leading-tight text-2xl m-0 font-bold text-[var(--text-primary)]">{selectedTask.title}</h1>

              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div className="space-y-1">
                  <span className="ui-label block opacity-30 text-[10px]">Priority</span>
                  <span className={`font-bold uppercase ${selectedTask.priority === 'Critical' ? 'text-[var(--accent-pink)]' : ''}`}>{selectedTask.priority || 'Medium'}</span>
                </div>
                <div className="space-y-1">
                  <span className="ui-label block opacity-30 text-[10px]">Status</span>
                  <span className="font-bold uppercase">{selectedTask.status}</span>
                </div>
                <div className="space-y-1">
                  <span className="ui-label block opacity-30 text-[10px]">Assigned To</span>
                  <div className="flex items-center gap-2">
                    {selectedTask.profiles?.display_name ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center">
                          <span className="text-[9px] font-black text-[var(--accent-blue)]">{selectedTask.profiles.display_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-bold">{selectedTask.profiles.display_name}</span>
                      </>
                    ) : (
                      <span className="opacity-40 italic">Unassigned</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="ui-label block opacity-30 text-[10px]">Deadline</span>
                  {selectedTask.due_date ? (
                    <span className="font-bold flex items-center gap-1">
                      <Clock size={12} className="opacity-40" />
                      {new Date(selectedTask.due_date).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="opacity-40 italic">No deadline</span>
                  )}
                </div>
              </div>

              {selectedTask.description && (
                <div className="space-y-2 pt-4 border-t border-[var(--border-color)]/30">
                  <span className="ui-label block opacity-30 text-[10px]">Description</span>
                  <p className="text-[14px] opacity-80 leading-relaxed italic border-l-2 border-[var(--accent-blue)]/30 pl-4 text-[var(--text-body)]">
                    {selectedTask.description}
                  </p>
                </div>
              )}
            </div>

            {/* ── Timer Section ── */}
            <div className="p-8 border-b border-[var(--border-sep)]">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={14} className="text-[var(--accent)]" />
                <span className="ui-label opacity-40 text-[10px]">Time Tracking</span>
                {(taskTimeMap[selectedTask.id] || 0) > 0 && (
                  <span className="text-[10px] mono font-bold text-[var(--accent)]">
                    {formatDurationShort(taskTimeMap[selectedTask.id] || 0)} logged
                  </span>
                )}
              </div>
              {activeTimerTaskId === selectedTask.id ? (
                <div className="flex items-center gap-3">
                  <div className="flex-grow flex items-center gap-3 p-3 bg-[var(--accent)]/5 border border-[var(--accent)]/30 rounded-sm">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    <span className="mono font-bold text-[var(--accent)] text-[14px]">{formatDuration(elapsedSeconds)}</span>
                  </div>
                  <button
                    onClick={handleStopTimer}
                    className="px-4 py-3 bg-[var(--accent-pink)] text-white text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all rounded-sm"
                  >
                    <Square size={12} /> Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleStartTimer(selectedTask.id)}
                  className="w-full py-3 border border-[var(--accent)] text-[var(--accent)] text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[var(--accent)] hover:text-black transition-all rounded-sm"
                >
                  <Play size={14} /> Start Timer
                </button>
              )}
            </div>

            {/* ── Dependencies Section ── */}
            <div className="p-8 border-b border-[var(--border-sep)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Link2 size={14} className="text-[var(--accent-purple)]" />
                  <span className="ui-label opacity-40 text-[10px]">Dependencies</span>
                  <span className="text-[10px] mono opacity-30">({dependencies.length})</span>
                </div>
                <button
                  onClick={() => setShowDepPicker(!showDepPicker)}
                  className="text-[10px] mono font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all flex items-center gap-1"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {/* Dependency picker dropdown */}
              {showDepPicker && (
                <div className="mb-4 border border-[var(--border-color)] rounded-sm bg-black/5 dark:bg-white/5 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {depPickerTasks.length === 0 ? (
                    <div className="p-4 text-[11px] mono opacity-30 text-center">No available tasks to depend on</div>
                  ) : (
                    depPickerTasks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleAddDependency(t.id)}
                        className="w-full text-left px-4 py-3 hover:bg-[var(--accent-blue)]/10 transition-colors border-b border-[var(--border-color)]/30 last:border-b-0 flex items-center justify-between group"
                      >
                        <span className="text-[12px] font-bold truncate">{t.title}</span>
                        <span className={`text-[9px] mono font-bold uppercase tracking-wider ${
                          (t.status === 'Completed' || t.status === 'Done') ? 'text-green-400' : 'opacity-40'
                        }`}>{t.status}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Current dependencies list */}
              <div className="space-y-2">
                {depsLoading && <span className="text-[12px] mono opacity-30">Loading dependencies...</span>}
                {!depsLoading && dependencies.length === 0 && !showDepPicker && (
                  <span className="text-[12px] mono opacity-30 italic">No dependencies. This task can proceed independently.</span>
                )}
                {dependencies.map((dep: any) => {
                  const isComplete = dep.task?.status === 'Completed' || dep.task?.status === 'Done';
                  return (
                    <div
                      key={dep.id}
                      className={`flex items-center gap-3 p-3 rounded-sm border transition-all ${
                        isComplete
                          ? 'border-green-500/20 bg-green-500/5'
                          : 'border-red-500/20 bg-red-500/5'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                      ) : (
                        <Lock size={14} className="text-red-400 shrink-0" />
                      )}
                      <span className={`text-[12px] font-bold flex-grow truncate ${isComplete ? 'line-through opacity-50' : ''}`}>
                        {dep.task?.title || 'Unknown Task'}
                      </span>
                      <button
                        onClick={() => handleRemoveDependency(dep.id, dep.task?.title || '')}
                        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-red-400 transition-all p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Subtasks Section ── */}
            <div className="p-8 border-b border-[var(--border-sep)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListChecks size={14} className="text-[var(--accent)]" />
                  <span className="ui-label opacity-40 text-[10px]">Subtasks</span>
                  <span className="text-[10px] mono opacity-30">({subtasks.length})</span>
                </div>
                {subtasks.length > 0 && (
                  <span className={`text-[10px] mono font-bold ${selectedSubtaskProgress === 100 ? 'text-green-400' : 'text-[var(--accent)]'}`}>
                    {selectedSubtaskProgress}%
                  </span>
                )}
              </div>

              {subtasks.length > 0 && (
                <div className="h-1.5 bg-black/10 dark:bg-white/5 overflow-hidden rounded-sm mb-4">
                  <div
                    className={`h-full transition-all duration-500 ${selectedSubtaskProgress === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${selectedSubtaskProgress}%` }}
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

            {/* Notes Section */}
            <div className="p-8 border-b border-[var(--border-sep)]">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={14} className="opacity-40" />
                <span className="ui-label opacity-40 text-[10px]">Notes</span>
                <span className="text-[10px] mono opacity-30">({notes.length})</span>
              </div>

              <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar mb-4">
                {notesLoading && <span className="text-[12px] mono opacity-30">Loading notes...</span>}
                {!notesLoading && notes.length === 0 && (
                  <span className="text-[12px] mono opacity-30 italic">No notes yet. Add one below.</span>
                )}
                {notes.map((note: any) => (
                  <div key={note.id} className="p-3 bg-black/5 dark:bg-white/5 border border-[var(--border-color)]/30 rounded-sm">
                    <p className="text-[13px] leading-relaxed">
                      {renderNoteContent(note.content)}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] mono opacity-40 font-bold">{note.profiles?.display_name || 'Unknown'}</span>
                      <span className="text-[10px] mono opacity-30">{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative">
                {/* @Mention Dropdown */}
                {showMentionDropdown && filteredProfiles.length > 0 && (
                  <div className="absolute bottom-full left-0 w-full mb-1 border border-[var(--border-color)] bg-[var(--bg-sidebar)] rounded-sm shadow-lg max-h-[140px] overflow-y-auto custom-scrollbar z-10">
                    {filteredProfiles.slice(0, 6).map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => handleMentionSelect(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[var(--accent-blue)]/10 transition-colors flex items-center gap-2 border-b border-[var(--border-color)]/20 last:border-b-0"
                      >
                        <div className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-black text-[var(--accent-blue)]">{p.display_name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-[12px] font-bold">{p.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a note... use @ to mention"
                    value={newNote}
                    onChange={handleNoteInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && !showMentionDropdown && handleAddNote()}
                    className="flex-grow bg-black/5 dark:bg-white/5 border border-[var(--border-color)] rounded-sm py-2.5 px-4 text-[13px] mono outline-none focus:border-[var(--accent-blue)] transition-colors"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 bg-[var(--accent-blue)] text-white rounded-sm transition-all hover:opacity-90 disabled:opacity-30"
                >
                  <Send size={14} />
                </button>
              </div>
              </div>
            </div>

            {/* ── Attachments Section ── */}
            <div className="p-8 border-b border-[var(--border-sep)]">
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

              {/* Drag & Drop Zone */}
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

              {/* File list */}
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

            {/* Actions Bar — context-aware */}
            <div className="p-8 space-y-3">
              {selectedTask.status === 'To Do' && (
                <button
                  onClick={() => handleStatusChange(selectedTask, 'In Progress')}
                  className={`w-full py-4 bg-[var(--accent)] text-black font-bold uppercase text-[12px] tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl ${theme === 'dark' ? 'neon-glow-green' : ''}`}
                >
                  Start Task
                </button>
              )}
              {selectedTask.status === 'In Progress' && (
                <button
                  onClick={() => handleStatusChange(selectedTask, 'Review')}
                  className="w-full py-4 bg-[var(--accent-blue)] text-white font-bold uppercase text-[12px] tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
                >
                  Request Review
                </button>
              )}
              {selectedTask.status === 'Review' && (
                <button
                  onClick={() => handleStatusChange(selectedTask, 'Completed')}
                  className={`w-full py-4 font-bold uppercase text-[12px] tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl ${
                    isSelectedBlocked
                      ? 'bg-gray-500 text-white cursor-not-allowed opacity-50'
                      : 'bg-green-600 text-white'
                  }`}
                  disabled={isSelectedBlocked}
                >
                  {isSelectedBlocked ? 'Blocked — Cannot Complete' : 'Mark Complete'}
                </button>
              )}
              {selectedTask.status !== 'Completed' && selectedTask.status !== 'Done' && (
                <button
                  onClick={() => handleStatusChange(selectedTask, 'To Do')}
                  className="w-full py-4 border border-[var(--border-color)] text-[var(--text-primary)] font-bold uppercase text-[12px] tracking-[0.3em] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--accent-blue)] transition-all"
                >
                  Move to Backlog
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onCreated={() => { setShowTaskModal(false); fetchTasks(); }}
      />
    </div>
  );
};

export default Board;
