/**
 * Constants and enums for Slack integration
 */

/** Cache duration in milliseconds - longer than Jira due to stricter rate limits */
export const SLACK_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/** Batch size aligned with Slack API rate limits */
export const SLACK_BATCH_SIZE = 15;

/** Maximum number of channels to process concurrently */
export const MAX_CHANNELS_TO_PROCESS = 10;

/** Maximum number of boards/channels to fetch */
export const MAX_BOARDS_LIMIT = 20;

/** Default number of thread replies to fetch */
export const DEFAULT_THREAD_REPLIES_LIMIT = 5;

/**
 * Task-related keywords for message identification
 */
export const TASK_KEYWORDS = [
  'todo', 'task', 'bug', 'feature', 'issue', 'fix', 'implement',
  'urgent', 'priority', 'deadline', 'assigned', 'complete', 'done',
  'need to', 'should', 'must', 'requirement', 'story', 'epic'
] as const;

/**
 * Channel name patterns that indicate task-related discussions
 */
export const TASK_CHANNEL_PATTERNS = [
  'task', 'todo', 'project', 'sprint', 'bug', 
  'feature', 'dev', 'engineering'
] as const;

/**
 * Emoji reactions that indicate task status
 */
export const TASK_REACTION_EMOJIS = [
  'white_check_mark', 'heavy_check_mark', 'x', 'hourglass_flowing_sand',
  'red_circle', 'yellow_circle', 'green_circle', 'eyes', 'raising_hand'
] as const;

/**
 * Emoji reactions for priority indication
 */
export const PRIORITY_REACTION_EMOJIS = {
  urgent: ['fire', 'rotating_light', 'warning'],
  high: ['zap', 'exclamation']
} as const;

/**
 * Status mapping from Slack reactions to task status
 */
export const REACTION_STATUS_MAP = {
  'white_check_mark': 'completed',
  'heavy_check_mark': 'completed', 
  'x': 'cancelled',
  'hourglass_flowing_sand': 'in_progress',
  'red_circle': 'blocked',
  'yellow_circle': 'waiting',
  'green_circle': 'ready',
  'eyes': 'in_review',
  'raising_hand': 'assigned'
} as const;

/**
 * Priority keywords and their corresponding priority levels
 */
export const PRIORITY_KEYWORDS = {
  urgent: ['🔥', 'urgent', 'critical', 'emergency'],
  high: ['⚡', 'high priority', 'important', 'asap'],
  low: ['low priority', 'nice to have', 'when time permits']
} as const;

/**
 * Status keywords found in message text
 */
export const STATUS_KEYWORDS = {
  completed: ['completed', 'done', 'finished'],
  in_progress: ['in progress', 'working on', 'started'],
  blocked: ['blocked', 'stuck', 'waiting for']
} as const;

/**
 * Regular expressions for extracting assignees from messages
 */
export const ASSIGNEE_PATTERNS = [
  /assigned to (@?\w+)/i,
  /assignee:?\s*(@?\w+)/i,
  /@(\w+)\s+(please|can you|could you)/i
] as const;

/**
 * Regular expression for Slack user mentions
 */
export const MENTION_PATTERN = /<@([UW][A-Z0-9]+)>/g;

/**
 * Regular expression for Slack hashtags
 */
export const HASHTAG_PATTERN = /#(\w+)/g;

/**
 * Label reactions that should be extracted as task labels
 */
export const LABEL_REACTIONS = ['bug', 'enhancement', 'question', 'documentation'] as const;

/**
 * Task format patterns (bullet points, numbered lists, checkboxes, code comments)
 */
export const TASK_FORMAT_PATTERNS = [
  /^[-*+]\s/,           // Bullet points
  /^\d+\.\s/,           // Numbered lists  
  /\[[\sx]\]/i,         // Checkboxes
  /^(TODO|FIXME|NOTE|HACK):/i  // Code comments
] as const;

/**
 * Slack API scopes required for the bot token
 */
export const REQUIRED_SLACK_SCOPES = [
  'channels:history',
  'groups:history', 
  'im:history',
  'reactions:read',
  'search:read',
  'users:read'
] as const;

/**
 * Error messages for common Slack integration issues
 */
export const SLACK_ERROR_MESSAGES = {
  INVALID_TOKEN: 'Invalid Slack token. Please check your Bot Token.',
  RATE_LIMITED: 'Rate limited by Slack API. Please try again later.',
  CHANNEL_NOT_FOUND: 'Channel not found or not accessible.',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions. Please check bot scopes.',
  NETWORK_ERROR: 'Network error connecting to Slack.',
  CACHE_ERROR: 'Error accessing cached data.',
  PARSING_ERROR: 'Error parsing Slack message data.'
} as const;