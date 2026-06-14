import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  TrendingUp,
  ShieldAlert,
  Users,
  FolderOpen,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import ProjectModal from './ProjectModal';
import Board from './Board';
import SkillMatrixHeatmap from './SkillMatrixHeatmap';
import SystemLog from './SystemLog';
import { supabase } from '../supabaseClient';
import { computeRisk } from './RisksTab';

const ProjectHealthRadar = ({ refreshKey }: { refreshKey: number }) => {
  const [metrics, setMetrics] = useState<{ total: number; completed: number; overdue: number; projectCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Get current auth user
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch only projects this user owns or is a member of
        let projectIds: string[] = [];
        if (user) {
          const { data: memberRows } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user.id);
          const memberIds = (memberRows || []).map((r: any) => r.project_id);

          const { data: ownedProjects } = await supabase
            .from('projects')
            .select('id')
            .or(`owner_id.eq.${user.id}${memberIds.length > 0 ? `,id.in.(${memberIds.join(',')})` : ''}`);
          projectIds = (ownedProjects || []).map((p: any) => p.id);
        }

        // Fetch tasks scoped to those projects
        let tasks: any[] = [];
        if (projectIds.length > 0) {
          const { data, error: taskError } = await supabase
            .from('tasks')
            .select('status, due_date')
            .in('project_id', projectIds);
          if (taskError) throw taskError;
          tasks = data || [];
        }

        const total = tasks?.length || 0;
        const completed = tasks?.filter((t: any) => t.status === 'Completed' || t.status === 'Done').length || 0;
        const overdue = tasks?.filter((t: any) => {
          if (!t.due_date) return false;
          return new Date(t.due_date) < new Date() && t.status !== 'Completed' && t.status !== 'Done';
        }).length || 0;

        // Fetch project count
        let projectCount = 0;
        try {
          const { count, error: projError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true });
          if (!projError && count !== null) projectCount = count;
        } catch (_) { /* projects table may not exist yet */ }

        setMetrics({ total, completed, overdue, projectCount });
      } catch (err) {
        console.error('Failed to fetch project metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [refreshKey]);

  const progress = metrics && metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0;
  const riskPercent = metrics && metrics.total > 0 ? Math.round((metrics.overdue / metrics.total) * 100) : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-panel p-8 flex items-center justify-center h-48 opacity-30">
            <span className="mono text-[14px] uppercase tracking-widest">Loading...</span>
          </div>
        ))}
      </div>
    );
  }

  if (!metrics || metrics.total === 0) {
    return (
      <div className="glass-panel p-12 text-center border-dashed border-[var(--border-color)]">
        <span className="mono text-[14px] uppercase tracking-widest opacity-30">No project data available. Create tasks to see metrics.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
      {/* Progress Tracking */}
      <div className="glass-panel p-8 flex flex-col justify-between">
        <div className="flex justify-between items-center mb-6">
          <span className="ui-label opacity-60 flex items-center gap-2"><TrendingUp size={14} /> Progress Tracking</span>
          <span className="text-[13px] mono font-black text-[var(--accent)] tracking-widest">LIVE</span>
        </div>
        <div className="space-y-6">
          <div className="flex justify-between text-[14px] font-black uppercase tracking-tighter">
            <span>Completion</span>
            <span className="text-[var(--accent)]">{progress}%</span>
          </div>
          <div className="relative h-2 bg-black/10 dark:bg-white/5 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex justify-between text-[13px] mono opacity-40 uppercase tracking-widest font-bold">
            <span>{metrics.completed} / {metrics.total} tasks</span>
            <span>Target: 100%</span>
          </div>
        </div>
      </div>

      {/* Risk Meter */}
      <div className="glass-panel p-8 flex flex-col items-center justify-center relative overflow-hidden group">
        <div className="absolute top-4 left-8">
          <span className="ui-label opacity-60 flex items-center gap-2"><ShieldAlert size={14} /> Risk Analysis</span>
        </div>
        <div className="relative w-32 h-32 mt-4">
          <svg className="w-full h-full" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="opacity-10" />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke={riskPercent > 50 ? '#FF007A' : '#39FF14'}
              strokeWidth="6"
              strokeDasharray={251}
              strokeDashoffset={251 - (251 * riskPercent) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000"
              style={{ filter: `drop-shadow(0 0 4px ${riskPercent > 50 ? '#FF007A' : '#39FF14'})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black mono leading-none">{riskPercent}%</span>
            <span className="text-[8px] mono opacity-40 font-bold uppercase tracking-widest mt-1">{riskPercent > 50 ? 'Elevated' : 'Nominal'}</span>
          </div>
        </div>
        <div className="mt-4 text-[10px] mono opacity-40 uppercase tracking-widest font-bold">{metrics.overdue} overdue task{metrics.overdue !== 1 ? 's' : ''}</div>
      </div>

      {/* Team Capacity Summary */}
      <div className="glass-panel p-8 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <span className="ui-label opacity-60 flex items-center gap-2"><Users size={14} /> Team Capacity</span>
        </div>
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-4xl font-black mono text-[var(--accent)]">{metrics.total - metrics.completed}</div>
            <div className="text-[11px] mono opacity-40 uppercase tracking-widest font-bold">Remaining Tasks</div>
          </div>
          {metrics.projectCount > 0 && (
            <div className="mt-6 flex items-center gap-2 text-[12px] mono opacity-50">
              <FolderOpen size={14} /> {metrics.projectCount} active project{metrics.projectCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   RISK SUMMARY CARD
───────────────────────────────────────────────────── */
interface ProjectRisk {
  id: string;
  name: string;
  score: number;
  label: 'Low' | 'Medium' | 'High';
}

const riskLabelColor = (label: 'Low' | 'Medium' | 'High') => {
  if (label === 'High') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (label === 'Medium') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  return 'text-green-400 bg-green-500/10 border-green-500/20';
};

const riskBarColor = (label: 'Low' | 'Medium' | 'High') => {
  if (label === 'High') return 'bg-red-500';
  if (label === 'Medium') return 'bg-orange-500';
  return 'bg-green-500';
};

const RiskSummaryCard: React.FC = () => {
  const navigate = useNavigate();
  const [projectRisks, setProjectRisks] = useState<ProjectRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data: projects = [] } = await supabase
          .from('projects')
          .select('id, name, status')
          .not('status', 'eq', 'Archived')
          .order('created_at', { ascending: false })
          .limit(8);

        if (!projects || projects.length === 0) {
          setProjectRisks([]);
          return;
        }

        // Compute risk for each project in parallel
        const results = await Promise.all(
          (projects as any[]).map(async (p) => {
            try {
              const r = await computeRisk(p.id);
              return { id: p.id, name: p.name, score: r.score, label: r.label };
            } catch {
              return { id: p.id, name: p.name, score: 0, label: 'Low' as const };
            }
          })
        );

        // Sort highest risk first
        results.sort((a, b) => b.score - a.score);
        setProjectRisks(results);
      } catch (err) {
        console.error('Risk summary error:', err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const highest = projectRisks[0];

  return (
    <div className="glass-panel p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="ui-label opacity-60 flex items-center gap-2">
          <ShieldAlert size={14} /> Project Risk Overview
        </span>
        {highest && (
          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 border rounded-sm ${riskLabelColor(highest.label)}`}>
            Highest: {highest.label}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32 opacity-30">
          <span className="mono text-[13px] uppercase tracking-widest">Calculating risks…</span>
        </div>
      )}

      {/* Empty */}
      {!loading && projectRisks.length === 0 && (
        <div className="text-center py-8 opacity-30">
          <ShieldAlert size={28} className="mx-auto mb-3" />
          <p className="mono text-[12px]">No projects to analyse.</p>
        </div>
      )}

      {/* Risk list */}
      {!loading && projectRisks.length > 0 && (
        <div className="space-y-3">
          {projectRisks.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`, { state: { tab: 'risks' } })}
              className="w-full flex items-center gap-4 group hover:bg-white/3 -mx-2 px-2 py-1.5 rounded-sm transition-colors"
            >
              {/* Name */}
              <span className="text-[12px] font-bold truncate w-36 text-left flex-shrink-0 group-hover:text-[var(--accent)] transition-colors">
                {p.name}
              </span>

              {/* Bar */}
              <div className="flex-grow relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${riskBarColor(p.label)}`}
                  style={{ width: `${p.score}%` }}
                />
              </div>

              {/* Score */}
              <span className="text-[13px] font-black mono shrink-0 w-8 text-right">{p.score}</span>

              {/* Label */}
              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm shrink-0 w-16 text-center ${riskLabelColor(p.label)}`}>
                {p.label}
              </span>

              {/* Arrow */}
              <ChevronRight size={13} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      )}

      {!loading && projectRisks.length > 0 && (
        <p className="text-[9px] mono opacity-20 leading-relaxed">
          Scores calculated from live task data. Click any project to open its Risk Analysis tab.
        </p>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────
   PROJECTS LIST
───────────────────────────────────────────────────── */
const statusColor = (s: string) => {
  if (s === 'Active') return 'text-green-400 bg-green-500/10 border-green-500/20';
  if (s === 'Archived') return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  if (s === 'On Hold') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  if (s === 'Completed') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  return 'opacity-40';
};

const ProjectsList: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Get projects user is a member of
        const { data: memberRows } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id);
        const memberIds = (memberRows || []).map((r: any) => r.project_id);

        let query = supabase
          .from('projects')
          .select('id, name, status, priority, created_at, owner_id')
          .order('created_at', { ascending: false });

        if (memberIds.length > 0) {
          query = query.or(`owner_id.eq.${user.id},id.in.(${memberIds.join(',')})`);
        } else {
          query = query.eq('owner_id', user.id);
        }

        const { data: projData, error } = await query;
        if (error) throw error;
        if (!projData || projData.length === 0) { setProjects([]); setLoading(false); return; }

        // Fetch task counts for progress bars
        const projIds = projData.map((p: any) => p.id);
        const { data: taskData } = await supabase
          .from('tasks')
          .select('project_id, status')
          .in('project_id', projIds);

        const enriched = projData.map((p: any) => {
          const pTasks = (taskData || []).filter((t: any) => t.project_id === p.id);
          const completed = pTasks.filter((t: any) => t.status === 'Completed' || t.status === 'Done').length;
          return { ...p, totalTasks: pTasks.length, completedTasks: completed };
        });

        setProjects(enriched);
      } catch (err) {
        console.error('Projects list error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [refreshKey]);

  return (
    <div className="glass-panel">
      <div className="p-6 border-b border-[var(--border-color)]">
        <span className="ui-label opacity-60 flex items-center gap-2"><FolderOpen size={14} /> Your Projects</span>
        <h3 className="text-lg font-black uppercase tracking-tighter mt-1">{projects.length} Projects</h3>
      </div>

      {loading ? (
        <div className="p-8 text-center opacity-30 mono text-[13px]">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="p-8 text-center opacity-30 mono text-[13px]">No projects yet. Create one to get started.</div>
      ) : (
        <div>
          {projects.map(proj => {
            const progress = proj.totalTasks > 0 ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="flex items-center gap-6 p-5 border-b border-[var(--border-color)] cursor-pointer hover:bg-white/3 transition-colors group"
              >
                <div className="flex-grow min-w-0">
                  <h4 className="text-[14px] font-black uppercase tracking-tight truncate group-hover:text-[var(--accent)] transition-colors">
                    {proj.name}
                  </h4>
                  <span className="text-[10px] mono opacity-30">{proj.priority || 'Medium'} priority</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border rounded-sm shrink-0 ${statusColor(proj.status)}`}>
                  {proj.status || 'Active'}
                </span>
                <div className="w-28 shrink-0">
                  <div className="flex justify-between text-[9px] mono mb-1">
                    <span className="opacity-40">{proj.completedTasks}/{proj.totalTasks}</span>
                    <span className="font-bold text-[var(--accent)]">{progress}%</span>
                  </div>
                  <div className="h-1 bg-white/5 overflow-hidden rounded-sm">
                    <div className={`h-full transition-all ${progress === 100 ? 'bg-green-400' : 'bg-[var(--accent)]'}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PMDashboard: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProjectCreated = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 w-full pb-24 relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
        <div className="space-y-4">
          <span className="ui-label text-[var(--accent)] block tracking-[0.4em] font-black text-[18px]">Project Overview</span>
          <h1 className="uppercase tracking-tighter leading-none mb-6">Project Dashboard</h1>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[var(--accent)] text-black px-10 py-5 rounded-none text-[12px] font-black uppercase tracking-widest flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-xl">
          <Plus size={20} /> Create Project
        </button>
      </div>

      {/* Health Radar */}
      <ProjectHealthRadar refreshKey={refreshKey} />

      {/* Risk Summary */}
      <RiskSummaryCard />

      {/* Projects List */}
      <ProjectsList refreshKey={refreshKey} />

      <div className="space-y-8 w-full">
        <Board />
        <SkillMatrixHeatmap />
        <SystemLog />
      </div>

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
};

export default PMDashboard;
