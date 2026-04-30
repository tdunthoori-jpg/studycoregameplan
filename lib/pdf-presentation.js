import { existsSync } from 'fs';

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
    weeks, totalHours, targetColleges,
  } = studentData;

  const rwCur    = parseInt(rwScore)   || 0;
  const mathCur  = parseInt(mathScore) || 0;
  const baseline = rwCur + mathCur;
  const target   = parseInt(targetScore) || 1400;

  const weakIsRW   = rwCur < mathCur;
  const weakSec    = weakIsRW ? 'R/W'  : 'Math';
  const strongSec  = weakIsRW ? 'Math' : 'R/W';
  const weakScore  = weakIsRW ? rwCur  : mathCur;
  const strongScore = weakIsRW ? mathCur : rwCur;
  const weakColor   = weakIsRW ? '#C8553D' : '#C8553D'; // always coral for gap
  const strongColor = '#2D8659'; // always green for strong
  const weakBg      = '#FBE5DD';
  const strongBg    = '#DCEDE2';
  // Semantic: math-specific color and rw-specific color
  const mathColor = weakIsRW ? '#2D8659' : '#C8553D'; // green if Math is strong, coral if weak
  const rwColor   = weakIsRW ? '#C8553D' : '#2D8659'; // coral if R/W is weak, green if strong
  const mathBg    = weakIsRW ? '#DCEDE2' : '#FBE5DD';
  const rwBg      = weakIsRW ? '#FBE5DD' : '#DCEDE2';

  const totalLift  = target - baseline;

  // Derive section lifts from the actual score progression targets, not a fixed ratio.
  // Parse the first 3-4 digit number from a target string like "750–760" or "740+".
  function parseTargetNum(str) { const m = (str || '').match(/(\d{3,4})/); return m ? parseInt(m[1]) : null; }
  const _progRowsEarly = gamePlan.scoreProgression?.rows || [];
  const _lastRowEarly  = _progRowsEarly[_progRowsEarly.length - 1] || {};
  const _rwTarget      = parseTargetNum(_lastRowEarly.rw)   || Math.round(target * 0.47);
  const _mathTarget    = parseTargetNum(_lastRowEarly.math) || Math.round(target * 0.53);
  const _mathLift      = Math.max(0, _mathTarget - mathCur);
  const _rwLift        = Math.max(0, _rwTarget   - rwCur);
  const _rawTotal      = _mathLift + _rwLift;
  let weakLift, strongLift;
  if (_rawTotal > 0) {
    const _weakRaw = weakIsRW ? _rwLift : _mathLift;
    // Round to nearest 10 so displayed lifts are valid SAT score increments
    weakLift   = Math.round((_weakRaw / _rawTotal) * totalLift / 10) * 10;
    strongLift = totalLift - weakLift;
  } else {
    weakLift   = Math.round(totalLift * 0.7 / 10) * 10;
    strongLift = totalLift - weakLift;
  }

  // Use the game plan's own AI-generated tagline as the thesis.
  // Fall back to a score-derived phrase only if the game plan didn't produce one.
  const gap = Math.abs(rwCur - mathCur);
  let _fallbackThesis;
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
  const thesis = gamePlan.tagline || _fallbackThesis;

  const cols = (targetColleges || '').toLowerCase();
  let scoreBand;
  if (/mit|caltech|cmu|georgia.?tech/.test(cols) && target >= 1480) scoreBand = 'STEM-tier';
  else if (/harvard|yale|princeton|stanford|columbia|dartmouth|brown|cornell|upenn/.test(cols)) scoreBand = 'Ivy-tier';
  else if (target >= 1500) scoreBand = 'elite-tier';
  else if (target >= 1450) scoreBand = 'T20-tier';
  else if (target >= 1350) scoreBand = 'strong-private-tier';
  else if (target >= 1250) scoreBand = 'solid-tier';
  else                     scoreBand = `${target}+ target`;
  // Human-readable version: no hyphens, title-cased (e.g. "Strong Private")
  const scoreBandDisplay = scoreBand
    .replace(/-tier$/, '')
    .replace(/-/g, ' ')
    .replace(/\b[a-z]/g, c => c.toUpperCase());
  const bottomLine = gamePlan.bottomLine || '';

  // Section score percentile (400–800 scale)
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
  // Composite score percentile (400–1600 scale)
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
  const baselinePct = compositePct(baseline);
  const rwPct       = pct(rwCur);
  const mathPct     = pct(mathCur);

  let testMonthYear = 'Target Date';
  let testMonth     = 'Target';
  if (targetTestDate) {
    const d = new Date(targetTestDate + 'T12:00:00');
    testMonthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    testMonth     = d.toLocaleDateString('en-US', { month: 'long' });
  }
  const baselineLabel = (testType === 'PSAT' || testType === 'PSAT/NMSQT' || testType === 'PSAT 10')
    ? 'PSAT' : (testType || 'SAT');

  const progRows = gamePlan.scoreProgression?.rows || [];
  const lastRow  = progRows[progRows.length - 1] || {};
  const rwTargetStr   = lastRow.rw   || `${Math.round(target * 0.47)}+`;
  const mathTargetStr = lastRow.math || `${Math.round(target * 0.53)}+`;

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
    let shortDesc  = sents.slice(0, 2).join(' ');
    if (shortDesc.length > 200) shortDesc = shortDesc.slice(0, 200);
    if (shortDesc.length > 0) shortDesc = shortDesc.charAt(0).toUpperCase() + shortDesc.slice(1);

    return { ...ph, hours, wkStart, wkEnd, season, shortName, shortDesc };
  });

  const phaseCount  = parsedPhases.length;
  const phaseHrsSum = parsedPhases.reduce((s, ph) => s + ph.hours, 0);
  const totalHrs    = phaseHrsSum > 0 ? phaseHrsSum : (parseInt(totalHours) || 20);

  let rwH = 0, mathH = 0;
  parsedPhases.forEach(ph => {
    const txt = ((ph.title || '') + ' ' + (ph.description || '')).toLowerCase();
    const rwC   = ['r/w','reading','writing','sec','craft','structure','info','expression','eoi','conventions'].filter(k => txt.includes(k)).length;
    const mathC = ['math','algebra','advanced','psda','geometry','trig','quadratic','function'].filter(k => txt.includes(k)).length;
    if (rwC > mathC)       rwH   += ph.hours;
    else if (mathC > rwC)  mathH += ph.hours;
    else { rwH += ph.hours * 0.5; mathH += ph.hours * 0.5; }
  });
  const stratH       = Math.max(1, totalHrs - Math.round(rwH) - Math.round(mathH));
  const rwAlloc      = Math.max(1, Math.round(rwH));
  const mathAlloc    = Math.max(1, Math.round(mathH));
  const rwAllocPct   = Math.round((rwAlloc  / totalHrs) * 100);
  const mathAllocPct = Math.round((mathAlloc / totalHrs) * 100);
  const stratAllocPct = Math.max(0, 100 - rwAllocPct - mathAllocPct);

  const showTimeAlloc = Math.max(rwAllocPct, mathAllocPct) > 70;
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
  const testCount = testRows.length || Math.max(3, Math.round(parseInt(weeks) / 3));

  function parseFirstNum(str) {
    const m = (str || '').match(/(\d{3,4})/); return m ? parseInt(m[1]) : null;
  }
  const chartPoints = [{ label: baselineLabel, score: baseline, isBaseline: true }];
  if (testRows.length > 0) {
    testRows.forEach((r, i) => {
      const s = parseFirstNum(r.total) || Math.round(baseline + (target - baseline) * ((i + 1) / (testRows.length + 1)));
      chartPoints.push({ label: `T#${i + 1}`, score: s });
    });
  } else {
    for (let i = 1; i <= testCount; i++) {
      chartPoints.push({ label: `T#${i}`, score: Math.round(baseline + (target - baseline) * Math.pow(i / (testCount + 1), 0.75)) });
    }
  }
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
  const rwDomainNames   = ['Standard English Conventions', 'Information & Ideas', 'Craft & Structure', 'Expression of Ideas'];
  const mathDomainNames = ['Algebra', 'Advanced Math', 'Problem-Solving & Data Analysis', 'Geometry & Trigonometry'];
  function matchDomain(name) {
    const found = domainPriority.find(d => {
      const dn = (d.domain || '').toLowerCase();
      const nl = name.toLowerCase();
      // Exact match first, then significant keyword overlap (all words > 4 chars must match)
      if (dn === nl) return true;
      const words = nl.split(' ').filter(w => w.length > 4);
      if (words.length === 0) return dn.includes(nl);
      return words.every(w => dn.includes(w));
    });
    // Always use the canonical name, just borrow performance/target/priority from matched entry
    return {
      domain: name,
      performance: found?.performance || 'N/A',
      target: found?.target || 'N/A',
      priority: found?.priority || 'Low',
    };
  }
  const rwDomains      = rwDomainNames.map(matchDomain);
  const mathDomains    = mathDomainNames.map(matchDomain);
  const highPriorityCount = domainPriority.filter(d => (d.priority || '').toLowerCase() === 'high').length;

  const nameParts  = (studentName || '').split(' ');
  const firstName  = nameParts[0] || 'Student';
  const familyName = nameParts.slice(1).join(' ') || firstName;

  let totalSlides = 11;
  if (showTimeAlloc) totalSlides++;
  if (showTwoGears)  totalSlides++;
  if (expandPhases)  totalSlides++;

  return {
    firstName, familyName, studentName,
    baseline, rwCur, mathCur, target,
    rwTargetStr, mathTargetStr,
    testType, testMonthYear, testMonth, baselineLabel,
    weeks: parseInt(weeks) || 0,
    totalHours: totalHrs,
    weakIsRW, weakSec, strongSec, weakScore, strongScore,
    weakLift, strongLift, totalLift,
    weakColor, strongColor, weakBg, strongBg,
    mathColor, rwColor, mathBg, rwBg,
    thesis, scoreBand, scoreBandDisplay, bottomLine,
    baselinePct, rwPct, mathPct,
    rwAlloc, mathAlloc, stratH, rwAllocPct, mathAllocPct, stratAllocPct,
    parsedPhases, phaseCount, expandPhases,
    showTimeAlloc, showTwoGears,
    syPhases, sumPhases, syHrs, sumHrs, syWkStart, syWkEnd, sumWkStart, sumWkEnd,
    testRows, testCount, chartPoints, progRows,
    rwDomains, mathDomains, highPriorityCount,
    cols: targetColleges || '',
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

function lineChartSvg(chartPoints, baseline, target) {
  const W = 1100, H = 400;
  const axL = 80, axR = W - 30, axT = 30, axB = H - 55;
  const plotW = axR - axL, plotH = axB - axT;
  const n = chartPoints.length;

  const yMin = Math.floor((baseline - 60) / 50) * 50;
  const yMax = Math.ceil((target  + 80) / 50) * 50;
  const ySpan = yMax - yMin;

  function xPos(i) { return axL + (plotW / Math.max(n - 1, 1)) * i; }
  function yPos(s) { return axT + plotH * (1 - (s - yMin) / ySpan); }

  const gridScores = [];
  for (let s = yMin; s <= yMax; s += 50) gridScores.push(s);

  const polyPts = chartPoints.map((p, i) => `${xPos(i).toFixed(1)},${yPos(p.score).toFixed(1)}`).join(' ');
  const tY = yPos(target);

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">`;

  // Grid
  gridScores.forEach(sc => {
    s += `<line x1="${axL}" y1="${yPos(sc).toFixed(1)}" x2="${axR}" y2="${yPos(sc).toFixed(1)}" stroke="#E5E7EB" stroke-width="1"/>`;
    s += `<text x="${axL - 8}" y="${(yPos(sc) + 4).toFixed(1)}" text-anchor="end" font-family="Inter,Helvetica Neue,sans-serif" font-size="12" fill="#64748B">${sc}</text>`;
  });

  // Target dashed line
  s += `<line x1="${axL}" y1="${tY.toFixed(1)}" x2="${axR}" y2="${tY.toFixed(1)}" stroke="#2D8659" stroke-width="2" stroke-dasharray="8,5"/>`;
  s += `<text x="${(axL + 10).toFixed(1)}" y="${(tY - 8).toFixed(1)}" font-family="Inter,Helvetica Neue,sans-serif" font-size="13" font-weight="700" fill="#2D8659">${target} TARGET</text>`;

  // Data line
  s += `<polyline points="${polyPts}" fill="none" stroke="#1B3A5C" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;

  // X-axis
  s += `<line x1="${axL}" y1="${axB}" x2="${axR}" y2="${axB}" stroke="#E5E7EB" stroke-width="1"/>`;

  // Points + labels
  chartPoints.forEach((p, i) => {
    const x = xPos(i).toFixed(1), y = yPos(p.score).toFixed(1);
    if (p.isTarget) {
      s += `<circle cx="${x}" cy="${y}" r="12" fill="#2D8659"/>`;
      s += `<text x="${x}" y="${(parseFloat(y) + 5).toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="13" font-weight="800" fill="white">★</text>`;
      s += `<text x="${x}" y="${(parseFloat(y) - 18).toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="14" font-weight="700" fill="#2D8659">${p.score}+</text>`;
    } else {
      s += `<circle cx="${x}" cy="${y}" r="7" fill="white" stroke="#1B3A5C" stroke-width="2.5"/>`;
      s += `<text x="${x}" y="${(parseFloat(y) - 14).toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="13" font-weight="700" fill="#1B3A5C">${p.score}</text>`;
    }
    s += `<text x="${x}" y="${(axB + 18).toFixed(1)}" text-anchor="middle" font-family="Inter,Helvetica Neue,sans-serif" font-size="12" fill="#64748B">${p.label}</text>`;
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

function brandBar(firstName, category) {
  return `<div style="height:56px;background:#1B3A5C;color:white;padding:0 80px;
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
    font-family:'Inter',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
    <span style="font-weight:800;">STUDYCORE</span>
    <span style="font-weight:500;opacity:0.9;">${esc(firstName)}'s SAT Game Plan | Demo Presentation</span>
    <span>${esc(category)}</span>
  </div>`;
}

function slideFooter(n, total) {
  return `<div style="position:absolute;bottom:0;left:0;right:0;height:40px;padding:0 80px;
    display:flex;align-items:center;justify-content:space-between;
    border-top:1px solid #E5E7EB;font-family:'Inter',sans-serif;
    font-size:13px;font-weight:500;color:#64748B;letter-spacing:0.05em;">
    <span>StudyCore SAT Prep — Confidential</span>
    <span>Slide ${n} of ${total}</span>
  </div>`;
}

function slideHeader(eyebrow, title) {
  return `<div style="font-size:15px;font-weight:700;color:#1A8870;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;font-family:'Inter',sans-serif;">${esc(eyebrow)}</div>
  <div style="font-size:52px;font-weight:800;color:#1B3A5C;letter-spacing:-0.02em;line-height:1.08;font-family:'Inter',sans-serif;">${esc(title)}</div>
  <div style="width:110px;height:4px;background:#D9684E;margin-top:14px;margin-bottom:36px;border-radius:2px;"></div>`;
}

function callout(variant, tagline, sub) {
  const variants = {
    gray:        { bg: '#F3F4F6', border: '', color: '#1B3A5C', subColor: '#475569' },
    'navy-tint': { bg: '#E8EEF7', border: '', color: '#1B3A5C', subColor: '#475569' },
    teal:        { bg: '#D5EDE6', border: 'border-left:6px solid #1A8870;', color: '#1B3A5C', subColor: '#475569' },
    green:       { bg: '#DCEDE2', border: 'border-left:6px solid #2D8659;', color: '#1B3A5C', subColor: '#475569' },
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
  if (p === 'high')   return `<span style="background:#C8553D;color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">HIGH</span>`;
  if (p === 'medium' || p === 'med') return `<span style="background:#C9942C;color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">MED</span>`;
  if (p === 'protect') return `<span style="background:#2D8659;color:white;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">PROTECT</span>`;
  return `<span style="border:1px solid #64748B;color:#64748B;font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;">LOW</span>`;
}

const PHASE_COLORS = ['#C8553D', '#C9942C', '#2A9D85', '#2D8659', '#234876', '#8B5CF6'];

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
        ${esc(d.firstName)}'s<br>SAT Game Plan
      </div>
      <div style="font-size:19px;font-style:italic;color:rgba(184,200,216,0.9);line-height:1.45;margin-bottom:auto;font-family:'Inter',sans-serif;">
        "${esc(d.thesis)}"
      </div>
      <div style="margin-top:48px;">
        <div style="font-size:10px;font-weight:700;color:#C8553D;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PREPARED FOR</div>
        <div style="font-size:22px;font-weight:700;color:white;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(d.familyName)} &amp; Family</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.45);font-family:'Inter',sans-serif;">Plan Created: ${esc(today)} | Target: ${esc(d.testMonthYear)} SAT</div>
      </div>
    </div>
    <!-- Coral divider -->
    <div style="width:4px;background:#D9684E;flex-shrink:0;"></div>
    <!-- Right white panel -->
    <div style="flex:1;padding:64px 72px;display:flex;flex-direction:column;justify-content:center;background:white;">
      <div style="font-size:13px;font-weight:700;color:#1A8870;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:18px;font-family:'Inter',sans-serif;">THE CLIMB</div>
      <!-- Score display -->
      <div style="display:flex;align-items:center;gap:28px;margin-bottom:18px;">
        <div>
          <div style="font-size:128px;font-weight:800;color:#1B3A5C;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;">${d.baseline}</div>
          <div style="font-size:13px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${esc(d.baselineLabel)} · No prep · ${d.baselinePct} %ile</div>
        </div>
        <div style="font-size:56px;color:#C8553D;font-weight:800;font-family:'Inter',sans-serif;">→</div>
        <div>
          <div style="font-size:128px;font-weight:800;color:#2D8659;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;">${d.target}+</div>
          <div style="font-size:13px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${esc(d.testMonthYear)} SAT · ${esc(d.scoreBandDisplay)}</div>
        </div>
      </div>
      <!-- Divider -->
      <div style="height:1px;background:#E5E7EB;margin-bottom:20px;"></div>
      <!-- Three stat cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;">
        <div style="background:#F3F4F6;border-radius:12px;padding:22px 18px;border-top:6px solid #1B3A5C;">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">TOTAL LIFT</div>
          <div style="font-size:52px;font-weight:800;color:#1B3A5C;line-height:1;font-family:'Inter',sans-serif;">+${d.totalLift}</div>
          <div style="font-size:14px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${d.baseline} → ${d.target}+</div>
        </div>
        <div style="background:#F3F4F6;border-radius:12px;padding:22px 18px;border-top:6px solid ${d.weakColor};">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(d.weakSec)} GAP</div>
          <div style="font-size:52px;font-weight:800;color:${d.weakColor};line-height:1;font-family:'Inter',sans-serif;">+${d.weakLift}</div>
          <div style="font-size:14px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${d.weakScore} → ${esc(d.weakIsRW ? d.rwTargetStr : d.mathTargetStr)} (the climb)</div>
        </div>
        <div style="background:#F3F4F6;border-radius:12px;padding:22px 18px;border-top:6px solid ${d.strongColor};">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;font-family:'Inter',sans-serif;">${esc(d.strongSec)} POLISH</div>
          <div style="font-size:52px;font-weight:800;color:${d.strongColor};line-height:1;font-family:'Inter',sans-serif;">+${d.strongLift}</div>
          <div style="font-size:14px;color:#64748B;margin-top:6px;font-family:'Inter',sans-serif;">${d.strongScore} → ${esc(d.weakIsRW ? d.mathTargetStr : d.rwTargetStr)} (already strong)</div>
        </div>
      </div>
      <!-- Bottom callout -->
      <div style="background:#FAEFD4;border-radius:12px;padding:18px 28px;">
        <div style="font-size:17px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">
          ${d.weeks} WEEKS · ${d.totalHours} HOURS · ${d.phaseCount} PHASES · ${d.testCount} PRACTICE TESTS
        </div>
        <div style="font-size:14px;color:#334155;margin-top:5px;font-family:'Inter',sans-serif;">
          Built around the ${esc(d.testMonth)} SAT — engineered to lift ${esc(d.weakSec)} and protect ${esc(d.strongSec)}.
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide2Standing(d, n) {
  const rwRead  = d.rwCur  >= 700 ? 'At the ceiling' : d.rwCur  >= 650 ? 'Strong — nearly there' : d.rwCur  >= 600 ? 'Solid foundation' : d.rwCur  >= 550 ? 'Building room' : 'Largest opportunity';
  const mRead   = d.mathCur >= 700 ? 'At the ceiling' : d.mathCur >= 650 ? 'Strong — nearly there' : d.mathCur >= 600 ? 'Solid foundation' : d.mathCur >= 550 ? 'Building room' : 'Largest opportunity';
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'STARTING POINT')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader(`WHERE ${esc(d.firstName.toUpperCase())} STANDS TODAY`, `${d.baseline}. With zero structured prep.`)}
      <!-- Hero number -->
      <div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="font-size:160px;font-weight:800;color:#1B3A5C;line-height:1;letter-spacing:-0.04em;font-family:'Inter',sans-serif;">${d.baseline}</div>
        <div style="font-size:18px;color:#334155;margin-top:8px;font-family:'Inter',sans-serif;">${esc(d.baselineLabel)} · No structured prep</div>
        <div style="font-size:16px;font-weight:700;color:#C8553D;margin-top:6px;letter-spacing:0.1em;text-transform:uppercase;font-family:'Inter',sans-serif;">${d.baselinePct} PERCENTILE NATIONALLY</div>
      </div>
      <!-- Two score cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="background:${d.mathBg};border-radius:12px;padding:28px 36px;border-top:4px solid ${d.mathColor};">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">MATH</div>
          <div style="font-size:88px;font-weight:800;color:${d.mathColor};line-height:1;letter-spacing:-0.02em;font-family:'Inter',sans-serif;">${d.mathCur}</div>
          <div style="font-size:15px;color:#334155;margin-top:8px;font-family:'Inter',sans-serif;">${d.mathPct} percentile · ${mRead}</div>
        </div>
        <div style="background:${d.rwBg};border-radius:12px;padding:28px 36px;border-top:4px solid ${d.rwColor};">
          <div style="font-size:14px;font-weight:700;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">READING &amp; WRITING</div>
          <div style="font-size:88px;font-weight:800;color:${d.rwColor};line-height:1;letter-spacing:-0.02em;font-family:'Inter',sans-serif;">${d.rwCur}</div>
          <div style="font-size:15px;color:#334155;margin-top:8px;font-family:'Inter',sans-serif;">${d.rwPct} percentile · ${rwRead}</div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide3Diagnosis(d, n) {
  // Bar widths: represent score as % of target
  const mathFill = Math.min(100, Math.round((d.mathCur / d.target) * 100));
  const rwFill   = Math.min(100, Math.round((d.rwCur   / d.target) * 100));
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'DIAGNOSIS')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('THE DIAGNOSIS', d.thesis)}
      <!-- Visual bars -->
      <div style="flex:1;display:flex;flex-direction:column;gap:32px;justify-content:center;margin-bottom:24px;">
        <!-- Math bar -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <div>
              <span style="font-size:20px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">MATH</span>
              <span style="font-size:14px;color:#64748B;margin-left:10px;font-family:'Inter',sans-serif;">${d.mathPct} percentile · ${d.weakIsRW ? 'The foundation' : 'The gap'}</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:${d.mathColor};font-family:'Inter',sans-serif;">→ ${esc(d.mathTargetStr)}</div>
          </div>
          <div style="height:80px;background:#E5E7EB;border-radius:8px;position:relative;overflow:hidden;">
            <div style="width:${mathFill}%;height:100%;background:${d.mathColor};border-radius:8px;display:flex;align-items:center;padding-left:20px;">
              <span style="font-size:30px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${d.mathCur}</span>
            </div>
          </div>
        </div>
        <!-- R/W bar -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <div>
              <span style="font-size:20px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">READING &amp; WRITING</span>
              <span style="font-size:14px;color:#64748B;margin-left:10px;font-family:'Inter',sans-serif;">${d.rwPct} percentile · ${d.weakIsRW ? 'The gap' : 'The foundation'}</span>
            </div>
            <div style="font-size:20px;font-weight:700;color:${d.rwColor};font-family:'Inter',sans-serif;">${d.weakIsRW ? `+${d.weakLift} to close` : `→ ${esc(d.rwTargetStr)}`}</div>
          </div>
          <div style="height:80px;background:#E5E7EB;border-radius:8px;position:relative;overflow:hidden;">
            <div style="width:${rwFill}%;height:100%;background:${d.rwColor};border-radius:8px;display:flex;align-items:center;padding-left:20px;">
              <span style="font-size:30px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${d.rwCur}</span>
            </div>
            <div style="position:absolute;top:0;left:${rwFill}%;height:100%;display:flex;align-items:center;padding-left:10px;">
              <span style="font-size:13px;font-weight:700;color:${d.rwColor};font-family:'Inter',sans-serif;white-space:nowrap;">TARGET ${esc(d.rwTargetStr)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide4Domains(d, n) {
  function domainRow(dom, isLast) {
    const arrowColor = (dom.priority || '').toLowerCase() === 'high' ? '#C8553D'
      : (dom.priority || '').toLowerCase() === 'protect' ? '#2D8659' : '#C9942C';
    return `<div style="flex:1;display:flex;align-items:center;justify-content:space-between;padding:0 24px;${isLast ? '' : 'border-bottom:1px solid #E5E7EB;'}">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:17px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">${esc(dom.domain)}</span>
          ${domainPill(dom.priority)}
        </div>
        <div style="font-size:13px;color:#64748B;font-style:italic;margin-top:3px;font-family:'Inter',sans-serif;">${esc(dom.performance)}</div>
      </div>
      <div style="font-size:15px;font-weight:700;color:${arrowColor};margin-left:16px;font-family:'Inter',sans-serif;">→ ${esc(dom.target)}</div>
    </div>`;
  }
  const rwRows   = d.rwDomains.map((dom, i) => domainRow(dom, i === d.rwDomains.length - 1)).join('');
  const mathRows = d.mathDomains.map((dom, i) => domainRow(dom, i === d.mathDomains.length - 1)).join('');
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'DOMAIN BREAKDOWN')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('WHERE THE POINTS LIVE', `8 domains. ${d.highPriorityCount} drive the climb.`)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex:1;margin-bottom:24px;">
        <!-- R/W column -->
        <div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;display:flex;flex-direction:column;">
          <div style="background:${d.rwColor};padding:20px 24px;flex-shrink:0;">
            <div style="font-size:17px;font-weight:800;color:white;font-family:'Inter',sans-serif;">READING &amp; WRITING</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;font-family:'Inter',sans-serif;">Current: ${d.rwCur} | Target: ${esc(d.rwTargetStr)}</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">${rwRows}</div>
        </div>
        <!-- Math column -->
        <div style="border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;display:flex;flex-direction:column;">
          <div style="background:${d.mathColor};padding:20px 24px;flex-shrink:0;">
            <div style="font-size:17px;font-weight:800;color:white;font-family:'Inter',sans-serif;">MATH</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;font-family:'Inter',sans-serif;">Current: ${d.mathCur} | Target: ${esc(d.mathTargetStr)}</div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">${mathRows}</div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide5Admissions(d, n) {
  const tierContext = d.scoreBandDisplay;
  const strongPct = d.weakIsRW ? d.mathPct : d.rwPct;
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'WHY THIS MATTERS')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('WHAT ADMISSIONS ACTUALLY SEES', `At ${d.target}, ${esc(d.weakSec)} becomes the score that matters.`)}
      <div style="display:flex;flex-direction:column;gap:20px;flex:1;">
        <!-- Strong section card -->
        <div style="background:${d.strongBg};border-radius:12px;padding:28px 36px;border-left:6px solid ${d.strongColor};flex:1;display:flex;flex-direction:column;justify-content:flex-start;">
          <div style="font-size:14px;font-weight:700;color:${d.strongColor};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;font-family:'Inter',sans-serif;">${esc(d.strongSec)} AT ${strongPct} PERCENTILE</div>
          <div style="font-size:28px;font-weight:700;color:#1B3A5C;margin-bottom:8px;font-family:'Inter',sans-serif;">Qualifies for ${esc(tierContext)} programs.</div>
          <div style="font-size:16px;color:#334155;font-family:'Inter',sans-serif;">A strong foundation — now the weaker section must match it.</div>
        </div>
        <!-- Weak section card -->
        <div style="background:${d.weakBg};border-radius:12px;padding:28px 36px;border-left:6px solid ${d.weakColor};flex:1;display:flex;flex-direction:column;justify-content:flex-start;">
          <div style="font-size:14px;font-weight:700;color:${d.weakColor};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;font-family:'Inter',sans-serif;">${esc(d.weakSec)} AT TARGET: ${esc(d.weakIsRW ? d.rwTargetStr : d.mathTargetStr)}</div>
          <div style="font-size:28px;font-weight:700;color:#1B3A5C;margin-bottom:8px;font-family:'Inter',sans-serif;">The score they actually look at.</div>
          <div style="font-size:16px;color:#334155;font-family:'Inter',sans-serif;">Proves the gap is closed. Removes the only flag on ${esc(d.firstName)}'s profile.</div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide6Plan(d, n) {
  const teal = '#1A8870';
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE PLAN')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader(`BUILT AROUND THE ${esc(d.testMonth.toUpperCase())} SAT`, `${d.weeks} weeks. ${d.totalHours} hours. ${d.phaseCount} phases.`)}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:20px;flex:1;margin-bottom:24px;">
        <div style="background:#F3F4F6;border-radius:12px;padding:28px 24px;border-top:6px solid #1B3A5C;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">WEEKS</div>
          <div style="font-size:80px;font-weight:800;color:#1B3A5C;line-height:1;font-family:'Inter',sans-serif;">${d.weeks}</div>
          <div style="font-size:14px;color:#64748B;margin-top:8px;font-family:'Inter',sans-serif;">program duration</div>
        </div>
        <div style="background:#F3F4F6;border-radius:12px;padding:28px 24px;border-top:6px solid ${teal};text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">TOTAL HOURS</div>
          <div style="font-size:80px;font-weight:800;color:${teal};line-height:1;font-family:'Inter',sans-serif;">${d.totalHours}</div>
          <div style="font-size:14px;color:#64748B;margin-top:8px;font-family:'Inter',sans-serif;">in-session + test prep</div>
        </div>
        <div style="background:#F3F4F6;border-radius:12px;padding:28px 24px;border-top:6px solid ${d.weakColor};text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PHASES</div>
          <div style="font-size:80px;font-weight:800;color:${d.weakColor};line-height:1;font-family:'Inter',sans-serif;">${d.phaseCount}</div>
          <div style="font-size:14px;color:#64748B;margin-top:8px;font-family:'Inter',sans-serif;">each with a clear job</div>
        </div>
        <div style="background:#F3F4F6;border-radius:12px;padding:28px 24px;border-top:6px solid ${d.strongColor};text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:13px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;font-family:'Inter',sans-serif;">PRACTICE TESTS</div>
          <div style="font-size:80px;font-weight:800;color:${d.strongColor};line-height:1;font-family:'Inter',sans-serif;">${d.testCount}</div>
          <div style="font-size:14px;color:#64748B;margin-top:8px;font-family:'Inter',sans-serif;">tracking the climb</div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
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
    ${brandBar(d.firstName, 'WHERE THE TIME GOES')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('TIME FOLLOWS THE POINTS', `${domPct}% of instruction time goes to ${esc(dominant)}.`)}
      <div style="display:grid;grid-template-columns:2fr 3fr;gap:48px;flex:1;align-items:center;margin-bottom:20px;">
        <!-- Donut -->
        <div style="display:flex;justify-content:center;align-items:center;">${svg}</div>
        <!-- Bars -->
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="background:${d.rwBg};border-radius:12px;padding:22px 28px;border-left:6px solid ${d.rwColor};display:flex;align-items:center;gap:24px;">
            <div style="font-size:64px;font-weight:800;color:${d.rwColor};line-height:1;font-family:'Inter',sans-serif;">${d.rwAllocPct}%</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">READING &amp; WRITING</div>
              <div style="font-size:14px;color:#334155;margin-top:4px;font-family:'Inter',sans-serif;">${d.rwAlloc} hrs · ${esc(rwDesc)}</div>
            </div>
          </div>
          <div style="background:${d.mathBg};border-radius:12px;padding:22px 28px;border-left:6px solid ${d.mathColor};display:flex;align-items:center;gap:24px;">
            <div style="font-size:64px;font-weight:800;color:${d.mathColor};line-height:1;font-family:'Inter',sans-serif;">${d.mathAllocPct}%</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">MATH</div>
              <div style="font-size:14px;color:#334155;margin-top:4px;font-family:'Inter',sans-serif;">${d.mathAlloc} hrs · ${esc(mathDesc)}</div>
            </div>
          </div>
          <div style="background:#FAEFD4;border-radius:12px;padding:22px 28px;border-left:6px solid #C9942C;display:flex;align-items:center;gap:24px;">
            <div style="font-size:64px;font-weight:800;color:#C9942C;line-height:1;font-family:'Inter',sans-serif;">${d.stratAllocPct}%</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">STRATEGY &amp; TESTING</div>
              <div style="font-size:14px;color:#334155;margin-top:4px;font-family:'Inter',sans-serif;">${d.stratH} hrs · Practice tests + pacing + timed conditions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide8Phases(d, n) {
  const phases = d.parsedPhases.slice(0, 4); // max 4 per slide
  const cards = phases.map((ph, i) => {
    const color = PHASE_COLORS[i] || PHASE_COLORS[0];
    const wkLabel = ph.wkStart && ph.wkEnd ? `Wks ${ph.wkStart}–${ph.wkEnd}` : ph.wkStart ? `Wk ${ph.wkStart}` : '';
    return `<div style="border-radius:12px;overflow:hidden;flex:1;display:flex;flex-direction:column;">
      <div style="background:${color};padding:18px 22px;min-height:80px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.85);text-transform:uppercase;font-family:'Inter',sans-serif;">PHASE ${i + 1}</div>
        <div style="font-size:19px;font-weight:700;color:white;margin-top:4px;line-height:1.2;font-family:'Inter',sans-serif;">${esc(ph.shortName || ph.title)}</div>
      </div>
      <div style="background:#F3F4F6;padding:22px;flex:1;">
        <div style="font-size:15px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">${esc([wkLabel, ph.hours ? `${ph.hours} hrs` : ''].filter(Boolean).join(' · '))}</div>
        <div style="font-size:14px;color:#64748B;margin-top:3px;margin-bottom:14px;font-family:'Inter',sans-serif;">${esc(ph.season)}</div>
        <div style="font-size:16px;color:#1E293B;line-height:1.55;font-family:'Inter',sans-serif;">${esc(ph.shortDesc)}</div>
      </div>
    </div>`;
  }).join('');

  // Dotted timeline connecting cards
  const dots = phases.map((_, i) => {
    const pct = (i / (phases.length - 1)) * 100;
    return `<div style="position:absolute;left:${pct}%;transform:translateX(-50%);width:10px;height:10px;background:#1B3A5C;border-radius:50%;top:50%;transform:translate(-50%,-50%);"></div>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE ROADMAP')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('EACH PHASE HAS ONE JOB', `${d.phaseCount} phases. One mission per phase.`)}
      <div style="display:flex;gap:18px;flex:1;margin-bottom:20px;">${cards}</div>
      <!-- Dotted timeline -->
      <div style="position:relative;height:24px;margin-bottom:0;">
        <div style="position:absolute;top:50%;left:0;right:0;height:1px;border-top:2px dashed #E5E7EB;transform:translateY(-50%);"></div>
        ${dots}
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
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
    ${brandBar(d.firstName, 'CADENCE')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
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
            <div style="font-size:13px;color:#334155;margin-top:6px;margin-bottom:20px;font-family:'Inter',sans-serif;">Total in-session time during school year</div>
            <ul style="list-style:none;padding:0;">${syBullets}</ul>
          </div>
        </div>
        <!-- Summer -->
        <div style="border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="background:#C8553D;padding:24px 32px;">
            <div style="font-size:14px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.7);text-transform:uppercase;font-family:'Inter',sans-serif;">SUMMER · WEEKS ${sumRange}</div>
            <div style="font-size:30px;font-weight:800;color:white;margin-top:8px;font-family:'Inter',sans-serif;">~${sumHrsPerWeek} hrs / week</div>
          </div>
          <div style="background:#FBE5DD;padding:32px;flex:1;">
            <div style="font-size:60px;font-weight:800;color:#C8553D;line-height:1;font-family:'Inter',sans-serif;">${d.sumHrs} hrs</div>
            <div style="font-size:13px;color:#334155;margin-top:6px;margin-bottom:20px;font-family:'Inter',sans-serif;">Total in-session time across summer</div>
            <ul style="list-style:none;padding:0;">${sumBullets}</ul>
          </div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide10Checkpoints(d, n) {
  const count  = d.testCount;
  const colors = ['#1B3A5C','#1A8870','#C8553D','#C9942C','#3A9D6B','#2D8659'];
  const cadence = d.weeks > 0 && count > 0 ? `${Math.round(d.weeks / count)}–${Math.round(d.weeks / count) + 1} weeks` : '2–3 weeks';

  // Build test circles with alternating above/below
  const circles = Array.from({ length: count }, (_, i) => {
    const color = colors[i % colors.length];
    const above = i % 2 === 0;
    const row   = d.testRows[i];
    const job   = row?.status || (i === count - 1 ? 'Final check' : 'Progress check');
    const wk    = row?.milestone?.match(/[Ww](?:eek)?\s*(\d+)/)?.[1] || '';
    const score = row?.total || d.chartPoints[i + 1]?.score || '';
    const leftPct = count > 1 ? (i / (count - 1)) * 100 : 50;

    const labelHtml = `<div style="text-align:center;width:140px;">
      <div style="font-size:16px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">Test #${i + 1}</div>
      ${wk ? `<div style="font-size:14px;color:#64748B;font-family:'Inter',sans-serif;">Wk ${wk}</div>` : ''}
      ${score ? `<div style="font-size:18px;font-weight:700;color:${color};margin-top:2px;font-family:'Inter',sans-serif;">${esc(String(score))}</div>` : ''}
      <div style="font-size:13px;font-style:italic;color:#64748B;margin-top:2px;font-family:'Inter',sans-serif;">${esc(job)}</div>
    </div>`;

    return `<div style="position:absolute;left:${leftPct}%;top:78px;transform:translateX(-50%);width:44px;">
      ${above ? `<div style="position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);text-align:center;width:140px;">${labelHtml}</div>` : ''}
      <div style="width:44px;height:44px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:16px;font-weight:800;color:white;font-family:'Inter',sans-serif;">${i + 1}</div>
      ${!above ? `<div style="position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);text-align:center;width:140px;">${labelHtml}</div>` : ''}
    </div>`;
  }).join('');

  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'CHECKPOINTS')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader("WE DON'T GUESS. WE MEASURE.", `${count} full practice tests. One every ${cadence}.`)}
      <!-- Circle timeline -->
      <div style="flex:1;display:flex;align-items:center;position:relative;margin:0 40px 20px;">
        <div style="position:absolute;top:50%;left:0;right:0;height:2px;background:#E5E7EB;transform:translateY(-50%);"></div>
        <div style="position:absolute;top:12px;left:0;font-size:10px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;font-family:'Inter',sans-serif;">DIAGNOSTIC</div>
        <div style="position:absolute;top:12px;right:0;font-size:10px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;font-family:'Inter',sans-serif;">TEST DAY</div>
        <div style="position:relative;width:100%;height:200px;">${circles}</div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide11Progression(d, n) {
  const svg = lineChartSvg(d.chartPoints, d.baseline, d.target);
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE CLIMB')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('THE PROGRESSION', `Plotted from ${esc(d.baselineLabel)} baseline to ${esc(d.testMonth)} target.`)}
      <div style="flex:1;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">${svg}</div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide12Outcomes(d, n) {
  const tierName    = d.scoreBandDisplay;
  const namedSchool = d.cols ? d.cols.split(',')[0].trim() : '';
  const schoolLine  = namedSchool
    ? `Competitive at ${namedSchool.charAt(0).toUpperCase() + namedSchool.slice(1)} and similar programs.`
    : `${d.target}+ composite opens the ${esc(tierName)} range.`;
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'THE OUTCOME')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader('WHAT ' + d.target + ' UNLOCKS', `The score that opens ${esc(tierName)} doors.`)}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;flex:1;margin-bottom:24px;">
        <div style="background:#E8EEF7;border-radius:12px;padding:32px;border-left:6px solid #1B3A5C;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:56px;font-weight:800;color:#1B3A5C;line-height:1;margin-bottom:16px;font-family:'Inter',sans-serif;">01</div>
            <div style="font-size:22px;font-weight:700;color:#1B3A5C;margin-bottom:10px;font-family:'Inter',sans-serif;">${esc(tierName)} Composite</div>
          </div>
          <div style="font-size:15px;color:#334155;line-height:1.5;font-family:'Inter',sans-serif;">${d.target}+ signals analytical range and breadth. Both sections proven at a competitive level.</div>
        </div>
        <div style="background:#FBE5DD;border-radius:12px;padding:32px;border-left:6px solid #C8553D;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:56px;font-weight:800;color:#C8553D;line-height:1;margin-bottom:16px;font-family:'Inter',sans-serif;">02</div>
            <div style="font-size:22px;font-weight:700;color:#1B3A5C;margin-bottom:10px;font-family:'Inter',sans-serif;">Removes the only flag</div>
          </div>
          <div style="font-size:15px;color:#334155;line-height:1.5;font-family:'Inter',sans-serif;">Lifts ${esc(d.weakSec)} from ${d.weakScore} to ${esc(d.weakIsRW ? d.rwTargetStr : d.mathTargetStr)} — no longer the weak point on an otherwise strong profile.</div>
        </div>
        <div style="background:#DCEDE2;border-radius:12px;padding:32px;border-left:6px solid #2D8659;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:56px;font-weight:800;color:#2D8659;line-height:1;margin-bottom:16px;font-family:'Inter',sans-serif;">03</div>
            <div style="font-size:22px;font-weight:700;color:#1B3A5C;margin-bottom:10px;font-family:'Inter',sans-serif;">Schools in range</div>
          </div>
          <div style="font-size:15px;color:#334155;line-height:1.5;font-family:'Inter',sans-serif;">${schoolLine}</div>
        </div>
      </div>
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

function slide13LockItIn(d, n) {
  const phase1Name = d.parsedPhases[0]?.shortName || 'Phase 1';
  return `<section style="width:1920px;height:1080px;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;">
    ${brandBar(d.firstName, 'NEXT STEPS')}
    <div style="flex:1;padding:48px 80px 80px;display:flex;flex-direction:column;background:white;">
      ${slideHeader("LET'S LOCK IT IN", 'Three steps to start the climb.')}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:24px;">
        ${[
          { num: '1', title: 'ENROLL TODAY', body: `Lock in your start date and pricing. We hold the ${esc(d.testMonth)} SAT seat.` },
          { num: '2', title: 'DIAGNOSTIC TEST', body: `Full StudyCore SAT diagnostic before Week 1. True SAT baseline confirmed.` },
          { num: '3', title: 'FIRST SESSION', body: `Meet your coach. Walk through results. Begin Phase 1: ${esc(phase1Name)}.` },
        ].map(s => `<div style="background:#F3F4F6;border-radius:12px;padding:32px;border:1px solid #E5E7EB;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="width:44px;height:44px;background:#C8553D;border-radius:50%;display:flex;align-items:center;justify-content:center;
              font-size:18px;font-weight:800;color:white;margin-bottom:20px;font-family:'Inter',sans-serif;">${s.num}</div>
            <div style="font-size:20px;font-weight:700;color:#1B3A5C;margin-bottom:10px;font-family:'Inter',sans-serif;">${s.title}</div>
          </div>
          <div style="font-size:15px;color:#334155;line-height:1.5;font-family:'Inter',sans-serif;">${s.body}</div>
        </div>`).join('')}
      </div>
      ${d.bottomLine ? `<div style="flex:1;background:#1B3A5C;border-radius:14px;padding:36px 48px;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:14px;font-family:'Inter',sans-serif;">THE BOTTOM LINE</div>
        <div style="font-size:22px;color:white;line-height:1.55;font-family:'Inter',sans-serif;">${esc(d.bottomLine)}</div>
      </div>` : `<div style="flex:1;background:#F3F4F6;border-radius:14px;padding:36px 48px;display:flex;align-items:center;">
        <div style="font-size:20px;font-weight:700;color:#1B3A5C;font-family:'Inter',sans-serif;">${d.weeks} wks · ${d.totalHours} hrs · ${d.phaseCount} phases · ${d.testCount} tests · Target: ${esc(d.testMonthYear)} SAT ${d.target}+</div>
      </div>`}
    </div>
    ${slideFooter(n, d.totalSlides)}
  </section>`;
}

// ── Proofreader ───────────────────────────────────────────────────────────────

async function proofreadData(d) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return d;

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
      content: `You are a proofreader for a professional SAT tutoring presentation. Fix any grammar, punctuation, capitalization, or awkward phrasing in the JSON below. Do NOT change meaning, numbers, names, scores, or structure. Return ONLY valid JSON with the exact same keys.\n\n${JSON.stringify(payload, null, 2)}`,
    }],
  });

  try {
    const text = msg.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return d;
    const corrected = JSON.parse(jsonMatch[0]);
    if (corrected.thesis) d.thesis = corrected.thesis;
    if (Array.isArray(corrected.phases)) {
      corrected.phases.forEach((ph, i) => {
        if (!d.parsedPhases[i]) return;
        if (ph.shortName) d.parsedPhases[i].shortName = ph.shortName;
        if (ph.shortDesc) d.parsedPhases[i].shortDesc = ph.shortDesc;
      });
    }
  } catch {
    // proofread failed — use original data unchanged
  }
  return d;
}

// ── HTML assembler ────────────────────────────────────────────────────────────

function generateHTML(d) {
  const slides = [];
  let n = 1;

  slides.push(slide1Cover(d, n++));
  slides.push(slide2Standing(d, n++));
  slides.push(slide3Diagnosis(d, n++));
  slides.push(slide4Domains(d, n++));
  slides.push(slide5Admissions(d, n++));
  slides.push(slide6Plan(d, n++));
  if (d.showTimeAlloc) slides.push(slide7TimeAlloc(d, n++));
  slides.push(slide8Phases(d, n++));
  if (d.showTwoGears) slides.push(slide9TwoGears(d, n++));
  slides.push(slide10Checkpoints(d, n++));
  slides.push(slide11Progression(d, n++));
  slides.push(slide12Outcomes(d, n++));
  slides.push(slide13LockItIn(d, n++));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(d.firstName)}'s SAT Game Plan</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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

// ── Main export ───────────────────────────────────────────────────────────────

export async function buildPresentationPdf(gamePlan, studentData, studentName) {
  const d       = derive(gamePlan, studentData, studentName);
  await proofreadData(d);
  const html    = generateHTML(d);
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      width: '1920px',
      height: '1080px',
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
