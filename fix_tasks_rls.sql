-- ==============================================================================
-- NUCLEAR FIX: Reset ALL policies on the 'tasks' table to safe defaults
-- ==============================================================================

-- Drop all existing policies on 'tasks'
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname); 
    END LOOP; 
END $$;

-- Make sure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Recreate standard permissive policies for authenticated users
CREATE POLICY "Tasks are viewable by authenticated users" ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Tasks insertable by authenticated" ON public.tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Tasks updatable by authenticated" ON public.tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Tasks deletable by authenticated" ON public.tasks FOR DELETE USING (auth.role() = 'authenticated');

-- Ensure the proper database permissions are granted to avoid "Permission Denied"
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO anon, authenticated, service_role;
