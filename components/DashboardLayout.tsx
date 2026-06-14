
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatDrawer from './AIChatDrawer';
import { supabase } from '../supabaseClient';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    const sidebarWidthValue = isCollapsed ? '72px' : '260px';
    document.documentElement.style.setProperty('--current-sidebar-width', sidebarWidthValue);
  }, [isCollapsed]);

  // Check profile skills completion on mount
  useEffect(() => {
    const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, skills_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.role === 'Team Member' && profile.skills_completed === false) {
        // Check if a notification already exists
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'profile_incomplete')
          .maybeSingle();

        if (!existing) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            message: 'Your profile is incomplete. Please add at least 3 technical skills to help the AI assign tasks accurately.',
            type: 'profile_incomplete',
          });
        }
      } else if (profile && profile.skills_completed === true) {
         // remove notification if it exists and skills are now completed
         await supabase.from('notifications')
           .delete()
           .eq('user_id', user.id)
           .eq('type', 'profile_incomplete');
      }
    };
    checkProfile();
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebar-collapsed', String(newState));
      return newState;
    });
  };

  return (
    <div className="flex w-full min-h-screen bg-[var(--bg-primary)] transition-colors duration-500 relative overflow-hidden">
      <Sidebar isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} />
      
      <div 
        className="flex-grow flex flex-col transition-all duration-300 ease-in-out min-w-0"
        style={{ marginLeft: 'var(--current-sidebar-width)' }}
      >
        <Header />
        
        <main className="flex-grow mt-[var(--header-height)] p-8 md:p-12 relative z-10 w-full overflow-hidden flex items-stretch">
          <div className="w-full flex-grow flex-shrink transition-all duration-300 ease-in-out overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
      
      <AIChatDrawer />
    </div>
  );
};

export default DashboardLayout;
