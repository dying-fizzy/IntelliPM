
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { 
  Layout, 
  Settings, 
  Search, 
  ChevronLeft,
  ChevronRight,
  Shield,
  FolderOpen
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const user = JSON.parse(localStorage.getItem('user') || '{}');



  const navItems = [
    { icon: FolderOpen, label: 'Projects', path: '/projects' },
    { icon: Layout, label: 'Overview', path: '/projects/overview' },
    { icon: Settings, label: 'Settings', path: '/projects/settings' },
    ...(user.role === 'Admin' ? [{ icon: Shield, label: 'Admin Panel', path: '/projects/admin' }] : []),
  ];

  const sidebarWidth = isCollapsed ? '72px' : '260px';

  return (
    <aside 
      className={`glass-nav h-screen fixed left-0 top-0 z-[999] flex flex-col transition-all duration-300 ease-in-out`}
      style={{ width: sidebarWidth }}
    >
      <div className="h-[var(--header-height)] flex items-center px-6 border-b border-[var(--border-sep)] justify-end overflow-hidden">
        {isCollapsed ? (
          <button onClick={toggleCollapse} className="p-1 opacity-30 hover:opacity-100 transition-all mx-auto">
            <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={toggleCollapse} className="p-1 opacity-30 hover:opacity-100 transition-all">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-6 py-8">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 z-10 transition-all" size={14} />
            <input 
              type="text" 
              placeholder="Search..."
              className="w-full bg-black/5 dark:bg-white/5 border border-[var(--border-color)] rounded-none py-2.5 pl-10 pr-3 text-[14px] mono outline-none focus:border-[var(--accent-blue)] transition-all text-black dark:text-white placeholder:text-gray-500"
            />
          </div>
        </div>
      )}

      <nav className="flex-grow">
        {!isCollapsed && (
          <div className="px-7 mb-4">
            <span className="ui-label text-[15px] opacity-40">Navigation</span>
          </div>
        )}
        
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/projects' && location.pathname === '/projects') ||
              (item.path !== '/projects' && location.pathname.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center transition-all relative group py-4 px-7 ${
                  isActive 
                    ? 'glass-accent text-[var(--accent)] font-bold' 
                    : 'opacity-40 hover:opacity-100 hover:bg-white/[0.06] hover:backdrop-blur-sm'
                }`}
              >
                <item.icon size={20} className="shrink-0 transition-transform group-hover:scale-110" />
                
                {!isCollapsed && (
                  <span className="ml-5 text-[14px] font-bold uppercase tracking-[0.15em] mono">
                    {item.label}
                  </span>
                )}
                
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--accent)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>


    </aside>
  );
};

export default Sidebar;
