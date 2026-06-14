
import { supabase } from './supabaseClient';

// Cache permissions in memory to avoid repeated DB calls
let permissionCache: Record<string, Record<string, boolean>> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Check if a role is allowed to perform an action.
 * Returns true by default if no permission record exists (fail-open for unlisted actions).
 */
export const checkPermission = async (role: string, action: string): Promise<boolean> => {
  // Admins always have full access
  if (role === 'Admin') return true;

  // Try cache first
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && permissionCache[role]?.[action] !== undefined) {
    return permissionCache[role][action];
  }

  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('allowed')
      .eq('role', role)
      .eq('action', action)
      .single();

    if (error || !data) return true; // Fail open if no record

    // Update cache
    if (!permissionCache[role]) permissionCache[role] = {};
    permissionCache[role][action] = data.allowed;
    cacheTimestamp = now;

    return data.allowed;
  } catch (_) {
    return true; // Fail open on error
  }
};

/**
 * Load all permissions for a role at once (for UI-level permission gating).
 */
export const loadRolePermissions = async (role: string): Promise<Record<string, boolean>> => {
  if (role === 'Admin') {
    return {
      create_task: true, delete_task: true, assign_task: true,
      create_project: true, delete_project: true, manage_members: true,
      manage_sprints: true, view_admin: true, view_audit_logs: true,
    };
  }

  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('action, allowed')
      .eq('role', role);

    if (error) return {};

    const perms: Record<string, boolean> = {};
    (data || []).forEach((p: any) => { perms[p.action] = p.allowed; });

    permissionCache[role] = perms;
    cacheTimestamp = Date.now();

    return perms;
  } catch (_) {
    return {};
  }
};

/**
 * Get current user's permission for an action.
 * Reads role from localStorage user object.
 */
export const canCurrentUser = async (action: string): Promise<boolean> => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return checkPermission(user.role || 'Team Member', action);
};

/**
 * Synchronous check against the cached permissions.
 * Must call loadRolePermissions first.
 */
export const canCurrentUserSync = (action: string): boolean => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || 'Team Member';
  if (role === 'Admin') return true;
  return permissionCache[role]?.[action] ?? true;
};

/** Clear the permission cache */
export const clearPermissionCache = () => {
  permissionCache = {};
  cacheTimestamp = 0;
};
