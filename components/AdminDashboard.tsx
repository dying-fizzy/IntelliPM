
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FolderOpen, CheckSquare, Activity, TrendingUp,
  Shield, Trash2, ChevronDown, AlertTriangle, RefreshCw,
  Archive, Search, Clock, FileSpreadsheet, Pencil,
  UserPlus, Check, X, ChevronRight
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useTheme } from './ThemeContext';
import DataImportPanel from './DataImportPanel';
import EmployeeEditModal from './EmployeeEditModal';

/* ─────────────────────────────────────────────────────
   SYSTEM METRICS
───────────────────────────────────────────────────── */
const SystemMetrics: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [metrics, setMetrics] = useState({ users: 0, projects: 0, tasks: 0, activeProjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [usersRes, projRes, tasksRes, activeRes] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('projects').select('*', { count: 'exact', head: true }),
          supabase.from('tasks').select('*', { count: 'exact', head: true }),
          supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        ]);
        setMetrics({
          users: usersRes.count || 0,
          projects: projRes.count || 0,
          tasks: tasksRes.count || 0,
          activeProjects: activeRes.count || 0,
        });
      } catch (err) {
        console.error('Metrics error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [refreshKey]);

  const cards = [
    { label: 'Total Users', value: metrics.users, icon: Users, color: 'var(--accent)' },
    { label: 'Total Projects', value: metrics.projects, icon: FolderOpen, color: 'var(--accent-blue)' },
    { label: 'Active Projects', value: metrics.activeProjects, icon: TrendingUp, color: '#39FF14' },
    { label: 'Total Tasks', value: metrics.tasks, icon: CheckSquare, color: 'var(--accent-pink)' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map(card => (
        <div key={card.label} className="glass-panel p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <span className="ui-label opacity-50 flex items-center gap-2">
              <card.icon size={14} /> {card.label}
            </span>
          </div>
          <div className="text-3xl font-black mono" style={{ color: card.color }}>
            {loading ? '—' : card.value}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   USERS TABLE
───────────────────────────────────────────────────── */
const UsersTable: React.FC<{ onRefresh: () => void; onEditEmployee: (employeeId: string, fullName: string) => void }> = ({ onRefresh, onEditEmployee }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Also fetch employee_id by joining on email
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, role, created_at')
        .order('created_at', { ascending: false });
      if (error || !profileData) return;

      // Attempt to enrich with employee_id from employees table
      const { data: empData } = await supabase
        .from('employees')
        .select('employee_id, full_name');

      const enriched = profileData.map(p => {
        const match = empData?.find(e =>
          e.full_name?.toLowerCase().trim() === p.display_name?.toLowerCase().trim()
        );
        return { ...p, employee_id: match?.employee_id || null };
      });

      setUsers(enriched);
    } catch (err) {
      console.error('Users fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUser.id) {
      alert('You cannot change your own role.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;

      // Log activity
      supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        action: 'Changed user role',
        entity_type: 'user',
        entity_id: userId,
        details: `Role changed to ${newRole}`,
      });

      fetchUsers();
      onRefresh();
    } catch (err) {
      console.error('Role update error:', err);
      alert('Failed to update role.');
    }
  };

  const handleDelete = async (userId: string, displayName: string) => {
    if (userId === currentUser.id) {
      setDeleteStatus({ type: 'error', message: 'You cannot delete your own account.' });
      setTimeout(() => setDeleteStatus(null), 4000);
      return;
    }
    // Show confirmation modal
    setDeleteConfirm({ id: userId, name: displayName });
  };

  const confirmPermanentDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      // Get the current Supabase session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No active session. Please log in again.');

      const res = await fetch(`/api/admin/users/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Deletion failed.');

      setDeleteStatus({ type: 'success', message: `"${deleteConfirm.name}" has been permanently deleted.` });
      setTimeout(() => setDeleteStatus(null), 5000);
      setDeleteConfirm(null);
      fetchUsers();
      onRefresh();
    } catch (err: any) {
      setDeleteStatus({ type: 'error', message: err.message || 'Failed to delete user.' });
      setTimeout(() => setDeleteStatus(null), 5000);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = filter
    ? users.filter(u =>
      u.display_name?.toLowerCase().includes(filter.toLowerCase()) ||
      u.email?.toLowerCase().includes(filter.toLowerCase()) ||
      u.role?.toLowerCase().includes(filter.toLowerCase())
    )
    : users;

  return (
    <div className="glass-panel">
      {/* Toast notification */}
      {deleteStatus && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-sm border shadow-2xl text-[12px] font-bold mono animate-in slide-in-from-top-2 duration-300 ${
          deleteStatus.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {deleteStatus.type === 'success' ? <Shield size={14} /> : <AlertTriangle size={14} />}
          {deleteStatus.message}
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirm && (
        <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center">
          <div className="glass-panel-elevated rounded-sm p-8 max-w-sm w-full mx-4 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-sm flex items-center justify-center">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-[10px] mono uppercase tracking-widest opacity-40">Irreversible Action</p>
                <h3 className="text-base font-black uppercase tracking-tight">Delete Account</h3>
              </div>
            </div>
            <p className="text-[13px] opacity-60 leading-relaxed">
              This will <span className="text-red-400 font-bold">permanently delete</span> the account for{' '}
              <span className="font-bold text-white">&quot;{deleteConfirm.name}&quot;</span>. Their authentication, profile, and all associated data will be wiped. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-[var(--border-color)] text-[11px] font-black uppercase tracking-widest rounded-sm hover:bg-white/5 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmPermanentDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white text-[11px] font-black uppercase tracking-widest rounded-sm hover:bg-red-600 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {deleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
        <div>
          <span className="ui-label text-[var(--accent)] flex items-center gap-2"><Users size={14} /> User Management</span>
          <h3 className="text-lg font-black uppercase tracking-tighter mt-1">{users.length} Users</h3>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 z-10" />
          <input
            type="text"
            placeholder="Filter users..."
            className="bg-white/5 border border-[var(--border-color)] rounded-sm py-2 pl-9 pr-4 text-[12px] mono outline-none focus:border-[var(--accent)] w-56 text-black dark:text-white placeholder:text-gray-500"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-white/2">
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Name</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Email</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Role</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Joined</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center opacity-30 mono text-[13px]">Loading users...</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center opacity-30 mono text-[13px]">No users found</td></tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} className="border-b border-[var(--border-color)] hover:bg-white/3 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[var(--accent)]/10 rounded-sm flex items-center justify-center text-[11px] font-black text-[var(--accent)]">
                        {user.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-[13px] font-bold">{user.display_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-[12px] mono opacity-60">{user.email || '—'}</td>
                  <td className="p-4">
                    <div className="relative">
                      <select
                        value={user.role || 'Team Member'}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        disabled={user.id === currentUser.id}
                        className={`bg-transparent border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-[11px] font-bold mono uppercase tracking-wider outline-none appearance-none cursor-pointer pr-7 transition-colors focus:border-[var(--accent)] ${user.id === currentUser.id ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <option value="Admin">Admin</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Team Member">Team Member</option>
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                    </div>
                  </td>
                  <td className="p-4 text-[11px] mono opacity-40">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditEmployee(user.employee_id || '', user.display_name || 'Unknown')}
                        className="p-2 opacity-60 hover:opacity-100 hover:text-[var(--accent)] transition-all"
                        title="Edit employee record"
                      >
                        <Pencil size={13} />
                      </button>
                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => handleDelete(user.id, user.display_name)}
                          className="p-2 opacity-60 hover:opacity-100 hover:text-red-500 transition-all"
                          title="Delete user"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   ADD TO ENVIRONMENT
───────────────────────────────────────────────────── */
const AddToEnvironment: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedRole, setSelectedRole] = useState('Member');
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: profiles }, { data: proj }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, email, role').order('display_name'),
        supabase.from('projects').select('id, name').order('name'),
      ]);
      setAllUsers(profiles || []);
      setProjects(proj || []);
      setLoading(false);
    };
    load();
  }, []);

  const filteredUsers = search.trim()
    ? allUsers.filter(u =>
        u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : allUsers;

  const handleAdd = async () => {
    if (!selectedUser || !selectedProjectId) return;
    setAdding(true);
    setStatus(null);
    try {
      // Check if already a member
      const { data: existing } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', selectedProjectId)
        .eq('user_id', selectedUser.id)
        .maybeSingle();

      if (existing) {
        setStatus({ type: 'error', msg: `${selectedUser.display_name} is already a member of this project.` });
        setAdding(false);
        return;
      }

      const { error } = await supabase.from('project_members').insert({
        project_id: selectedProjectId,
        user_id: selectedUser.id,
        role: selectedRole,
      });
      if (error) throw error;

      // Log the action
      await supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        action: 'Added user to project',
        entity_type: 'project',
        entity_id: selectedProjectId,
        details: `"${selectedUser.display_name}" added to project as ${selectedRole}`,
      });

      // Notify the added user
      const projName = projects.find(p => p.id === selectedProjectId)?.name || 'a project';
      await supabase.from('notifications').insert({
        user_id: selectedUser.id,
        message: `You have been added to the project "${projName}" as ${selectedRole}.`,
        type: 'project_added',
        entity_id: selectedProjectId,
      });

      setStatus({ type: 'success', msg: `${selectedUser.display_name} added successfully!` });
      setSelectedUser(null);
      setSelectedProjectId('');
      setSearch('');
      onRefresh();
      setTimeout(() => setStatus(null), 4000);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Failed to add member.' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="glass-panel">
      <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
        <div>
          <span className="ui-label text-[var(--accent)] flex items-center gap-2"><UserPlus size={14} /> Add to Environment</span>
          <h3 className="text-lg font-black uppercase tracking-tighter mt-1">Project Access Control</h3>
          <p className="text-[11px] mono opacity-40 mt-1">Search registered users and add them to a project.</p>
        </div>
      </div>

      {status && (
        <div className={`mx-6 mt-4 p-3 text-[12px] font-bold mono flex items-center gap-2 ${
          status.type === 'success'
            ? 'text-green-400 bg-green-500/10 border border-green-500/20'
            : 'text-red-400 bg-red-500/10 border border-red-500/20'
        }`}>
          {status.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
          {status.msg}
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* User Search */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Search User</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 z-10" />
            <input
              type="text"
              placeholder="Name or email..."
              className="w-full bg-white/5 border border-[var(--border-color)] rounded-sm py-2.5 pl-9 pr-4 text-[12px] mono outline-none focus:border-[var(--accent)] text-black dark:text-white placeholder:text-gray-500"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedUser(null); }}
            />
          </div>

          {/* User dropdown results */}
          {search.trim() && !selectedUser && (
            <div className="mt-1 border border-[var(--border-color)] rounded-sm overflow-hidden max-h-48 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-[12px] mono opacity-30">Loading...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-3 text-[12px] mono opacity-30">No users found</div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setSearch(u.display_name); }}
                    className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left border-b border-[var(--border-color)] last:border-0"
                  >
                    <div>
                      <div className="text-[13px] font-bold">{u.display_name}</div>
                      <div className="text-[11px] mono opacity-40">{u.email}</div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${
                      u.role === 'Admin' ? 'text-red-400 border-red-500/30'
                      : u.role === 'Project Manager' ? 'text-[var(--accent)] border-[var(--accent)]/30'
                      : 'text-blue-400 border-blue-500/30'
                    }`}>{u.role}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected user badge */}
          {selectedUser && (
            <div className="mt-2 flex items-center justify-between p-3 bg-[var(--accent)]/5 border border-[var(--accent)]/30 rounded-sm">
              <div>
                <div className="text-[13px] font-bold">{selectedUser.display_name}</div>
                <div className="text-[11px] mono opacity-40">{selectedUser.email} · {selectedUser.role}</div>
              </div>
              <button onClick={() => { setSelectedUser(null); setSearch(''); }} className="opacity-40 hover:opacity-100 transition-opacity">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Project selector */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Select Project</label>
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full bg-white/5 border border-[var(--border-color)] rounded-sm py-2.5 pl-4 pr-9 text-[12px] mono outline-none focus:border-[var(--accent)] appearance-none cursor-pointer text-black dark:text-white"
            >
              <option value="">— Choose a project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
          </div>
        </div>

        {/* Role selector */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 block">Project Role</label>
          <div className="flex gap-2">
            {['Member', 'Lead', 'Reviewer'].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest border rounded-sm transition-all ${
                  selectedRole === r
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'border-[var(--border-color)] opacity-40 hover:opacity-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={adding || !selectedUser || !selectedProjectId}
          className="w-full py-3 bg-[var(--accent)] text-black text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.99] disabled:opacity-30 rounded-sm"
        >
          {adding ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
          {adding ? 'Adding...' : 'Add to Environment'}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   PROJECTS TABLE
───────────────────────────────────────────────────── */
const ProjectsTable: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('id, name, status, priority, created_at, owner_id')
        .order('created_at', { ascending: false });

      if (projErr) { console.error('Projects fetch error:', projErr); setLoading(false); return; }
      if (!projData || projData.length === 0) { setProjects([]); setLoading(false); return; }

      const ownerIds = [...new Set(projData.map((p: any) => p.owner_id).filter(Boolean))];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ownerIds);
        (profiles || []).forEach((p: any) => { ownerMap[p.id] = p.display_name; });
      }

      const enriched = projData.map((p: any) => ({
        ...p,
        owner_name: ownerMap[p.owner_id] || '—',
      }));

      setProjects(enriched);
    } catch (err) {
      console.error('Projects fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleArchive = async (projectId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'Archived' })
        .eq('id', projectId);
      if (error) throw error;

      supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        action: 'Archived project',
        entity_type: 'project',
        entity_id: projectId,
        details: `Project "${name}" archived`,
      });

      fetchProjects();
      onRefresh();
    } catch (err) {
      console.error('Archive error:', err);
      alert('Failed to archive project.');
    }
  };

  const handleDelete = async (projectId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also remove all tasks in this project.`)) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;

      supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        action: 'Deleted project',
        entity_type: 'project',
        entity_id: projectId,
        details: `Project "${name}" deleted`,
      });

      fetchProjects();
      onRefresh();
    } catch (err) {
      console.error('Delete project error:', err);
      alert('Failed to delete project.');
    }
  };

  const statusColor = (s: string) => {
    if (s === 'Active') return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (s === 'Archived') return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    if (s === 'On Hold') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    if (s === 'Completed') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'opacity-40';
  };

  return (
    <div className="glass-panel">
      <div className="flex justify-between items-center p-6 border-b border-[var(--border-color)]">
        <div>
          <span className="ui-label text-[var(--accent-blue)] flex items-center gap-2"><FolderOpen size={14} /> Project Control</span>
          <h3 className="text-lg font-black uppercase tracking-tighter mt-1">{projects.length} Projects</h3>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-white/2">
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Project</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Owner</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Status</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono">Created</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold opacity-40 mono text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center opacity-30 mono text-[13px]">Loading projects...</td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center opacity-30 mono text-[13px]">No projects yet</td></tr>
            ) : (
              projects.map(proj => (
                <tr
                  key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="border-b border-[var(--border-color)] hover:bg-white/3 transition-colors group cursor-pointer"
                >
                  <td className="p-4 text-[13px] font-bold group-hover:text-[var(--accent)] transition-colors">{proj.name}</td>
                  <td className="p-4 text-[12px] mono opacity-60">{proj.owner_name}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border rounded-sm ${statusColor(proj.status)}`}>
                      {proj.status || 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-[11px] mono opacity-40">
                    {proj.created_at ? new Date(proj.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {proj.status !== 'Archived' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchive(proj.id, proj.name); }}
                          className="p-2 opacity-40 hover:opacity-100 hover:text-yellow-400 transition-all"
                          title="Archive project"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(proj.id, proj.name); }}
                        className="p-2 opacity-40 hover:opacity-100 hover:text-red-500 transition-all"
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   ACTIVITY FEED
───────────────────────────────────────────────────── */
const ActivityFeed: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*, profiles(display_name)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error && data) setLogs(data);
      } catch (err) {
        console.error('Activity fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();

    // Realtime subscription
    const channel = supabase
      .channel('admin-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    <div className="glass-panel">
      <div className="p-6 border-b border-[var(--border-color)]">
        <span className="ui-label text-[var(--accent-pink)] flex items-center gap-2"><Activity size={14} /> Activity Monitor</span>
        <h3 className="text-lg font-black uppercase tracking-tighter mt-1">Recent Activity</h3>
      </div>

      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-8 text-center opacity-30 mono text-[13px]">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center opacity-30 mono text-[13px]">No activity recorded yet</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 p-4 border-b border-[var(--border-color)] hover:bg-white/3 transition-colors">
              <div className="w-8 h-8 bg-[var(--accent-pink)]/10 rounded-sm flex items-center justify-center shrink-0">
                <Activity size={12} className="text-[var(--accent-pink)]" />
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-bold truncate">
                    {(log.profiles as any)?.display_name || 'System'}
                  </span>
                  <span className="text-[11px] mono opacity-40">{log.action}</span>
                </div>
                {log.details && (
                  <p className="text-[11px] opacity-40 mono truncate">{log.details}</p>
                )}
              </div>
              <div className="text-[10px] mono opacity-30 flex items-center gap-1 shrink-0">
                <Clock size={10} />
                {log.created_at ? timeAgo(log.created_at) : '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   ADMIN DASHBOARD (MAIN)
───────────────────────────────────────────────────── */
const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'data-import'>('overview');
  const [editEmployee, setEditEmployee] = useState<{ id: string; name: string } | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Frontend access guard
  useEffect(() => {
    if (user.role !== 'Admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  if (user.role !== 'Admin') return null;

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'data-import', label: 'Data Import', icon: FileSpreadsheet },
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 w-full pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-[var(--accent)]" />
            <span className="ui-label text-[var(--accent)] tracking-[0.4em] font-black">Admin Panel</span>
          </div>
          <h1 className="uppercase tracking-tighter leading-none font-bold">System Administration</h1>
          <p className="text-[13px] opacity-40 mono">Manage users, projects, and monitor system activity.</p>
        </div>
        {activeTab === 'overview' && (
          <button
            onClick={handleRefresh}
            className="bg-[var(--accent)] text-black px-6 py-3 rounded-sm text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-widest mono transition-all border-b-2 -mb-[1px]
              ${ activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent opacity-40 hover:opacity-70'
              }`}
          >
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <SystemMetrics refreshKey={refreshKey} />
          <AddToEnvironment onRefresh={handleRefresh} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <UsersTable
              onRefresh={handleRefresh}
              onEditEmployee={(id, name) => setEditEmployee({ id, name })}
            />
            <ProjectsTable onRefresh={handleRefresh} />
          </div>
          <ActivityFeed />
        </>
      )}

      {/* Data Import Tab */}
      {activeTab === 'data-import' && <DataImportPanel />}

      {/* Employee Edit Side Panel */}
      {editEmployee && (
        <EmployeeEditModal
          employeeId={editEmployee.id}
          fullName={editEmployee.name}
          onClose={() => setEditEmployee(null)}
          onSaved={handleRefresh}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
