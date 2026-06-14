import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { Users, Layers, Cpu } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Task {
    id: string;
    title: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
}

interface Member {
    id: string;
    name: string;
    role: string;
    avatar: string;
    tasks: Task[];
}

const TeamLoad: React.FC = () => {
    const { theme } = useTheme();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select(`
                        id,
                        display_name,
                        job_title,
                        avatar_url,
                        tasks (
                            id,
                            title,
                            priority
                        )
                    `);

                if (error) throw error;

                const mappedData: Member[] = data.map((p: any) => ({
                    id: p.id,
                    name: p.display_name,
                    role: p.job_title,
                    avatar: p.avatar_url || 'bg-zinc-800',
                    tasks: p.tasks || []
                }));

                setMembers(mappedData);
            } catch (err) {
                console.error('Failed to load team data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTeamData();
    }, []);

    // Count tasks by priority for a member (plain data, no predictions)
    const getTaskBreakdown = (member: Member) => {
        const critical = member.tasks.filter(t => t.priority === 'Critical').length;
        const high = member.tasks.filter(t => t.priority === 'High').length;
        const medium = member.tasks.filter(t => t.priority === 'Medium').length;
        const low = member.tasks.filter(t => t.priority === 'Low').length;
        return { critical, high, medium, low };
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-700 w-full pb-24">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div className="space-y-4">
                    <span className="ui-label text-[var(--accent)] block tracking-[0.4em] font-black">Team Workload</span>
                    <h1 className="uppercase tracking-tighter leading-none m-0 font-bold">Resource Overview</h1>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center h-64 opacity-30">
                    <span className="mono text-[14px] uppercase tracking-widest">Loading team data...</span>
                </div>
            )}

            {!loading && members.length === 0 && (
                <div className="glass-panel p-16 text-center border-dashed border-[var(--border-color)]">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <span className="mono text-[14px] uppercase tracking-widest opacity-30">No team members found</span>
                </div>
            )}

            {!loading && members.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                    {/* Member List */}
                    <div className="lg:col-span-2 space-y-4">
                        {members.map(member => {
                            const breakdown = getTaskBreakdown(member);
                            return (
                                <div key={member.id} className="glass-panel p-6 group transition-all hover:border-[var(--accent-blue)]">
                                    <div className="flex items-center gap-6 mb-6">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${member.avatar} text-lg`}>
                                            {member.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-grow">
                                            <h3 className="text-xl font-black uppercase tracking-tight">{member.name}</h3>
                                            <div className="flex items-center gap-4 text-[10px] mono uppercase opacity-60 font-bold mt-1">
                                                <span>{member.role || 'Team Member'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-[var(--accent)]">
                                                {member.tasks.length}
                                            </div>
                                            <div className="text-[9px] mono uppercase opacity-40 font-bold">Assigned Tasks</div>
                                        </div>
                                    </div>

                                    {/* Task breakdown by priority */}
                                    <div className="flex justify-between items-center bg-white/[0.04] p-4 rounded-sm border border-[var(--border-color)]">
                                        <div className="flex items-center gap-3">
                                            <Layers size={14} className="opacity-40" />
                                            <span className="text-[11px] mono font-bold uppercase tracking-widest">{member.tasks.length} Assigned Tasks</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] mono font-bold">
                                            {breakdown.critical > 0 && <span className="text-[var(--accent-pink)]">{breakdown.critical} Critical</span>}
                                            {breakdown.high > 0 && <span className="text-orange-500">{breakdown.high} High</span>}
                                            {breakdown.medium > 0 && <span className="text-[var(--accent-blue)]">{breakdown.medium} Med</span>}
                                            {breakdown.low > 0 && <span className="opacity-40">{breakdown.low} Low</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Right Panel — AI Placeholder */}
                    <div className="glass-panel p-8 sticky top-8">
                        <span className="ui-label opacity-40 flex items-center gap-2 mb-8">
                            <Cpu size={16} /> AI Optimization
                        </span>
                        <div className="h-64 flex flex-col items-center justify-center opacity-30 text-center">
                            <Cpu size={48} className="mb-4" />
                            <p className="text-sm mono uppercase font-bold leading-relaxed">
                                AI load optimization will be available<br />after AI engine integration.
                            </p>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default TeamLoad;
