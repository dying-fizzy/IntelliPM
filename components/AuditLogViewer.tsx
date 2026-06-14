
import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  User,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  X,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const AuditLogViewer: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles:user_id ( display_name )')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [projectId]);

  // Filter
  let filtered = logs;
  if (searchText) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(l =>
      l.action?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q) ||
      l.profiles?.display_name?.toLowerCase().includes(q) ||
      l.entity_type?.toLowerCase().includes(q)
    );
  }
  if (filterAction !== 'all') {
    filtered = filtered.filter(l => l.action === filterAction);
  }

  const uniqueActions = [...new Set(logs.map((l: any) => l.action as string))].sort();

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const actionColor = (action: string) => {
    if (action.includes('delete') || action === 'delete') return 'text-red-400 bg-red-400/10';
    if (action.includes('create') || action === 'create') return 'text-green-400 bg-green-400/10';
    if (action.includes('status')) return 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10';
    if (action.includes('assignment')) return 'text-[var(--accent)] bg-[var(--accent)]/10';
    return 'opacity-60 bg-black/5 dark:bg-white/5';
  };

  const renderJsonDiff = (oldVal: any, newVal: any) => {
    if (!oldVal && !newVal) return null;
    return (
      <div className="grid grid-cols-2 gap-4 mt-3">
        {oldVal && (
          <div className="space-y-1">
            <span className="text-[9px] mono uppercase tracking-widest text-red-400 font-bold">Previous</span>
            <pre className="text-[11px] mono bg-red-400/5 border border-red-400/10 p-3 rounded-sm overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          </div>
        )}
        {newVal && (
          <div className="space-y-1">
            <span className="text-[9px] mono uppercase tracking-widest text-green-400 font-bold">New</span>
            <pre className="text-[11px] mono bg-green-400/5 border border-green-400/10 p-3 rounded-sm overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-10 mono text-[14px] opacity-20 uppercase tracking-widest">Loading audit logs...</div>;

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-[var(--accent)]" />
          <span className="text-[14px] font-black uppercase tracking-widest">Audit Trail</span>
          <span className="text-[10px] mono opacity-30">{filtered.length} entries</span>
        </div>
        <button
          onClick={fetchLogs}
          className="text-[10px] mono font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all flex items-center gap-1"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-grow max-w-[300px] glass-panel px-4 py-2.5">
          <Search size={14} className="opacity-30" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-grow bg-transparent text-[13px] mono outline-none text-black dark:text-white placeholder:text-gray-500"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="opacity-30 hover:opacity-100 transition-all">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter size={12} className="opacity-30" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="glass-input px-3 py-2 text-[11px] mono font-bold uppercase tracking-widest cursor-pointer"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((a: string) => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log List */}
      <div className="glass-panel overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-[12px] mono opacity-30 uppercase tracking-widest">
              No audit logs found
            </div>
          ) : (
            filtered.map((log, i) => {
              const isExpanded = expandedLog === log.id;
              const hasChanges = log.old_value || log.new_value;
              return (
                <div
                  key={log.id}
                  className={`border-b border-[var(--border-color)]/30 transition-all ${
                    i % 2 === 0 ? '' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                  }`}
                >
                  <div
                    onClick={() => hasChanges && setExpandedLog(isExpanded ? null : log.id)}
                    className={`px-6 py-4 flex items-center gap-4 ${hasChanges ? 'cursor-pointer hover:bg-black/3 dark:hover:bg-white/3' : ''}`}
                  >
                    {/* Action Badge */}
                    <span className={`text-[9px] mono font-bold uppercase tracking-widest px-2 py-1 rounded-sm shrink-0 min-w-[100px] text-center ${actionColor(log.action)}`}>
                      {log.action.replace('_', ' ')}
                    </span>

                    {/* Details */}
                    <span className="text-[12px] flex-grow min-w-0 truncate opacity-70">
                      {log.details || `${log.action} on ${log.entity_type || 'entity'}`}
                    </span>

                    {/* User */}
                    <div className="flex items-center gap-1.5 shrink-0 min-w-[120px]">
                      <User size={12} className="opacity-30" />
                      <span className="text-[11px] mono opacity-50 truncate">
                        {log.profiles?.display_name || 'System'}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] mono opacity-30 shrink-0 min-w-[80px] text-right">
                      {timeAgo(log.created_at)}
                    </span>

                    {/* Expand indicator */}
                    {hasChanges && (
                      <ChevronDown size={14} className={`shrink-0 opacity-30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>

                  {/* Expanded diff view */}
                  {isExpanded && hasChanges && (
                    <div className="px-6 pb-4 animate-in fade-in duration-200">
                      {renderJsonDiff(log.old_value, log.new_value)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
