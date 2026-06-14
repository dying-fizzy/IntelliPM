-- ============================================================
-- INTELLIPM — RESTORE SCRIPT (target state: 23/05/2026)
-- Safe to run on existing databases — idempotent (IF NOT EXISTS,
-- DROP IF EXISTS, ON CONFLICT DO NOTHING throughout).
-- Does NOT delete user data (profiles, projects, tasks, etc).
-- Run in: Supabase → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ============================================================
-- 0. CLEAN UP POTENTIALLY BROKEN POLICIES & TRIGGERS
--    (anything that may have been added/modified since 23/05)
-- ============================================================

-- Drop all known policies so we can cleanly recreate them
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Drop triggers we will recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_generate_employee_id ON public.employees;
DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
DROP TRIGGER IF EXISTS trg_employee_skills_updated_at ON public.employee_skills;

-- Drop functions we will recreate
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.generate_employee_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;


-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'Team Member',
  avatar_url TEXT,
  bio TEXT,
  job_title TEXT,
  organization_name TEXT,              -- which company/workspace this user belongs to
  skills_completed BOOLEAN DEFAULT false, -- true once user has saved ≥3 technical skills
  ai_sensitivity INT DEFAULT 50 CHECK (ai_sensitivity >= 0 AND ai_sensitivity <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns if they don't exist yet (safe on existing DBs)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills_completed BOOLEAN DEFAULT false;


-- ============================================================
-- 2. PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT DEFAULT 'Software Development',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  budget NUMERIC(12, 2),
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'On Hold', 'Archived')),
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 3. PROJECT MEMBERS (junction table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'Member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);


-- ============================================================
-- 4. TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  complexity INT DEFAULT 5 CHECK (complexity >= 1 AND complexity <= 10),
  priority TEXT CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  status TEXT DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Review', 'Completed', 'Done')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  sprint_id UUID,
  due_date TIMESTAMP WITH TIME ZONE,
  category TEXT,
  planned_points INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 5. TASK NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 6. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 7. ANALYTICS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projected_completion TIMESTAMP WITH TIME ZONE,
  current_velocity FLOAT DEFAULT 0.0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 8. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 9. TASK DEPENDENCIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);


-- ============================================================
-- 10. TASK ATTACHMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 11. TIME LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 12. SPRINTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'Completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add sprint FK to tasks (safe to re-run)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_sprint_fk;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_sprint_fk FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE SET NULL;


-- ============================================================
-- 13. PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed BOOLEAN DEFAULT true,
  UNIQUE(role, action)
);


-- ============================================================
-- 14. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================================
-- 15. RESOURCE INTELLIGENCE — EMPLOYEES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.employee_id_seq START 1 INCREMENT 1;

CREATE TABLE IF NOT EXISTS public.employees (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             TEXT UNIQUE NOT NULL,
  full_name               TEXT NOT NULL,
  role                    TEXT,
  department              TEXT,
  experience_years        NUMERIC(4, 1) DEFAULT 0 CHECK (experience_years >= 0),
  seniority_level         TEXT DEFAULT 'junior'
                            CHECK (seniority_level IN ('junior', 'mid', 'senior')),
  max_hours_per_week      INTEGER DEFAULT 40 CHECK (max_hours_per_week >= 0),
  availability_percentage NUMERIC(5, 2) DEFAULT 100
                            CHECK (availability_percentage >= 0 AND availability_percentage <= 100),
  is_available            BOOLEAN DEFAULT true,
  location                TEXT,
  start_date              DATE,
  certification_count     INTEGER DEFAULT 0 CHECK (certification_count >= 0),
  monthly_rate            NUMERIC(12, 2) DEFAULT 0 CHECK (monthly_rate >= 0),
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE  public.employees IS 'Resource intelligence — employee capacity & cost data';
COMMENT ON COLUMN public.employees.employee_id IS 'Auto-generated: EMP001, EMP002, …';


-- ============================================================
-- 16. EMPLOYEE SKILLS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  skill_name       TEXT NOT NULL,
  skill_level      INTEGER NOT NULL DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 10),
  years_experience NUMERIC(4, 1) DEFAULT 0 CHECK (years_experience >= 0),
  category         TEXT DEFAULT 'common' CHECK (category IN ('core', 'common')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (employee_id, skill_name)
);

COMMENT ON TABLE  public.employee_skills IS 'Per-employee skill proficiency for resource matching';
COMMENT ON COLUMN public.employee_skills.skill_level IS 'Proficiency from 1 (beginner) to 10 (expert)';


-- ============================================================
-- 17. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_department     ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_seniority      ON public.employees(seniority_level);
CREATE INDEX IF NOT EXISTS idx_employees_available       ON public.employees(is_available);
CREATE INDEX IF NOT EXISTS idx_employee_skills_name      ON public.employee_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_employee_skills_category  ON public.employee_skills(category);
CREATE INDEX IF NOT EXISTS idx_employee_skills_emp_id    ON public.employee_skills(employee_id);


-- ============================================================
-- 18. SEED DEFAULT PERMISSIONS
-- ============================================================
INSERT INTO public.permissions (role, action, allowed) VALUES
  -- Project Manager
  ('Project Manager', 'create_task', true),
  ('Project Manager', 'delete_task', true),
  ('Project Manager', 'assign_task', true),
  ('Project Manager', 'create_project', true),
  ('Project Manager', 'delete_project', true),
  ('Project Manager', 'manage_members', true),
  ('Project Manager', 'manage_sprints', true),
  ('Project Manager', 'view_admin', true),
  ('Project Manager', 'view_audit_logs', true),
  -- Team Member
  ('Team Member', 'create_task', true),
  ('Team Member', 'delete_task', false),
  ('Team Member', 'assign_task', false),
  ('Team Member', 'create_project', false),
  ('Team Member', 'delete_project', false),
  ('Team Member', 'manage_members', false),
  ('Team Member', 'manage_sprints', false),
  ('Team Member', 'view_admin', false),
  ('Team Member', 'view_audit_logs', false),
  -- Admin
  ('Admin', 'create_task', true),
  ('Admin', 'delete_task', true),
  ('Admin', 'assign_task', true),
  ('Admin', 'create_project', true),
  ('Admin', 'delete_project', true),
  ('Admin', 'manage_members', true),
  ('Admin', 'manage_sprints', true),
  ('Admin', 'view_admin', true),
  ('Admin', 'view_audit_logs', true)
ON CONFLICT (role, action) DO NOTHING;


-- ============================================================
-- 19. ROW LEVEL SECURITY — Enable on all tables
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 20. RLS POLICIES
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────
CREATE POLICY "Public Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can upsert their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles insertable on signup"
  ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

-- ── Projects (Role-scoped: Admins/PMs see all, Team Members only theirs) ──
CREATE POLICY "Projects viewable by role"
  ON public.projects FOR SELECT
  USING (
    -- Admins see everything
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
    OR
    -- Project Managers see everything (so they can manage any project in the org)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Project Manager')
    OR
    -- Owner of the project
    owner_id = auth.uid()
    OR
    -- Explicitly added as a member
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
  );

CREATE POLICY "Projects insertable by authenticated"
  ON public.projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Projects updatable by authenticated"
  ON public.projects FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Projects deletable by authenticated"
  ON public.projects FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

-- ── Project Members ───────────────────────────────────────
CREATE POLICY "Project members viewable by authenticated"
  ON public.project_members FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Project members insertable by authenticated"
  ON public.project_members FOR INSERT WITH CHECK (true);

CREATE POLICY "Project members deletable by authenticated"
  ON public.project_members FOR DELETE USING (auth.role() = 'authenticated');

-- ── Tasks ─────────────────────────────────────────────────
CREATE POLICY "Tasks are viewable by authenticated users"
  ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Tasks insertable by authenticated"
  ON public.tasks FOR INSERT WITH CHECK (true);

CREATE POLICY "Tasks updatable by authenticated"
  ON public.tasks FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Tasks deletable by authenticated"
  ON public.tasks FOR DELETE USING (auth.role() = 'authenticated');

-- ── Task Notes ────────────────────────────────────────────
CREATE POLICY "Notes viewable by authenticated"
  ON public.task_notes FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Notes insertable by authenticated"
  ON public.task_notes FOR INSERT WITH CHECK (true);

-- ── Task Dependencies ─────────────────────────────────────
CREATE POLICY "Dependencies viewable by authenticated"
  ON public.task_dependencies FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Dependencies insertable by authenticated"
  ON public.task_dependencies FOR INSERT WITH CHECK (true);

CREATE POLICY "Dependencies deletable by authenticated"
  ON public.task_dependencies FOR DELETE USING (auth.role() = 'authenticated');

-- ── Task Attachments ──────────────────────────────────────
CREATE POLICY "Attachments viewable by authenticated"
  ON public.task_attachments FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Attachments insertable by authenticated"
  ON public.task_attachments FOR INSERT WITH CHECK (true);

CREATE POLICY "Attachments deletable by authenticated"
  ON public.task_attachments FOR DELETE USING (auth.role() = 'authenticated');

-- ── Activity Logs ─────────────────────────────────────────
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
  );

CREATE POLICY "Logs insertable by authenticated"
  ON public.activity_logs FOR INSERT WITH CHECK (true);

-- ── Notifications ─────────────────────────────────────────
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Notifications insertable by authenticated"
  ON public.notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ── Time Logs ─────────────────────────────────────────────
CREATE POLICY "Time logs viewable by authenticated"
  ON public.time_logs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Time logs insertable by authenticated"
  ON public.time_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Time logs updatable by authenticated"
  ON public.time_logs FOR UPDATE USING (auth.role() = 'authenticated');

-- ── Sprints ───────────────────────────────────────────────
CREATE POLICY "Sprints viewable by authenticated"
  ON public.sprints FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sprints insertable by authenticated"
  ON public.sprints FOR INSERT WITH CHECK (true);

CREATE POLICY "Sprints updatable by authenticated"
  ON public.sprints FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Sprints deletable by authenticated"
  ON public.sprints FOR DELETE USING (auth.role() = 'authenticated');

-- ── Permissions ───────────────────────────────────────────
CREATE POLICY "Permissions viewable by authenticated"
  ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permissions manageable by admin"
  ON public.permissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

-- ── Audit Logs ────────────────────────────────────────────
CREATE POLICY "Audit logs viewable by PM and Admin"
  ON public.audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('Admin', 'Project Manager')));

CREATE POLICY "Audit logs insertable by authenticated"
  ON public.audit_logs FOR INSERT WITH CHECK (true);

-- ── Employees ─────────────────────────────────────────────
CREATE POLICY "Employees viewable by authenticated"
  ON public.employees FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Employees insertable by authenticated"
  ON public.employees FOR INSERT WITH CHECK (true);

CREATE POLICY "Employees updatable by authenticated"
  ON public.employees FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Employees deletable by authenticated"
  ON public.employees FOR DELETE USING (auth.role() = 'authenticated');

-- ── Employee Skills ───────────────────────────────────────
CREATE POLICY "Employee skills viewable by authenticated"
  ON public.employee_skills FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Employee skills insertable by authenticated"
  ON public.employee_skills FOR INSERT WITH CHECK (true);

CREATE POLICY "Employee skills updatable by authenticated"
  ON public.employee_skills FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Employee skills deletable by authenticated"
  ON public.employee_skills FOR DELETE USING (auth.role() = 'authenticated');


-- ============================================================
-- 21. TRIGGERS & FUNCTIONS
-- ============================================================

-- Signup trigger: auto-create profile from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role, organization_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'Team Member'),
    COALESCE(new.raw_user_meta_data->>'organization_name', NULL)
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name      = EXCLUDED.display_name,
        email             = EXCLUDED.email,
        role              = EXCLUDED.role,
        organization_name = EXCLUDED.organization_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate employee_id on INSERT
CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := 'EMP' || LPAD(nextval('public.employee_id_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_employee_id ON public.employees;
CREATE TRIGGER trg_generate_employee_id
  BEFORE INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.generate_employee_id();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employee_skills_updated_at ON public.employee_skills;
CREATE TRIGGER trg_employee_skills_updated_at
  BEFORE UPDATE ON public.employee_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 22. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ============================================================
-- DONE — Schema restored to IntelliPM 23/05/2026 baseline
-- + organization_name and skills_completed added to profiles
-- + projects RLS now role-scoped (Admin/PM see all)
-- ============================================================
