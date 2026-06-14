-- Drop potentially recursive policies on projects
DROP POLICY IF EXISTS "Projects viewable by role" ON public.projects;
DROP POLICY IF EXISTS "Projects viewable by authenticated" ON public.projects;

-- Recreate the projects SELECT policy safely
CREATE POLICY "Projects viewable by role"
  ON public.projects FOR SELECT
  USING (
    owner_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('Admin', 'Project Manager'))
    OR
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
  );

-- Ensure project_members policy doesn't query projects back (which causes the infinite loop)
DROP POLICY IF EXISTS "Project members viewable by authenticated" ON public.project_members;
CREATE POLICY "Project members viewable by authenticated"
  ON public.project_members FOR SELECT USING (auth.role() = 'authenticated');
