
import React from 'react';
import { useTheme } from './ThemeContext';
import { Code, Globe, Users } from 'lucide-react';

const SocialAuth: React.FC = () => {
  const { theme } = useTheme();

  const handleSocial = (url: string) => {
    window.location.href = url;
  };

  const btnClass = `flex-1 py-3 px-4 rounded-sm border transition-all flex items-center justify-center gap-2 font-bold text-[14px] uppercase tracking-wider ${
    theme === 'dark' 
      ? 'border-white/10 hover:bg-white/5 bg-white/2' 
      : 'border-black/10 hover:bg-black/5 bg-black/2'
  }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 opacity-30">
        <hr className="flex-1 border-[var(--border-color)]" />
        <span className="ui-label">Or continue with</span>
        <hr className="flex-1 border-[var(--border-color)]" />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => handleSocial('https://accounts.google.com/')} className={btnClass}>
          <Globe size={16} /> Google
        </button>
        <button onClick={() => handleSocial('https://github.com/login')} className={btnClass}>
          <Code size={16} /> GitHub
        </button>
        <button onClick={() => handleSocial('https://www.linkedin.com/login')} className={btnClass}>
          <Users size={16} /> LinkedIn
        </button>
      </div>
    </div>
  );
};

export default SocialAuth;
