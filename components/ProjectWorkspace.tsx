
/**
 * INTELLIPM PRESENTATION CODE FLOW (WORKSPACE):
 * 1. ProjectWorkspace is the core container for any individual project.
 * 2. Uses React Router to capture the `:projectId` via `useParams()`.
 * 3. Verifies user access via Supabase `projects` and `project_members` tables.
 * 4. Manages the state of the active tab (Board, List, Calendar, Members, etc.).
 * 5. Dynamically renders the correct sub-component based on `activeTab`, keeping the app modular and fast.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Users, Activity, Settings, ArrowLeft,
  Trash2, Check, X, Plus, ChevronDown, Clock,
  AlertTriangle, Save, FolderOpen, Zap, CalendarDays, List, Shield,
  Crown, Search, UserPlus, UserMinus, Sparkles
} from 'lucide-react';
import Board from './Board';
import SprintManager from './SprintManager';
import CalendarView from './CalendarView';
import ListView from './ListView';
import AuditLogViewer from './AuditLogViewer';
import TaskModal from './TaskModal';
import RisksTab from './RisksTab';
import InsightsPanel from './InsightsPanel';
import AITaskGenerator from './AITaskGenerator';
import { supabase } from '../supabaseClient';

/* ─────────────────────────────────────────────────────
   TAB BUTTON
───────────────────────────────────────────────────── */
const TabBtn = ({ id, label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${active
      ? 'border-[var(--accent)] text-[var(--accent)]'
      : 'border-transparent opacity-40 hover:opacity-100'
      }`}
  >
    <Icon size={14} /> {label}
  </button>
);

/* ── Workload colours ── */
const workloadMeta = (taskCount: number, availability: number, isAvailable: boolean) => {
  if (!isAvailable || availability < 40 || taskCount >= 6)
    return { label: 'Overloaded', bar: 'bg-red-500', badge: 'text-red-400 bg-red-500/10 border-red-500/20' };
  if (availability < 70 || taskCount >= 3)
    return { label: 'Moderate', bar: 'bg-yellow-500', badge: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
  return { label: 'Available', bar: 'bg-green-500', badge: 'text-green-400 bg-green-500/10 border-green-500/20' };
};

const WorkloadList: React.FC<{
  members: any[];
  projectId: string;
  ownerId: string | null;
  canManage: boolean;
  onRemove: (id: string) => void;
}> = ({ members, projectId, ownerId, canManage, onRemove }) => {
  const [enriched, setEnriched] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Active task counts per user in this project
        const { data: taskData } = await supabase
          .from('tasks')
          .select('assigned_to')
          .eq('project_id', projectId)
          .not('status', 'in', '("Completed","Done","Cancelled")');

        const counts: Record<string, number> = {};
        (taskData || []).forEach((t: any) => {
          if (t.assigned_to) counts[t.assigned_to] = (counts[t.assigned_to] || 0) + 1;
        });

        // Availability from employees table
        const { data: empData } = await supabase
          .from('employees')
          .select('full_name, availability_percentage, is_available');

        const empMap: Record<string, { avail: number; isAvail: boolean }> = {};
        (empData || []).forEach((e: any) => {
          empMap[e.full_name?.toLowerCase().trim()] = {
            avail: e.availability_percentage ?? 100,
            isAvail: e.is_available ?? true,
          };
        });

        const result = members.map(m => {
          const profile = m.profiles as any;
          const key = profile?.display_name?.toLowerCase().trim() || '';
          const emp = empMap[key];
          return { ...m, taskCount: counts[m.user_id] || 0, availability: emp?.avail ?? 100, isAvailable: emp?.isAvail ?? true };
        });

        // Sort: owner first, then by workload
        result.sort((a, b) => {
          if (a.user_id === ownerId) return -1;
          if (b.user_id === ownerId) return 1;
          return (b.taskCount * 2 + (100 - b.availability) / 10) - (a.taskCount * 2 + (100 - a.availability) / 10);
        });
        setEnriched(result);
      } catch (err) {
        console.error('Workload enrichment error:', err);
        setEnriched(members.map(m => ({ ...m, taskCount: 0, availability: 100, isAvailable: true })));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [members, projectId]);

  const maxTasks = Math.max(1, ...enriched.map(m => m.taskCount));

  if (loading) return <div className="p-6 text-center opacity-30 mono text-[13px]">Calculating workload…</div>;

  return (
    <div className="glass-panel overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_140px_100px_36px] gap-4 items-center px-5 py-3 border-b border-[var(--border-color)]">
        <span className="text-[9px] mono uppercase tracking-widest opacity-30">Member</span>
        <span className="text-[9px] mono uppercase tracking-widest opacity-30 text-center">Tasks</span>
        <span className="text-[9px] mono uppercase tracking-widest opacity-30">Workload</span>
        <span className="text-[9px] mono uppercase tracking-widest opacity-30 text-center">Avail</span>
        <span />
      </div>

      {enriched.map(m => {
        const profile = m.profiles as any;
        const { label, bar, badge } = workloadMeta(m.taskCount, m.availability, m.isAvailable);
        const barPct = Math.min(100, (m.taskCount / maxTasks) * 100);
        const isOwner = m.user_id === ownerId;

        return (
          <div key={m.id} className="grid grid-cols-[1fr_80px_140px_100px_36px] gap-4 items-center px-5 py-4 border-b border-[var(--border-color)] hover:bg-white/3 transition-colors group">
            {/* Name + Owner Badge */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-sm flex items-center justify-center text-[12px] font-black shrink-0 ${
                isOwner ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--accent)]/10 text-[var(--accent)]'
              }`}>
                {profile?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-bold truncate">{profile?.display_name || 'Unknown'}</div>
                  {isOwner && (
                    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded-sm shrink-0">
                      <Crown size={8} /> Owner
                    </span>
                  )}
                </div>
                <div className="text-[10px] mono opacity-40 truncate">{profile?.job_title || profile?.email || m.role || 'Member'}</div>
              </div>
            </div>

            {/* Task count */}
            <div className="text-center">
              <span className="text-[16px] font-black mono">{m.taskCount}</span>
            </div>

            {/* Bar + label */}
            <div className="space-y-1.5">
              <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${bar}`} style={{ width: `${barPct}%` }} />
              </div>
              <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 border rounded-sm ${badge}`}>{label}</span>
            </div>

            {/* Availability % */}
            <div className="text-center">
              <span className={`text-[15px] font-black mono ${
                m.availability >= 70 ? 'text-green-400' : m.availability >= 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>{m.availability}%</span>
            </div>

            {/* Remove — only visible to managers, hidden for owner */}
            <div className="justify-self-center">
              {canManage && !isOwner ? (
                <button
                  onClick={() => onRemove(m.id)}
                  className="p-2.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-sm transition-all"
                  title="Remove member"
                >
                  <UserMinus size={16} />
                </button>
              ) : (
                <span className="w-6 h-6 block" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MembersTab: React.FC<{ projectId: string; ownerId: string | null }> = ({ projectId, ownerId }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addSearch, setAddSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('Team Member');

  // Resolve actual auth user + role
  useEffect(() => {
    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.role) setCurrentUserRole(profile.role);
      }
    };
    resolve();
  }, []);

  // canManage: project owner OR global Admin
  const canManage = currentUserId === ownerId || currentUserRole === 'Admin';

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('id, user_id, role, joined_at, profiles(display_name, email, job_title)')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true });
      if (!error && data) setMembers(data);
    } catch (err) {
      console.error('Members fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, job_title')
      .order('display_name');
    if (data) setAllProfiles(data);
  };

  useEffect(() => { fetchMembers(); fetchAllProfiles(); }, [projectId]);

  const memberIds = members.map(m => m.user_id);

  const addMember = async (userId: string, displayName: string) => {
    setAddingId(userId);
    try {
      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: userId, role: 'Member' });
      if (error) throw error;
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        action: 'Added member',
        entity_type: 'project',
        entity_id: projectId,
        details: `"${displayName}" added to project`,
      });
      await fetchMembers();
      setAddSearch('');
    } catch (err: any) {
      console.error('Add member error:', err);
      alert(err.message || 'Failed to add member.');
    } finally {
      setAddingId(null);
    }
  };

  const removeMember = async (membershipId: string) => {
    const membership = members.find(m => m.id === membershipId);
    // Safety: never remove the owner
    if (membership?.user_id === ownerId) return;
    try {
      const { error } = await supabase.from('project_members').delete().eq('id', membershipId);
      if (error) throw error;
      const profile = membership?.profiles as any;
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        action: 'Removed member',
        entity_type: 'project',
        entity_id: projectId,
        details: `"${profile?.display_name || 'Member'}" removed from project`,
      });
      await fetchMembers();
    } catch (err) {
      console.error('Remove member error:', err);
    }
  };

  // Profiles not yet in the project, filtered by search
  const availableProfiles = allProfiles.filter(p =>
    !memberIds.includes(p.id) &&
    (!addSearch ||
      p.display_name?.toLowerCase().includes(addSearch.toLowerCase()) ||
      p.email?.toLowerCase().includes(addSearch.toLowerCase())
    )
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[14px] font-black uppercase tracking-widest">
            {members.length} Member{members.length !== 1 ? 's' : ''}
          </h3>
          {!canManage && (
            <p className="text-[10px] mono opacity-30 mt-0.5">Only the project owner can manage members.</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => { setShowAdd(!showAdd); setAddSearch(''); }}
            className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-sm transition-all flex items-center gap-2 ${
              showAdd
                ? 'bg-white/10 text-[var(--text-primary)] border border-[var(--border-color)]'
                : 'bg-[var(--accent)] text-black hover:opacity-90'
            }`}
          >
            {showAdd ? <X size={14} /> : <UserPlus size={14} />}
            {showAdd ? 'Cancel' : 'Add Member'}
          </button>
        )}
      </div>

      {/* Add Member Panel */}
      {showAdd && canManage && (
        <div className="glass-panel overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-[var(--border-color)] relative">
            <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 opacity-50 z-10" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              autoFocus
              className="w-full bg-transparent pl-8 pr-4 py-1 text-[13px] mono outline-none text-black dark:text-white placeholder:text-gray-500 opacity-80 placeholder:opacity-30"
            />
          </div>

          {/* User list */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {availableProfiles.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[12px] mono opacity-30">
                  {addSearch ? 'No users match your search.' : 'All users are already members of this project.'}
                </p>
              </div>
            ) : (
              availableProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => addMember(p.id, p.display_name)}
                  disabled={addingId === p.id}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-[var(--border-color)] last:border-0 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-sm bg-[var(--accent-blue)]/10 flex items-center justify-center text-[11px] font-black text-[var(--accent-blue)] shrink-0">
                      {p.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold">{p.display_name}</div>
                      {p.email && <div className="text-[10px] mono opacity-40">{p.email}</div>}
                    </div>
                  </div>
                  {addingId === p.id ? (
                    <span className="text-[10px] mono opacity-40">Adding...</span>
                  ) : (
                    <UserPlus size={13} className="opacity-30 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      {loading ? (
        <div className="p-8 text-center opacity-30 mono text-[13px]">Loading members...</div>
      ) : members.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-[var(--border-color)]">
          <Users size={32} className="mx-auto mb-4 opacity-15" />
          <p className="text-[13px] mono opacity-30">No members yet. Add team members above.</p>
        </div>
      ) : (
        <WorkloadList
          members={members}
          projectId={projectId}
          ownerId={ownerId}
          canManage={canManage}
          onRemove={removeMember}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   ACTIVITY TAB
───────────────────────────────────────────────────── */
const ActivityTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*, profiles(display_name)')
          .eq('entity_id', projectId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && data) setLogs(data);
      } catch (err) {
        console.error('Activity error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [projectId]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="animate-in fade-in duration-300">
      {loading ? (
        <div className="p-8 text-center opacity-30 mono text-[13px]">Loading activity...</div>
      ) : logs.length === 0 ? (
        <div className="glass-panel p-12 text-center border-dashed border-[var(--border-color)]">
          <Activity size={32} className="mx-auto mb-4 opacity-15" />
          <p className="text-[13px] mono opacity-30">No activity recorded for this project yet.</p>
        </div>
      ) : (
        <div className="glass-panel">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 p-4 border-b border-[var(--border-color)] hover:bg-white/3 transition-colors">
              <div className="w-8 h-8 bg-[var(--accent-blue)]/10 rounded-sm flex items-center justify-center shrink-0">
                <Activity size={12} className="text-[var(--accent-blue)]" />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[12px] font-bold truncate">{(log.profiles as any)?.display_name || 'System'}</span>
                  <span className="text-[10px] mono opacity-40">{log.action}</span>
                </div>
                {log.details && <p className="text-[11px] opacity-40 mono truncate">{log.details}</p>}
              </div>
              <span className="text-[10px] mono opacity-30 shrink-0 flex items-center gap-1">
                <Clock size={10} /> {log.created_at ? timeAgo(log.created_at) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   SETTINGS TAB
───────────────────────────────────────────────────── */
const SettingsTab: React.FC<{ project: any; onUpdate: () => void; onDelete: () => void }> = ({ project, onUpdate, onDelete }) => {
  const [form, setForm] = useState({ name: '', description: '', status: '', priority: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'Active',
        priority: project.priority || 'Medium',
      });
    }
  }, [project]);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: form.name,
          description: form.description,
          status: form.status,
          priority: form.priority,
        })
        .eq('id', project.id);
      if (error) throw error;
      setMsg('Project updated!');
      onUpdate();
      setTimeout(() => setMsg(''), 3000);
    } catch (err: any) {
      setMsg(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${project.name}"? This will permanently remove the project and all its tasks.`)) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id);
      if (error) throw error;
      onDelete();
    } catch (err: any) {
      alert(err.message || 'Failed to delete.');
    }
  };

  const inputClass = "w-full p-3 glass-input rounded-sm text-[13px] mono";

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-2xl">
      {msg && (
        <div className={`p-3 text-[12px] font-bold mono ${msg.includes('updated') ? 'text-green-400 bg-green-500/10 border border-green-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
          {msg}
        </div>
      )}

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase opacity-60">Project Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase opacity-60">Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-24 resize-none`} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase opacity-60">Status</label>
            <div className="relative">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={`${inputClass} appearance-none cursor-pointer pr-8`}>
                <option>Active</option>
                <option>On Hold</option>
                <option>Completed</option>
                <option>Archived</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase opacity-60">Priority</label>
            <div className="relative">
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={`${inputClass} appearance-none cursor-pointer pr-8`}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !form.name.trim()}
        className="bg-[var(--accent)] text-black px-8 py-3 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
      >
        <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Danger zone */}
      <div className="border-t border-[var(--border-color)] pt-8 mt-8">
        <h4 className="text-[14px] font-black uppercase text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h4>
        <button
          onClick={handleDelete}
          className="px-6 py-3 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center gap-2 rounded-sm"
        >
          <Trash2 size={14} /> Delete Project
        </button>
        <p className="text-[10px] mono opacity-30 mt-2">This action cannot be undone. All tasks will be permanently deleted.</p>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   PROJECT WORKSPACE (MAIN)
───────────────────────────────────────────────────── */
const ProjectWorkspace: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Allow deep-linking to a specific tab via navigation state
    return (location.state as any)?.tab || 'board';
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);

  const fetchProject = async () => {
    if (!projectId) return;
    setLoading(true);
    setAccessDenied(false);
    try {
      // ── Step 1: Resolve current authenticated user ──
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/projects', { replace: true });
        return;
      }

      // ── Step 2: Fetch project — RLS will block this if user has no access ──
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle(); // maybeSingle returns null instead of throwing on "no rows"

      // Explicitly handle "project not found or not accessible"
      if (error || !data) {
        // Extra explicit check: see if this project even exists at all
        // If RLS blocked it, data will be null. Show denied message.
        setAccessDenied(true);
        setTimeout(() => navigate('/projects', { replace: true }), 2500);
        return;
      }

      // ── Step 3: Double-check membership client-side (defence in depth) ──
      const isOwner = data.owner_id === user.id;

      if (!isOwner) {
        const { data: membership } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          setAccessDenied(true);
          setTimeout(() => navigate('/projects', { replace: true }), 2500);
          return;
        }
      }

      setProject(data);
    } catch (err) {
      console.error('Project fetch error:', err);
      navigate('/projects', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [projectId]);

  // ── Access Denied Screen ──
  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-sm bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-[18px] font-black uppercase tracking-widest text-red-400">Access Denied</h2>
          <p className="text-[13px] mono opacity-50">You do not have access to this project.</p>
          <p className="text-[11px] mono opacity-30">Redirecting to your projects...</p>
        </div>
        <button
          onClick={() => navigate('/projects', { replace: true })}
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-5 py-2 border border-[var(--border-color)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
        >
          <ArrowLeft size={13} /> Back to Projects
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 opacity-30">
        <span className="mono text-[14px] uppercase tracking-widest">Loading project...</span>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-3">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[var(--accent)] transition-all mb-2"
          >
            <ArrowLeft size={14} /> All Projects
          </button>
          <div className="flex items-center gap-4">
            <FolderOpen size={22} className="text-[var(--accent)] shrink-0" />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{project.name}</h1>
              {project.description && (
                <p className="text-[13px] opacity-40 mt-1 line-clamp-1">{project.description}</p>
              )}
            </div>
          </div>
        </div>
        {activeTab === 'board' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAIGenerator(true)}
              className="flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-widest border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all rounded-sm"
            >
              <Sparkles size={14} /> Generate Tasks with AI
            </button>
            <button
              onClick={() => setShowTaskModal(true)}
              className="bg-[var(--accent)] text-black px-6 py-3 rounded-sm text-[12px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              <Plus size={16} /> Create Task
            </button>
          </div>
        )}
      </div>

      {/* Smart Insights — always visible, collapses when none */}
      {projectId && (
        <InsightsPanel projectId={projectId} onTabSwitch={setActiveTab} />
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)] overflow-x-auto">
        <TabBtn id="board" label="Board" icon={LayoutGrid} active={activeTab === 'board'} onClick={setActiveTab} />
        <TabBtn id="list" label="List" icon={List} active={activeTab === 'list'} onClick={setActiveTab} />
        <TabBtn id="calendar" label="Calendar" icon={CalendarDays} active={activeTab === 'calendar'} onClick={setActiveTab} />
        <TabBtn id="sprints" label="Sprints" icon={Zap} active={activeTab === 'sprints'} onClick={setActiveTab} />
        <TabBtn id="members" label="Members" icon={Users} active={activeTab === 'members'} onClick={setActiveTab} />
        <TabBtn id="risks" label="Risks" icon={Shield} active={activeTab === 'risks'} onClick={setActiveTab} />
        <TabBtn id="activity" label="Activity" icon={Activity} active={activeTab === 'activity'} onClick={setActiveTab} />
        <TabBtn id="settings" label="Settings" icon={Settings} active={activeTab === 'settings'} onClick={setActiveTab} />
      </div>

      {/* Tab Content */}
      {activeTab === 'board' && (
        <Board projectId={projectId} key={boardRefreshKey} />
      )}
      {activeTab === 'list' && projectId && (
        <ListView projectId={projectId} />
      )}
      {activeTab === 'calendar' && projectId && (
        <CalendarView projectId={projectId} />
      )}
      {activeTab === 'sprints' && projectId && (
        <SprintManager projectId={projectId} />
      )}
      {activeTab === 'members' && projectId && (
        <MembersTab projectId={projectId} ownerId={project?.owner_id || null} />
      )}
      {activeTab === 'risks' && projectId && (
        <RisksTab projectId={projectId} onTabSwitch={setActiveTab} />
      )}
      {activeTab === 'activity' && projectId && (
        <div className="space-y-12">
          <ActivityTab projectId={projectId} />
          <AuditLogViewer projectId={projectId} />
        </div>
      )}
      {activeTab === 'settings' && (
        <SettingsTab
          project={project}
          onUpdate={fetchProject}
          onDelete={() => navigate('/projects', { replace: true })}
        />
      )}

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onCreated={() => { setShowTaskModal(false); setBoardRefreshKey(k => k + 1); }}
        projectId={projectId}
      />

      {showAIGenerator && (
        <AITaskGenerator
          projectId={projectId!}
          projectName={project.name}
          projectDescription={project.description || ''}
          onClose={() => setShowAIGenerator(false)}
          onTasksInserted={() => setBoardRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
};

export default ProjectWorkspace;
