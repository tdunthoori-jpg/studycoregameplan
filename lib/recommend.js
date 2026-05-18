/**
 * StudyCore program recommendation logic.
 *
 * Anchor: 1300→1500 (+200 pts) = 20 hrs, 10-week plan, 2x/week × 1 hr.
 *
 * idealHours = gap÷10, rounded to nearest 5, clamped [10, 40].
 * Session structure is chosen as the lightest option (fewest sessions/week)
 * whose hours × planWeeks still reach idealHours. This keeps all three numbers
 * internally consistent: totalHours = sessionsPerWeek × sessionHrs × planWeeks.
 *
 * Plan length snaps DOWN to the nearest standard tier based on weeks until test:
 *   ≤9→8, 10-14→10, 15-19→15, 20-24→20, 25-29→25, 30-39→30, ≥40→40
 */

const PLAN_TIERS = [
  { maxWeeks: 9,        planWeeks: 8  },
  { maxWeeks: 14,       planWeeks: 10 },
  { maxWeeks: 19,       planWeeks: 15 },
  { maxWeeks: 24,       planWeeks: 20 },
  { maxWeeks: 29,       planWeeks: 25 },
  { maxWeeks: 39,       planWeeks: 30 },
  { maxWeeks: Infinity, planWeeks: 40 },
];

function snapPlanWeeks(weeksAvailable) {
  for (const tier of PLAN_TIERS) {
    if (weeksAvailable <= tier.maxWeeks) return tier.planWeeks;
  }
  return 20;
}

export function getRecommendation(gap, weeksAvailable) {
  if (!gap || gap <= 0) {
    const planWeeks = weeksAvailable ? snapPlanWeeks(weeksAvailable) : 8;
    return {
      totalHours: 10,
      planWeeks,
      sessionsPerWeek: 1,
      sessionLength: '1 hr',
      homeworkHrs: '1-2',
      note: 'Maintenance program — focus on consistency and test-day strategy.',
    };
  }

  // Ideal hours from gap: 1 hr per 10 pts, rounded to nearest 5, clamped [10, 40]
  const idealHours = Math.max(10, Math.min(40, Math.round((gap / 10) / 5) * 5));

  // Plan length: snap to standard tier, or pick based on gap if no date given
  let planWeeks;
  if (weeksAvailable && weeksAvailable > 0) {
    planWeeks = snapPlanWeeks(weeksAvailable);
  } else {
    if (gap <= 100) planWeeks = 8;
    else if (gap <= 200) planWeeks = 10;
    else if (gap <= 300) planWeeks = 15;
    else planWeeks = 20;
  }

  // Pick the lightest session structure whose hours × planWeeks reaches idealHours.
  // This keeps totalHours = sessionsPerWeek × sessionHrs × planWeeks (always consistent).
  const SESSION_OPTIONS = [
    { sessionsPerWeek: 1, sessionLength: '1 hr',    sessionHrs: 1   },
    { sessionsPerWeek: 2, sessionLength: '1 hr',    sessionHrs: 1   },
    { sessionsPerWeek: 2, sessionLength: '1.5 hrs', sessionHrs: 1.5 },
    { sessionsPerWeek: 3, sessionLength: '1 hr',    sessionHrs: 1   },
  ];
  let chosen = SESSION_OPTIONS[SESSION_OPTIONS.length - 1];
  for (const opt of SESSION_OPTIONS) {
    if (opt.sessionsPerWeek * opt.sessionHrs * planWeeks >= idealHours) {
      chosen = opt;
      break;
    }
  }
  const { sessionsPerWeek, sessionLength } = chosen;
  const sessionHrs = chosen.sessionHrs;
  let totalHours = Math.min(40, sessionsPerWeek * sessionHrs * planWeeks);

  // Note reflects plan intensity
  let note;
  if (gap <= 100) {
    note = `${totalHours}-hr program over ${planWeeks} weeks. Focus on eliminating careless errors.`;
  } else if (gap <= 200) {
    note = `${totalHours}-hr program over ${planWeeks} weeks. Achievable with consistent homework.`;
  } else if (gap <= 300) {
    note = `${totalHours}-hr program over ${planWeeks} weeks. Full homework commitment is the multiplier.`;
  } else {
    note = `${totalHours}-hr program over ${planWeeks} weeks. Large gap — consistent effort is critical.`;
  }

  return {
    totalHours,
    planWeeks,
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
  { label: 'March 14, 2026',     value: '2026-03-14' },
  { label: 'May 2, 2026',        value: '2026-05-02' },
  { label: 'June 6, 2026',       value: '2026-06-06' },
  { label: 'August 22, 2026',    value: '2026-08-22' },
  { label: 'September 12, 2026', value: '2026-09-12' },
  { label: 'October 3, 2026',    value: '2026-10-03' },
  { label: 'November 7, 2026',   value: '2026-11-07' },
  { label: 'December 5, 2026',   value: '2026-12-05' },
  { label: 'March 13, 2027',     value: '2027-03-13' },
  { label: 'May 1, 2027',        value: '2027-05-01' },
  { label: 'June 5, 2027',       value: '2027-06-05' },
];

export const ACT_TEST_DATES = [
  { label: 'February 7, 2026',   value: '2026-02-07' },
  { label: 'April 4, 2026',      value: '2026-04-04' },
  { label: 'June 13, 2026',      value: '2026-06-13' },
  { label: 'July 18, 2026',      value: '2026-07-18' },
  { label: 'September 12, 2026', value: '2026-09-12' },
  { label: 'October 24, 2026',   value: '2026-10-24' },
  { label: 'December 12, 2026',  value: '2026-12-12' },
  { label: 'February 6, 2027',   value: '2027-02-06' },
  { label: 'April 10, 2027',     value: '2027-04-10' },
  { label: 'June 12, 2027',      value: '2027-06-12' },
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

/**
 * Top colleges by US state (in-state flagships + strong regionals + notable privates).
 * Used to suggest target colleges when a student's location is detected.
 */
export const STATE_COLLEGES = {
  AL: ['University of Alabama', 'Auburn University', 'Samford University', 'University of South Alabama'],
  AK: ['University of Alaska Fairbanks', 'University of Alaska Anchorage'],
  AZ: ['University of Arizona', 'Arizona State University', 'Grand Canyon University', 'Northern Arizona University'],
  AR: ['University of Arkansas', 'Arkansas Tech University', 'Hendrix College'],
  CA: ['UCLA', 'UC Berkeley', 'USC', 'UC San Diego', 'UC Davis', 'UC Santa Barbara', 'UC Irvine', 'Cal Poly SLO', 'Stanford University', 'Pepperdine University', 'Santa Clara University'],
  CO: ['University of Colorado Boulder', 'Colorado State University', 'University of Denver', 'Colorado College'],
  CT: ['University of Connecticut', 'Yale University', 'Trinity College', 'Quinnipiac University', 'Wesleyan University'],
  DC: ['Georgetown University', 'George Washington University', 'American University', 'Howard University'],
  DE: ['University of Delaware', 'Delaware State University'],
  FL: ['University of Florida', 'Florida State University', 'University of Miami', 'University of Central Florida', 'University of South Florida', 'Florida International University', 'Rollins College'],
  GA: ['University of Georgia', 'Georgia Tech', 'Emory University', 'Georgia State University', 'Mercer University', 'Kennesaw State University'],
  HI: ['University of Hawaii at Manoa', 'Hawaii Pacific University'],
  ID: ['University of Idaho', 'Boise State University', 'Idaho State University'],
  IL: ['University of Illinois Urbana-Champaign', 'Northwestern University', 'DePaul University', 'Loyola University Chicago', 'Illinois State University', 'University of Chicago'],
  IN: ['Indiana University Bloomington', 'Purdue University', 'University of Notre Dame', 'Butler University', 'Ball State University'],
  IA: ['University of Iowa', 'Iowa State University', 'Grinnell College'],
  KS: ['University of Kansas', 'Kansas State University', 'Wichita State University'],
  KY: ['University of Kentucky', 'University of Louisville', 'Western Kentucky University', 'Transylvania University'],
  LA: ['Louisiana State University', 'Tulane University', 'University of New Orleans', 'Loyola University New Orleans'],
  ME: ['University of Maine', 'Bowdoin College', 'Colby College', 'Bates College'],
  MD: ['University of Maryland', 'Johns Hopkins University', 'Towson University', 'Loyola University Maryland', 'UMBC'],
  MA: ['Boston University', 'Boston College', 'Northeastern University', 'Harvard University', 'MIT', 'UMass Amherst', 'Tufts University', 'Worcester Polytechnic Institute', 'College of the Holy Cross'],
  MI: ['University of Michigan', 'Michigan State University', 'Wayne State University', 'Western Michigan University', 'Grand Valley State University'],
  MN: ['University of Minnesota', 'Macalester College', 'Carleton College', 'St. Olaf College', 'University of St. Thomas'],
  MS: ['University of Mississippi', 'Mississippi State University', 'Millsaps College'],
  MO: ['University of Missouri', 'Washington University in St. Louis', 'Saint Louis University', 'Mizzou', 'Truman State University'],
  MT: ['University of Montana', 'Montana State University'],
  NE: ['University of Nebraska-Lincoln', 'Creighton University', 'Nebraska Wesleyan University'],
  NV: ['University of Nevada Las Vegas', 'University of Nevada Reno'],
  NH: ['University of New Hampshire', 'Dartmouth College', 'Saint Anselm College'],
  NJ: ['Rutgers University', 'Princeton University', 'Seton Hall University', 'Rider University', 'Monmouth University', 'Drew University'],
  NM: ['University of New Mexico', 'New Mexico State University', 'New Mexico Tech'],
  NY: ['NYU', 'Columbia University', 'Fordham University', 'University of Rochester', 'Cornell University', 'SUNY Binghamton', 'SUNY Stony Brook', 'Syracuse University', 'RPI', 'Colgate University', 'Hamilton College'],
  NC: ['UNC Chapel Hill', 'NC State University', 'Duke University', 'Wake Forest University', 'Davidson College', 'Elon University', 'Appalachian State University', 'UNC Charlotte', 'High Point University'],
  ND: ['University of North Dakota', 'North Dakota State University'],
  OH: ['Ohio State University', 'University of Cincinnati', 'Case Western Reserve University', 'Miami University', 'Ohio University', 'Denison University', 'Kenyon College'],
  OK: ['University of Oklahoma', 'Oklahoma State University', 'Oral Roberts University'],
  OR: ['University of Oregon', 'Oregon State University', 'Portland State University', 'Reed College', 'Lewis & Clark College'],
  PA: ['Penn State', 'University of Pittsburgh', 'Temple University', 'Drexel University', 'Villanova University', 'Lehigh University', 'Dickinson College', 'Bucknell University', 'Lafayette College'],
  RI: ['Brown University', 'University of Rhode Island', 'Providence College', 'Bryant University'],
  SC: ['University of South Carolina', 'Clemson University', 'College of Charleston', 'Coastal Carolina University', 'Furman University', 'Wofford College'],
  SD: ['University of South Dakota', 'South Dakota State University'],
  TN: ['University of Tennessee', 'Vanderbilt University', 'Belmont University', 'Rhodes College', 'Lipscomb University', 'Tennessee Tech'],
  TX: ['University of Texas Austin', 'Texas A&M', 'Baylor University', 'SMU', 'Rice University', 'TCU', 'University of Houston', 'Texas Tech University', 'Trinity University', 'UT Dallas'],
  UT: ['University of Utah', 'Utah State University', 'Brigham Young University', 'Westminster College'],
  VT: ['University of Vermont', 'Middlebury College', 'Norwich University'],
  VA: ['University of Virginia', 'Virginia Tech', 'James Madison University', 'William & Mary', 'George Mason University', 'Virginia Commonwealth University', 'Washington and Lee University', 'Hampden-Sydney College'],
  WA: ['University of Washington', 'Washington State University', 'Seattle University', 'Gonzaga University', 'Western Washington University'],
  WV: ['West Virginia University', 'Marshall University'],
  WI: ['University of Wisconsin-Madison', 'Marquette University', 'UW Milwaukee', 'Lawrence University'],
  WY: ['University of Wyoming'],
};

/** US state abbreviation → full name lookup */
export const STATE_NAMES = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DC:'Washington D.C.', DE:'Delaware', FL:'Florida',
  GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri',
  MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey',
  NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota',
  OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island',
  SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah',
  VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
};

/**
 * Extract a 2-letter state code from a free-text location string.
 * Handles "Charlotte, NC", "NC", "North Carolina", "Texas", etc.
 */
export function parseStateFromLocation(location) {
  if (!location) return null;
  const s = location.trim();

  // Direct 2-letter match
  const abbr = s.match(/\b([A-Z]{2})\b/);
  if (abbr && STATE_COLLEGES[abbr[1]]) return abbr[1];

  // Full state name match (case-insensitive)
  const lower = s.toLowerCase();
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name.toLowerCase())) return code;
  }

  return null;
}
