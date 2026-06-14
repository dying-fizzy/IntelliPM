
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, TrendingUp, CheckCircle, Clock, Search,
  ChevronRight, LayoutGrid, List, Crown, Users2, Trash2, AlertTriangle
} from 'lucide-react';
import ProjectModal from './ProjectModal';
import { supabase } from '../supabaseClient';

interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  tags: string[] | null;
  totalTasks: number;
  completedTasks: number;
}

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('Team Member');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);

      // Get current user's role from DB (source of truth)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      const role = profile?.role || 'Team Member';
      if (profile?.role) setCurrentUserRole(profile.role);

      let projData: any[] = [];
      let projErr: any = null;

      if (role === 'Admin' || role === 'Project Manager') {
        // Admin & PM see ALL projects in the system — RLS policy also allows this
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        projData = data || [];
        projErr = error;
      } else {
        // Team Member: only projects they have been explicitly added to (or own)
        const { data: memberRows } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id);

        const memberProjectIds = (memberRows || []).map((r: any) => r.project_id);

        if (memberProjectIds.length > 0) {
          // Include owned projects too (edge case: PM demoted to TM who owns projects)
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .or(`owner_id.eq.${user.id},id.in.(${memberProjectIds.join(',')})`)
            .order('created_at', { ascending: false });
          projData = data || [];
          projErr = error;
        } else {
          // No memberships — only owned projects (likely none for a new Team Member)
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });
          projData = data || [];
          projErr = error;
        }
      }

      if (projErr) throw projErr;

      // Fetch task counts scoped to accessible projects
      const accessibleProjectIds = projData.map((p: any) => p.id);
      let taskData: any[] = [];
      if (accessibleProjectIds.length > 0) {
        const { data: td, error: taskErr } = await supabase
          .from('tasks')
          .select('project_id, status')
          .in('project_id', accessibleProjectIds);
        if (taskErr) throw taskErr;
        taskData = td || [];
      }

      const projectStats: ProjectWithStats[] = projData.map((proj: any) => {
        const projectTasks = taskData.filter(t => t.project_id === proj.id);
        const completed = projectTasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
        return { ...proj, totalTasks: projectTasks.length, completedTasks: completed };
      });

      // Owned projects first, then by date
      projectStats.sort((a: any, b: any) => {
        const aOwned = a.owner_id === user.id ? 0 : 1;
        const bOwned = b.owner_id === user.id ? 0 : 1;
        if (aOwned !== bOwned) return aOwned - bOwned;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setProjects(projectStats);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const canDelete = currentUserRole === 'Admin' || currentUserRole === 'Project Manager';

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('projects').delete().eq('id', deleteConfirm.id);
      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        action: 'Deleted project',
        entity_type: 'project',
        entity_id: deleteConfirm.id,
        details: `Project "${deleteConfirm.name}" permanently deleted`,
      });

      setDeleteConfirm(null);
      fetchProjects();
    } catch (err: any) {
      console.error('Delete project error:', err);
      alert(err.message || 'Failed to delete project.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesText = !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.description?.toLowerCase().includes(filter.toLowerCase()) ||
      p.project_type?.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const statusColor = (s: string) => {
    if (s === 'Active') return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (s === 'Archived') return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    if (s === 'On Hold') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    if (s === 'Completed') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'opacity-40';
  };

  const priorityColor = (p: string) => {
    if (p === 'Critical') return 'text-red-400';
    if (p === 'High') return 'text-orange-400';
    if (p === 'Medium') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 w-full pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-3">
          <span className="ui-label text-[var(--accent)] tracking-[0.4em] font-black text-[18px]">Workspace</span>
          <h1 className="uppercase tracking-tighter leading-none font-bold">
            {currentUserRole === 'Admin' || currentUserRole === 'Project Manager' ? 'All Projects' : 'Your Projects'}
          </h1>
          <p className="text-[13px] opacity-40 mono">
            {currentUserRole === 'Admin'
              ? 'System-wide view — all organization projects.'
              : currentUserRole === 'Project Manager'
              ? 'All projects across your organization.'
              : 'Showing only projects you have been added to.'}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--accent)] text-black px-10 py-5 rounded-sm text-[12px] font-black uppercase tracking-widest flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-xl"
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-grow max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 z-10" />
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full glass-input rounded-sm py-3 pl-11 pr-4 text-[13px] mono placeholder:text-gray-500"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'Active', 'On Hold', 'Completed', 'Archived'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border rounded-sm transition-all ${
                statusFilter === s
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'border-[var(--border-color)] opacity-40 hover:opacity-100'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <div className="flex border border-[var(--border-color)] rounded-sm overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-black' : 'opacity-40 hover:opacity-100'}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 transition-all ${viewMode === 'list' ? 'bg-[var(--accent)] text-black' : 'opacity-40 hover:opacity-100'}`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel h-48 flex items-center justify-center opacity-30">
              <span className="mono text-[13px] uppercase tracking-widest">Loading...</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filteredProjects.length === 0 && (
        <div className="glass-panel p-16 text-center border-dashed border-[var(--border-color)]">
          <FolderOpen size={48} className="mx-auto mb-6 opacity-15" />
          <h3 className="text-xl font-black uppercase tracking-widest mb-3 opacity-40">
            {filter || statusFilter !== 'all' ? 'No matching projects' : 'No projects yet'}
          </h3>
          <p className="text-[13px] opacity-30 mono mb-6">
            {filter || statusFilter !== 'all'
              ? 'Try adjusting your filters.'
              : currentUserRole === 'Team Member'
              ? "You haven't been added to any projects yet. Contact your Admin or Project Manager to be added."
              : 'Create your first project to get started.'}
          </p>
          {!filter && statusFilter === 'all' && (currentUserRole === 'Admin' || currentUserRole === 'Project Manager') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[var(--accent)] text-black px-8 py-3 text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Plus size={14} className="inline mr-2" /> Create Project
            </button>
          )}
        </div>
      )}

      {/* Grid View */}
      {!loading && filteredProjects.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map(proj => {
            const progress = proj.totalTasks > 0 ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="glass-panel p-6 cursor-pointer hover:border-[var(--accent)]/40 transition-all group hover:shadow-lg hover:-translate-y-[3px]"
              >
                {/* Header row */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-grow min-w-0">
                    <h3 className="text-[16px] font-black uppercase tracking-tight truncate group-hover:text-[var(--accent)] transition-colors">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {proj.project_type && (
                        <span className="text-[10px] mono opacity-30 uppercase tracking-widest">{proj.project_type}</span>
                      )}
                      {currentUserId && (
                        (proj as any).owner_id === currentUserId ? (
                          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded-sm">
                            <Crown size={7} /> Owned by you
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 rounded-sm">
                            <Users2 size={7} /> Shared with you
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: proj.id, name: proj.name }); }}
                        className="p-1.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-red-500 transition-all rounded-sm"
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <ChevronRight size={16} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                  </div>
                </div>

                {/* Description */}
                {proj.description && (
                  <p className="text-[12px] opacity-40 mb-4 line-clamp-2 leading-relaxed">{proj.description}</p>
                )}

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] mono font-bold mb-1.5">
                    <span className="opacity-40">{proj.completedTasks}/{proj.totalTasks} tasks</span>
                    <span className={progress === 100 ? 'text-green-400' : 'text-[var(--accent)]'}>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-black/10 dark:bg-white/5 overflow-hidden rounded-sm">
                    <div
                      className={`h-full transition-all duration-700 ${progress === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm ${statusColor(proj.status)}`}>
                    {proj.status}
                  </span>
                  <div className="flex items-center gap-3 text-[10px] mono opacity-30">
                    {proj.priority && (
                      <span className={`font-bold uppercase ${priorityColor(proj.priority)}`}>
                        {proj.priority}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {proj.tags && proj.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {proj.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[8px] mono px-2 py-0.5 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 rounded-sm">
                        #{tag}
                      </span>
                    ))}
                    {proj.tags.length > 3 && (
                      <span className="text-[8px] mono px-2 py-0.5 opacity-30">+{proj.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!loading && filteredProjects.length > 0 && viewMode === 'list' && (
        <div className="glass-panel">
          {filteredProjects.map(proj => {
            const progress = proj.totalTasks > 0 ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="flex items-center gap-6 p-5 border-b border-[var(--border-color)] cursor-pointer hover:bg-white/3 transition-colors group"
              >
                <div className="flex-grow min-w-0">
                  <h3 className="text-[14px] font-black uppercase tracking-tight truncate group-hover:text-[var(--accent)] transition-colors">
                    {proj.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] mono opacity-30">{proj.project_type || 'Project'}</span>
                    {currentUserId && (
                      (proj as any).owner_id === currentUserId ? (
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded-sm">
                          <Crown size={7} /> Owned by you
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 rounded-sm">
                          <Users2 size={7} /> Shared with you
                        </span>
                      )
                    )}
                  </div>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm shrink-0 ${statusColor(proj.status)}`}>
                  {proj.status}
                </span>
                <div className="w-32 shrink-0">
                  <div className="flex justify-between text-[9px] mono mb-1">
                    <span className="opacity-40">{proj.completedTasks}/{proj.totalTasks}</span>
                    <span className="font-bold text-[var(--accent)]">{progress}%</span>
                  </div>
                  <div className="h-1 bg-black/10 dark:bg-white/5 overflow-hidden rounded-sm">
                    <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {canDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: proj.id, name: proj.name }); }}
                    className="p-1.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-red-500 transition-all rounded-sm shrink-0"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-overlay">
          <div className="glass-panel-elevated rounded-sm p-8 max-w-sm w-full mx-4 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-sm flex items-center justify-center">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-[10px] mono uppercase tracking-widest opacity-40">Irreversible Action</p>
                <h3 className="text-base font-black uppercase tracking-tight">Delete Project</h3>
              </div>
            </div>
            <p className="text-[13px] opacity-60 leading-relaxed">
              This will <span className="text-red-400 font-bold">permanently delete</span> the project{' '}
              <span className="font-bold text-white">&quot;{deleteConfirm.name}&quot;</span> and all of its tasks, members, and associated data. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 glass-button text-[11px] font-black uppercase tracking-widest rounded-sm disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white text-[11px] font-black uppercase tracking-widest rounded-sm hover:bg-red-600 transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {deleting ? 'Deleting...' : <><Trash2 size={12} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => { setIsModalOpen(false); fetchProjects(); }}
      />
    </div>
  );
};

export default ProjectsPage;
