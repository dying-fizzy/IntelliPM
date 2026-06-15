
/**
 * INTELLIPM PRESENTATION CODE FLOW:
 * 1. App.tsx is the entry point for the React application.
 * 2. It sets up the HashRouter and ThemeProvider for global state.
 * 3. The `AppContent` component handles the main routing logic:
 *    - Public marketing routes (/, /about, /features, etc.)
 *    - Auth routes (/login, /register)
 *    - Protected internal routes (/projects/*)
 * 4. Auth is handled dynamically, checking localStorage and Supabase sessions.
 * 5. This ensures users are segmented based on their authentication status and roles.
 */
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import AuthPage from './components/AuthPage';
import RegisterPage from './components/RegisterPage';
import EmailVerifiedPage from './components/EmailVerifiedPage';
import Footer from './components/Footer';
import DashboardLayout from './components/DashboardLayout';
import PMDashboard from './components/PMDashboard';
import MemberDashboard from './components/MemberDashboard';
import AdminDashboard from './components/AdminDashboard';
import ProjectsPage from './components/ProjectsPage';
import ProjectWorkspace from './components/ProjectWorkspace';
import SettingsPage from './components/SettingsPage';
import NeuralBackground from './components/NeuralBackground';
import TaskManagementPage from './components/TaskManagementPage';
import SmartAssignPage from './components/SmartAssignPage';
import AITaskGenerationPage from './components/AITaskGenerationPage';
import ResourceIntelligencePage from './components/ResourceIntelligencePage';
import RiskAssessmentPage from './components/RiskAssessmentPage';
import AdminDashboardPage from './components/AdminDashboardPage';
import AboutPage from './components/AboutPage';
import CareersPage from './components/CareersPage';
import BlogPage from './components/BlogPage';
import ContactPage from './components/ContactPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsOfServicePage from './components/TermsOfServicePage';
import CookiePolicyPage from './components/CookiePolicyPage';
import SecurityPage from './components/SecurityPage';
import { startDeadlineAlertLoop } from './deadlineAlerts';
import { supabase } from './supabaseClient';
import { PENDING_REG_KEY } from './components/RegisterPage';

const HomePage: React.FC = () => (
  <main className="w-full relative overflow-hidden">
    <NeuralBackground />
    <div className="relative z-10">
      <Hero />
      <Features />
    </div>
  </main>
);

/* ─────────────────────────────────────────────────────
   PROTECTED ROUTES (Project-First UX)
   All internal routes live under /projects/*
───────────────────────────────────────────────────── */
const InternalRoutes: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [navigate]);

  // Start deadline alert polling when user is authenticated
  useEffect(() => {
    if (!user?.id) return;
    const stopAlertLoop = startDeadlineAlertLoop(user.id, 60_000); // check every 60s
    return () => stopAlertLoop();
  }, [user?.id]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <Routes>
        {/* Projects list — the main landing page after login */}
        <Route path="/" element={<ProjectsPage />} />

        {/* Overview / Dashboard summary */}
        <Route path="/overview" element={
          user.role === 'Project Manager' || user.role === 'Admin'
            ? <PMDashboard />
            : <MemberDashboard />
        } />

        {/* Project workspace — Board, Members, Activity, Settings tabs */}
        <Route path="/:projectId" element={<ProjectWorkspace />} />

        {/* Global settings */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Catch-all → back to projects */}
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isInternal = location.pathname.startsWith('/projects') ||
    location.pathname.startsWith('/dashboard');

  // The email verification link now points directly to /#/email-verified
  // (set in RegisterPage emailRedirectTo), so no redirect logic needed here.
  // We only listen for auth events to handle sign-outs or token refreshes.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }

      // Cross-tab sync: when user clicks email link in any tab, SIGNED_IN fires
      // in ALL open tabs simultaneously. If there's pending registration, redirect.
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('token', session.access_token);
        const pending = localStorage.getItem(PENDING_REG_KEY);
        const alreadySetup = localStorage.getItem('user');
        if (pending && !alreadySetup) {
          navigate('/email-verified');
        }
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col w-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      {!isInternal && <Navbar />}
      <div className="flex-grow w-full">
        <Routes>
          {/* Public: Homepage */}
          <Route path="/" element={<HomePage />} />
          <Route path="/task-management" element={<TaskManagementPage />} />
          <Route path="/smart-assign" element={<SmartAssignPage />} />
          <Route path="/ai-task-generation" element={<AITaskGenerationPage />} />
          <Route path="/resource-intelligence" element={<ResourceIntelligencePage />} />
          <Route path="/risk-assessment" element={<RiskAssessmentPage />} />
          <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/security" element={<SecurityPage />} />

          {/* Auth */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/email-verified" element={<EmailVerifiedPage />} />

          {/* Protected: Project-first routes */}
          <Route path="/projects/*" element={<InternalRoutes />} />

          {/* Legacy redirect: /dashboard → /projects */}
          <Route path="/dashboard/*" element={<Navigate to="/projects" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isInternal && <Footer />}
    </div>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <HashRouter>
      <AppContent />
    </HashRouter>
  </ThemeProvider>
);

export default App;
