/**
 * StudyCore program recommendation logic.
 * Given a score gap and available weeks, returns a recommended program structure.
 */

export function getRecommendation(gap, weeksAvailable) {
  if (!gap || gap <= 0) {
    return {
      totalHours: 10,
      sessionsPerWeek: 1,
      sessionLength: '1 hr',
      homeworkHrs: '2-3',
      note: 'Maintenance program — focus on consistency and test-day prep.',
    };
  }

  let baseHours, sessionsPerWeek, sessionLength;

  if (gap <= 100) {
    baseHours = 15;
    sessionsPerWeek = 1;
    sessionLength = '1 hr';
  } else if (gap <= 200) {
    baseHours = 22;
    sessionsPerWeek = 2;
    sessionLength = '1 hr';
  } else if (gap <= 300) {
    baseHours = 32;
    sessionsPerWeek = 2;
    sessionLength = '1.5 hrs';
  } else {
    baseHours = 45;
    sessionsPerWeek = 2;
    sessionLength = '1.5 hrs';
  }

  // Cap by available weeks
  if (weeksAvailable && weeksAvailable > 0) {
    const sessionHrs = parseSessionHours(sessionLength);
    const maxHoursByWeeks = weeksAvailable * sessionsPerWeek * sessionHrs;
    baseHours = Math.min(baseHours, maxHoursByWeeks);
  }

  // Round to nearest 5
  baseHours = Math.round(baseHours / 5) * 5;
  if (baseHours < 10) baseHours = 10;

  let note = '';
  if (gap <= 100) {
    note = 'Very achievable with consistent work. Focus on eliminating careless errors.';
  } else if (gap <= 200) {
    note = 'Achievable with full homework commitment and 2 sessions/week.';
  } else if (gap <= 300) {
    note = 'Ambitious but achievable. Full homework (3-4 hrs/week) is the multiplier.';
  } else {
    note = 'Large gap — plan sets honest realistic + aspirational targets. Consistent effort critical.';
  }

  return {
    totalHours: baseHours,
    sessionsPerWeek,
    sessionLength,
    homeworkHrs: gap <= 200 ? '2-3' : '3-4',
    note,
  };
}

function parseSessionHours(sessionLength) {
  if (sessionLength === '45 min') return 0.75;
  if (sessionLength === '1 hr') return 1;
  if (sessionLength === '1.5 hrs') return 1.5;
  if (sessionLength === '2 hrs') return 2;
  return 1;
}

/**
 * Calculate weeks between today and a target test date string.
 */
export function weeksUntilDate(dateString) {
  if (!dateString) return null;
  const target = new Date(dateString);
  const now = new Date();
  const diffMs = target - now;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
}

/**
 * SAT test dates for 2026–2027 (approximate).
 */
export const SAT_TEST_DATES = [
  { label: 'August 23, 2025', value: '2025-08-23' },
  { label: 'October 4, 2025', value: '2025-10-04' },
  { label: 'November 1, 2025', value: '2025-11-01' },
  { label: 'December 6, 2025', value: '2025-12-06' },
  { label: 'March 14, 2026', value: '2026-03-14' },
  { label: 'May 2, 2026', value: '2026-05-02' },
  { label: 'June 6, 2026', value: '2026-06-06' },
  { label: 'August 22, 2026', value: '2026-08-22' },
  { label: 'October 3, 2026', value: '2026-10-03' },
  { label: 'November 7, 2026', value: '2026-11-07' },
  { label: 'December 5, 2026', value: '2026-12-05' },
  { label: 'March 13, 2027', value: '2027-03-13' },
  { label: 'May 1, 2027', value: '2027-05-01' },
  { label: 'June 5, 2027', value: '2027-06-05' },
];

export const PERFORMANCE_BANDS = [
  'Below 400',
  '400–450',
  '450–500',
  '490–540',
  '500–550',
  '550–600',
  '610–670',
  '680–760',
  '680–800',
  'N/A',
];
