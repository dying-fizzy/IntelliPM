import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { Activity, ShieldAlert, Cpu, BarChart3, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';

const AIInsights: React.FC = () => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [taskStats, setTaskStats] = useState<{ total: number; completed: number; overdue: number; inProgress: number } | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const { data: tasks, error } = await supabase
                    .from('tasks')
                    .select('status, due_date');

                if (error) throw error;

                const allTasks = tasks || [];
                const total = allTasks.length;
                const completed = allTasks.filter((t: any) => t.status === 'Completed' || t.status === 'Done').length;
                const inProgress = allTasks.filter((t: any) => t.status === 'In Progress').length;
                const overdue = allTasks.filter((t: any) => {
                    if (!t.due_date) return false;
                    return new Date(t.due_date) < new Date() && t.status !== 'Completed' && t.status !== 'Done';
                }).length;

                setTaskStats({ total, completed, overdue, inProgress });
            } catch (err) {
                console.error('Insights fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    if (loading) return <div className="p-12 opacity-50 mono">Loading insights...</div>;

    return (
        <div className="space-y-12 animate-in fade-in duration-700 w-full pb-24">
            {/* Header */}
            <div className="space-y-4">
                <span className="ui-label text-[var(--accent)] block tracking-[0.4em] font-black">Analytics // Insights</span>
                <h1 className="uppercase tracking-tighter leading-none mb-6">Project Insights</h1>
                <p className="opacity-60 mono text-[15px] max-w-2xl italic leading-relaxed text-[var(--text-body)]">
                    View real-time project statistics. AI-powered analysis will be available after integration.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Project Stats — Real Data Only */}
                <div className="glass-panel p-10 flex flex-col">
                    <div className="w-full border-b border-[var(--border-color)] pb-4 mb-6 flex justify-between items-center">
                        <span className="ui-label opacity-60 flex items-center gap-2"><BarChart3 size={16} /> Project Statistics</span>
                    </div>

                    {taskStats && taskStats.total > 0 ? (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-6 glass-panel text-center">
                                <div className="text-[36px] font-black text-[var(--accent)]">{taskStats.total}</div>
                                <div className="text-[10px] mono uppercase opacity-50 font-bold mt-1">Total Tasks</div>
                            </div>
                            <div className="p-6 glass-panel text-center">
                                <div className="text-[36px] font-black text-[var(--accent)]">
                                    {Math.round((taskStats.completed / taskStats.total) * 100)}%
                                </div>
                                <div className="text-[10px] mono uppercase opacity-50 font-bold mt-1">Completion Rate</div>
                                <div className="text-[9px] opacity-30 mt-1">{taskStats.completed} of {taskStats.total}</div>
                            </div>
                            <div className="p-6 glass-panel text-center">
                                <div className="text-[36px] font-black text-[var(--accent-blue)]">{taskStats.inProgress}</div>
                                <div className="text-[10px] mono uppercase opacity-50 font-bold mt-1">In Progress</div>
                            </div>
                            <div className="p-6 glass-panel text-center">
                                <div className={`text-[36px] font-black ${taskStats.overdue > 0 ? 'text-[var(--accent-pink)]' : 'text-[var(--accent)]'}`}>{taskStats.overdue}</div>
                                <div className="text-[10px] mono uppercase opacity-50 font-bold mt-1">Overdue</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 opacity-20 text-center">
                            <BarChart3 size={48} className="mb-4" />
                            <span className="mono text-xs uppercase">No task data available yet</span>
                        </div>
                    )}
                </div>

                {/* AI Panels — Disabled */}
                <div className="space-y-8">
                    {/* Risk Detection — AI Disabled */}
                    <div className="glass-panel p-10 flex flex-col">
                        <div className="w-full border-b border-[var(--border-color)] pb-4 mb-6 flex justify-between items-center">
                            <span className="ui-label opacity-60 flex items-center gap-2"><ShieldAlert size={16} /> Risk Detection</span>
                            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-white/10 opacity-40">AI Required</span>
                        </div>
                        <div className="flex flex-col items-center justify-center h-32 opacity-30 text-center">
                            <Cpu size={36} className="mb-3" />
                            <p className="text-[12px] mono uppercase font-bold leading-relaxed">
                                AI-powered risk detection will be available<br />after AI engine integration.
                            </p>
                        </div>
                    </div>

                    {/* Health Score — AI Disabled */}
                    <div className="glass-panel p-10 flex flex-col">
                        <div className="w-full border-b border-[var(--border-color)] pb-4 mb-6 flex justify-between items-center">
                            <span className="ui-label opacity-60 flex items-center gap-2"><Activity size={16} /> Health Score</span>
                            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-white/10 opacity-40">AI Required</span>
                        </div>
                        <div className="flex flex-col items-center justify-center h-32 opacity-30 text-center">
                            <TrendingUp size={36} className="mb-3" />
                            <p className="text-[12px] mono uppercase font-bold leading-relaxed">
                                AI health scoring will be available<br />after AI engine integration.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AIInsights;
