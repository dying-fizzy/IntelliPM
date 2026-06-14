
/**
 * Maps Supabase error messages to user-friendly explanations.
 * Used across all components to provide consistent, actionable error messages.
 */
export const mapSupabaseError = (error: any, context?: string): string => {
  const msg = typeof error === 'string' ? error : (error?.message || error?.error_description || '');
  const hint = error?.hint || '';
  const code = error?.code || '';
  const ctx = context ? ` ${context}` : '';

  // ── Permission / RLS ──
  if (msg.includes('permission denied') || msg.includes('row-level security') || code === '42501') {
    return `Permission denied: You don't have access to${ctx || ' perform this action'}. This may be a Row Level Security policy issue — contact your admin or check Supabase RLS settings.`;
  }

  // ── Auth / Session ──
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('expired') || code === 'PGRST301') {
    return 'Your session has expired. Please sign out and sign back in to continue.';
  }
  if (msg.includes('Invalid login')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Your email address has not been confirmed. Please check your inbox for a confirmation link.';
  }
  if (msg.includes('User already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  // ── Constraint violations ──
  if (msg.includes('duplicate key') || msg.includes('unique constraint') || code === '23505') {
    return `This${ctx || ' record'} already exists. Please use a different name or value.`;
  }
  if (msg.includes('violates foreign key') || code === '23503') {
    return `Invalid reference: A linked record does not exist. Please verify your${ctx || ''} data.`;
  }
  if (msg.includes('null value') || msg.includes('not-null constraint') || code === '23502') {
    return 'Missing required field. Please fill in all required fields and try again.';
  }
  if (msg.includes('check constraint') || code === '23514') {
    return `Invalid value: The${ctx || ''} data doesn't meet the required format or range.`;
  }

  // ── Network ──
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION')) {
    return 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return 'Request timed out. The server is taking too long to respond — please try again.';
  }

  // ── Rate limiting ──
  if (msg.includes('rate limit') || code === '429') {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  // ── Storage ──
  if (msg.includes('Bucket not found')) {
    return 'File storage is not configured. Please set up the storage bucket in Supabase.';
  }
  if (msg.includes('The resource already exists')) {
    return 'A file with this name already exists. Please rename the file and try again.';
  }

  // ── Fallback ──
  if (msg) {
    return `Error${ctx ? ' ' + ctx : ''}: ${msg}`;
  }
  return `An unexpected error occurred${ctx ? ' while ' + ctx : ''}. Please try again.`;
};
