// ============================================================
// TASK MATCHER — Employee Scoring Engine
// IntelliPM · Pure TypeScript, no AI dependency
//
// Formula (per employee):
//   score = skillMatchScore   (weight 40)
//         + skillLevelScore   (weight 25)
//         + experienceScore   (weight 20)
//         + availabilityScore (weight 15)
//         - overloadPenalty
//         ± seniorityBonus/penalty
//
// AI-READY: weights are named constants — swap them for
// model probabilities without touching the core logic.
// ============================================================

// ── Types ────────────────────────────────────────────────────

export type TaskDifficulty = 'low' | 'medium' | 'high';

export interface TaskInput {
  required_skills: string[];          // e.g. ['React', 'TypeScript']
  difficulty: TaskDifficulty;
  estimated_hours?: number;           // used to check overload
}

export interface EmployeeSkillRecord {
  skill_name: string;
  skill_level: number;                // 1–10
  years_experience: number;
  category: 'core' | 'common';
}

export interface EmployeeRecord {
  employee_id: string;
  full_name: string;
  role?: string;
  department?: string;
  seniority_level: 'junior' | 'mid' | 'senior';
  experience_years: number;           // total career experience
  availability_percentage: number;    // 0–100
  max_hours_per_week: number;
  is_available: boolean;
  skills: EmployeeSkillRecord[];
}

export interface MatchResult {
  employee_id: string;
  full_name: string;
  role?: string;
  seniority_level: string;
  score: number;                      // 0–100, higher = better match
  breakdown: ScoreBreakdown;
  matched_skills: string[];           // skills that overlap with task
  missing_skills: string[];           // required skills employee lacks
  recommendation: 'strong' | 'good' | 'fair' | 'weak';
}

export interface ScoreBreakdown {
  skill_match: number;                // 0–40
  skill_level: number;                // 0–25
  experience: number;                 // 0–20
  availability: number;               // 0–15
  overload_penalty: number;           // negative
  seniority_adjustment: number;       // positive or negative
  raw_total: number;
  final_score: number;                // clamped 0–100
}

// ── Weights (AI-READY: replace with learned weights) ─────────

const W = {
  SKILL_MATCH:   40,   // proportion of required skills matched
  SKILL_LEVEL:   25,   // average level of matched skills (1–10 → 0–25)
  EXPERIENCE:    20,   // total experience years (capped at 10yr → 20pts)
  AVAILABILITY:  15,   // availability_percentage / 100 * 15
  OVERLOAD:      15,   // penalty when is_available=false or avail<30%
  SENIORITY:     10,   // bonus/penalty based on difficulty ↔ seniority fit
} as const;

/** Admin-configurable weights loaded from ai_settings table */
export interface DynamicWeights {
  skill_match:    number;   // maps to W.SKILL_MATCH
  skill_level:    number;   // maps to W.SKILL_LEVEL
  experience:     number;   // maps to W.EXPERIENCE
  availability:   number;   // maps to W.AVAILABILITY
}

// ── Difficulty → preferred seniority mapping ─────────────────

const DIFFICULTY_SENIORITY: Record<TaskDifficulty, { preferred: string[]; penalty_for: string[] }> = {
  low:    { preferred: ['junior', 'mid'],    penalty_for: [] },
  medium: { preferred: ['mid', 'senior'],    penalty_for: [] },
  high:   { preferred: ['senior'],           penalty_for: ['junior'] },
};

// ── Core Scorer ─────────────────────────────────────────

function scoreEmployee(
  employee: EmployeeRecord,
  task: TaskInput,
  dw?: DynamicWeights
): ScoreBreakdown {
  // Merge dynamic weights over defaults
  const wSkillMatch  = dw?.skill_match   ?? W.SKILL_MATCH;
  const wSkillLevel  = dw?.skill_level   ?? W.SKILL_LEVEL;
  const wExperience  = dw?.experience    ?? W.EXPERIENCE;
  const wAvailability= dw?.availability  ?? W.AVAILABILITY;

  const required = task.required_skills.map(s => s.toLowerCase().trim());

  // ── 1. Skill Match (0–40) ─────────────────────────────────
  // For each required skill, find the best-matching employee skill.
  // Partial match allowed (e.g. "react" matches "React Native") at 50% credit.
  const matchedSkills: EmployeeSkillRecord[] = [];
  let matchSum = 0;

  for (const reqSkill of required) {
    const exact = employee.skills.find(
      s => s.skill_name.toLowerCase().trim() === reqSkill
    );
    const partial = !exact && employee.skills.find(
      s => s.skill_name.toLowerCase().includes(reqSkill) ||
           reqSkill.includes(s.skill_name.toLowerCase())
    );

    if (exact) {
      matchSum += 1;
      matchedSkills.push(exact);
    } else if (partial) {
      matchSum += 0.5;
      matchedSkills.push(partial);
    }
  }

  const matchRatio = required.length > 0 ? matchSum / required.length : 0;
  const skill_match = Math.round(matchRatio * wSkillMatch);

  // ── 2. Skill Level (0–25) ─────────────────────────────────
  // Average level of MATCHED skills, scaled 1–10 → 0–25.
  // Core skills are weighted 1.5x vs common skills.
  let levelScore = 0;
  if (matchedSkills.length > 0) {
    const weightedLevels = matchedSkills.map(s => {
      const weight = s.category === 'core' ? 1.5 : 1.0;
      return (s.skill_level / 10) * weight;
    });
    const avgWeighted = weightedLevels.reduce((a, b) => a + b, 0) / matchedSkills.length;
    // Normalize for difficulty: high tasks demand higher raw level
    const difficultyDivisor = task.difficulty === 'high' ? 1.2 : task.difficulty === 'medium' ? 1.1 : 1.0;
    levelScore = Math.round((avgWeighted / difficultyDivisor) * wSkillLevel);
  }
  const skill_level = Math.min(wSkillLevel, levelScore);

  // ── 3. Experience (0–20) ──────────────────────────────────
  // Total career years, capped at 10 → maps linearly to 20pts.
  // High difficulty tasks need proportionally more experience.
  const expTarget = task.difficulty === 'high' ? 8 : task.difficulty === 'medium' ? 5 : 3;
  const expRatio = Math.min(1, employee.experience_years / expTarget);
  const experience = Math.round(expRatio * wExperience);

  // ── 4. Availability (0–admin weight) ───────────────────────
  const availability = Math.round((employee.availability_percentage / 100) * wAvailability);

  // ── 5. Overload Penalty ───────────────────────────────────
  let overload_penalty = 0;
  if (!employee.is_available) {
    overload_penalty = W.OVERLOAD; // full penalty: not available at all
  } else if (employee.availability_percentage < 30) {
    overload_penalty = Math.round(W.OVERLOAD * 0.6); // partial penalty: very busy
  } else if (employee.availability_percentage < 60) {
    overload_penalty = Math.round(W.OVERLOAD * 0.2); // light penalty: moderately busy
  }

  // ── 6. Seniority Adjustment (−10 to +10) ─────────────────
  const { preferred, penalty_for } = DIFFICULTY_SENIORITY[task.difficulty];
  let seniority_adjustment = 0;
  if (preferred.includes(employee.seniority_level)) {
    seniority_adjustment = +W.SENIORITY;
  } else if (penalty_for.includes(employee.seniority_level)) {
    seniority_adjustment = -W.SENIORITY;  // e.g. junior on a high difficulty task
  }

  // ── 7. Total ──────────────────────────────────────────────
  const raw_total = skill_match + skill_level + experience + availability - overload_penalty + seniority_adjustment;
  const final_score = Math.max(0, Math.min(100, raw_total));

  return {
    skill_match,
    skill_level,
    experience,
    availability,
    overload_penalty: -overload_penalty,
    seniority_adjustment,
    raw_total,
    final_score,
  };
}

// ── Recommendation label ─────────────────────────────────────

function getRecommendation(score: number): MatchResult['recommendation'] {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'good';
  if (score >= 35) return 'fair';
  return 'weak';
}

// ── Public API ────────────────────────────────────────────────

/**
 * Match a task to a pool of employees.
 * Returns a ranked list of MatchResult, best match first.
 *
 * @param task      - Task requirements (skills + difficulty)
 * @param employees - All candidate employees with their skills
 * @param topN      - Return only top N results (default: all)
 */
export function matchTaskToEmployees(
  task: TaskInput,
  employees: EmployeeRecord[],
  topN?: number,
  weights?: DynamicWeights
): MatchResult[] {
  const required = task.required_skills.map(s => s.toLowerCase().trim());

  const results: MatchResult[] = employees.map(emp => {
    const breakdown = scoreEmployee(emp, task, weights);

    const matched_skills = emp.skills
      .filter(s =>
        required.some(
          r => s.skill_name.toLowerCase().includes(r) || r.includes(s.skill_name.toLowerCase())
        )
      )
      .map(s => s.skill_name);

    const missing_skills = required.filter(
      r => !emp.skills.some(
        s => s.skill_name.toLowerCase().includes(r) || r.includes(s.skill_name.toLowerCase())
      )
    );

    return {
      employee_id: emp.employee_id,
      full_name: emp.full_name,
      role: emp.role,
      seniority_level: emp.seniority_level,
      score: breakdown.final_score,
      breakdown,
      matched_skills,
      missing_skills,
      recommendation: getRecommendation(breakdown.final_score),
    };
  });

  // Sort: highest score first
  results.sort((a, b) => b.score - a.score);

  return topN ? results.slice(0, topN) : results;
}

/**
 * Fetch employees + their skills from Supabase, then run matching.
 * Drop-in replacement for matchTaskToEmployees when you have live data.
 */
export async function matchTaskLive(
  supabase: any,
  task: TaskInput,
  topN = 5,
  weights?: DynamicWeights
): Promise<MatchResult[]> {
  const { data: empData, error: empErr } = await supabase
    .from('employees')
    .select(`
      employee_id,
      full_name,
      role,
      seniority_level,
      experience_years,
      availability_percentage,
      max_hours_per_week,
      is_available,
      employee_skills (
        skill_name,
        skill_level,
        years_experience,
        category
      )
    `)
    .eq('is_available', true);

  if (empErr || !empData) {
    console.error('matchTaskLive fetch error:', empErr);
    return [];
  }

  const employees: EmployeeRecord[] = empData.map((e: any) => ({
    ...e,
    skills: e.employee_skills || [],
  }));

  return matchTaskToEmployees(task, employees, topN, weights);
}

// ── Usage Examples (commented out) ───────────────────────────
//
// BASIC:
// const results = matchTaskToEmployees(
//   { required_skills: ['React', 'TypeScript'], difficulty: 'high' },
//   employees,
//   5  // top 5 only
// );
// console.log(results[0].full_name, results[0].score);
//
// LIVE (with Supabase):
// import { supabase } from './supabaseClient';
// const top = await matchTaskLive(supabase, {
//   required_skills: ['Python', 'ML'],
//   difficulty: 'high',
//   estimated_hours: 20,
// }, 3);
