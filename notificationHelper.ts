import { supabase } from './supabaseClient';

/**
 * Create a notification for a specific user.
 */
export const createNotification = async (
  userId: string,
  message: string,
  type: string = 'general',
  entityId?: string
) => {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      message,
      type,
      entity_id: entityId || null,
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

/**
 * Create notifications for multiple users (e.g. @mentions).
 */
export const createBulkNotifications = async (
  userIds: string[],
  message: string,
  type: string = 'mention',
  entityId?: string
) => {
  if (userIds.length === 0) return;
  try {
    const rows = userIds.map(uid => ({
      user_id: uid,
      message,
      type,
      entity_id: entityId || null,
    }));
    await supabase.from('notifications').insert(rows);
  } catch (err) {
    console.error('Failed to create bulk notifications:', err);
  }
};

/**
 * Notify a user when a task is assigned to them.
 */
export const notifyTaskAssigned = async (
  assigneeId: string,
  taskTitle: string,
  assignerName: string,
  taskId: string
) => {
  await createNotification(
    assigneeId,
    `${assignerName} assigned you to "${taskTitle}"`,
    'assignment',
    taskId
  );
};

/**
 * Notify mentioned users from a note.
 */
export const notifyMentions = async (
  mentionedUserIds: string[],
  mentionerName: string,
  taskTitle: string,
  taskId: string
) => {
  await createBulkNotifications(
    mentionedUserIds,
    `${mentionerName} mentioned you in a note on "${taskTitle}"`,
    'mention',
    taskId
  );
};

/**
 * Notify relevant users when a task status changes.
 */
export const notifyTaskStatusChange = async (
  recipientId: string,
  changerName: string,
  taskTitle: string,
  newStatus: string,
  taskId: string
) => {
  await createNotification(
    recipientId,
    `${changerName} moved "${taskTitle}" to ${newStatus}`,
    'status_change',
    taskId
  );
};

/**
 * Parse @mentions from text content against a list of profiles.
 * Returns an array of { id, display_name } for matched users.
 */
export const parseMentions = (
  text: string,
  profiles: { id: string; display_name: string }[]
): { id: string; display_name: string }[] => {
  const mentionRegex = /@(\w[\w\s]*?)(?=\s@|$|\s[^@]|[.,!?;:])/g;
  const matches: { id: string; display_name: string }[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const rawName = match[1].trim().toLowerCase();
    const profile = profiles.find(
      p => p.display_name.toLowerCase() === rawName
    );
    if (profile && !matches.some(m => m.id === profile.id)) {
      matches.push({ id: profile.id, display_name: profile.display_name });
    }
  }

  return matches;
};
