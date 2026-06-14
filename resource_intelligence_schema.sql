-- ============================================================
-- RESOURCE INTELLIGENCE SCHEMA
-- Employee & Skill tracking for IntelliPM
-- Created: 2026-03-27
-- ============================================================
--
-- ENTITY-RELATIONSHIP DIAGRAM
-- ┌──────────────────────┐       ┌──────────────────────────┐
-- │      employees       │       │     employee_skills      │
-- ├──────────────────────┤       ├──────────────────────────┤
-- │ id (PK, UUID)        │       │ id (PK, UUID)            │
-- │ employee_id (UNIQUE) │◄──────│ employee_id (FK)         │
-- │ full_name            │  1:N  │ skill_name               │
-- │ role                 │       │ skill_level (1–10)       │
-- │ department           │       │ years_experience         │
-- │ experience_years     │       │ category (core/common)   │
-- │ seniority_level      │       │ created_at               │
-- │ max_hours_per_week   │       │ updated_at               │
-- │ availability_%       │       └──────────────────────────┘
-- │ is_available         │
-- │ location             │
-- │ start_date           │
-- │ certification_count  │
-- │ monthly_rate         │
-- │ created_at           │
-- │ updated_at           │
-- └──────────────────────┘
--
-- RELATIONSHIP: employees.employee_id = employee_skills.employee_id (1:N)
-- ============================================================


-- ============================================================
-- 1. SEQUENCE for auto-generating employee_id (EMP001, EMP002 …)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.employee_id_seq START 1 INCREMENT 1;


-- ============================================================
-- 2. EMPLOYEES TABLE
-- ============================================================
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
-- 3. TRIGGER — auto-generate employee_id on INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if the caller did not supply an employee_id
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


-- ============================================================
-- 4. EMPLOYEE SKILLS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      TEXT NOT NULL
                     REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  skill_name       TEXT NOT NULL,
  skill_level      INTEGER NOT NULL DEFAULT 1
                     CHECK (skill_level >= 1 AND skill_level <= 10),
  years_experience NUMERIC(4, 1) DEFAULT 0 CHECK (years_experience >= 0),
  category         TEXT DEFAULT 'common'
                     CHECK (category IN ('core', 'common')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate skills per employee
  UNIQUE (employee_id, skill_name)
);

COMMENT ON TABLE  public.employee_skills IS 'Per-employee skill proficiency for resource matching';
COMMENT ON COLUMN public.employee_skills.skill_level IS 'Proficiency from 1 (beginner) to 10 (expert)';


-- ============================================================
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ============================================================
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
-- 6. INDEXES — query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_department     ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_seniority      ON public.employees(seniority_level);
CREATE INDEX IF NOT EXISTS idx_employees_available       ON public.employees(is_available);
CREATE INDEX IF NOT EXISTS idx_employee_skills_name      ON public.employee_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_employee_skills_category  ON public.employee_skills(category);
CREATE INDEX IF NOT EXISTS idx_employee_skills_emp_id    ON public.employee_skills(employee_id);


-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;

-- Employees — read/write for authenticated users
CREATE POLICY "Employees viewable by authenticated"
  ON public.employees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Employees insertable by authenticated"
  ON public.employees FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Employees updatable by authenticated"
  ON public.employees FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Employees deletable by authenticated"
  ON public.employees FOR DELETE
  USING (auth.role() = 'authenticated');

-- Employee Skills — read/write for authenticated users
CREATE POLICY "Employee skills viewable by authenticated"
  ON public.employee_skills FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Employee skills insertable by authenticated"
  ON public.employee_skills FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Employee skills updatable by authenticated"
  ON public.employee_skills FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Employee skills deletable by authenticated"
  ON public.employee_skills FOR DELETE
  USING (auth.role() = 'authenticated');
