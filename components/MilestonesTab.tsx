import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react';

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  status: 'Pending' | 'Completed';
}

interface MilestonesTabProps {
  projectId: string;
}

const MilestonesTab: React.FC<MilestonesTabProps> = ({ projectId }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', target_date: '' });

  const storageKey = `milestones_${projectId}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setMilestones(JSON.parse(saved));
    } else {
      // Seed default milestones
      const defaults: Milestone[] = [
        { id: crypto.randomUUID(), name: 'Design Complete', target_date: '', status: 'Pending' },
        { id: crypto.randomUUID(), name: 'Alpha Release', target_date: '', status: 'Pending' }
      ];
      setMilestones(defaults);
      localStorage.setItem(storageKey, JSON.stringify(defaults));
    }
  }, [projectId, storageKey]);

  const saveMilestones = (updated: Milestone[]) => {
    setMilestones(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!newMilestone.name.trim()) return;
    
    const added: Milestone = {
      id: crypto.randomUUID(),
      name: newMilestone.name,
      target_date: newMilestone.target_date,
      status: 'Pending'
    };
    
    saveMilestones([...milestones, added]);
    setNewMilestone({ name: '', target_date: '' });
    setShowAddForm(false);
  };

  const toggleStatus = (id: string) => {
    const updated = milestones.map(m => 
      m.id === id ? { ...m, status: m.status === 'Pending' ? 'Completed' : 'Pending' as const } : m
    );
    saveMilestones(updated);
  };

  const deleteMilestone = (id: string) => {
    const updated = milestones.filter(m => m.id !== id);
    saveMilestones(updated);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[14px] font-black uppercase tracking-widest">
            Project Milestones
          </h3>
          <p className="text-[10px] mono opacity-40 mt-0.5">Track key dates and deliverables</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[var(--accent)] text-black px-4 py-2 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 rounded-sm hover:opacity-90 transition-all"
        >
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="glass-panel p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-60">Milestone Name</label>
              <input
                type="text"
                placeholder="e.g. Beta Launch"
                value={newMilestone.name}
                onChange={e => setNewMilestone({ ...newMilestone, name: e.target.value })}
                className="w-full p-2.5 glass-input rounded-sm text-[12px] outline-none"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase opacity-60">Target Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="date"
                  value={newMilestone.target_date}
                  onChange={e => setNewMilestone({ ...newMilestone, target_date: e.target.value })}
                  className="w-full p-2.5 pl-9 glass-input rounded-sm text-[12px] outline-none"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newMilestone.name.trim()}
              className="bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-sm hover:bg-white/20 disabled:opacity-30 transition-all"
            >
              Save Milestone
            </button>
          </div>
        </div>
      )}

      {/* Milestones List */}
      <div className="glass-panel overflow-hidden">
        {milestones.length === 0 ? (
          <div className="p-12 text-center border-dashed border-[var(--border-color)]">
            <p className="text-[13px] mono opacity-30">No milestones yet. Create one above.</p>
          </div>
        ) : (
          <div>
            {/* Header Row */}
            <div className="grid grid-cols-[auto_1fr_120px_40px] gap-4 items-center px-5 py-3 border-b border-[var(--border-color)] bg-black/20">
              <span className="w-6"></span>
              <span className="text-[9px] mono uppercase tracking-widest opacity-40">Name</span>
              <span className="text-[9px] mono uppercase tracking-widest opacity-40">Target Date</span>
              <span className="text-[9px] mono uppercase tracking-widest opacity-40 text-center">Action</span>
            </div>

            {/* Milestone Rows */}
            {milestones.map(m => (
              <div
                key={m.id}
                className="grid grid-cols-[auto_1fr_120px_40px] gap-4 items-center px-5 py-4 border-b border-[var(--border-color)] last:border-0 hover:bg-white/5 transition-colors group"
              >
                <button
                  onClick={() => toggleStatus(m.id)}
                  className={`flex-shrink-0 transition-colors ${m.status === 'Completed' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
                >
                  {m.status === 'Completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                
                <div className={`text-[13px] font-medium transition-all ${m.status === 'Completed' ? 'line-through text-green-400/70' : 'text-white'}`}>
                  {m.name}
                </div>
                
                <div className="text-[11px] mono opacity-60">
                  {m.target_date ? new Date(m.target_date).toLocaleDateString() : 'No date set'}
                </div>
                
                <div className="text-center">
                  <button
                    onClick={() => deleteMilestone(m.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                    title="Delete milestone"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MilestonesTab;
