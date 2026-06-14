-- ==============================================================================
-- NUCLEAR FIX: Drop ALL policies on the related tables to break any loops
-- ==============================================================================
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    -- Drop all policies on projects
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname); 
    END LOOP; 
    
    -- Drop all policies on project_members
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'project_members' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members', pol.policyname); 
    END LOOP; 
    
    -- Drop all policies on profiles (in case the loop involves profiles)
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); 
    END LOOP; 
END $$;

-- ==============================================================================
-- RECREATE SAFE POLICIES (From standard IntelliPM schema)
-- ==============================================================================

-- 1. Profiles
CREATE POLICY "Public Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can upsert their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles insertable on signup" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
);

-- 2. Project Members
CREATE POLICY "Project members viewable by authenticated" ON public.project_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Project members insertable by authenticated" ON public.project_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Project members deletable by authenticated" ON public.project_members FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Projects
CREATE POLICY "Projects viewable by role" ON public.projects FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('Admin', 'Project Manager'))
  OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
);
CREATE POLICY "Projects insertable by authenticated" ON public.projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Projects updatable by authenticated" ON public.projects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Projects deletable by authenticated" ON public.projects FOR DELETE USING (auth.role() = 'authenticated');
