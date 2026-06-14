
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import {
  Sun,
  Moon,
  LogOut,
  Bell,
  ChevronRight,
  Check,
  CheckCheck,
  AtSign,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Fetch real notifications for the current user
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user.id) return;
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!error && data) setNotifications(data);
      } catch (_) {}
    };
    fetchNotifications();

    // Realtime subscription for new notifications
    const channel = supabase
      .channel('header-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleMarkRead = async (notifId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, is_read: true } : n)
      );
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (_) {}
  };

  const pathnames = location.pathname.split('/').filter(x => x);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign size={12} className="text-[var(--accent-blue)]" />;
      case 'assignment': return <UserPlus size={12} className="text-[var(--accent)]" />;
      case 'status_change': return <RefreshCw size={12} className="text-[var(--accent-pink)]" />;
      case 'deadline': return <Bell size={12} className="text-orange-400" />;
      default: return <Bell size={12} className="opacity-40" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <div className="fixed top-0 right-0 left-0 h-[var(--system-status-height)] bg-[var(--accent)] z-[110]"></div>

      <header
        className="glass-nav h-[var(--header-height)] fixed top-[var(--system-status-height)] left-0 right-0 z-[100] border-b border-[var(--border-sep)] flex items-center justify-between transition-all duration-300"
      >
        {/* Breadcrumbs */}
        <div className="flex items-center gap-6 h-full transition-all duration-300" style={{ paddingLeft: 'calc(var(--current-sidebar-width) + 32px)' }}>
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 shrink-0 pr-6 border-r border-[var(--border-sep)]">
            <div className="w-7 h-7 bg-[var(--accent)] text-black dark:text-black flex items-center justify-center font-black text-xs rounded-sm">
              I
            </div>
            <span className="text-[14px] font-bold tracking-[0.25em] uppercase mono text-[var(--text-primary)]">IntelliPM</span>
          </Link>

          <nav className="flex items-center gap-3 text-[11px] mono uppercase font-bold tracking-widest">
            <Link to="/projects" className="opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all">Projects</Link>
            {pathnames.map((name, index) => {
              const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
              const isLast = index === pathnames.length - 1;
              return (
                <React.Fragment key={name}>
                  <ChevronRight size={14} className="opacity-20" />
                  <Link
                    to={routeTo}
                    className={`${isLast ? 'text-[var(--accent-blue)] font-bold' : 'opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)]'} transition-all`}
                  >
                    {name.replace('-', ' ')}
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-8 px-12">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2.5 transition-all ${showNotifications ? 'opacity-100 text-[var(--accent)]' : 'opacity-50 hover:opacity-100'}`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <div className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-pink)] text-[8px] text-white font-black flex items-center justify-center border-2 border-[var(--bg-header)] ${theme === 'dark' ? 'neon-glow-pink' : ''}`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-12 right-0 w-96 glass-panel-elevated border border-[var(--border-color)] shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-primary)]">
                  <span className="text-[11px] font-black uppercase tracking-widest opacity-60">Notifications</span>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <span className="text-[10px] mono bg-[var(--accent-pink)]/10 text-[var(--accent-pink)] px-1.5 py-0.5 rounded-sm">{unreadCount} Unread</span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[9px] mono font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all flex items-center gap-1"
                      >
                        <CheckCheck size={12} /> Read All
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-[12px] mono opacity-30">No notifications yet</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && handleMarkRead(n.id)}
                        className={`p-4 border-b border-[var(--border-color)] hover:bg-white/5 transition-colors cursor-pointer group flex gap-3 ${
                          !n.is_read ? 'bg-[var(--accent-blue)]/5' : ''
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {typeIcon(n.type)}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className={`text-[12px] font-medium leading-snug group-hover:opacity-100 transition-opacity ${n.is_read ? 'opacity-50' : 'opacity-90'}`}>
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[9px] mono opacity-30">{n.created_at ? timeAgo(n.created_at) : ''}</span>
                            {!n.is_read && (
                              <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className="p-2.5 opacity-50 hover:opacity-100 transition-all">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={16} />}
          </button>

          <div className="h-8 w-[1px] bg-[var(--border-sep)]" />

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[13px] font-bold uppercase tracking-widest text-[var(--text-primary)]">{user.name}</span>
              <span className="text-[10px] mono opacity-80 uppercase font-bold text-[var(--accent)] tracking-tighter">{user.role}</span>
            </div>

            <button
              onClick={handleLogout}
              className="w-10 h-10 glass border border-[var(--border-color)] flex items-center justify-center hover:border-[var(--accent-pink)]/50 hover:text-[var(--accent-pink)] transition-all group"
            >
              <LogOut size={18} className="opacity-40 group-hover:opacity-100" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
