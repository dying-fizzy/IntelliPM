import { supabase } from './supabaseClient';
import { createNotification } from './notificationHelper';

/**
 * Deadline Alert Thresholds
 * Each threshold defines how far before a task's due_date an alert fires.
 * The `key` is stored in localStorage to prevent duplicate alerts.
 */
const THRESHOLDS = [
  { key: '5d',  ms: 5 * 24 * 60 * 60 * 1000, label: '5 days'   },
  { key: '3d',  ms: 3 * 24 * 60 * 60 * 1000, label: '3 days'   },
  { key: '2d',  ms: 2 * 24 * 60 * 60 * 1000, label: '2 days'   },
  { key: '1d',  ms: 1 * 24 * 60 * 60 * 1000, label: '1 day'    },
  { key: '12h', ms: 12 * 60 * 60 * 1000,      label: '12 hours' },
  { key: '6h',  ms: 6 * 60 * 60 * 1000,       label: '6 hours'  },
  { key: '1h',  ms: 1 * 60 * 60 * 1000,       label: '1 hour'   },
];

/** Build a localStorage key for a specific task + threshold */
const sentKey = (taskId: string, thresholdKey: string) =>
  `deadline_alert_${taskId}_${thresholdKey}`;

/** Check if an alert was already sent */
const alreadySent = (taskId: string, thresholdKey: string): boolean =>
  localStorage.getItem(sentKey(taskId, thresholdKey)) === '1';

/** Mark an alert as sent */
const markSent = (taskId: string, thresholdKey: string): void =>
  localStorage.setItem(sentKey(taskId, thresholdKey), '1');

/**
 * Core check: scans all tasks assigned to the current user that have a
 * due_date, and fires notifications at each threshold that has been
 * crossed but not yet alerted.
 */
export const checkDeadlineAlerts = async (userId: string): Promise<void> => {
  try {
    // Fetch only incomplete tasks assigned to this user that have a due date
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, due_date, status')
      .eq('assigned_to', userId)
      .not('status', 'in', '("Completed","Done")')
      .not('due_date', 'is', null);

    if (error || !tasks || tasks.length === 0) return;

    const now = Date.now();

    for (const task of tasks) {
      const deadline = new Date(task.due_date).getTime();
      const remaining = deadline - now;

      // Skip tasks whose deadline has already passed
      if (remaining < 0) continue;

      // Walk through thresholds from largest to smallest
      for (const threshold of THRESHOLDS) {
        if (remaining <= threshold.ms && !alreadySent(task.id, threshold.key)) {
          // Fire notification
          await createNotification(
            userId,
            `⚠️ "${task.title}" is due in ${threshold.label}!`,
            'deadline',
            task.id
          );
          markSent(task.id, threshold.key);
        }
      }
    }
  } catch (err) {
    console.error('[DeadlineAlerts] Check failed:', err);
  }
};

/**
 * Start the deadline alert polling loop.
 * Returns a cleanup function to stop polling.
 *
 * @param userId - The currently authenticated user's ID
 * @param intervalMs - How often to check (default: every 60 seconds)
 */
export const startDeadlineAlertLoop = (
  userId: string,
  intervalMs: number = 60_000
): (() => void) => {
  // Run immediately on start
  checkDeadlineAlerts(userId);

  // Then poll on interval
  const id = setInterval(() => {
    checkDeadlineAlerts(userId);
  }, intervalMs);

  return () => clearInterval(id);
};
