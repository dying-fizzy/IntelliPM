import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ── Types ─────────────────────────────────────────── */
interface EmployeeRow {
  full_name: string;
  role?: string;
  department?: string;
  experience_years?: number;
  seniority_level?: string;
  max_hours_per_week?: number;
  availability_percentage?: number;
  is_available?: boolean;
  location?: string;
  start_date?: string;
  certification_count?: number;
  monthly_rate?: number;
  employee_id?: string; // optional — trigger auto-generates if absent
  [key: string]: any;
}

interface SkillRow {
  employee_id: string;
  skill_name: string;
  skill_level: number;
  years_experience?: number;
  category?: string;
  [key: string]: any;
}

const EMPLOYEE_REQUIRED = ['full_name'];
const SKILL_REQUIRED = ['employee_id', 'skill_name', 'skill_level'];
const SENIORITY_VALID = ['junior', 'mid', 'senior'];
const CATEGORY_VALID = ['core', 'common'];

/* ── Helpers ───────────────────────────────────────── */
function parseSheet(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows as any[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

function validateEmployees(rows: any[]): { valid: EmployeeRow[]; errors: string[] } {
  const errors: string[] = [];
  if (rows.length === 0) { errors.push('File is empty'); return { valid: [], errors }; }

  const cols = Object.keys(rows[0]);
  for (const req of EMPLOYEE_REQUIRED) {
    if (!cols.some(c => c.trim().toLowerCase() === req)) {
      errors.push(`Missing required column: "${req}"`);
    }
  }
  if (errors.length) return { valid: [], errors };

  const valid: EmployeeRow[] = rows.map((r, i) => {
    const norm: any = {};
    for (const [k, v] of Object.entries(r)) {
      norm[k.trim().toLowerCase().replace(/ /g, '_')] = v;
    }
    if (norm.seniority_level && !SENIORITY_VALID.includes(norm.seniority_level)) {
      errors.push(`Row ${i + 2}: invalid seniority_level "${norm.seniority_level}" (use: junior/mid/senior)`);
    }
    return {
      full_name: String(norm.full_name || '').trim(),
      role: norm.role ? String(norm.role).trim() : undefined,
      department: norm.department ? String(norm.department).trim() : undefined,
      experience_years: norm.experience_years !== '' ? Number(norm.experience_years) : undefined,
      seniority_level: norm.seniority_level ? String(norm.seniority_level).toLowerCase().trim() : 'junior',
      max_hours_per_week: norm.max_hours_per_week !== '' ? Number(norm.max_hours_per_week) : undefined,
      availability_percentage: norm.availability_percentage !== '' ? Number(norm.availability_percentage) : undefined,
      is_available: norm.is_available !== '' ? Boolean(norm.is_available) : true,
      location: norm.location ? String(norm.location).trim() : undefined,
      start_date: norm.start_date ? String(norm.start_date) : undefined,
      certification_count: norm.certification_count !== '' ? Number(norm.certification_count) : undefined,
      monthly_rate: norm.monthly_rate !== '' ? Number(norm.monthly_rate) : undefined,
      employee_id: norm.employee_id ? String(norm.employee_id).trim() : undefined,
    };
  }).filter(r => r.full_name);

  return { valid, errors };
}

function validateSkills(rows: any[]): { valid: SkillRow[]; errors: string[] } {
  const errors: string[] = [];
  if (rows.length === 0) { errors.push('File is empty'); return { valid: [], errors }; }

  const cols = Object.keys(rows[0]);
  for (const req of SKILL_REQUIRED) {
    if (!cols.some(c => c.trim().toLowerCase() === req)) {
      errors.push(`Missing required column: "${req}"`);
    }
  }
  if (errors.length) return { valid: [], errors };

  const valid: SkillRow[] = rows.map((r, i) => {
    const norm: any = {};
    for (const [k, v] of Object.entries(r)) {
      norm[k.trim().toLowerCase().replace(/ /g, '_')] = v;
    }
    const level = Number(norm.skill_level);
    if (isNaN(level) || level < 1 || level > 10) {
      errors.push(`Row ${i + 2}: skill_level must be 1–10, got "${norm.skill_level}"`);
    }
    if (norm.category && !CATEGORY_VALID.includes(String(norm.category).toLowerCase())) {
      errors.push(`Row ${i + 2}: invalid category "${norm.category}" (use: core/common)`);
    }
    return {
      employee_id: String(norm.employee_id || '').trim(),
      skill_name: String(norm.skill_name || '').trim(),
      skill_level: Math.min(10, Math.max(1, level || 1)),
      years_experience: norm.years_experience !== '' ? Number(norm.years_experience) : undefined,
      category: norm.category ? String(norm.category).toLowerCase().trim() : 'common',
    };
  }).filter(r => r.employee_id && r.skill_name);

  return { valid, errors };
}

/* ── Drop Zone ─────────────────────────────────────── */
interface DropZoneProps {
  label: string;
  sublabel: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  accent: string;
}

const DropZone: React.FC<DropZoneProps> = ({ label, sublabel, file, onFile, onClear, accent }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !file && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-sm p-8 transition-all cursor-pointer text-center glass-input
        ${dragging ? '!border-[var(--accent)] !bg-[var(--accent)]/5' : '!border-[rgba(255,255,255,0.15)] hover:!border-white/30'}
        ${file ? 'cursor-default' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
      />

      {file ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} style={{ color: accent }} />
            <div className="text-left">
              <p className="text-[13px] font-bold truncate max-w-[220px]">{file.name}</p>
              <p className="text-[11px] mono opacity-40">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            className="p-1.5 opacity-40 hover:opacity-100 hover:text-red-400 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <Upload size={24} className="mx-auto mb-3 opacity-20" />
          <p className="text-[13px] font-bold">{label}</p>
          <p className="text-[11px] mono opacity-40 mt-1">{sublabel}</p>
          <p className="text-[10px] mono opacity-20 mt-3">XLSX · XLS · CSV</p>
        </>
      )}
    </div>
  );
};

/* ── Preview Table ─────────────────────────────────── */
const PreviewTable: React.FC<{ rows: any[]; label: string }> = ({ rows, label }) => {
  if (!rows.length) return null;
  const PREVIEW_LIMIT = 8;
  const cols = Object.keys(rows[0]).slice(0, 6); // show max 6 cols
  const preview = rows.slice(0, PREVIEW_LIMIT);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] mono uppercase tracking-widest opacity-40">{label}</span>
        <span className="text-[11px] mono opacity-40">{rows.length} rows total</span>
      </div>
      <div className="overflow-x-auto border border-[var(--border-color)] rounded-sm">
        <table className="w-full text-left text-[11px] mono">
          <thead>
            <tr className="bg-white/5">
              {cols.map(c => (
                <th key={c} className="px-3 py-2 font-bold uppercase tracking-wider opacity-40 whitespace-nowrap border-b border-[var(--border-color)]">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b border-[var(--border-color)] hover:bg-white/2">
                {cols.map(c => (
                  <td key={c} className="px-3 py-2 opacity-70 whitespace-nowrap max-w-[140px] truncate">
                    {String(row[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > PREVIEW_LIMIT && (
          <div className="px-4 py-2 text-[10px] mono opacity-30 border-t border-[var(--border-color)]">
            … and {rows.length - PREVIEW_LIMIT} more rows
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main Component ────────────────────────────────── */
const DataImportPanel: React.FC = () => {
  const [empFile, setEmpFile] = useState<File | null>(null);
  const [skillFile, setSkillFile] = useState<File | null>(null);

  const [empRows, setEmpRows] = useState<EmployeeRow[]>([]);
  const [skillRows, setSkillRows] = useState<SkillRow[]>([]);
  const [empErrors, setEmpErrors] = useState<string[]>([]);
  const [skillErrors, setSkillErrors] = useState<string[]>([]);

  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ emp: number; skills: number } | null>(null);
  const [importError, setImportError] = useState('');

  const handleEmpFile = async (f: File) => {
    setEmpFile(f);
    setParsed(false);
    setResult(null);
    setEmpErrors([]);
    setEmpRows([]);
    try {
      const raw = await parseSheet(f);
      const { valid, errors } = validateEmployees(raw);
      setEmpRows(valid);
      setEmpErrors(errors);
    } catch {
      setEmpErrors(['Failed to parse file. Please use a valid .xlsx or .csv format.']);
    }
  };

  const handleSkillFile = async (f: File) => {
    setSkillFile(f);
    setParsed(false);
    setResult(null);
    setSkillErrors([]);
    setSkillRows([]);
    try {
      const raw = await parseSheet(f);
      const { valid, errors } = validateSkills(raw);
      setSkillRows(valid);
      setSkillErrors(errors);
    } catch {
      setSkillErrors(['Failed to parse file. Please use a valid .xlsx or .csv format.']);
    }
  };

  const hasValidData = (empRows.length > 0 || skillRows.length > 0) &&
    empErrors.filter(e => e.startsWith('Missing')).length === 0 &&
    skillErrors.filter(e => e.startsWith('Missing')).length === 0;

  const handlePreview = () => setParsed(true);

  const handleImport = async () => {
    setImporting(true);
    setImportError('');
    let empCount = 0;
    let skillCount = 0;

    try {
      // Step 1 – Upsert employees (employee_id as conflict key; if absent the trigger will generate one)
      if (empRows.length > 0) {
        const toUpsert = empRows.map(r => {
          const obj: any = { ...r };
          if (!obj.employee_id) delete obj.employee_id; // let trigger handle it
          return obj;
        });

        // Rows with employee_id → upsert (update on conflict)
        const withId = toUpsert.filter(r => r.employee_id);
        const withoutId = toUpsert.filter(r => !r.employee_id);

        if (withId.length > 0) {
          const { error } = await supabase
            .from('employees')
            .upsert(withId, { onConflict: 'employee_id' });
          if (error) throw new Error(`Employees upsert: ${error.message}`);
          empCount += withId.length;
        }

        // Rows without employee_id → plain insert (trigger generates ID)
        for (const row of withoutId) {
          const { error } = await supabase.from('employees').insert(row);
          if (error) throw new Error(`Employee insert: ${error.message}`);
          empCount++;
        }
      }

      // Step 2 – Upsert skills
      if (skillRows.length > 0) {
        const { error } = await supabase
          .from('employee_skills')
          .upsert(skillRows, { onConflict: 'employee_id,skill_name' });
        if (error) throw new Error(`Skills upsert: ${error.message}`);
        skillCount = skillRows.length;
      }

      setResult({ emp: empCount, skills: skillCount });
      setParsed(false);
    } catch (err: any) {
      setImportError(err.message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setEmpFile(null); setSkillFile(null);
    setEmpRows([]); setSkillRows([]);
    setEmpErrors([]); setSkillErrors([]);
    setParsed(false); setResult(null); setImportError('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="glass-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="ui-label text-[var(--accent)] flex items-center gap-2 mb-1">
              <FileSpreadsheet size={14} /> Data Import
            </span>
            <h3 className="text-lg font-black uppercase tracking-tighter">Bulk Import Employees & Skills</h3>
            <p className="text-[12px] mono opacity-40 mt-1">Upload Excel or CSV files. Existing records are updated automatically.</p>
          </div>
          {/* Download sample */}
          <a
            href="#"
            onClick={e => {
              e.preventDefault();
              const wb = XLSX.utils.book_new();
              const empWs = XLSX.utils.aoa_to_sheet([
                ['full_name', 'role', 'department', 'experience_years', 'seniority_level', 'max_hours_per_week', 'availability_percentage', 'is_available', 'location', 'start_date', 'certification_count', 'monthly_rate', 'employee_id'],
                ['John Doe', 'Developer', 'Engineering', 3, 'mid', 40, 100, true, 'Remote', '2022-01-15', 2, 5000, ''],
              ]);
              const skillWs = XLSX.utils.aoa_to_sheet([
                ['employee_id', 'skill_name', 'skill_level', 'years_experience', 'category'],
                ['EMP001', 'React', 8, 3, 'core'],
              ]);
              XLSX.utils.book_append_sheet(wb, empWs, 'Employees');
              XLSX.utils.book_append_sheet(wb, skillWs, 'Skills');
              XLSX.writeFile(wb, 'intellipm_import_template.xlsx');
            }}
            className="flex items-center gap-2 px-4 py-2.5 glass-button rounded-sm text-[11px] font-bold mono uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] whitespace-nowrap"
          >
            <Download size={13} /> Download Template
          </a>
        </div>
      </div>

      {/* Success Banner */}
      {result && (
        <div className="flex items-center gap-3 p-5 bg-green-500/10 border border-green-500/20 rounded-sm">
          <CheckCircle size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-green-400">Import Successful!</p>
            <p className="text-[12px] mono opacity-60 mt-0.5">
              {result.emp > 0 && `${result.emp} employee${result.emp !== 1 ? 's' : ''} imported. `}
              {result.skills > 0 && `${result.skills} skill${result.skills !== 1 ? 's' : ''} imported.`}
            </p>
          </div>
          <button onClick={handleReset} className="ml-auto p-1.5 opacity-40 hover:opacity-100 transition-all">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Import Error */}
      {importError && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-sm">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-[12px] mono text-red-400">{importError}</p>
        </div>
      )}

      {/* Upload Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <DropZone
            label="Employees File"
            sublabel="Drag & drop or click to select"
            file={empFile}
            onFile={handleEmpFile}
            onClear={() => { setEmpFile(null); setEmpRows([]); setEmpErrors([]); }}
            accent="var(--accent)"
          />
          {empErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] mono text-amber-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
          {empFile && !empErrors.some(e => e.startsWith('Missing')) && empRows.length > 0 && (
            <p className="text-[11px] mono text-green-400">✓ {empRows.length} valid employee rows detected</p>
          )}
        </div>

        <div className="space-y-3">
          <DropZone
            label="Skills File"
            sublabel="Drag & drop or click to select"
            file={skillFile}
            onFile={handleSkillFile}
            onClear={() => { setSkillFile(null); setSkillRows([]); setSkillErrors([]); }}
            accent="var(--accent-blue)"
          />
          {skillErrors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] mono text-amber-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
          {skillFile && !skillErrors.some(e => e.startsWith('Missing')) && skillRows.length > 0 && (
            <p className="text-[11px] mono text-green-400">✓ {skillRows.length} valid skill rows detected</p>
          )}
        </div>
      </div>

      {/* Preview CTA */}
      {hasValidData && !parsed && !result && (
        <div className="flex justify-end">
          <button
            onClick={handlePreview}
            className="bg-[var(--accent)] text-black px-8 py-3 rounded-sm text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
          >
            Preview Import →
          </button>
        </div>
      )}

      {/* Preview Tables */}
      {parsed && (
        <div className="glass-panel p-6 space-y-6">
          <h4 className="text-[12px] font-black uppercase tracking-widest opacity-60">Preview</h4>
          {empRows.length > 0 && <PreviewTable rows={empRows} label="Employees" />}
          {skillRows.length > 0 && <PreviewTable rows={skillRows} label="Skills" />}

          <div className="flex items-center gap-4 pt-2 border-t border-[var(--border-color)]">
            <button
              onClick={() => setParsed(false)}
              className="px-6 py-3 glass-button rounded-sm text-[11px] font-bold mono uppercase tracking-wider"
            >
              ← Back
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-[var(--accent)] text-black px-8 py-3 rounded-sm text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 disabled:opacity-40"
            >
              {importing ? 'Importing…' : `Confirm Import (${empRows.length + skillRows.length} rows)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImportPanel;
