
import React, { useState, useEffect } from 'react';
import { Activity, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  taskCount: number;
}

const SkillMatrixHeatmap: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            job_title,
            tasks ( id )
          `);

        if (error) throw error;

        const mapped: TeamMember[] = (data || []).map((p: any) => ({
          id: p.id,
          name: p.display_name || 'Unknown',
          role: p.job_title || 'Team Member',
          taskCount: p.tasks ? p.tasks.length : 0,
        }));

        setMembers(mapped);
      } catch (err) {
        console.error('Failed to load team members:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  return (
    <div className="glass-panel p-8 rounded-none relative overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-10">
        <div>
          <span className="ui-label text-[var(--accent-blue)] !opacity-100 font-black">Team Members</span>
          <div className="text-[14px] mono opacity-30 mt-1 uppercase tracking-widest font-black text-[var(--text-primary)]">Workload Overview</div>
        </div>
        <Activity size={18} className="text-[var(--accent-blue)]" />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 opacity-30">
          <span className="mono text-[14px] uppercase tracking-widest">Loading team data...</span>
        </div>
      )}

      {!loading && members.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 opacity-30">
          <Users size={48} className="mb-4" />
          <span className="mono text-[14px] uppercase tracking-widest">No team members found</span>
        </div>
      )}

      <div className="space-y-6">
        {members.map((member) => (
          <div key={member.id} className="p-6 border border-[var(--border-color)] bg-white/2 hover:border-[var(--accent-blue)]/40 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col">
                 <span className="text-[14px] font-black uppercase tracking-tight text-[var(--text-primary)]">{member.name}</span>
                 <span className="text-[12px] mono opacity-40 uppercase tracking-widest mt-1">{member.role}</span>
              </div>
              <div className="flex flex-col items-end">
                 <span className="text-[16px] font-black mono text-[var(--accent-blue)]">{member.taskCount} tasks</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillMatrixHeatmap;
