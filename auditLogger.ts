
import { supabase } from './supabaseClient';

/**
 * Log an auditable action with optional old/new value tracking.
 */
export const logAudit = async (
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string,
  oldValue?: any,
  newValue?: any
): Promise<void> => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    await supabase.from('audit_logs').insert({
      user_id: user.id || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: details || null,
      old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

/**
 * Convenience: log a task status change with old → new tracking.
 */
export const auditStatusChange = async (
  taskId: string,
  taskTitle: string,
  oldStatus: string,
  newStatus: string
): Promise<void> => {
  await logAudit(
    'status_change',
    'task',
    taskId,
    `Task "${taskTitle}" moved from ${oldStatus} to ${newStatus}`,
    { status: oldStatus },
    { status: newStatus }
  );
};

/**
 * Convenience: log task assignment change.
 */
export const auditAssignment = async (
  taskId: string,
  taskTitle: string,
  oldAssignee: string | null,
  newAssignee: string | null
): Promise<void> => {
  await logAudit(
    'assignment_change',
    'task',
    taskId,
    `Task "${taskTitle}" reassigned`,
    { assigned_to: oldAssignee },
    { assigned_to: newAssignee }
  );
};

/**
 * Convenience: log entity creation.
 */
export const auditCreate = async (
  entityType: string,
  entityId: string,
  details: string,
  newValue?: any
): Promise<void> => {
  await logAudit('create', entityType, entityId, details, null, newValue);
};

/**
 * Convenience: log entity deletion.
 */
export const auditDelete = async (
  entityType: string,
  entityId: string,
  details: string,
  oldValue?: any
): Promise<void> => {
  await logAudit('delete', entityType, entityId, details, oldValue, null);
};
