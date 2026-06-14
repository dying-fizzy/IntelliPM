
import React from 'react';
import { AlertTriangle, Clock, Cpu } from 'lucide-react';

const BottleneckEngine: React.FC = () => {
  return (
    <div className="glass-panel p-6 rounded-sm relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <span className="ui-label opacity-60">Bottleneck Analysis</span>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center opacity-30 text-center px-4">
        <Cpu size={48} className="mb-4" />
        <p className="text-sm mono uppercase font-bold leading-relaxed">
          AI insights will be available once the AI engine is connected.
        </p>
      </div>
    </div>
  );
};

export default BottleneckEngine;
