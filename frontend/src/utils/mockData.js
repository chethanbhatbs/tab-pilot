// lastAccessed timestamps: recent = active within threshold, old = inactive
const NOW = Date.now();
const MIN = 60000;
const RECENT = NOW - 5 * MIN;       // 5 minutes ago (within any threshold)
const OLD_30 = NOW - 45 * MIN;      // 45 minutes ago (beyond 30min threshold)
const OLD_60 = NOW - 90 * MIN;      // 90 minutes ago (beyond 1hr threshold)
const OLD_120 = NOW - 180 * MIN;    // 3 hours ago (beyond 2hr threshold)

export const MOCK_WINDOWS = [
  {
    id: 1,
    focused: true,
    state: 'normal',
    tabs: [
      {
        id: 101, windowId: 1, index: 0,
        title: 'GitHub - tab-radar/extension: Chrome Tab Manager',
        url: 'https://github.com/tab-radar/extension',
        active: false, pinned: true,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: -1,
        lastAccessed: RECENT
      },
      {
        id: 102, windowId: 1, index: 1,
        title: 'Stack Overflow - How to use React hooks effectively',
        url: 'https://stackoverflow.com/questions/12345/how-to-use-react-hooks',
        active: true, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: -1,
        lastAccessed: NOW
      },
      {
        id: 103, windowId: 1, index: 2,
        title: 'Jira Board - Sprint 42',
        url: 'https://mycompany.atlassian.net/jira/board/42',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: 1,
        lastAccessed: RECENT
      },
      {
        id: 104, windowId: 1, index: 3,
        title: 'Confluence - Sprint Notes & Retrospective',
        url: 'https://mycompany.atlassian.net/wiki/spaces/DEV/sprint-notes',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: 1,
        lastAccessed: OLD_30
      },
      {
        id: 105, windowId: 1, index: 4,
        title: 'Slack - #engineering channel',
        url: 'https://mycompany.slack.com/channels/engineering',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: 1,
        lastAccessed: RECENT
      },
      {
        id: 106, windowId: 1, index: 5,
        title: 'ChatGPT - AI Assistant',
        url: 'https://chat.openai.com/',
        active: false, pinned: false,
        audible: true, mutedInfo: { muted: false },
        status: 'complete', groupId: 2,
        lastAccessed: RECENT
      },
      {
        id: 107, windowId: 1, index: 6,
        title: 'Google Docs - Q4 Meeting Notes',
        url: 'https://docs.google.com/document/d/abc123/edit',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: 2,
        lastAccessed: OLD_60
      },
    ]
  },
  {
    id: 2,
    focused: false,
    state: 'normal',
    tabs: [
      {
        id: 201, windowId: 2, index: 0,
        title: 'YouTube - Lo-fi Hip Hop Radio',
        url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        active: true, pinned: false,
        audible: true, mutedInfo: { muted: false },
        status: 'complete', groupId: 3,
        lastAccessed: NOW
      },
      {
        id: 202, windowId: 2, index: 1,
        title: 'Reddit - r/programming - Top Posts',
        url: 'https://www.reddit.com/r/programming/',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: 3,
        lastAccessed: OLD_120
      },
      {
        id: 203, windowId: 2, index: 2,
        title: 'Gmail - Inbox (3)',
        url: 'https://mail.google.com/mail/u/0/#inbox',
        active: false, pinned: true,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: -1,
        lastAccessed: RECENT
      },
    ]
  },
  {
    id: 3,
    focused: false,
    state: 'normal',
    tabs: [
      {
        id: 301, windowId: 3, index: 0,
        title: 'Amazon.com - Shopping Cart',
        url: 'https://www.amazon.com/gp/cart/view.html',
        active: true, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: 4,
        lastAccessed: NOW
      },
      {
        id: 302, windowId: 3, index: 1,
        title: 'Stack Overflow - How to use React hooks effectively',
        url: 'https://stackoverflow.com/questions/12345/how-to-use-react-hooks',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: -1,
        lastAccessed: OLD_30
      },
      {
        id: 303, windowId: 3, index: 2,
        title: 'X (Twitter) - Home Feed',
        url: 'https://x.com/home',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'complete', groupId: -1,
        lastAccessed: OLD_60
      },
      {
        id: 304, windowId: 3, index: 3,
        title: 'Netflix - Browse',
        url: 'https://www.netflix.com/browse',
        active: false, pinned: false,
        audible: false, mutedInfo: { muted: false },
        status: 'loading', groupId: -1,
        lastAccessed: OLD_120
      },
    ]
  }
];

export const MOCK_TAB_GROUPS = [
  { id: 1, title: 'Work', color: 'blue', collapsed: false, windowId: 1 },
  { id: 2, title: 'Research', color: 'green', collapsed: false, windowId: 1 },
  { id: 3, title: 'Media', color: 'red', collapsed: false, windowId: 2 },
  { id: 4, title: 'Shopping', color: 'yellow', collapsed: false, windowId: 3 },
];

export const TAB_GROUP_COLORS = {
  grey: { bg: '#9aa0a6', text: '#ffffff' },
  blue: { bg: '#8ab4f8', text: '#202124' },
  red: { bg: '#f28b82', text: '#202124' },
  yellow: { bg: '#fdd663', text: '#202124' },
  green: { bg: '#81c995', text: '#202124' },
  pink: { bg: '#ff8bcb', text: '#202124' },
  purple: { bg: '#c58af9', text: '#202124' },
  cyan: { bg: '#78d9ec', text: '#202124' },
  orange: { bg: '#fcad70', text: '#202124' },
};

export const TAB_METRICS = {
  101: { memory: 145, cpu: 2, visitCount: 47 },
  102: { memory: 210, cpu: 5, visitCount: 156 },
  103: { memory: 98, cpu: 1, visitCount: 32 },
  104: { memory: 112, cpu: 1, visitCount: 28 },
  105: { memory: 320, cpu: 8, visitCount: 89 },
  106: { memory: 285, cpu: 12, visitCount: 203 },
  107: { memory: 78, cpu: 1, visitCount: 15 },
  201: { memory: 410, cpu: 14, visitCount: 312 },
  202: { memory: 165, cpu: 3, visitCount: 67 },
  203: { memory: 130, cpu: 2, visitCount: 184 },
  301: { memory: 195, cpu: 4, visitCount: 23 },
  302: { memory: 180, cpu: 3, visitCount: 41 },
  303: { memory: 225, cpu: 6, visitCount: 95 },
  304: { memory: 55, cpu: 1, visitCount: 8 },
};

export const DOMAIN_TIME_SPENT = {
  'github.com': { hours: 4.2, label: 'GitHub', color: '#8ab4f8' },
  'stackoverflow.com': { hours: 3.1, label: 'Stack Overflow', color: '#f48225' },
  'mycompany.atlassian.net': { hours: 2.8, label: 'Atlassian', color: '#0052cc' },
  'mycompany.slack.com': { hours: 2.3, label: 'Slack', color: '#4a154b' },
  'chat.openai.com': { hours: 1.9, label: 'ChatGPT', color: '#10a37f' },
  'docs.google.com': { hours: 1.4, label: 'Google Docs', color: '#4285f4' },
  'www.youtube.com': { hours: 1.1, label: 'YouTube', color: '#ff0000' },
  'www.reddit.com': { hours: 0.8, label: 'Reddit', color: '#ff4500' },
  'mail.google.com': { hours: 0.7, label: 'Gmail', color: '#ea4335' },
  'www.amazon.com': { hours: 0.5, label: 'Amazon', color: '#ff9900' },
  'x.com': { hours: 0.4, label: 'X / Twitter', color: '#1da1f2' },
  'www.netflix.com': { hours: 0.3, label: 'Netflix', color: '#e50914' },
};

export const TAB_TIME_MINUTES = {
  101: 142, 102: 98, 103: 65, 104: 52, 105: 88,
  106: 114, 107: 38, 201: 66, 202: 48, 203: 42,
  301: 30, 302: 22, 303: 24, 304: 5,
};

export const HOURLY_ACTIVITY = [
  { hour: '6am', minutes: 0 },
  { hour: '7am', minutes: 12 },
  { hour: '8am', minutes: 35 },
  { hour: '9am', minutes: 52 },
  { hour: '10am', minutes: 48 },
  { hour: '11am', minutes: 55 },
  { hour: '12pm', minutes: 20 },
  { hour: '1pm', minutes: 45 },
  { hour: '2pm', minutes: 58 },
  { hour: '3pm', minutes: 50 },
  { hour: '4pm', minutes: 42 },
  { hour: '5pm', minutes: 30 },
  { hour: '6pm', minutes: 15 },
  { hour: '7pm', minutes: 8 },
];

export const WEEKLY_ACTIVITY = [
  { day: 'Mon', hours: 6.2, visits: 45 },
  { day: 'Tue', hours: 7.8, visits: 72 },
  { day: 'Wed', hours: 5.9, visits: 58 },
  { day: 'Thu', hours: 8.4, visits: 91 },
  { day: 'Fri', hours: 7.1, visits: 83 },
  { day: 'Sat', hours: 3.2, visits: 34 },
  { day: 'Sun', hours: 2.1, visits: 28 },
];

export const MONTHLY_ACTIVITY = [
  { week: 'Week 1', hours: 32.5, visits: 310 },
  { week: 'Week 2', hours: 38.2, visits: 385 },
  { week: 'Week 3', hours: 35.8, visits: 348 },
  { week: 'Week 4', hours: 40.7, visits: 411 },
];

export const ACTIVITY_TIMELINE = WEEKLY_ACTIVITY;

// Smart workspace presets
export const WORKSPACE_PRESETS = [
  {
    id: 'deep-work',
    name: 'Deep Work',
    icon: 'code',
    color: '#8ab4f8',
    tabIds: [101, 102, 103, 104, 105],
    description: 'GitHub, Stack Overflow, Jira, Confluence, Slack',
  },
  {
    id: 'meetings',
    name: 'Meetings',
    icon: 'video',
    color: '#81c995',
    tabIds: [105, 107, 203],
    description: 'Slack, Google Docs, Gmail',
  },
  {
    id: 'research',
    name: 'Research',
    icon: 'search',
    color: '#c58af9',
    tabIds: [102, 106, 202],
    description: 'Stack Overflow, ChatGPT, Reddit',
  },
  {
    id: 'break',
    name: 'Break Time',
    icon: 'coffee',
    color: '#f28b82',
    tabIds: [201, 202, 303, 304],
    description: 'YouTube, Reddit, Twitter, Netflix',
  },
];

// Tab notes mock data
export const INITIAL_TAB_NOTES = {
  102: 'Check the accepted answer about useEffect cleanup',
  103: 'Sprint ends Friday - review pending PRs',
  201: 'Good focus music playlist',
};

// Auto-close rule presets
export const AUTO_CLOSE_PRESETS = [
  { id: 'aggressive', label: '15 minutes', minutes: 15 },
  { id: 'moderate', label: '30 minutes', minutes: 30 },
  { id: 'relaxed', label: '1 hour', minutes: 60 },
  { id: 'off', label: 'Off', minutes: 0 },
];
