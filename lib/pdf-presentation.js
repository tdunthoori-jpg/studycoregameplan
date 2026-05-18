import { existsSync } from 'fs';

let _interFontCss = null;

const PHASE_COLORS = ['#B84A2E', '#C9942C', '#1A8870', '#2D6DB5', '#7B4EA6', '#1F7A50'];

// ── Browser launcher ──────────────────────────────────────────────────────────

const CHROMIUM_ARCH = process.arch === 'arm64' ? 'arm64' : 'x64';
const CHROMIUM_URL  =
  `https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.${CHROMIUM_ARCH}.tar`;

async function getBrowser() {
  const puppeteerMod = await import('puppeteer-core');
  const puppeteer = puppeteerMod.default ?? puppeteerMod;

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromiumMod = await import('@sparticuz/chromium-min');
    const chromium = chromiumMod.default ?? chromiumMod;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(CHROMIUM_URL),
      headless: chromium.headless ?? true,
    });
  }

  const localPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  const executablePath = localPaths.find(p => existsSync(p));
  if (!executablePath) throw new Error('No Chrome found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH.');

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
}

// ── Data derivation ───────────────────────────────────────────────────────────

function derive(gamePlan, studentData, studentName) {
  const {
    rwScore, mathScore, targetScore, testType, targetTestDate,
    weeks, totalHours, targetColleges, domains,
  } = studentData;

  const isACT = (testType || '').toUpperCase() === 'ACT';

  // ── ACT section scores ────────────────────────────────────────────────────
  const actEnglish  = isACT ? (parseInt(domains?.actEnglish)  || 0) : 0;
  const actMath     = isACT ? (parseInt(domains?.actMath)     || 0) : 0;
  const actReading  = isACT ? (parseInt(domains?.actReading)  || 0) : 0;
  const actScience  = isACT ? (parseInt(domains?.actScience)  || 0) : 0;
  const actComposite = (isACT && actEnglish && actMath && actReading && actScience)
    ? Math.round((actEnglish + actMath + actReading + actScience) / 4)
    : (parseInt(studentData.totalScore) || 0);

  // ── SAT section scores ────────────────────────────────────────────────────
  const rwCur   = isACT ? 0 : (parseInt(rwScore)   || 0);
  const mathCur = isACT ? 0 : (parseInt(mathScore) || 0);

  const baseline = isACT ? actComposite : (rwCur + mathCur);
  const target   = parseInt(targetScore) || (isACT ? 30 : 1400);
  const totalLift = target - baseline;

  // ── Weak/strong section analysis ─────────────────────────────────────────
  let weakIsRW, weakSec, strongSec, weakScore, strongScore;
  let weakColor, strongColor, weakBg, strongBg;
  let mathColor, rwColor, mathBg, rwBg;
  let weakLift, strongLift;

  if (isACT) {
    const actSectionList = [
      { name: 'English',  score: actEnglish  },
      { name: 'Math',     score: actMath     },
      { name: 'Reading',  score: actReading  },
      { name: 'Science',  score: actScience  },
    ].filter(s => s.score > 0);

    const lowestSec  = actSectionList.length ? actSectionList.reduce((a, b) => b.score < a.score ? b : a) : { name: 'English',  score: 0 };
    const highestSec = actSectionList.length ? actSectionList.reduce((a, b) => b.score > a.score ? b : a) : { name: 'Science', score: 0 };

    weakIsRW   = false; // not applicable for ACT
    weakSec    = lowestSec.name;
    strongSec  = highestSec.name;
    weakScore  = lowestSec.score;
    strongScore = highestSec.score;
    weakColor   = '#B84A2E';
    strongColor = '#1F7A50';
    weakBg      = '#FBE5DD';
    strongBg    = '#DCEDE2';
    mathColor   = '#B84A2E'; // reused for weak color in ACT context
    rwColor     = '#1F7A50'; // reused for strong color in ACT context
    mathBg      = '#FBE5DD';
    rwBg        = '#DCEDE2';

    weakLift   = Math.round(totalLift * 0.6);
    strongLift = totalLift - weakLift;
  } else {
    weakIsRW   = rwCur < mathCur;
    weakSec    = weakIsRW ? 'R/W'  : 'Math';
    strongSec  = weakIsRW ? 'Math' : 'R/W';
    weakScore  = weakIsRW ? rwCur  : mathCur;
    strongScore = weakIsRW ? mathCur : rwCur;
    weakColor   = '#B84A2E';
    strongColor = '#1F7A50';
    weakBg      = '#FBE5DD';
    strongBg    = '#DCEDE2';
    mathColor = weakIsRW ? '#1F7A50' : '#B84A2E';
    rwColor   = weakIsRW ? '#B84A2E' : '#1F7A50';
    mathBg    = weakIsRW ? '#DCEDE2' : '#FBE5DD';
    rwBg      = weakIsRW ? '#FBE5DD' : '#DCEDE2';

    // Derive section lifts from actual score progression targets
    function parseTargetNum(str) { const m = (str || '').match(/(\d{3,4})/); return m ? parseInt(m[1]) : null; }
    const _progRowsEarly = gamePlan.scoreProgression?.rows || [];
    const _lastRowEarly  = _progRowsEarly[_progRowsEarly.length - 1] || {};
    const _rwTarget      = parseTargetNum(_lastRowEarly.rw)   || Math.round(target * 0.47);
    const _mathTarget    = parseTargetNum(_lastRowEarly.math) || Math.round(target * 0.53);
    const _mathLift      = Math.max(0, _mathTarget - mathCur);
    const _rwLift        = Math.max(0, _rwTarget   - rwCur);
    const _rawTotal      = _mathLift + _rwLift;
    if (_rawTotal > 0) {
      const _weakRaw = weakIsRW ? _rwLift : _mathLift;
      weakLift   = Math.round((_weakRaw / _rawTotal) * totalLift / 10) * 10;
      strongLift = totalLift - weakLift;
    } else {
      weakLift   = Math.round(totalLift * 0.7 / 10) * 10;
      strongLift = totalLift - weakLift;
    }
  }

  // Use the game plan's AI-generated tagline; fall back to a score-derived phrase.
  let _fallbackThesis;
  if (isACT) {
    _fallbackThesis = `Composite ${baseline}. ${weakSec} is the climb. ${target}+ is the goal.`;
  } else {
    const gap = Math.abs(rwCur - mathCur);
    if (weakIsRW) {
      if (mathCur >= 750)      _fallbackThesis = 'Math is elite. R/W is the entire gap.';
      else if (mathCur >= 700) _fallbackThesis = 'Math is strong. R/W is the climb.';
      else if (gap >= 80)      _fallbackThesis = 'Math leads. R/W is the gap.';
      else                     _fallbackThesis = 'Solid baseline. The lift lives in R/W.';
    } else {
      if (rwCur >= 750)        _fallbackThesis = 'R/W is elite. Math is the entire gap.';
      else if (rwCur >= 700)   _fallbackThesis = 'R/W is strong. Math is the climb.';
      else if (gap >= 80)      _fallbackThesis = 'R/W leads. Math is the gap.';
      else                     _fallbackThesis = 'Solid baseline. The lift lives in Math.';
    }
  }
  const thesis = gamePlan.tagline || _fallbackThesis;

  const cols = (targetColleges || '').toLowerCase();
  let scoreBand;
  if (isACT) {
    if (/mit|caltech|cmu|georgia.?tech/.test(cols) && target >= 34) scoreBand = 'STEM-tier';
    else if (/harvard|yale|princeton|stanford|columbia|dartmouth|brown|cornell|upenn/.test(cols)) scoreBand = 'Ivy-tier';
    else if (target >= 34) scoreBand = 'elite-tier';
    else if (target >= 32) scoreBand = 'T20-tier';
    else if (target >= 30) scoreBand = 'strong-private-tier';
    else if (target >= 27) scoreBand = 'solid-tier';
    else                   scoreBand = `${target}+ target`;
  } else {
    if (/mit|caltech|cmu|georgia.?tech/.test(cols) && target >= 1480) scoreBand = 'STEM-tier';
    else if (/harvard|yale|princeton|stanford|columbia|dartmouth|brown|cornell|upenn/.test(cols)) scoreBand = 'Ivy-tier';
    else if (target >= 1500) scoreBand = 'elite-tier';
    else if (target >= 1450) scoreBand = 'T20-tier';
    else if (target >= 1350) scoreBand = 'strong-private-tier';
    else if (target >= 1250) scoreBand = 'solid-tier';
    else                     scoreBand = `${target}+ target`;
  }
  // Human-readable version: no hyphens, title-cased (e.g. "Strong Private")
  const scoreBandDisplay = scoreBand
    .replace(/-tier$/, '')
    .replace(/-/g, ' ')
    .replace(/\b[a-z]/g, c => c.toUpperCase());
  const bottomLine = gamePlan.bottomLine || '';

  // SAT section score percentile (400–800 scale)
  function pct(s) {
    const table = [
      [790,'99th+'],[770,'99th'],[740,'98th'],[720,'97th'],[700,'95th'],
      [680,'93rd'],[660,'90th'],[640,'87th'],[620,'83rd'],[600,'79th'],
      [580,'74th'],[560,'69th'],[540,'63rd'],[520,'57th'],[500,'50th'],
      [480,'43rd'],[460,'37th'],[420,'24th'],
    ];
    for (const [t, p] of table) if (s >= t) return p;
    return '15th';
  }
  // SAT composite percentile (400–1600 scale)
  function compositePct(s) {
    const table = [
      [1580,'99th+'],[1520,'99th'],[1480,'98th'],[1460,'97th'],[1440,'96th'],
      [1420,'95th'],[1400,'94th'],[1380,'93rd'],[1360,'92nd'],[1340,'90th'],
      [1320,'88th'],[1300,'86th'],[1280,'83rd'],[1260,'81st'],[1240,'78th'],
      [1220,'75th'],[1200,'72nd'],[1180,'69th'],[1160,'65th'],[1140,'62nd'],
      [1120,'58th'],[1100,'54th'],[1080,'50th'],[1060,'46th'],[1040,'42nd'],
      [1020,'38th'],[1000,'34th'],[980,'30th'],[960,'26th'],[940,'22nd'],
      [920,'18th'],[900,'15th'],[880,'12th'],[860,'9th'],[840,'7th'],
      [820,'5th'],[800,'3rd'],
    ];
    for (const [t, p] of table) if (s >= t) return p;
    return '1st';
  }
  // ACT composite/section percentile (1–36 scale)
  function actPct(s) {
    const table = [
      [36,'100th'],[35,'99th'],[34,'99th'],[33,'98th'],[32,'97th'],[31,'96th'],
      [30,'95th'],[29,'93rd'],[28,'90th'],[27,'87th'],[26,'83rd'],[25,'79th'],
      [24,'74th'],[23,'68th'],[22,'62nd'],[21,'56th'],[20,'49th'],[19,'43rd'],
      [18,'38th'],[17,'30th'],[16,'24th'],[15,'18th'],[14,'13th'],[13,'9th'],
    ];
    for (const [t, p] of table) if (s >= t) return p;
    return '5th';
  }
  const baselinePct = isACT ? actPct(baseline) : compositePct(baseline);
  const rwPct       = isACT ? actPct(actEnglish) : pct(rwCur);
  const mathPct     = isACT ? actPct(actMath)    : pct(mathCur);

  let testMonthYear = 'Target Date';
  let testMonth     = 'Target';
  if (targetTestDate) {
    const d = new Date(targetTestDate + 'T12:00:00');
    testMonthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    testMonth     = d.toLocaleDateString('en-US', { month: 'long' });
  }
  const testLabel = isACT ? 'ACT' : ((testType === 'PSAT' || testType === 'PSAT/NMSQT' || testType === 'PSAT 10') ? 'PSAT' : (testType || 'SAT'));
  const baselineLabel = testLabel;

  const progRows = gamePlan.scoreProgression?.rows || [];
  const lastRow  = progRows[progRows.length - 1] || {};
  // For ACT: rwTargetStr = target composite string; mathTargetStr unused
  const rwTargetStr   = isACT
    ? (lastRow.total ? `${lastRow.total}+` : `${target}+`)
    : (lastRow.rw   || `${Math.round(target * 0.47)}+`);
  const mathTargetStr = isACT ? '' : (lastRow.math || `${Math.round(target * 0.53)}+`);

  const phases = gamePlan.phases || [];
  const parsedPhases = phases.map(ph => {
    const hMatch  = (ph.title || '').match(/(\d+)\s*(?:hours?|hrs?)/i);
    const wkMatch = (ph.title || '').match(/[Ww]eeks?\s*(\d+)\s*[–\-]\s*(\d+)/i);
    const hours   = hMatch ? parseInt(hMatch[1]) : 0;
    const wkStart = wkMatch ? parseInt(wkMatch[1]) : null;
    const wkEnd   = wkMatch ? parseInt(wkMatch[2]) : wkStart;

    // Season is only set when the phase title/description explicitly says so.
    // We never infer it from generic words — that causes false positives.
    const seasonTxt = ((ph.title || '') + ' ' + (ph.description || '')).toLowerCase();
    let season = null;
    if (seasonTxt.includes('summer')) season = 'Summer';
    else if (seasonTxt.includes('school year')) season = 'School Year';
    else if (seasonTxt.includes('final sprint')) season = 'Final Sprint';

    const namePart  = ph.title?.split(/[—–|·]/)[1]?.trim() || ph.title?.split(/[Pp]hase\s*\d+/)[1]?.trim() || ph.title || '';
    const rawName   = namePart.replace(/\s*\(.*$/, '').trim().replace(/^[:\s–—·]+/, '').trim();
    const shortName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    const rawDesc  = ph.description || '';
    const sents    = rawDesc.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
    let shortDesc  = sents[0] || '';
    if (shortDesc.length > 90) {
      const cut = shortDesc.lastIndexOf(' ', 90);
      shortDesc = cut > 20 ? shortDesc.slice(0, cut) : shortDesc.slice(0, 90);
    }
    if (shortDesc.length > 0) shortDesc = shortDesc.charAt(0).toUpperCase() + shortDesc.slice(1);

    return { ...ph, hours, wkStart, wkEnd, season, shortName, shortDesc };
  });

  const phaseCount  = parsedPhases.length;
  const phaseHrsSum = parsedPhases.reduce((s, ph) => s + ph.hours, 0);
  const totalHrs    = phaseHrsSum > 0 ? phaseHrsSum : (parseInt(totalHours) || 20);

  // Reserve ~12% of total hours for strategy/practice tests (min 2 hrs)
  const stratReserve = Math.max(2, Math.round(totalHrs * 0.12));
  const instrHrs     = totalHrs - stratReserve;

  let rwH = 0, mathH = 0;

  // Primary: use weeklySchedule.breakdown (most accurate — explicitly labelled)
  const wkBreakdown = gamePlan?.weeklySchedule?.breakdown || [];
  if (wkBreakdown.length > 0) {
    let bRW = 0, bMath = 0;
    for (const item of wkBreakdown) {
      const txt = (item.activity || '').toLowerCase();
      const hrs = parseFloat(item.hours) || 0;
      const isRW = isACT
        ? ['english','reading','grammar','punctuation','humanities'].some(k => txt.includes(k))
        : ['r/w','reading','writing','verbal'].some(k => txt.includes(k));
      const isMath = isACT
        ? ['math','science','algebra','geometry','data'].some(k => txt.includes(k))
        : ['math','algebra','geometry','stem'].some(k => txt.includes(k));
      if (isRW && !isMath) bRW += hrs;
      else if (isMath && !isRW) bMath += hrs;
      // strategy/mixed items not counted toward instructional split
    }
    const bTotal = bRW + bMath;
    if (bTotal > 0) {
      rwH   = instrHrs * (bRW   / bTotal);
      mathH = instrHrs * (bMath / bTotal);
    }
  }

  // Fallback: phase keyword counting, scaled to instrHrs
  if (rwH === 0 && mathH === 0) {
    let rawRW = 0, rawMath = 0;
    parsedPhases.forEach(ph => {
      const txt = ((ph.title || '') + ' ' + (ph.description || '')).toLowerCase();
      let rwC, mathC;
      if (isACT) {
        rwC   = ['english','reading','grammar','punctuation','rhetoric','prose','humanities'].filter(k => txt.includes(k)).length;
        mathC = ['math','science','algebra','geometry','trig','data','research','conflicting'].filter(k => txt.includes(k)).length;
      } else {
        rwC   = ['r/w','reading','writing','sec','craft','structure','info','expression','eoi','conventions'].filter(k => txt.includes(k)).length;
        mathC = ['math','algebra','advanced','psda','geometry','trig','quadratic','function'].filter(k => txt.includes(k)).length;
      }
      if (rwC > mathC)      rawRW   += ph.hours;
      else if (mathC > rwC) rawMath += ph.hours;
      else { rawRW += ph.hours * 0.5; rawMath += ph.hours * 0.5; }
    });
    const phTotal = rawRW + rawMath;
    if (phTotal > 0) {
      rwH   = instrHrs * (rawRW   / phTotal);
      mathH = instrHrs * (rawMath / phTotal);
    } else {
      rwH = instrHrs * 0.5;
      mathH = instrHrs * 0.5;
    }
  }

  // Cap: neither section can exceed 75% of instructional hours
  const cap = instrHrs * 0.75;
  if (rwH > cap)   { mathH += rwH - cap;   rwH   = cap; }
  if (mathH > cap) { rwH   += mathH - cap; mathH = cap; }

  const rwAlloc      = Math.max(1, Math.round(rwH));
  const mathAlloc    = Math.max(1, Math.round(mathH));
  const stratH       = Math.max(1, totalHrs - rwAlloc - mathAlloc);
  const rwAllocPct   = Math.round((rwAlloc   / totalHrs) * 100);
  const mathAllocPct = Math.round((mathAlloc / totalHrs) * 100);
  const stratAllocPct = Math.max(0, 100 - rwAllocPct - mathAllocPct);

  // Only show when imbalance is both extreme (>70%) AND both sections meaningful (≥10%)
  const showTimeAlloc = Math.max(rwAllocPct, mathAllocPct) > 70
    && Math.min(rwAllocPct, mathAllocPct) >= 10;
  const hasSchoolYear = parsedPhases.some(ph => ph.season === 'School Year');
  const hasSummer     = parsedPhases.some(ph => ph.season === 'Summer' || ph.season === 'Final Sprint');
  // Only show Two Gears when the game plan explicitly marks phases as both
  // School Year and Summer/Final Sprint — never infer this from generic keywords
  const showTwoGears  = hasSchoolYear && hasSummer;
  const expandPhases  = phaseCount >= 5;

  const testRows = progRows.filter(r => {
    const m = (r.milestone || '').toLowerCase();
    return (m.includes('test') || m.includes('practice') || m.includes('t#') || m.includes('wk')) &&
      !m.includes('baseline') && !m.includes('current') && !m.includes('psat') &&
      !m.includes('target') && !m.includes('goal') && !m.includes('actual');
  });
  const testCount = testRows.length || 0;

  function parseFirstNum(str) {
    if (isACT) { const m = (str || '').match(/(\d{1,2})/); return m ? parseInt(m[1]) : null; }
    const m = (str || '').match(/(\d{3,4})/); return m ? parseInt(m[1]) : null;
  }
  const chartPoints = [{ label: baselineLabel, score: baseline, isBaseline: true }];
  if (testRows.length > 0) {
    // Only plot scores that are explicitly in the game plan's score progression
    testRows.forEach((r, i) => {
      const s = parseFirstNum(r.total);
      if (s !== null) chartPoints.push({ label: `T#${i + 1}`, score: s });
    });
  }
  // No interpolation — chart goes baseline → game-plan rows → target
  chartPoints.push({ label: testMonth, score: target, isTarget: true });

  const syPhases   = parsedPhases.filter(ph => ph.season === 'School Year');
  const sumPhases  = parsedPhases.filter(ph => ph.season === 'Summer' || ph.season === 'Final Sprint');
  const syHrs      = syPhases.reduce((s, ph) => s + ph.hours, 0);
  const sumHrs     = sumPhases.reduce((s, ph) => s + ph.hours, 0);
  const syWkStart  = syPhases[0]?.wkStart || 1;
  const syWkEnd    = syPhases[syPhases.length - 1]?.wkEnd || 8;
  const sumWkStart = sumPhases[0]?.wkStart || 9;
  const sumWkEnd   = sumPhases[sumPhases.length - 1]?.wkEnd || parseInt(weeks) || 18;

  // Domain priority data from game plan
  const domainPriority = gamePlan.domainPriority || [];
  const highPriorityCount = domainPriority.filter(d => (d.priority || '').toLowerCase() === 'high').length;

  let rwDomains, mathDomains, rwSectionLabel, mathSectionLabel;

  if (isACT) {
    // ACT: left col = English + Reading, right col = Math + Science
    rwSectionLabel   = 'English & Reading';
    mathSectionLabel = 'Math & Science';
    function findACTDomain(name) {
      const found = domainPriority.find(d => (d.domain || '').toLowerCase() === name.toLowerCase());
      return found || { domain: name, performance: 'N/A', target: 'N/A', priority: 'Low' };
    }
    rwDomains   = ['English', 'Reading'].map(findACTDomain);
    mathDomains = ['Math', 'Science'].map(findACTDomain);
  } else {
    rwSectionLabel   = 'Reading & Writing';
    mathSectionLabel = 'Math';
    const rwDomainNames   = ['Standard English Conventions', 'Information & Ideas', 'Craft & Structure', 'Expression of Ideas'];
    const mathDomainNames = ['Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', 'Geometry & Trigonometry'];
    function matchDomain(name) {
      const found = domainPriority.find(d => {
        const dn = (d.domain || '').toLowerCase();
        const nl = name.toLowerCase();
        if (dn === nl) return true;
        const words = nl.split(' ').filter(w => w.length > 4);
        if (words.length === 0) return dn.includes(nl);
        return words.every(w => dn.includes(w));
      });
      return { domain: name, performance: found?.performance || 'N/A', target: found?.target || 'N/A', priority: found?.priority || 'Low' };
    }
    rwDomains   = rwDomainNames.map(matchDomain);
    mathDomains = mathDomainNames.map(matchDomain);
  }

  const nameParts  = (studentName || '').split(' ');
  const firstName  = nameParts[0] || 'Student';
  const familyName = nameParts.slice(1).join(' ') || firstName;

  // School pills: use user's schools first; pad to 4-5 from score-band defaults when user has 1-3
  const userSchools = (targetColleges || '').trim()
    ? (targetColleges || '').split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const _schoolDefaults = {
    'STEM-tier':           ['MIT', 'Caltech', 'Carnegie Mellon', 'Georgia Tech', 'UCLA'],
    'Ivy-tier':            ['Harvard', 'Yale', 'Princeton', 'Columbia', 'Penn'],
    'elite-tier':          ['Stanford', 'UCLA', 'Northwestern', 'Vanderbilt', 'USC'],
    'T20-tier':            ['NYU', 'UCLA', 'Northeastern', 'Boston University', 'Tulane'],
    'strong-private-tier': ['University of Georgia', 'Penn State', 'Virginia Tech', 'Boston University', 'UT Austin'],
    'solid-tier':          ['Arizona State', 'University of Oregon', 'Temple', 'Drexel'],
  };
  const _defaultsForBand = (_schoolDefaults[scoreBand] || []);
  const _filteredDefaults = _defaultsForBand.filter(s => !userSchools.some(u => u.toLowerCase() === s.toLowerCase()));
  const competitiveSchools = [...userSchools, ..._filteredDefaults].slice(0, 5);

  // Weekly cadence derived from game plan's own hours + weeks — no invented data
  const planWeeks = parseInt(weeks) || 0;
  const weeklyCadence = (planWeeks > 0 && totalHrs > 0)
    ? `~${(totalHrs / planWeeks).toFixed(1)} hrs/week`
    : null;

  // ── Homework data ─────────────────────────────────────────────────────────
  const homeworkOverview = gamePlan.programOverview?.homework || '';
  const phaseHomework = (gamePlan.phases || []).map((ph, i) => {
    const firstWeek = (ph.weeks || [])[0] || {};
    const items = (firstWeek.homework || []).filter(h => h && h.trim()).slice(0, 3);
    return {
      shortName: parsedPhases[i]?.shortName || `Phase ${i + 1}`,
      items,
      color: PHASE_COLORS[i % PHASE_COLORS.length],
    };
  }).filter(ph => ph.items.length > 0);
  const showHomework = !!(homeworkOverview || phaseHomework.length > 0);

  let totalSlides = 11;
  if (showTimeAlloc) totalSlides++;
  if (showTwoGears)  totalSlides++;
  if (showHomework)  totalSlides++;

  return {
    firstName, familyName, studentName,
    isACT, testLabel,
    baseline, rwCur, mathCur, target,
    actEnglish, actMath, actReading, actScience,
    rwTargetStr, mathTargetStr,
    testType, testMonthYear, testMonth, baselineLabel,
    weeks: parseInt(weeks) || 0,
    totalHours: totalHrs,
    groupSessionHours: totalHrs,
    weakIsRW, weakSec, strongSec, weakScore, strongScore,
    weakLift, strongLift, totalLift,
    weakColor, strongColor, weakBg, strongBg,
    mathColor, rwColor, mathBg, rwBg,
    thesis, scoreBand, scoreBandDisplay, bottomLine,
    baselinePct, rwPct, mathPct,
    rwAlloc, mathAlloc, stratH, rwAllocPct, mathAllocPct, stratAllocPct,
    parsedPhases, phaseCount, expandPhases,
    showTimeAlloc, showTwoGears,
    rwSectionLabel, mathSectionLabel,
    syPhases, sumPhases, syHrs, sumHrs, syWkStart, syWkEnd, sumWkStart, sumWkEnd,
    testRows, testCount, chartPoints, progRows,
    rwDomains, mathDomains, highPriorityCount,
    cols: targetColleges || '',
    competitiveSchools,
    weeklyCadence,
    homeworkOverview, phaseHomework, showHomework,
    totalSlides,
  };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function donutSvg(rwPct, mathPct, stratPct, totalHrs, rwColor, mathColor) {
  const cx = 180, cy = 180, r = 110, sw = 50;
  const C  = 2 * Math.PI * r;
  // offset formula: -(C/4) shifts start to 12 o'clock; then cumulative arc offsets
  function arc(pct, cumPct, color) {
    const len  = (pct / 100) * C;
    const gap  = C - len;
    const off  = -(C / 4 + (cumPct / 100) * C);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
      stroke-dasharray="${len.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>`;
  }
  const a1 = arc(rwPct,              0,              rwColor);
  const a2 = arc(mathPct,            rwPct,          mathColor);
  const a3 = arc(stratPct,           rwPct + mathPct, '#C9942C');
  return `<svg width="360" height="360" viewBox="0 0 360 360">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="${sw}"/>
    ${a1}${a2}${a3}
    <circle cx="${cx}" cy="${cy}" r="${r - sw / 2 - 2}" fill="white"/>
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="40" font-weight="800" fill="#1B3A5C">${totalHrs}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="14" fill="#64748B">hrs total</text>
  </svg>`;
}

function lineChartSvg(chartPoints, baseline, target, isACT = false) {
  const W = 1700, H = 620;
  const axL = 90, axR = W - 40, axT = 40, axB = H - 70;
  const plotW = axR - axL, plotH = axB - axT;
  const n = chartPoints.length;

  const interval = isACT ? 2 : 50;
  const yMin = isACT
    ? Math.max(1,  Math.floor((baseline - 3) / 2) * 2)
    : Math.floor((baseline - 60) / 50) * 50;
  const yMax = isACT
    ? Math.min(36, Math.ceil((target + 4) / 2) * 2)
    : Math.ceil((target + 80) / 50) * 50;
  const ySpan = yMax - yMin;

  function xPos(i) { return axL + (plotW / Math.max(n - 1, 1)) * i; }
  function yPos(s) { return axT + plotH * (1 - (s - yMin) / ySpan); }

  const gridScores = [];
  for (let s = yMin; s <= yMax; s += interval) gridScores.push(s);

  const polyPts = chartPoints.map((p, i) => `${xPos(i).toFixed(1)},${yPos(p.score).toFixed(1)}`).join(' ');
  const tY = yPos(target);

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">`;

  // Grid
  gridScores.forEach(sc => {
    s += `<line x1="${axL}" y1="${yPos(sc).toFixed(1)}" x2="${axR}" y2="${yPos(sc).toFixed(1)}" stroke="#E5E7EB" stroke-width="1.5"/>`;
    s += `<text x="${axL - 10}" y="${(yPos(sc) + 5).toFixed(1)}" text-anchor="end" font-family="Inter,Helvetica Neue,sans-serif" font-size="16" fill="#64748B">${sc}</text>`;
  });

  // Target dashed line
  s += `<line x1="${axL}" y1="${tY.toFixed(1)}" x2="${axR}" y2="${tY.toFixed(1)}" stroke="#1F7A50" stroke-width="2.5" stroke-dasharray="10,6"/>`;
  s += `<text x="${(axL + 12).toFixed(1)}" y="${(tY - 10).toFixed(1)}" font-family="Inter,Helvetica Neue,sans-serif" font-size="18" font-weight="700" fill="#1F7A50">${target} TARGET</text>`;

  // Data line
  s += `<polyline points="${polyPts}" fill="none" stroke="#1B3A5C" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;

  // X-axis
  s += `<line x1="${axL}" y1="${axB}" x2="${axR}" y2="${axB}" stroke="#E5E7EB" stroke-width="1.5"/>`;

  // Points + labels
  chartPoints.forEach((p, i) => {
    const x = xPos(i).toFixed(1), y = yPos(p.score).toFixed(1);
    if (p.isTarget) {
      s += `<circle cx="${x}" cy="${y}" r="15" fill="#1F7A50"/>`;
      s += `<circle cx="${x}" cy="${y}" r="5" fill="white"/>`;
      s += `<text x="${x}" y="${(parseFloat(y) - 24).toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="18" font-weight="700" fill="#1F7A50">${p.score}+</text>`;
    } else {
      s += `<circle cx="${x}" cy="${y}" r="9" fill="white" stroke="#1B3A5C" stroke-width="3"/>`;
      const labelYAbove = parseFloat(y) - 18;
      const tooCloseToTarget = Math.abs(labelYAbove - tY) < 22;
      const labelY = tooCloseToTarget ? parseFloat(y) + 36 : labelYAbove;
      s += `<text x="${x}" y="${labelY.toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="18" font-weight="700" fill="#1B3A5C">${p.score}</text>`;
    }
    s += `<text x="${x}" y="${(axB + 22).toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="16" fill="#64748B">${p.label}</text>`;
  });

  s += `</svg>`;
  return s;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function brandBar(firstName, category, testLabel = 'SAT') {
  return `<div style="height:60px;background:linear-gradient(135deg,#1B3A5C 0%,#0F2540 100%);color:white;padding:0 80px;
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
    font-family:'Inter',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
    <span style="font-weight:800;">STUDYCORE</span>
    <span style="font-weight:500;opacity:0.9;">${esc(firstName)}'s ${esc(testLabel)} Game Plan | Demo Presentation</span>
    <span>${esc(category)}</span>
  </div>`;
}

function slideFooter(n, total, testLabel = 'SAT') {
  return `<div style="position:absolute;bottom:0;left:0;right:0;height:40px;padding:0 80px;
    display:flex;align-items:center;justify-content:space-between;
    border-top:1px solid #E2E8F0;font-family:'Inter',sans-serif;
    font-size:12px;font-weight:500;color:#64748B;letter-spacing:0.05em;">
    <span>StudyCore ${esc(testLabel)} Prep — Confidential</span>
    <span>Slide ${n} of ${total}</span>
  </div>`;
}

function monogramWatermark() {
  return `<div style="position:absolute;bottom:56px;right:56px;pointer-events:none;z-index:0;">
    <svg width="24" height="24" viewBox="0 0 24 24"><text x="12" y="19" text-anchor="middle" font-family="Georgia,serif" font-size="18" font-weight="700" fill="rgba(15,36,64,0.06)">S</text></svg>
  </div>`;
}

function slideHeader(eyebrow, title) {
  return `<div style="font-size:14px;font-weight:700;color:#1A8870;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;font-family:'Inter',sans-serif;">${esc(eyebrow)}</div>
  <div style="font-size:56px;font-weight:800;color:#1B3A5C;letter-spacing:-0.02em;line-height:1.08;font-family:'Inter',sans-serif;">${esc(title)}</div>
  <div style="display:flex;align-items:center;gap:0;margin-top:14px;margin-bottom:36px;">
    <div style="width:80px;height:3px;background:#B84A2E;border-radius:2px;"></div>
    <div style="width:40px;height:2px;background:#B84A2E;opacity:0.3;border-radius:2px;"></div>
  </div>`;
}

function callout(variant, tagline, sub) {
  const variants = {
    gray:        { bg: '#F3F4F6', border: '', color: '#1B3A5C', subColor: '#475569' },
    'navy-tint': { bg: '#E8EEF7', border: '', color: '#1B3A5C', subColor: '#475569' },
    teal:        { bg: '#D5EDE6', border: 'border-left:6px solid #1A8870;', color: '#1B3A5C', subColor: '#475569' },
    green:       { bg: '#DCEDE2', border: 'border-left:6px solid #1F7A50;', color: '#1B3A5C', subColor: '#475569' },
    gold:        { bg: '#FAEFD4', border: '', color: '#1B3A5C', subColor: '#475569' },
    navy:        { bg: '#1B3A5C', border: '', color: 'white', subColor: 'rgba(255,255,255,0.75)' },
  };
  const v = variants[variant] || variants.gray;
  return `<div style="background:${v.bg};border-radius:12px;padding:22px 32px;margin-top:24px;${v.border}">
    <div style="font-size:20px;font-weight:700;color:${v.color};font-family:'Inter',sans-serif;">${tagline}</div>
    ${sub ? `<div style="font-size:15px;color:${v.subColor};margin-top:6px;font-family:'Inter',sans-serif;">${sub}</div>` : ''}
  </div>`;
}

function domainPill(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'high')   return `<span style="background:#B84A2E;color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">HIGH</span>`;
  if (p === 'medium' || p === 'med') return `<span style="background:#C9942C;color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">MED</span>`;
  if (p === 'protect') return `<span style="background:#1F7A50;color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">PROTECT</span>`;
  return `<span style="border:1px solid #64748B;color:#64748B;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">LOW</span>`;
}

// ── SLIDES ────────────────────────────────────────────────────────────────────

function slide1Cover(d, n) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:row;position:relative;overflow:hidden;page-break-after:always;">
    <!-- Left navy panel -->
    <div style="width:640px;flex-shrink:0;background:#1B3A5C;padding:72px 64px;display:flex;flex-direction:column;position:relative;">
      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:0.18em;text-transform:uppercase;margin-bottom:48px;font-family:'Inter',sans-serif;">
        STUDYCORE | GAME PLAN
      </div>
      <div style="font-size:58px;font-weight:800;color:white;line-height:1.1;letter-spacing:-0.02em;margin-bottom:20px;font-family:'Inter',sans-serif;">
        ${esc(d.firstName)}'s<br>${esc(d.testLabel)} Game Plan
      </div>
      <div style="font-size:19px;font-style:italic;color:rgba(184,200,216,0.9);line-height:1.45;margin-bottom:auto;font-family:'Inter',sans-serif;">
        "${esc(d.thesis)}"
      </div>
      <div style="margin-top:48px;">
        <div style="font-size:10px;font-weight:700;color:#B84A2E;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PREPARED FOR</div>
        <div style="font-size:22px;font-weight:700;color:white;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(d.familyName)} &amp; Family</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.45);font-family:'Inter',sans-serif;">Plan Created: ${esc(today)} | Target: ${esc(d.testMonthYear)} ${esc(d.testLabel)}</div>
      </div>
    </div>
    <!-- Coral divider -->
    <div style="width:4px;background:#B84A2E;flex-shrink:0;"></div>
    <!-- Right panel -->
    <div style="flex:1;padding:64px 72px;display:flex;flex-direction:column;justify-content:center;background:#F8FAFC;background-image:radial-gradient(circle,#CBD5E1 1px,transparent 1px);background-size:40px 40px;">
      <div style="font-size:13px;font-weight:700;color:#1A8870;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:18px;font-family:'Inter',sans-serif;">THE CLIMB</div>
      <!-- Score display -->
      <div style="display:flex;align-items:center;gap:28px;margin-bottom:18px;">
        <div>
          <div style="font-size:128px;font-weight:800;color:#1B3A5C;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;">${d.baseline}</div>
          <div style="font-size:20px;font-weight:700;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${esc(d.baselineLabel)} · No prep · ${d.baselinePct} %ile</div>
        </div>
        <div style="display:flex;align-items:center;padding:0 4px;"><svg width="60" height="44" viewBox="0 0 60 44"><line x1="4" y1="22" x2="46" y2="22" stroke="#B84A2E" stroke-width="5" stroke-linecap="round"/><polyline points="34,8 50,22 34,36" fill="none" stroke="#B84A2E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div>
          <div style="font-size:128px;font-weight:800;color:#1F7A50;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;">${d.target}+</div>
          <div style="font-size:16px;font-weight:500;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${esc(d.testMonthYear)} ${esc(d.testLabel)} · ${esc(d.scoreBandDisplay)}</div>
        </div>
      </div>
      <!-- Divider -->
      <div style="height:1px;background:#E5E7EB;margin-bottom:20px;"></div>
      <!-- Three stat cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;">
        <div style="background:#F3F4F6;border-radius:14px;padding:22px 18px;border-left:6px solid #1B3A5C;">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">TOTAL LIFT</div>
          <div style="font-size:52px;font-weight:800;color:#1B3A5C;line-height:1;font-family:'Inter',sans-serif;">+${d.totalLift}</div>
          <div style="font-size:16px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${d.baseline} <svg width="16" height="12" viewBox="0 0 16 12" style="display:inline-block;vertical-align:middle;"><line x1="1" y1="6" x2="12" y2="6" stroke="#64748B" stroke-width="1.5" stroke-linecap="round"/><polyline points="8,2 13,6 8,10" fill="none" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${d.target}+</div>
        </div>
        <div style="background:#F3F4F6;border-radius:14px;padding:22px 18px;border-left:6px solid ${d.weakColor};">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(d.weakSec)} GAP</div>
          <div style="font-size:52px;font-weight:800;color:${d.weakColor};line-height:1;font-family:'Inter',sans-serif;">+${d.weakLift}</div>
          <div style="font-size:16px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${d.weakScore} <svg width="16" height="12" viewBox="0 0 16 12" style="display:inline-block;vertical-align:middle;"><line x1="1" y1="6" x2="12" y2="6" stroke="#64748B" stroke-width="1.5" stroke-linecap="round"/><polyline points="8,2 13,6 8,10" fill="none" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${esc(d.isACT ? d.rwTargetStr : (d.weakIsRW ? d.rwTargetStr : d.mathTargetStr))} (the climb)</div>
        </div>
        <div style="background:#F3F4F6;border-radius:14px;padding:22px 18px;border-left:6px solid ${d.strongColor};">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(d.strongSec)} POLISH</div>
          <div style="font-size:52px;font-weight:800;color:${d.strongColor};line-height:1;font-family:'Inter',sans-serif;">+${d.strongLift}</div>
          <div style="font-size:16px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${d.strongScore} <svg width="16" height="12" viewBox="0 0 16 12" style="display:inline-block;vertical-align:middle;"><line x1="1" y1="6" x2="12" y2="6" stroke="#64748B" stroke-width="1.5" stroke-linecap="round"/><polyline points="8,2 13,6 8,10" fill="none" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${esc(d.isACT ? d.rwTargetStr : (d.weakIsRW ? d.mathTargetStr : d.rwTargetStr))} (already strong)</div>
        </div>
      </div>
      <!-- Bottom callout -->
      <div style="background:linear-gradient(135deg,#1B3A5C,#263F5C);border-radius:12px;padding:18px 28px;">
        <div style="font-size:17px;font-weight:700;color:white;font-family:'Inter',sans-serif;">
          ${d.weeks} WEEKS · ${d.totalHours} PRIVATE HRS · ${d.groupSessionHours} GROUP SESSION HRS · ${d.phaseCount} PHASES · ${d.testCount} PRACTICE TESTS
        </div>
        <div style="font-size:17px;font-weight:600;color:rgba(255,255,255,0.9);margin-top:5px;font-family:'Inter',sans-serif;">
          Built around the ${esc(d.testMonth)} ${esc(d.testLabel)} — designed to lift ${esc(d.weakSec)} and protect ${esc(d.strongSec)}.
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide2StandingACT(d, n) {
  function sectionCard(label, score, color, bg) {
    const read = score >= 30 ? 'At the ceiling' : score >= 27 ? 'Strong — nearly there' : score >= 24 ? 'Solid foundation' : score >= 20 ? 'Room to grow' : 'Most to gain';
    return `<div style="background:linear-gradient(145deg,${bg},white);border-radius:12px;padding:28px 32px;border-left:8px solid ${color};">
      <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(label)}</div>
      <div style="font-size:80px;font-weight:800;color:${color};line-height:1;letter-spacing:-0.02em;font-family:'Inter',sans-serif;">${score}<span style="font-size:28px;font-weight:500;color:#94A3B8;margin-left:6px;">/36</span></div>
      <div style="font-size:15px;font-weight:500;color:#334155;margin-top:6px;font-family:'Inter',sans-serif;">${read}</div>
    </div>`;
  }
  const sectionColors = ['#1B3A5C','#B84A2E','#1F7A50','#C9942C'];
  const sectionBgs    = ['#E8EEF7','#FBE5DD','#DCEDE2','#FAEFD4'];
  const sections = [
    { label: 'English',  score: d.actEnglish  },
    { label: 'Math',     score: d.actMath     },
    { label: 'Reading',  score: d.actReading  },
    { label: 'Science',  score: d.actScience  },
  ];

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'STARTING POINT', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader(`WHERE ${esc(d.firstName.toUpperCase())} STANDS TODAY`, `ACT Composite: ${d.baseline}. With zero structured prep.`)}
      <div style="flex:1;display:flex;gap:32px;align-items:center;">
        <!-- Hero composite -->
        <div style="width:320px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
          <div style="position:relative;width:260px;height:260px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:260px;height:260px;border-radius:50%;border:3px solid #E5E7EB;opacity:0.6;"></div>
            <div style="position:absolute;width:220px;height:220px;border-radius:50%;border:2px solid #F1F5F9;opacity:0.8;"></div>
            <div style="font-size:120px;font-weight:800;color:#1B3A5C;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;position:relative;">${d.baseline}</div>
          </div>
          <div style="font-size:17px;color:#64748B;margin-top:12px;font-family:'Inter',sans-serif;">ACT Composite · No structured prep</div>
          <div style="font-size:15px;font-weight:700;color:#B84A2E;margin-top:8px;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">${d.baselinePct} Percentile Nationally</div>
          <div style="background:linear-gradient(135deg,#1B3A5C,#263F5C);border-radius:12px;padding:16px 24px;margin-top:24px;width:100%;">
            <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">TARGET COMPOSITE</div>
            <div style="font-size:48px;font-weight:800;color:#1F7A50;line-height:1;font-family:'Inter',sans-serif;">${d.target}+</div>
          </div>
        </div>
        <!-- 4 section cards -->
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          ${sections.map((s, i) => sectionCard(s.label, s.score, sectionColors[i], sectionBgs[i])).join('')}
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide2Standing(d, n) {
  if (d.isACT) return slide2StandingACT(d, n);
  const rwRead  = d.rwCur  >= 700 ? 'At the ceiling' : d.rwCur  >= 650 ? 'Strong — nearly there' : d.rwCur  >= 600 ? 'Solid foundation' : d.rwCur  >= 550 ? 'Room to grow' : 'Most to gain';
  const mRead   = d.mathCur >= 700 ? 'At the ceiling' : d.mathCur >= 650 ? 'Strong — nearly there' : d.mathCur >= 600 ? 'Solid foundation' : d.mathCur >= 550 ? 'Room to grow' : 'Most to gain';
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'STARTING POINT', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader(`WHERE ${esc(d.firstName.toUpperCase())} STANDS TODAY`, `${d.baseline}. With zero structured prep.`)}
      <!-- Hero number -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;">
        <div style="position:absolute;width:400px;height:400px;border-radius:50%;border:3px solid #E5E7EB;opacity:0.6;"></div>
        <div style="position:absolute;width:500px;height:500px;border-radius:50%;border:2px solid #F1F5F9;opacity:0.8;"></div>
        <div style="font-size:160px;font-weight:800;color:#1B3A5C;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;position:relative;">${d.baseline}</div>
        <div style="font-size:18px;color:#64748B;margin-top:12px;font-family:'Inter',sans-serif;">${esc(d.baselineLabel)} · No structured prep</div>
        <div style="font-size:15px;font-weight:700;color:#B84A2E;margin-top:8px;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">${d.baselinePct} PERCENTILE NATIONALLY</div>
      </div>
      <!-- Two score cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="background:linear-gradient(145deg,${d.mathBg},white);border-radius:12px;padding:32px 40px;border-left:8px solid ${d.mathColor};">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">MATH</div>
          <div style="font-size:96px;font-weight:800;color:${d.mathColor};line-height:1;letter-spacing:-0.02em;font-family:'Inter',sans-serif;">${d.mathCur}</div>
          <div style="font-size:16px;font-weight:500;color:#334155;margin-top:8px;font-family:'Inter',sans-serif;">${d.mathPct} percentile · ${mRead}</div>
        </div>
        <div style="background:linear-gradient(145deg,${d.rwBg},white);border-radius:12px;padding:32px 40px;border-left:8px solid ${d.rwColor};">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">READING &amp; WRITING</div>
          <div style="font-size:96px;font-weight:800;color:${d.rwColor};line-height:1;letter-spacing:-0.02em;font-family:'Inter',sans-serif;">${d.rwCur}</div>
          <div style="font-size:16px;font-weight:500;color:#334155;margin-top:8px;font-family:'Inter',sans-serif;">${d.rwPct} percentile · ${rwRead}</div>
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide3DiagnosisACT(d, n) {
  // 4 ACT sections, each 1–36
  const pct36 = s => Math.min(100, Math.round((s / 36) * 100));
  const sectionColors = ['#1B3A5C','#B84A2E','#1F7A50','#C9942C'];
  const sections = [
    { label: 'English',  score: d.actEnglish,  color: sectionColors[0] },
    { label: 'Math',     score: d.actMath,     color: sectionColors[1] },
    { label: 'Reading',  score: d.actReading,  color: sectionColors[2] },
    { label: 'Science',  score: d.actScience,  color: sectionColors[3] },
  ];

  // Get target per section from domainPriority
  const domainMap = {};
  (d.rwDomains || []).concat(d.mathDomains || []).forEach(dom => {
    domainMap[(dom.domain || '').toLowerCase()] = dom;
  });
  function getTarget(name) {
    const dom = domainMap[name.toLowerCase()];
    if (!dom || dom.target === 'N/A') return null;
    const m = (dom.target || '').match(/(\d{1,2})/);
    return m ? parseInt(m[1]) : null;
  }

  function sectionBar(sec) {
    const fill    = pct36(sec.score);
    const tNum    = getTarget(sec.label);
    const tPct    = tNum ? pct36(tNum) : null;
    const tStr    = tNum ? `${tNum}/36` : null;
    return `<div style="padding-top:20px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px;">
        <div>
          <span style="font-size:20px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">${esc(sec.label.toUpperCase())}</span>
          <span style="font-size:15px;font-weight:500;color:#64748B;margin-left:10px;font-family:'Inter',sans-serif;">${sec.score}/36</span>
        </div>
        ${tStr ? `<div style="font-size:18px;font-weight:700;color:${sec.color};font-family:'Inter',sans-serif;">Target: ${tStr}</div>` : ''}
      </div>
      <div style="height:72px;background:#E5E7EB;border-radius:10px;position:relative;overflow:visible;">
        <div style="width:${fill}%;height:100%;background:${sec.color};border-radius:10px;display:flex;align-items:center;padding-left:16px;">
          <span style="font-size:26px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${sec.score}</span>
        </div>
        ${tPct && tStr ? `
          <div style="position:absolute;top:0;left:${tPct}%;height:100%;display:flex;align-items:center;">
            <div style="width:3px;height:100%;background:${sec.color};opacity:0.6;"></div>
          </div>
          <div style="position:absolute;top:-30px;left:${tPct}%;transform:translateX(-50%);">
            <span style="background:${sec.color};color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;font-family:'Inter',sans-serif;white-space:nowrap;">${tStr}</span>
          </div>` : ''}
        <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:13px;font-weight:600;color:#94A3B8;font-family:'Inter',sans-serif;">36</div>
      </div>
    </div>`;
  }

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'DIAGNOSIS', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('THE OPPORTUNITY', d.thesis)}
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:40px 72px;align-content:center;margin-bottom:16px;">
        ${sections.map(sectionBar).join('')}
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide3Diagnosis(d, n) {
  if (d.isACT) return slide3DiagnosisACT(d, n);
  // Each section is scored 0–800; use 800 as the bar max for true proportions
  const pct = score => Math.min(100, Math.round((score / 800) * 100));
  const mathFill = pct(d.mathCur);
  const rwFill   = pct(d.rwCur);

  // Parse first number from target strings (e.g. "710–740" → 710) for target marker
  const parseFirst = str => parseInt((str || '').match(/\d+/)?.[0]) || 0;
  const mathTargetPct = pct(parseFirst(d.mathTargetStr));
  const rwTargetPct   = pct(parseFirst(d.rwTargetStr));

  // Target marker: vertical line + label, positioned absolutely on the bar
  function targetMarker(targetPct, targetStr, color) {
    return `<div style="position:absolute;top:0;left:${targetPct}%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div style="width:3px;height:100%;background:${color};opacity:0.6;"></div>
    </div>
    <div style="position:absolute;top:-34px;left:${targetPct}%;transform:translateX(-50%);">
      <span style="background:${color};color:white;font-size:13px;font-weight:700;padding:4px 10px;border-radius:5px;font-family:'Inter',sans-serif;white-space:nowrap;letter-spacing:0.02em;">${esc(targetStr)}</span>
    </div>`;
  }

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'DIAGNOSIS', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('THE OPPORTUNITY', d.thesis)}
      <!-- Visual bars -->
      <div style="flex:1;display:flex;flex-direction:column;gap:48px;justify-content:center;margin-bottom:24px;margin-top:16px;">
        <!-- Math bar -->
        <div style="padding-top:32px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:32px;">
            <div>
              <span style="font-size:22px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">MATH</span>
              <span style="font-size:16px;font-weight:500;color:#64748B;margin-left:10px;font-family:'Inter',sans-serif;">${d.mathPct} percentile · ${d.weakIsRW ? 'The foundation' : 'The gap'}</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:${d.mathColor};font-family:'Inter',sans-serif;">Target: ${esc(d.mathTargetStr)}</div>
          </div>
          <div style="height:96px;background:#E5E7EB;border-radius:10px;position:relative;overflow:visible;">
            <div style="width:${mathFill}%;height:100%;background:${d.mathColor};border-radius:10px;display:flex;align-items:center;padding-left:20px;">
              <span style="font-size:30px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${d.mathCur}</span>
            </div>
            ${targetMarker(mathTargetPct, d.mathTargetStr, d.mathColor)}
            <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:14px;font-weight:600;color:#94A3B8;font-family:'Inter',sans-serif;">800</div>
          </div>
        </div>
        <!-- R/W bar -->
        <div style="padding-top:32px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:32px;">
            <div>
              <span style="font-size:22px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">READING &amp; WRITING</span>
              <span style="font-size:16px;font-weight:500;color:#64748B;margin-left:10px;font-family:'Inter',sans-serif;">${d.rwPct} percentile · ${d.weakIsRW ? 'The gap' : 'The foundation'}</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:${d.rwColor};font-family:'Inter',sans-serif;">${d.weakIsRW ? `+${d.weakLift} to close` : `Target: ${esc(d.rwTargetStr)}`}</div>
          </div>
          <div style="height:96px;background:#E5E7EB;border-radius:10px;position:relative;overflow:visible;">
            <div style="width:${rwFill}%;height:100%;background:${d.rwColor};border-radius:10px;display:flex;align-items:center;padding-left:20px;">
              <span style="font-size:30px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${d.rwCur}</span>
            </div>
            ${targetMarker(rwTargetPct, d.rwTargetStr, d.rwColor)}
            <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:14px;font-weight:600;color:#94A3B8;font-family:'Inter',sans-serif;">800</div>
          </div>
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide4Domains(d, n) {
  function domainRow(dom, isLast) {
    const arrowColor = (dom.priority || '').toLowerCase() === 'high' ? '#B84A2E'
      : (dom.priority || '').toLowerCase() === 'protect' ? '#1F7A50' : '#C9942C';
    return `<div style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:0 28px;${isLast ? '' : 'border-bottom:1px solid #E5E7EB;'}">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">${esc(dom.domain)}</span>
          ${domainPill(dom.priority)}
        </div>
        <div style="font-size:17px;font-weight:500;color:#64748B;font-style:italic;margin-top:3px;font-family:'Inter',sans-serif;">${esc(dom.performance)}</div>
      </div>
      <div style="font-size:16px;font-weight:700;color:${arrowColor};margin-left:16px;font-family:'Inter',sans-serif;">Goal: ${esc(dom.target)}</div>
    </div>`;
  }
  const rwRows   = d.rwDomains.map((dom, i) => domainRow(dom, i === d.rwDomains.length - 1)).join('');
  const mathRows = d.mathDomains.map((dom, i) => domainRow(dom, i === d.mathDomains.length - 1)).join('');

  const domainCount = d.rwDomains.length + d.mathDomains.length;
  const slideSubtitle = d.isACT
    ? `4 sections. ${d.highPriorityCount} drive the climb.`
    : `8 domains. ${d.highPriorityCount} drive the climb.`;
  const rwCurDisplay   = d.isACT ? `${d.actEnglish}/36 · ${d.actReading}/36` : String(d.rwCur);
  const mathCurDisplay = d.isACT ? `${d.actMath}/36 · ${d.actScience}/36`    : String(d.mathCur);
  const rwTargetDisplay   = d.isACT ? `Composite ${d.rwTargetStr}` : esc(d.rwTargetStr);
  const mathTargetDisplay = d.isACT ? ''                            : `Target: ${esc(d.mathTargetStr)}`;

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'DOMAIN BREAKDOWN', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('WHERE THE POINTS LIVE', slideSubtitle)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex:1;margin-bottom:24px;">
        <!-- Left column -->
        <div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;display:flex;flex-direction:column;">
          <div style="background:${d.rwColor};padding:24px 28px;flex-shrink:0;">
            <div style="font-size:17px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${esc(d.rwSectionLabel)}</div>
            <div style="font-size:16px;color:rgba(255,255,255,0.85);margin-top:4px;font-family:'Inter',sans-serif;">Current: ${rwCurDisplay}${d.isACT ? '' : ` | Target: ${rwTargetDisplay}`}</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">${rwRows}</div>
        </div>
        <!-- Right column -->
        <div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;display:flex;flex-direction:column;">
          <div style="background:${d.mathColor};padding:24px 28px;flex-shrink:0;">
            <div style="font-size:17px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${esc(d.mathSectionLabel)}</div>
            <div style="font-size:16px;color:rgba(255,255,255,0.85);margin-top:4px;font-family:'Inter',sans-serif;">Current: ${mathCurDisplay}${mathTargetDisplay ? ` | Target: ${mathTargetDisplay}` : ''}</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">${mathRows}</div>
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide5Scholarships(d, n) {
  // ── Scholarship database (merit aid ranges, approximate) ──────────────────
  const _schDb = {
    'University of Georgia':  { annual: '$8,000–$26,000',  program: 'HOPE / Zell Miller Scholarship' },
    'Penn State':             { annual: '$4,000–$18,000',  program: 'Schreyer Honors Program' },
    'Virginia Tech':          { annual: '$4,000–$20,000',  program: 'University Scholars Program' },
    'Boston University':      { annual: '$12,000–$28,000', program: 'Presidential / Trustee Scholar' },
    'UT Austin':              { annual: '$5,000–$22,000',  program: 'Forty Acres / FRSP Scholars' },
    'NYU':                    { annual: '$15,000–$40,000', program: 'NYU Merit Award' },
    'Northeastern':           { annual: '$15,000–$27,000', program: "Dean's / Merit Scholarship" },
    'Tulane':                 { annual: '$17,500–$27,500', program: 'Distinguished Scholar Award' },
    'USC':                    { annual: '$16,000–$32,000', program: 'USC Merit Award' },
    'Fordham':                { annual: '$8,000–$24,000',  program: "Dean's Award" },
    'SMU':                    { annual: '$10,000–$28,000', program: 'University Merit Award' },
    'American University':    { annual: '$10,000–$24,000', program: "Dean's Award" },
    'Loyola':                 { annual: '$8,000–$18,000',  program: 'Presidential Scholar' },
    'DePaul':                 { annual: '$7,000–$16,000',  program: 'University Scholar' },
    'Arizona State':          { annual: '$5,000–$20,000',  program: 'New American University Scholarship' },
    'University of Oregon':   { annual: '$4,000–$12,000',  program: 'Presidential Scholarship' },
    'Temple':                 { annual: '$5,000–$15,000',  program: 'Diamond Scholar Program' },
    'Drexel':                 { annual: '$10,000–$24,000', program: 'A.J. Drexel Scholarship' },
    'Northwestern':           { annual: '$20,000–$55,000', program: 'Need-based financial aid' },
    'Vanderbilt':             { annual: '$20,000–$55,000', program: 'Cornelius Vanderbilt Scholar' },
    'UCLA':                   { annual: '$8,000–$25,000',  program: 'Regents Scholarship' },
    'Georgia Tech':           { annual: '$6,000–$18,000',  program: 'Presidential Fellowship' },
    'Carnegie Mellon':        { annual: '$15,000–$40,000', program: 'Merit & need-based award' },
    'Stanford':               { annual: '$25,000–$70,000', program: 'Stanford Financial Aid Initiative' },
    'Harvard':                { annual: '$25,000–$65,000', program: 'Harvard Financial Aid Initiative' },
    'Yale':                   { annual: '$25,000–$65,000', program: 'Yale Financial Aid' },
    'Princeton':              { annual: '$25,000–$70,000', program: 'Princeton Financial Aid' },
    'Columbia':               { annual: '$20,000–$60,000', program: 'Columbia Financial Aid' },
    'Penn':                   { annual: '$20,000–$55,000', program: 'Penn Financial Aid' },
    'MIT':                    { annual: '$25,000–$60,000', program: 'MIT Financial Aid' },
    'Caltech':                { annual: '$25,000–$55,000', program: 'Caltech Financial Aid' },
  };

  // ── Score-band fallback rows (when no target schools provided) ────────────
  const _bandFallback = {
    'STEM-tier':           [
      { school: 'Top STEM Universities',  annual: '$25,000–$60,000', program: 'Need-based & merit awards' },
      { school: 'State STEM Flagships',   annual: '$8,000–$22,000',  program: 'Presidential scholarships' },
      { school: 'Strong STEM Privates',   annual: '$15,000–$35,000', program: 'Merit aid programs' },
      { school: 'Honors College Programs',annual: '$10,000–$25,000', program: 'Honors merit scholarships' },
    ],
    'Ivy-tier': [
      { school: 'Ivy League Schools',     annual: '$25,000–$65,000', program: 'Exceptional financial aid' },
      { school: 'Near-Ivy Privates',      annual: '$20,000–$50,000', program: 'Merit & need-based aid' },
      { school: 'Elite Universities',     annual: '$18,000–$40,000', program: 'Presidential scholarships' },
      { school: 'Top-20 Programs',        annual: '$15,000–$35,000', program: "Dean's merit awards" },
    ],
    'elite-tier': [
      { school: 'Elite Private Schools',  annual: '$20,000–$50,000', program: 'Merit & need-based aid' },
      { school: 'Top-20 Universities',    annual: '$15,000–$35,000', program: "Dean's scholarships" },
      { school: 'State Flagship Honors',  annual: '$8,000–$22,000',  program: 'Honors scholarships' },
      { school: 'Competitive Privates',   annual: '$12,000–$28,000', program: 'Presidential merit awards' },
    ],
    'T20-tier': [
      { school: 'Top Private Universities',   annual: '$15,000–$30,000', program: 'Merit scholarships' },
      { school: 'Competitive State Schools',  annual: '$8,000–$20,000',  program: 'Presidential awards' },
      { school: 'Regional Private Schools',   annual: '$10,000–$25,000', program: "Dean's Awards" },
      { school: 'Honors Programs',            annual: '$7,000–$18,000',  program: 'Honors merit scholarships' },
    ],
    'strong-private-tier': [
      { school: 'Private Universities',   annual: '$10,000–$26,000', program: 'Presidential merit aid' },
      { school: 'State Flagships',        annual: '$6,000–$18,000',  program: 'Honors scholarships' },
      { school: 'Regional Private Schools',annual: '$8,000–$20,000', program: 'Merit awards' },
      { school: 'Liberal Arts Colleges',  annual: '$12,000–$24,000', program: 'Academic merit awards' },
    ],
    'solid-tier': [
      { school: 'Regional Universities',  annual: '$5,000–$16,000',  program: 'Merit scholarships' },
      { school: 'State Schools',          annual: '$4,000–$14,000',  program: 'Academic grants' },
      { school: 'Private Colleges',       annual: '$8,000–$20,000',  program: 'Presidential awards' },
      { school: 'Honors Programs',        annual: '$3,000–$10,000',  program: 'Honors merit awards' },
    ],
  };

  // ── Build display school list ─────────────────────────────────────────────
  function parseRange(str) {
    const nums = (str || '').replace(/[$,]/g, '').match(/\d+/g)?.map(Number) || [0];
    return { lo: nums[0] || 0, hi: nums[1] || nums[0] || 0 };
  }

  const matchedSchools = d.competitiveSchools.map(s => {
    const key = Object.keys(_schDb).find(k => k.toLowerCase() === s.toLowerCase());
    return key
      ? { school: s, annual: _schDb[key].annual, program: _schDb[key].program }
      : { school: s, annual: '$5,000–$25,000', program: 'Merit scholarship (varies by program)' };
  }).slice(0, 4);

  const usingFallback = matchedSchools.length === 0;
  const schools = usingFallback
    ? (_bandFallback[d.scoreBand] || _bandFallback['strong-private-tier']).slice(0, 4)
    : matchedSchools;

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const ranges  = schools.map(s => parseRange(s.annual));
  const aggLo   = Math.min(...ranges.map(r => r.lo));
  const aggHi   = Math.max(...ranges.map(r => r.hi));
  const yr4Lo   = (aggLo * 4).toLocaleString();
  const yr4Hi   = (aggHi * 4).toLocaleString();
  const heroLabel = usingFallback
    ? `FOR ${d.target}+ COMPOSITE SCORES`
    : 'ACROSS YOUR TARGET SCHOOLS';

  // ── School cards (always 4 in a row) ─────────────────────────────────────
  const cards = schools.map(s => {
    const { lo, hi } = parseRange(s.annual);
    const fourYr = `$${(lo * 4).toLocaleString()}–$${(hi * 4).toLocaleString()}`;
    return `<div style="background:white;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 2px 20px rgba(0,0,0,0.07);border:1px solid #E2E8F0;">
      <div style="background:linear-gradient(135deg,#1A8870,#1F7A50);padding:24px 28px;flex-shrink:0;">
        <div style="font-size:16px;font-weight:700;color:white;line-height:1.3;font-family:'Inter',sans-serif;">${esc(s.school)}</div>
        <div style="font-size:17px;font-weight:600;color:rgba(255,255,255,0.9);margin-top:5px;font-family:'Inter',sans-serif;">${esc(s.program)}</div>
      </div>
      <div style="flex:1;padding:28px 32px;display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:0.14em;text-transform:uppercase;font-family:'Inter',sans-serif;margin-bottom:10px;">PER YEAR</div>
          <div style="font-size:46px;font-weight:800;color:#1B3A5C;line-height:1;font-family:'Inter',sans-serif;">${esc(s.annual)}</div>
        </div>
        <div style="border-top:1px solid #E5E7EB;padding-top:18px;margin-top:18px;">
          <div style="font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:0.14em;text-transform:uppercase;font-family:'Inter',sans-serif;margin-bottom:6px;">4-YEAR SAVINGS</div>
          <div style="font-size:26px;font-weight:800;color:#1A8870;font-family:'Inter',sans-serif;">${fourYr}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'SCHOLARSHIPS', d.testLabel)}
    <div style="flex:1;padding:48px 80px 72px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('WHAT THE SCORE UNLOCKS FINANCIALLY', `${d.target}+ opens merit scholarships — on top of admissions.`)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px;">
        <!-- Hero stat banner -->
        <div style="background:linear-gradient(135deg,#1B3A5C 0%,#263F5C 100%);border-radius:16px;padding:30px 52px;display:flex;align-items:center;gap:0;flex-shrink:0;">
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.16em;text-transform:uppercase;margin-bottom:10px;font-family:'Inter',sans-serif;">MERIT AID RANGE — ${heroLabel}</div>
            <div style="display:flex;align-items:baseline;gap:14px;">
              <div style="font-size:52px;font-weight:800;color:#5EC9B0;line-height:1;font-family:'Inter',sans-serif;">$${aggLo.toLocaleString()}–$${aggHi.toLocaleString()}</div>
              <div style="font-size:20px;font-weight:500;color:rgba(255,255,255,0.4);font-family:'Inter',sans-serif;">/ year</div>
            </div>
          </div>
          <div style="width:1px;height:52px;background:rgba(255,255,255,0.12);margin:0 52px;flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.16em;text-transform:uppercase;margin-bottom:10px;font-family:'Inter',sans-serif;">TOTAL 4-YEAR OPPORTUNITY</div>
            <div style="font-size:52px;font-weight:800;color:#F4A98D;line-height:1;font-family:'Inter',sans-serif;">$${yr4Lo}–$${yr4Hi}</div>
          </div>
        </div>
        <!-- School cards: always 4 columns -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:20px;flex:1;">
          ${cards}
        </div>
        <div style="font-size:12px;color:#94A3B8;font-family:'Inter',sans-serif;text-align:right;flex-shrink:0;">Ranges are approximate and vary by academic year, GPA, and financial profile. Ivy &amp; elite figures reflect need-based aid packages.</div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide6Plan(d, n) {
  const cadenceRow = d.weeklyCadence
    ? `<div style="background:white;border-radius:14px;padding:22px 36px;border:1px solid #E2E8F0;box-shadow:0 2px 12px rgba(0,0,0,0.04);display:flex;align-items:center;gap:0;">
        <div style="flex:1;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">WEEKLY CADENCE</div>
          <div style="font-size:26px;font-weight:800;color:#1A8870;margin-top:4px;font-family:'Inter',sans-serif;">${esc(d.weeklyCadence)}</div>
        </div>
        <div style="width:1px;height:40px;background:#E5E7EB;"></div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">PROGRAM SPAN</div>
          <div style="font-size:26px;font-weight:800;color:#1B3A5C;margin-top:4px;font-family:'Inter',sans-serif;">${d.weeks} weeks total</div>
        </div>
        <div style="width:1px;height:40px;background:#E5E7EB;"></div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">TARGET DATE</div>
          <div style="font-size:26px;font-weight:800;color:#B84A2E;margin-top:4px;font-family:'Inter',sans-serif;">${esc(d.testMonthYear)} ${esc(d.testLabel)}</div>
        </div>
      </div>`
    : '';

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE PLAN', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader(`BUILT AROUND THE ${esc(d.testMonth.toUpperCase())} ${esc(d.testLabel)}`, `${d.weeks} weeks. ${d.totalHours} private hrs + ${d.groupSessionHours} group session hrs. ${d.phaseCount} phases.`)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:20px;height:380px;">
        <div style="background:linear-gradient(145deg,#1B3A5C,#233F5C);border-radius:16px;padding:28px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">WEEKS</div>
          <div style="font-size:80px;font-weight:800;color:white;line-height:1;font-family:'Inter',sans-serif;">${d.weeks}</div>
          <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:8px;font-family:'Inter',sans-serif;">program duration</div>
        </div>
        <div style="background:linear-gradient(145deg,#1B3A5C,#233F5C);border-radius:16px;padding:28px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PRIVATE HOURS</div>
          <div style="font-size:80px;font-weight:800;color:#5EC9B0;line-height:1;font-family:'Inter',sans-serif;">${d.totalHours}</div>
          <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:8px;font-family:'Inter',sans-serif;">1-on-1 instruction</div>
        </div>
        <div style="background:linear-gradient(145deg,#1B3A5C,#233F5C);border-radius:16px;padding:28px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">GROUP SESSIONS</div>
          <div style="font-size:80px;font-weight:800;color:#B8A4E8;line-height:1;font-family:'Inter',sans-serif;">${d.groupSessionHours}</div>
          <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:8px;font-family:'Inter',sans-serif;">hrs included</div>
        </div>
        <div style="background:linear-gradient(145deg,#1B3A5C,#233F5C);border-radius:16px;padding:28px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PHASES</div>
          <div style="font-size:80px;font-weight:800;color:#F4A98D;line-height:1;font-family:'Inter',sans-serif;">${d.phaseCount}</div>
          <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:8px;font-family:'Inter',sans-serif;">each with a clear job</div>
        </div>
        <div style="background:linear-gradient(145deg,#1B3A5C,#233F5C);border-radius:16px;padding:28px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PRACTICE TESTS</div>
          <div style="font-size:80px;font-weight:800;color:#8BB8E8;line-height:1;font-family:'Inter',sans-serif;">${d.testCount}</div>
          <div style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:8px;font-family:'Inter',sans-serif;">tracking the climb</div>
        </div>
        </div>
        ${cadenceRow}
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide7TimeAlloc(d, n) {
  const dominant = d.rwAllocPct >= d.mathAllocPct ? 'R/W' : 'Math';
  const domPct   = Math.max(d.rwAllocPct, d.mathAllocPct);
  const svg = donutSvg(d.rwAllocPct, d.mathAllocPct, d.stratAllocPct, d.totalHours, d.rwColor, d.mathColor);

  // Domain abbreviation map — keeps description text concise
  const abbrev = {
    'Standard English Conventions': 'SEC',
    'Information & Ideas': 'I&I',
    'Craft & Structure': 'C&S',
    'Expression of Ideas': 'EOI',
    'Algebra': 'Algebra',
    'Advanced Math': 'Adv. Math',
    'Problem-Solving & Data Analysis': 'PSDA',
    'Geometry & Trigonometry': 'Geo & Trig',
  };
  function topDomains(list) {
    const high = list.filter(x => (x.priority || '').toLowerCase() === 'high');
    const med  = high.length === 0 ? list.filter(x => ['medium','med'].includes((x.priority||'').toLowerCase())) : [];
    const src  = high.length > 0 ? high : med;
    if (src.length === 0) return null;
    return src.map(x => abbrev[x.domain] || x.domain.split(' ')[0]).join(', ');
  }
  const rwFocus   = topDomains(d.rwDomains);
  const mathFocus = topDomains(d.mathDomains);
  const rwDesc    = d.weakIsRW
    ? (rwFocus ? `${rwFocus} — the climb` : 'High-priority domains — the climb')
    : 'Protecting the strong section';
  const mathDesc  = d.weakIsRW
    ? 'Protecting the strong section'
    : (mathFocus ? `${mathFocus} — the climb` : 'High-priority domains — the climb');
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'WHERE THE TIME GOES', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('TIME FOLLOWS THE POINTS', `${domPct}% of instruction time goes to ${esc(dominant)}.`)}
      <div style="display:grid;grid-template-columns:2fr 3fr;gap:48px;flex:1;align-items:center;margin-bottom:20px;">
        <!-- Donut -->
        <div style="display:flex;justify-content:center;align-items:center;">${svg}</div>
        <!-- Bars -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:${d.rwBg};border-radius:14px;padding:24px 32px;border-left:6px solid ${d.rwColor};display:flex;align-items:center;gap:24px;">
            <div style="font-size:72px;font-weight:800;color:${d.rwColor};line-height:1;font-family:'Inter',sans-serif;">${d.rwAllocPct}%</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">READING &amp; WRITING</div>
              <div style="font-size:16px;font-weight:600;color:#1E293B;margin-top:5px;font-family:'Inter',sans-serif;">${d.rwAlloc} hrs · ${esc(rwDesc)}</div>
            </div>
          </div>
          <div style="background:${d.mathBg};border-radius:14px;padding:24px 32px;border-left:6px solid ${d.mathColor};display:flex;align-items:center;gap:24px;">
            <div style="font-size:72px;font-weight:800;color:${d.mathColor};line-height:1;font-family:'Inter',sans-serif;">${d.mathAllocPct}%</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">MATH</div>
              <div style="font-size:16px;font-weight:600;color:#1E293B;margin-top:5px;font-family:'Inter',sans-serif;">${d.mathAlloc} hrs · ${esc(mathDesc)}</div>
            </div>
          </div>
          <div style="background:#FAEFD4;border-radius:14px;padding:24px 32px;border-left:6px solid #C9942C;display:flex;align-items:center;gap:24px;">
            <div style="font-size:72px;font-weight:800;color:#C9942C;line-height:1;font-family:'Inter',sans-serif;">${d.stratH > 0 && d.stratAllocPct === 0 ? '< 1' : d.stratAllocPct}%</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">STRATEGY &amp; TESTING</div>
              <div style="font-size:16px;font-weight:600;color:#1E293B;margin-top:5px;font-family:'Inter',sans-serif;">${d.stratH} hrs · Practice tests + pacing + timed conditions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide8Phases(d, n) {
  const phases = d.parsedPhases;
  const count  = phases.length;

  // Scale card internals so all phases fit regardless of count
  const cardGap  = count >= 6 ? 12 : count === 5 ? 16 : 24;
  const cardPad  = count >= 6 ? '24px 20px' : count === 5 ? '30px 26px' : '40px 36px';
  const nameSize = count >= 6 ? 19 : count === 5 ? 22 : 26;
  const descSize = count >= 6 ? 13 : count === 5 ? 15 : 19;
  const hrsSize  = count >= 6 ? 52 : count === 5 ? 60 : 72;
  const hrslSize = count >= 6 ? 15 : count === 5 ? 18 : 22;
  const hrsMb    = count >= 6 ? 8  : count === 5 ? 10 : 12;
  const wkSize   = count >= 6 ? 13 : count === 5 ? 14 : 17;
  const markSize = count >= 6 ? 110 : count === 5 ? 150 : 240;
  const divMar   = count >= 5 ? '16px 0 12px' : '24px 0 20px';
  const outerPad = count >= 5 ? '40px 80px 56px' : '52px 80px 72px';

  const cards = phases.map((ph, i) => {
    const color    = PHASE_COLORS[i] || PHASE_COLORS[i % PHASE_COLORS.length];
    const wkLabel  = ph.wkStart && ph.wkEnd ? `Wks ${ph.wkStart}–${ph.wkEnd}` : ph.wkStart ? `Wk ${ph.wkStart}` : '';
    const phaseNum = String(i + 1).padStart(2, '0');
    return `<div style="border-radius:20px;overflow:hidden;flex:1;display:flex;flex-direction:column;position:relative;background:${color};box-shadow:0 8px 32px rgba(0,0,0,0.15);">
      <div style="position:absolute;bottom:-30px;right:-15px;font-size:${markSize}px;font-weight:800;color:rgba(255,255,255,0.07);line-height:1;font-family:'Inter',sans-serif;pointer-events:none;user-select:none;">${phaseNum}</div>
      <div style="position:relative;padding:${cardPad};flex:1;display:flex;flex-direction:column;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.18em;color:rgba(255,255,255,0.55);text-transform:uppercase;font-family:'Inter',sans-serif;">PHASE ${i + 1}</div>
        <div style="font-size:${nameSize}px;font-weight:700;color:white;margin-top:12px;line-height:1.25;font-family:'Inter',sans-serif;">${esc(ph.shortName || ph.title)}</div>
        ${ph.shortDesc ? `<div style="font-size:${descSize}px;font-weight:600;color:rgba(255,255,255,0.9);margin-top:8px;line-height:1.45;font-family:'Inter',sans-serif;flex:1;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,black 65%,transparent 100%);mask-image:linear-gradient(180deg,black 65%,transparent 100%);">${esc(ph.shortDesc)}</div>` : '<div style="flex:1;"></div>'}
        <div style="height:1px;background:rgba(255,255,255,0.2);margin:${divMar};"></div>
        <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:8px;">
          <span style="font-size:${hrsSize}px;font-weight:800;color:white;line-height:1;font-family:'Inter',sans-serif;">${ph.hours || '—'}</span>
          <span style="font-size:${hrslSize}px;font-weight:600;color:rgba(255,255,255,0.65);margin-bottom:${hrsMb}px;font-family:'Inter',sans-serif;">hrs</span>
        </div>
        ${wkLabel ? `<div style="font-size:${wkSize}px;font-weight:600;color:rgba(255,255,255,0.7);font-family:'Inter',sans-serif;">${esc(wkLabel)}</div>` : ''}
        ${ph.season ? `<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:5px;font-family:'Inter',sans-serif;">${esc(ph.season)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE ROADMAP', d.testLabel)}
    <div style="flex:1;padding:${outerPad};display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('EACH PHASE HAS ONE JOB', `A clear roadmap from start to finish.`)}
      <div style="display:flex;gap:${cardGap}px;flex:1;">${cards}</div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide9TwoGears(d, n) {
  const syFirst   = `${d.syPhases.length > 0 ? d.syPhases[0].wkStart || 1 : 1}–${d.syWkEnd}`;
  const sumRange  = `${d.sumWkStart}–${d.sumWkEnd}`;

  // Derive hrs/week from actual game plan data (no fabricated session counts)
  const syWeekCount  = Math.max(1, d.syWkEnd - (d.syPhases[0]?.wkStart || 1) + 1);
  const sumWeekCount = Math.max(1, d.sumWkEnd - d.sumWkStart + 1);
  const syHrsPerWeek  = (d.syHrs  / syWeekCount).toFixed(1);
  const sumHrsPerWeek = (d.sumHrs / sumWeekCount).toFixed(1);

  // Use actual phase names + descriptions from the game plan
  const syBullets  = d.syPhases.map(ph => {
    const wk = ph.wkStart && ph.wkEnd ? ` · Wks ${ph.wkStart}–${ph.wkEnd}` : '';
    const hrs = ph.hours ? ` · ${ph.hours} hrs` : '';
    return `<li style="font-size:15px;font-weight:600;color:#1B3A5C;padding:4px 0;font-family:'Inter',sans-serif;">• ${esc(ph.shortName)}${esc(wk)}${esc(hrs)}</li>`;
  }).join('');
  const sumBullets = d.sumPhases.map(ph => {
    const wk = ph.wkStart && ph.wkEnd ? ` · Wks ${ph.wkStart}–${ph.wkEnd}` : '';
    const hrs = ph.hours ? ` · ${ph.hours} hrs` : '';
    return `<li style="font-size:15px;font-weight:600;color:#1B3A5C;padding:4px 0;font-family:'Inter',sans-serif;">• ${esc(ph.shortName)}${esc(wk)}${esc(hrs)}</li>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'CADENCE', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('TWO GEARS', 'School year: focused. Summer: full throttle.')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex:1;margin-bottom:20px;">
        <!-- School Year -->
        <div style="border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#1B3A5C;padding:24px 32px;">
            <div style="font-size:14px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.7);text-transform:uppercase;font-family:'Inter',sans-serif;">SCHOOL YEAR · WEEKS ${syFirst}</div>
            <div style="font-size:30px;font-weight:800;color:white;margin-top:8px;font-family:'Inter',sans-serif;">~${syHrsPerWeek} hrs / week</div>
          </div>
          <div style="background:#E8EEF7;padding:32px;flex:1;">
            <div style="font-size:60px;font-weight:800;color:#1B3A5C;line-height:1;font-family:'Inter',sans-serif;">${d.syHrs} hrs</div>
            <div style="font-size:16px;font-weight:500;color:#334155;margin-top:6px;margin-bottom:20px;font-family:'Inter',sans-serif;">Total in-session time during school year</div>
            <ul style="list-style:none;padding:0;">${syBullets}</ul>
          </div>
        </div>
        <!-- Summer -->
        <div style="border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#B84A2E;padding:24px 32px;">
            <div style="font-size:14px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.7);text-transform:uppercase;font-family:'Inter',sans-serif;">SUMMER · WEEKS ${sumRange}</div>
            <div style="font-size:30px;font-weight:800;color:white;margin-top:8px;font-family:'Inter',sans-serif;">~${sumHrsPerWeek} hrs / week</div>
          </div>
          <div style="background:#FBE5DD;padding:32px;flex:1;">
            <div style="font-size:60px;font-weight:800;color:#B84A2E;line-height:1;font-family:'Inter',sans-serif;">${d.sumHrs} hrs</div>
            <div style="font-size:16px;font-weight:500;color:#334155;margin-top:6px;margin-bottom:20px;font-family:'Inter',sans-serif;">Total in-session time across summer</div>
            <ul style="list-style:none;padding:0;">${sumBullets}</ul>
          </div>
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide10Checkpoints(d, n) {
  const count  = d.testCount;
  const colors = ['#1B3A5C','#1A8870','#B84A2E','#C9942C','#2D6DB5','#7B4EA6'];
  const cadenceWks = d.weeks > 0 && count > 0 ? Math.round(d.weeks / count) : null;
  const cadence = cadenceWks ? `every ${cadenceWks}–${cadenceWks + 1} weeks` : 'at regular intervals';

  // Connector height: scales with test count so cards fill vertical space well
  // Timeline area is ~760px tall; connector must push cards far enough from center line
  const connH = count >= 6 ? 100 : count >= 4 ? 88 : 72;

  // Clamp left% so cards (220px wide = 110px half) don't overflow the 1640px timeline div
  const timelineW = 1640;
  const cardHalf  = 110;
  const edgePct   = (cardHalf / timelineW) * 100; // ~6.7%
  function leftPct(i) {
    const raw = count > 1 ? (i / (count - 1)) * 100 : 50;
    return Math.max(edgePct, Math.min(100 - edgePct, raw));
  }

  const nodes = Array.from({ length: count }, (_, i) => {
    const color = colors[i % colors.length];
    const above = i % 2 === 0;
    const row   = d.testRows[i];
    const job   = row?.status || (i === count - 1 ? 'Final check' : 'Progress check');
    const wkStr = row?.milestone?.match(/[Ww](?:eek)?\s*(\d+)/)?.[1] || '';
    const wkLabel = wkStr ? `Wk ${wkStr}` : '';
    // Only show score/delta when it comes directly from the game plan progression rows
    const score = row?.total || '';
    const prevRowScore = i === 0 ? String(d.baseline) : (d.testRows[i - 1]?.total || '');
    const parseScore = s => { const m = String(s || '').match(/(\d{3,4})/); return m ? parseInt(m[1]) : null; };
    const thisNum = parseScore(score);
    const prevNum = parseScore(prevRowScore) ?? d.baseline;
    const delta = row && thisNum !== null ? thisNum - prevNum : null;

    const lp = leftPct(i);

    const card = `<div style="background:white;border-radius:16px;padding:26px 30px;box-shadow:0 4px 24px rgba(0,0,0,0.09);border-top:5px solid ${color};width:220px;text-align:left;">
      <div style="font-size:14px;font-weight:700;color:${color};letter-spacing:0.1em;text-transform:uppercase;font-family:'Inter',sans-serif;">TEST ${i + 1}</div>
      ${wkLabel ? `<div style="font-size:15px;font-weight:500;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${wkLabel}</div>` : ''}
      ${score ? `<div style="font-size:34px;font-weight:800;color:#1B3A5C;line-height:1.1;margin-top:10px;font-family:'Inter',sans-serif;">${esc(String(score))}</div>` : ''}
      ${delta !== null ? `<div style="font-size:15px;font-weight:700;color:${delta >= 0 ? '#1A8870' : '#B84A2E'};margin-top:6px;font-family:'Inter',sans-serif;">${delta >= 0 ? '+' : ''}${delta} pts</div>` : ''}
      <div style="font-size:14px;font-style:italic;color:#94A3B8;margin-top:8px;font-family:'Inter',sans-serif;">${esc(job)}</div>
    </div>`;

    const connectorUp   = `<div style="position:absolute;left:50%;bottom:calc(50% + 28px);width:2px;height:${connH}px;background:${color};opacity:0.4;transform:translateX(-50%);"></div>`;
    const connectorDown = `<div style="position:absolute;left:50%;top:calc(50% + 28px);width:2px;height:${connH}px;background:${color};opacity:0.4;transform:translateX(-50%);"></div>`;

    return `<div style="position:absolute;left:${lp}%;top:0;bottom:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;">
      ${above ? `<div style="position:absolute;bottom:calc(50% + 28px + ${connH}px);left:50%;transform:translateX(-50%);">${card}</div>` : ''}
      ${above ? connectorUp : ''}
      <div style="width:60px;height:60px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white;font-family:'Inter',sans-serif;box-shadow:0 4px 18px ${color}55;position:relative;z-index:2;">${i + 1}</div>
      ${!above ? connectorDown : ''}
      ${!above ? `<div style="position:absolute;top:calc(50% + 28px + ${connH}px);left:50%;transform:translateX(-50%);">${card}</div>` : ''}
    </div>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'CHECKPOINTS', d.testLabel)}
    <div style="flex:1;padding:48px 80px 64px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('PROGRESS TRACKED AT EVERY STAGE', count > 0 ? `${count} full practice tests. One ${cadence}.` : 'Practice tests scheduled throughout the program.')}
      <div style="flex:1;position:relative;margin:0 60px;">
        <div style="position:absolute;top:50%;left:0;right:0;height:4px;background:linear-gradient(90deg,#CBD5E1,#1B3A5C,#CBD5E1);transform:translateY(-50%);border-radius:2px;"></div>
        <div style="position:absolute;bottom:12px;left:0;font-size:12px;font-weight:700;color:#94A3B8;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">DIAGNOSTIC</div>
        <div style="position:absolute;bottom:12px;right:0;font-size:12px;font-weight:700;color:#94A3B8;letter-spacing:0.12em;text-transform:uppercase;font-family:'Inter',sans-serif;">TEST DAY</div>
        <div style="position:absolute;top:0;left:0;right:0;bottom:0;">${nodes}</div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide11Progression(d, n) {
  const svg = lineChartSvg(d.chartPoints, d.baseline, d.target, d.isACT);
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE CLIMB', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('THE SCORE PROGRESSION', `${esc(d.baselineLabel)} today. ${esc(d.testMonth)} is the goal.`)}
      <div style="flex:1;display:flex;align-items:center;justify-content:center;margin-bottom:8px;overflow:hidden;">${svg}</div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide12Outcomes(d, n) {
  const tierName    = d.scoreBandDisplay;
  const namedSchool = d.competitiveSchools[0] || '';
  const schoolLine  = namedSchool
    ? `Competitive at ${namedSchool.charAt(0).toUpperCase() + namedSchool.slice(1)} and similar programs.`
    : `${d.target}+ composite opens the ${esc(tierName)} range.`;

  const schoolPills = d.competitiveSchools.length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
        ${d.competitiveSchools.slice(0, 5).map(s => `<span style="background:#DCEDE2;color:#1A5C38;font-size:14px;font-weight:600;padding:5px 14px;border-radius:16px;font-family:'Inter',sans-serif;">${esc(s)}</span>`).join('')}
      </div>`
    : '';

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE OUTCOME', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('WHAT ' + d.target + ' UNLOCKS', `The score that opens ${esc(tierName)} doors.`)}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;flex:1;">
        <!-- Card 01: Score jump -->
        <div style="background:linear-gradient(145deg,#E8EEF7,#F0F4FF);border-radius:16px;padding:44px 40px;border-left:6px solid #1B3A5C;box-shadow:0 1px 2px rgba(15,36,64,0.04),0 4px 16px rgba(15,36,64,0.06);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:64px;font-weight:800;color:#1B3A5C;line-height:1;margin-bottom:20px;font-family:'Inter',sans-serif;">01</div>
            <div style="font-size:24px;font-weight:700;color:#1B3A5C;margin-bottom:22px;font-family:'Inter',sans-serif;">${esc(tierName)} Composite</div>
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="background:rgba(27,58,92,0.08);border-radius:10px;padding:12px 22px;text-align:center;">
                <div style="font-size:11px;font-weight:700;color:#64748B;letter-spacing:0.1em;font-family:'Inter',sans-serif;">NOW</div>
                <div style="font-size:34px;font-weight:800;color:#1B3A5C;line-height:1;font-family:'Inter',sans-serif;">${d.baseline}</div>
              </div>
              <div style="font-size:28px;font-weight:800;color:#B84A2E;font-family:'Inter',sans-serif;">&#8594;</div>
              <div style="background:rgba(45,134,89,0.1);border-radius:10px;padding:12px 22px;text-align:center;">
                <div style="font-size:11px;font-weight:700;color:#1F7A50;letter-spacing:0.1em;font-family:'Inter',sans-serif;">GOAL</div>
                <div style="font-size:34px;font-weight:800;color:#1F7A50;line-height:1;font-family:'Inter',sans-serif;">${d.target}+</div>
              </div>
            </div>
          </div>
          <div style="font-size:20px;font-weight:700;color:#1B3A5C;line-height:1.55;font-family:'Inter',sans-serif;">${d.isACT ? 'All four sections competitive.' : 'Both sections competitive.'} A complete academic profile.</div>
        </div>
        <!-- Card 02: Gap closed -->
        <div style="background:linear-gradient(145deg,#FBE5DD,#FEF0EC);border-radius:16px;padding:44px 40px;border-left:6px solid #B84A2E;box-shadow:0 1px 2px rgba(15,36,64,0.04),0 4px 16px rgba(15,36,64,0.06);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:64px;font-weight:800;color:#B84A2E;line-height:1;margin-bottom:20px;font-family:'Inter',sans-serif;">02</div>
            <div style="font-size:24px;font-weight:700;color:#1B3A5C;margin-bottom:22px;font-family:'Inter',sans-serif;">Closes the gap</div>
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="background:rgba(200,85,61,0.08);border-radius:10px;padding:12px 22px;text-align:center;">
                <div style="font-size:11px;font-weight:700;color:#64748B;letter-spacing:0.1em;font-family:'Inter',sans-serif;">${esc(d.weakSec)}</div>
                <div style="font-size:34px;font-weight:800;color:#B84A2E;line-height:1;font-family:'Inter',sans-serif;">${d.weakScore}</div>
              </div>
              <div style="font-size:28px;font-weight:800;color:#B84A2E;font-family:'Inter',sans-serif;">&#8594;</div>
              <div style="background:rgba(200,85,61,0.08);border-radius:10px;padding:12px 22px;text-align:center;">
                <div style="font-size:11px;font-weight:700;color:#64748B;letter-spacing:0.1em;font-family:'Inter',sans-serif;">TARGET</div>
                <div style="font-size:34px;font-weight:800;color:#B84A2E;line-height:1;font-family:'Inter',sans-serif;">${esc(d.isACT ? d.rwTargetStr : (d.weakIsRW ? d.rwTargetStr : d.mathTargetStr))}</div>
              </div>
            </div>
          </div>
          <div style="font-size:20px;font-weight:700;color:#1B3A5C;line-height:1.55;font-family:'Inter',sans-serif;">${esc(d.weakSec)} reaches its target. ${d.isACT ? 'All four sections competitive.' : 'Both sections now strong.'}</div>
        </div>
        <!-- Card 03: Schools in range -->
        <div style="background:linear-gradient(145deg,#DCEDE2,#EBF5EE);border-radius:16px;padding:44px 40px;border-left:6px solid #1F7A50;box-shadow:0 1px 2px rgba(15,36,64,0.04),0 4px 16px rgba(15,36,64,0.06);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:64px;font-weight:800;color:#1F7A50;line-height:1;margin-bottom:20px;font-family:'Inter',sans-serif;">03</div>
            <div style="font-size:24px;font-weight:700;color:#1B3A5C;margin-bottom:22px;font-family:'Inter',sans-serif;">Schools in range</div>
            ${schoolPills}
          </div>
          <div style="font-size:20px;font-weight:700;color:#1B3A5C;line-height:1.55;font-family:'Inter',sans-serif;">${schoolLine}</div>
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

function slide13LockItIn(d, n) {
  const phase1Name = d.parsedPhases[0]?.shortName || 'Phase 1';
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'NEXT STEPS', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader("LET'S LOCK IT IN", 'Three steps to start the climb.')}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;flex:1;">
        ${[
          { num: '1', title: 'ENROLL TODAY', body: `Lock in your start date and first session. Secure your spot before the ${esc(d.testMonth)} ${esc(d.testLabel)}.` },
          { num: '2', title: 'DIAGNOSTIC TEST', body: `Full practice ${esc(d.testLabel)} before Week 1 begins. Sets the true starting point for the plan.` },
          { num: '3', title: 'FIRST SESSION', body: `Meet your coach. Walk through results. Begin Phase 1: ${esc(phase1Name)}.` },
        ].map(s => `<div style="background:white;border-radius:20px;padding:52px 56px;border:1px solid #E2E8F0;box-shadow:0 4px 24px rgba(0,0,0,0.07);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
          <div style="width:64px;height:64px;background:linear-gradient(135deg,#B84A2E,#E07060);border-radius:50%;display:flex;align-items:center;justify-content:center;
            font-size:24px;font-weight:800;color:white;margin-bottom:32px;font-family:'Inter',sans-serif;box-shadow:0 6px 20px rgba(184,74,46,0.35);flex-shrink:0;">${s.num}</div>
          <div style="font-size:28px;font-weight:700;color:#1B3A5C;margin-bottom:18px;font-family:'Inter',sans-serif;letter-spacing:-0.01em;">${s.title}</div>
          <div style="font-size:20px;color:#334155;line-height:1.65;font-family:'Inter',sans-serif;max-width:420px;">${s.body}</div>
        </div>`).join('')}
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

// ── Proofreader ───────────────────────────────────────────────────────────────

async function proofreadData(d) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return d;

  try {
    const payload = {
      thesis: d.thesis,
      phases: d.parsedPhases.map(ph => ({
        shortName: ph.shortName,
        shortDesc: ph.shortDesc,
      })),
    };

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a proofreader for a professional test-prep tutoring presentation. Fix any grammar, punctuation, capitalization, or awkward phrasing in the JSON below. Do NOT change meaning, numbers, names, scores, or structure. Return ONLY valid JSON with the exact same keys.\n\n${JSON.stringify(payload, null, 2)}`,
      }],
    });

    const text = msg.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return d;
    const corrected = JSON.parse(jsonMatch[0]);
    if (corrected.thesis) d.thesis = corrected.thesis;
    if (Array.isArray(corrected.phases)) {
      corrected.phases.forEach((ph, i) => {
        if (!d.parsedPhases[i]) return;
        if (ph.shortName) d.parsedPhases[i].shortName = ph.shortName;
        if (ph.shortDesc) {
          let sd = String(ph.shortDesc);
          if (sd.length > 90) {
            const cut = sd.lastIndexOf(' ', 90);
            sd = cut > 20 ? sd.slice(0, cut) : sd.slice(0, 90);
          }
          d.parsedPhases[i].shortDesc = sd;
        }
      });
    }
  } catch {
    // proofread failed — use original data unchanged
  }
  return d;
}

function slideHomework(d, n) {
  const count      = d.phaseHomework.length;
  const rightCols  = count >= 4 ? '1fr 1fr' : '1fr';
  const itemFont   = count >= 5 ? 14 : 15;
  const nameFont   = count >= 5 ? 11 : 12;
  const ovLen      = d.homeworkOverview.length;
  const ovFont     = ovLen > 320 ? 16 : ovLen > 200 ? 18 : 20;

  const phaseCards = d.phaseHomework.map((ph, i) => {
    const bullets = ph.items.map(item =>
      `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:9px;">
        <div style="width:6px;height:6px;border-radius:50%;background:${ph.color};flex-shrink:0;margin-top:6px;"></div>
        <div style="font-size:${itemFont}px;font-weight:500;color:#334155;line-height:1.5;font-family:'Inter',sans-serif;">${esc(item)}</div>
      </div>`
    ).join('');
    return `<div style="background:white;border-radius:12px;padding:20px 26px;border-left:5px solid ${ph.color};box-shadow:0 2px 10px rgba(0,0,0,0.05);">
      <div style="font-size:${nameFont}px;font-weight:700;color:${ph.color};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:12px;font-family:'Inter',sans-serif;">PHASE ${i + 1} · ${esc(ph.shortName)}</div>
      ${bullets}
    </div>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'HOMEWORK', d.testLabel)}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:#F8FAFC;">
      ${slideHeader('BETWEEN SESSIONS', 'Homework is the multiplier.')}
      <div style="display:grid;grid-template-columns:2fr 3fr;gap:48px;flex:1;overflow:hidden;">
        <!-- Overview panel -->
        <div style="background:linear-gradient(145deg,#1B3A5C,#233F5C);border-radius:16px;padding:44px 40px;display:flex;flex-direction:column;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.18em;text-transform:uppercase;font-family:'Inter',sans-serif;margin-bottom:20px;">HOMEWORK OVERVIEW</div>
          <div style="font-size:${ovFont}px;font-weight:600;color:white;line-height:1.65;font-family:'Inter',sans-serif;flex:1;">${esc(d.homeworkOverview)}</div>
        </div>
        <!-- Per-phase homework -->
        <div style="display:grid;grid-template-columns:${rightCols};gap:16px;align-content:start;overflow:hidden;">
          ${phaseCards}
        </div>
      </div>
    </div>
    ${monogramWatermark()}${slideFooter(n, d.totalSlides, d.testLabel)}
  </section>`;
}

// ── HTML assembler ────────────────────────────────────────────────────────────

function generateHTML(d, fontCss = '') {
  const slides = [];
  let n = 1;

  slides.push(slide1Cover(d, n++));
  slides.push(slide2Standing(d, n++));
  slides.push(slide3Diagnosis(d, n++));
  slides.push(slide4Domains(d, n++));
  slides.push(slide5Scholarships(d, n++));
  slides.push(slide6Plan(d, n++));
  if (d.showTimeAlloc) slides.push(slide7TimeAlloc(d, n++));
  slides.push(slide8Phases(d, n++));
  if (d.showTwoGears) slides.push(slide9TwoGears(d, n++));
  if (d.showHomework) slides.push(slideHomework(d, n++));
  slides.push(slide10Checkpoints(d, n++));
  slides.push(slide11Progression(d, n++));
  slides.push(slide12Outcomes(d, n++));
  slides.push(slide13LockItIn(d, n++));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(d.firstName)}'s ${esc(d.testLabel)} Game Plan</title>
${fontCss ? `<style>${fontCss}</style>` : `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`}
<style>
  @page { size: 1920px 1080px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1920px; background: white; }
  @media print {
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  section { page-break-after: always; }
  section:last-child { page-break-after: auto; }
</style>
</head>
<body>
${slides.join('\n')}
</body>
</html>`;
}

// ── Font loader ───────────────────────────────────────────────────────────────

async function fetchInterFontCss() {
  if (_interFontCss !== null) return _interFontCss;
  try {
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
    );
    const css = await cssRes.text();
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map(m => m[1]);
    let embedded = css;
    for (const url of urls) {
      const r = await fetch(url);
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      embedded = embedded.replace(url, `data:font/woff2;base64,${b64}`);
    }
    _interFontCss = embedded;
    return embedded;
  } catch {
    _interFontCss = '';
    return '';
  }
}

// ── Main exports ──────────────────────────────────────────────────────────────

// Single browser session produces both PDF and PPTX to avoid ETXTBSY
// (spawning two Chromium processes in parallel on the same binary is not safe)
async function buildPresentationAssets(gamePlan, studentData, studentName) {
  const d           = derive(gamePlan, studentData, studentName);
  await proofreadData(d);
  const fontCss     = await fetchInterFontCss();
  const html        = generateHTML(d, fontCss);
  const totalSlides = d.totalSlides;

  const browser = await getBrowser();
  try {
    // ── PDF: standard 1920×1080 viewport, one page per slide ──────────────
    const pdfPage = await browser.newPage();
    await pdfPage.setViewport({ width: 1920, height: 1080 });
    await pdfPage.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await pdfPage.evaluate(() => document.fonts.ready);
    const pdf = await pdfPage.pdf({
      width: '1920px',
      height: '1080px',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    // ── PPTX: screenshot each slide using captureBeyondViewport to avoid
    //    allocating a (1920 × 1080 × N) frame buffer that OOMs on Vercel ──
    const pngPage = await browser.newPage();
    await pngPage.setViewport({ width: 1920, height: 1080 });
    await pngPage.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await pngPage.evaluate(() => document.fonts.ready);

    const slideImages = [];
    for (let i = 0; i < totalSlides; i++) {
      const png = await pngPage.screenshot({
        clip: { x: 0, y: i * 1080, width: 1920, height: 1080 },
        encoding: 'base64',
        captureBeyondViewport: true,
      });
      slideImages.push(png);
    }

    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    for (const imgData of slideImages) {
      const slide = pptx.addSlide();
      slide.addImage({ data: `image/png;base64,${imgData}`, x: 0, y: 0, w: '100%', h: '100%' });
    }
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });

    return { pdfBuffer: Buffer.from(pdf), pptxBuffer };
  } finally {
    await browser.close();
  }
}

export async function buildPresentationPdf(gamePlan, studentData, studentName) {
  const { pdfBuffer } = await buildPresentationAssets(gamePlan, studentData, studentName);
  return pdfBuffer;
}

export async function buildPresentationPptx(gamePlan, studentData, studentName) {
  const { pptxBuffer } = await buildPresentationAssets(gamePlan, studentData, studentName);
  return pptxBuffer;
}

// Called by route when both outputs are needed — single browser session
export async function buildPresentationBoth(gamePlan, studentData, studentName) {
  return buildPresentationAssets(gamePlan, studentData, studentName);
}
