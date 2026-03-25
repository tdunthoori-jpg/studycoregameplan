'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getRecommendation, weeksUntilDate, SAT_TEST_DATES, PERFORMANCE_BANDS } from '../lib/recommend';

// ─── Constants ─────────────────────────────────────────────────────────────────
const STYLES = {
  navy:   '#1B365D',
  blue:   '#2E75B6',
  green:  '#27AE60',
  orange: '#D4740E',
  red:    '#C0392B',
};

function gapColor(gap) {
  if (!gap || gap <= 0) return STYLES.green;
  if (gap <= 200) return STYLES.green;
  if (gap <= 300) return STYLES.orange;
  return STYLES.red;
}
function gapLabel(gap) {
  if (!gap || gap <= 0) return '✅ Already at or above target';
  if (gap <= 200) return gap <= 100 ? '✅ Very achievable' : '📈 Ambitious but achievable with full homework';
  if (gap <= 300) return '📈 Ambitious but achievable with full homework';
  return '⚠️ Plan will set honest realistic + aspirational targets';
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ number, title, children }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #dde3ec',
      borderRadius: 8,
      marginBottom: 24,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    }}>
      <div style={{
        background: STYLES.navy,
        color: '#fff',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{
          background: STYLES.blue,
          color: '#fff',
          borderRadius: '50%',
          width: 28, height: 28,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, flexShrink: 0,
        }}>{number}</span>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.3 }}>{title}</span>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: STYLES.navy, marginBottom: 4, letterSpacing: 0.3 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ccd6e0',
  borderRadius: 5,
  fontSize: 14,
  color: '#333',
  outline: 'none',
  fontFamily: 'Arial, sans-serif',
  boxSizing: 'border-box',
};

const selectStyle = { ...inputStyle, background: '#fff' };

function Input({ value, onChange, type = 'text', placeholder, min, max, style: s, highlight }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      style={{
        ...inputStyle,
        ...(highlight ? { borderColor: STYLES.blue, boxShadow: `0 0 0 2px ${STYLES.blue}33` } : {}),
        ...s,
      }}
    />
  );
}

function Select({ value, onChange, options, highlight }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        ...selectStyle,
        ...(highlight ? { borderColor: STYLES.blue, boxShadow: `0 0 0 2px ${STYLES.blue}33` } : {}),
      }}
    >
      {options.map(opt =>
        typeof opt === 'string'
          ? <option key={opt} value={opt}>{opt}</option>
          : <option key={opt.value} value={opt.value}>{opt.label}</option>
      )}
    </select>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onParsed, onError, isParsing, setIsParsing }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  async function processFile(file) {
    if (!file) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      onError('Unsupported file type. Please upload a PDF or image (PNG, JPG, WEBP).');
      return;
    }
    setIsParsing(true);
    try {
      const base64 = await toBase64(file);
      const res = await fetch('/api/parse-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64, mediaType: file.type }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        onError(json.error || 'Failed to parse score report.');
      } else {
        onParsed(json.data);
      }
    } catch (err) {
      onError('Network error — please try again.');
    } finally {
      setIsParsing(false);
    }
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return (
    <div
      onClick={() => !isParsing && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragOver ? STYLES.blue : '#b0c4d8'}`,
        borderRadius: 8,
        padding: '28px 20px',
        textAlign: 'center',
        background: dragOver ? '#eaf3fb' : '#f7fafd',
        cursor: isParsing ? 'wait' : 'pointer',
        marginBottom: 20,
        transition: 'all 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={e => processFile(e.target.files[0])}
      />
      {isParsing ? (
        <div>
          <Spinner />
          <div style={{ marginTop: 10, color: STYLES.navy, fontWeight: 600 }}>Parsing score report with Claude Vision…</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
          <div style={{ fontWeight: 700, color: STYLES.navy, fontSize: 15, marginBottom: 4 }}>
            Drag & drop score report here
          </div>
          <div style={{ color: '#666', fontSize: 13 }}>
            or click to browse — PDF, PNG, or JPG
          </div>
          <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
            College Board, Huntington, StudyCore, or any practice test
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      display: 'inline-block',
      width: 24, height: 24,
      border: `3px solid #dde3ec`,
      borderTop: `3px solid ${STYLES.blue}`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const defaultDomains = { cs: '', ii: '', eoi: '', sec: '', alg: '', am: '', psda: '', gt: '' };

export default function HomePage() {
  // Student info
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade]             = useState('11th');
  const [testType, setTestType]       = useState('SAT');
  const [rwScore, setRwScore]         = useState('');
  const [mathScore, setMathScore]     = useState('');
  const [targetScore, setTargetScore] = useState('1400');
  const [targetDate, setTargetDate]   = useState('');
  const [colleges, setColleges]       = useState('');

  // Domains
  const [domains, setDomains] = useState({ ...defaultDomains });

  // Program
  const [totalHours, setTotalHours]         = useState('20');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('2');
  const [sessionLength, setSessionLength]   = useState('1 hr');
  const [weeks, setWeeks]                   = useState('');
  const [homeworkHrs, setHomeworkHrs]       = useState('3-4');

  // Notes
  const [notes, setNotes] = useState('');

  // PDF parse state
  const [parseStatus, setParseStatus] = useState(null); // null | 'success' | 'error'
  const [parseMessage, setParseMessage] = useState('');
  const [isParsing, setIsParsing]       = useState(false);
  const [highlightedFields, setHighlightedFields] = useState([]);
  const [additionalData, setAdditionalData] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError]         = useState('');
  const [downloads, setDownloads]       = useState(null); // { gamePlan, script, name }

  // Recommendation
  const [rec, setRec] = useState(null);

  // ── Computed values ──────────────────────────────────────────────────────────
  const total    = (parseInt(rwScore) || 0) + (parseInt(mathScore) || 0);
  const totalStr = total > 0 ? String(total) : '';
  const gap      = targetScore && total > 0 ? parseInt(targetScore) - total : null;

  // Auto-calc weeks from test date
  useEffect(() => {
    if (targetDate) {
      const w = weeksUntilDate(targetDate);
      if (w !== null && w > 0) setWeeks(String(w));
    }
  }, [targetDate]);

  // Auto-compute recommendation when gap or weeks change
  useEffect(() => {
    if (gap !== null) {
      const r = getRecommendation(gap, parseInt(weeks) || null);
      setRec(r);
    }
  }, [gap, weeks]);

  function applyRecommendation() {
    if (!rec) return;
    setTotalHours(String(rec.totalHours));
    setSessionsPerWeek(String(rec.sessionsPerWeek));
    setSessionLength(rec.sessionLength);
    setHomeworkHrs(rec.homeworkHrs);
  }

  // ── Score report parsed ──────────────────────────────────────────────────────
  function handleParsed(data) {
    const highlighted = [];
    if (data.studentName) { setStudentName(data.studentName); highlighted.push('studentName'); }
    if (data.grade)       { setGrade(data.grade);             highlighted.push('grade'); }
    if (data.testType)    { setTestType(data.testType);       highlighted.push('testType'); }
    if (data.rwScore)     { setRwScore(String(data.rwScore)); highlighted.push('rwScore'); }
    if (data.mathScore)   { setMathScore(String(data.mathScore)); highlighted.push('mathScore'); }
    if (data.domains) {
      setDomains(prev => {
        const next = { ...prev };
        Object.keys(defaultDomains).forEach(k => {
          if (data.domains[k]) { next[k] = data.domains[k]; highlighted.push('domain_' + k); }
        });
        return next;
      });
    }
    if (data.additionalData) setAdditionalData(data.additionalData);
    setHighlightedFields(highlighted);
    setParseStatus('success');
    setParseMessage('Score report parsed — verify data below, then fill in target info and generate.');
    setTimeout(() => setHighlightedFields([]), 4000);
  }

  function handleParseError(msg) {
    setParseStatus('error');
    setParseMessage(msg);
  }

  function hl(field) { return highlightedFields.includes(field); }

  // ── Generate ─────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenError('');
    setDownloads(null);
    setIsGenerating(true);
    try {
      const payload = {
        studentName: studentName || 'Student',
        grade,
        testType,
        rwScore:      parseInt(rwScore) || null,
        mathScore:    parseInt(mathScore) || null,
        totalScore:   total || null,
        targetScore:  parseInt(targetScore) || 1400,
        targetTestDate: targetDate || '',
        targetColleges: colleges,
        domains,
        totalHours:       parseInt(totalHours) || 20,
        sessionsPerWeek:  parseInt(sessionsPerWeek) || 2,
        sessionLength,
        weeks:            parseInt(weeks) || 10,
        homeworkHrs,
        notes,
        additionalData,
      };

      const res  = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setGenError(json.error || 'Generation failed. Please try again.');
        return;
      }

      setDownloads({
        gamePlan: json.gamePlanBase64,
        script:   json.scriptBase64,
        name:     json.studentName,
      });
    } catch (err) {
      setGenError('Network error — please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadFile(base64, filename) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const domainOptions = ['', ...PERFORMANCE_BANDS];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { background: #eef1f6; font-family: Arial, Helvetica, sans-serif; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #2E75B6 !important; box-shadow: 0 0 0 2px #2E75B633; }
      `}</style>

      {/* Header */}
      <div style={{ background: STYLES.navy, color: '#fff', padding: '0 0 0 0' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: 2, color: '#7FB3D8' }}>STUDYCORE</div>
          <div style={{ width: 1, height: 28, background: '#ffffff33' }} />
          <div style={{ fontSize: 16, color: '#d0dce8', fontWeight: 500 }}>SAT Game Plan Generator</div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#7FB3D8', fontStyle: 'italic' }}>For Sales Reps Only</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Upload section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.navy, marginBottom: 8, letterSpacing: 0.3 }}>
            UPLOAD SCORE REPORT (OPTIONAL — AUTO-FILLS FORM)
          </div>
          <UploadZone
            onParsed={handleParsed}
            onError={handleParseError}
            isParsing={isParsing}
            setIsParsing={setIsParsing}
          />
          {parseStatus === 'success' && (
            <div style={{ background: '#eafaf1', border: '1px solid #27AE60', borderRadius: 6, padding: '10px 14px', color: '#1e7e44', fontSize: 14, fontWeight: 600 }}>
              ✅ {parseMessage}
            </div>
          )}
          {parseStatus === 'error' && (
            <div style={{ background: '#fdf0ef', border: '1px solid #C0392B', borderRadius: 6, padding: '10px 14px', color: '#922b21', fontSize: 14 }}>
              ⚠️ {parseMessage} — <span style={{ fontWeight: 700 }}>Enter scores manually below.</span>
            </div>
          )}
        </div>

        {/* Section 1: Student Information */}
        <SectionCard number="1" title="Student Information">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Student Name *">
                <Input value={studentName} onChange={setStudentName} placeholder="e.g. Alex Johnson" highlight={hl('studentName')} />
              </Field>
            </div>
            <Field label="Grade">
              <Select value={grade} onChange={setGrade} options={['9th','10th','11th','12th']} highlight={hl('grade')} />
            </Field>
            <Field label="Test Type">
              <Select value={testType} onChange={setTestType} options={['SAT','PSAT','PSAT 10','PSAT/NMSQT','Practice Test']} highlight={hl('testType')} />
            </Field>
            <Field label="R/W Score">
              <Input type="number" value={rwScore} onChange={setRwScore} placeholder="200–800" min="200" max="800" highlight={hl('rwScore')} />
            </Field>
            <Field label="Math Score">
              <Input type="number" value={mathScore} onChange={setMathScore} placeholder="200–800" min="200" max="800" highlight={hl('mathScore')} />
            </Field>
            <Field label="Total Score" hint="Auto-calculated">
              <Input value={totalStr} onChange={() => {}} placeholder="—" style={{ background: '#f7fafd', color: '#555' }} />
            </Field>
            <Field label="Target Score">
              <Input type="number" value={targetScore} onChange={setTargetScore} placeholder="1400" min="400" max="1600" />
            </Field>
          </div>

          {/* Gap indicator */}
          {gap !== null && (
            <div style={{
              background: '#f7fafd', border: `1px solid ${gapColor(gap)}44`,
              borderLeft: `4px solid ${gapColor(gap)}`,
              borderRadius: 6, padding: '10px 14px', marginTop: 4, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: gapColor(gap) }}>{gapLabel(gap)}</span>
              {gap > 0 && <span style={{ fontSize: 13, color: '#666' }}>— {gap}-point gap</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Field label="Target Test Date">
              <Select
                value={targetDate}
                onChange={setTargetDate}
                options={[{ label: '— Select date —', value: '' }, ...SAT_TEST_DATES]}
              />
            </Field>
            <Field label="Target Colleges" hint="Comma-separated">
              <Input value={colleges} onChange={setColleges} placeholder="e.g. UNC Chapel Hill, UVA, Wake Forest" />
            </Field>
          </div>
        </SectionCard>

        {/* Section 2: Domain Performance */}
        <SectionCard number="2" title="Domain Performance">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            {/* R/W */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: STYLES.blue, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Reading &amp; Writing
              </div>
              <Field label="Craft & Structure (C&S)">
                <Select value={domains.cs} onChange={v => setDomains(p => ({ ...p, cs: v }))} options={domainOptions} highlight={hl('domain_cs')} />
              </Field>
              <Field label="Information & Ideas (I&I)">
                <Select value={domains.ii} onChange={v => setDomains(p => ({ ...p, ii: v }))} options={domainOptions} highlight={hl('domain_ii')} />
              </Field>
              <Field label="Expression of Ideas (EoI)">
                <Select value={domains.eoi} onChange={v => setDomains(p => ({ ...p, eoi: v }))} options={domainOptions} highlight={hl('domain_eoi')} />
              </Field>
              <Field label="Standard English Conventions (SEC)">
                <Select value={domains.sec} onChange={v => setDomains(p => ({ ...p, sec: v }))} options={domainOptions} highlight={hl('domain_sec')} />
              </Field>
            </div>
            {/* Math */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: STYLES.blue, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Math
              </div>
              <Field label="Algebra">
                <Select value={domains.alg} onChange={v => setDomains(p => ({ ...p, alg: v }))} options={domainOptions} highlight={hl('domain_alg')} />
              </Field>
              <Field label="Advanced Math (AM)">
                <Select value={domains.am} onChange={v => setDomains(p => ({ ...p, am: v }))} options={domainOptions} highlight={hl('domain_am')} />
              </Field>
              <Field label="Problem-Solving & Data Analysis (PSDA)">
                <Select value={domains.psda} onChange={v => setDomains(p => ({ ...p, psda: v }))} options={domainOptions} highlight={hl('domain_psda')} />
              </Field>
              <Field label="Geometry & Trigonometry (G&T)">
                <Select value={domains.gt} onChange={v => setDomains(p => ({ ...p, gt: v }))} options={domainOptions} highlight={hl('domain_gt')} />
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Section 3: Program Structure */}
        <SectionCard number="3" title="Program Structure">
          {rec && (
            <div style={{
              background: '#eaf3fb', border: `1px solid ${STYLES.blue}`,
              borderRadius: 6, padding: '12px 16px', marginBottom: 16,
            }}>
              <div style={{ fontWeight: 700, color: STYLES.navy, fontSize: 14, marginBottom: 4 }}>
                💡 Recommended Program
              </div>
              <div style={{ fontSize: 13, color: '#444', marginBottom: 10 }}>
                {rec.totalHours} hrs total &nbsp;·&nbsp; {rec.sessionsPerWeek}x/week &nbsp;·&nbsp; {rec.sessionLength} sessions &nbsp;·&nbsp; {rec.homeworkHrs} hrs homework/week
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10, fontStyle: 'italic' }}>{rec.note}</div>
              <button
                onClick={applyRecommendation}
                style={{
                  background: STYLES.blue, color: '#fff', border: 'none', borderRadius: 5,
                  padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Apply Recommendation
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px' }}>
            <Field label="Total Hours">
              <Input type="number" value={totalHours} onChange={setTotalHours} placeholder="20" min="5" max="120" />
            </Field>
            <Field label="Sessions Per Week">
              <Select value={sessionsPerWeek} onChange={setSessionsPerWeek} options={['1','2','3']} />
            </Field>
            <Field label="Session Length">
              <Select value={sessionLength} onChange={setSessionLength} options={['45 min','1 hr','1.5 hrs','2 hrs']} />
            </Field>
            <Field label="Weeks" hint={targetDate ? 'Auto-set from test date' : ''}>
              <Input type="number" value={weeks} onChange={setWeeks} placeholder="10" min="1" max="52" />
            </Field>
            <Field label="Homework Hrs/Week">
              <Input value={homeworkHrs} onChange={setHomeworkHrs} placeholder="3-4" />
            </Field>
          </div>
        </SectionCard>

        {/* Section 4: Notes */}
        <SectionCard number="4" title="Special Circumstances & Notes">
          <Field label="Notes for Claude" hint="504 plans, prior tutoring, price sensitivity, ACT interest, family context, additional test dates, etc.">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Has 504 for extended time. Took Huntington for 3 months last year with minimal progress. Family is budget-conscious. Interested in ACT as backup. Dad is very involved."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </Field>
        </SectionCard>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: isGenerating ? '#7a9bbf' : `linear-gradient(135deg, ${STYLES.navy}, ${STYLES.blue})`,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 17,
            fontWeight: 800,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(27,54,93,0.25)',
            transition: 'all 0.2s',
          }}
        >
          {isGenerating ? (
            <>
              <Spinner />
              Generating Game Plan + Meeting Script…
            </>
          ) : (
            '⚡ Generate Game Plan + Meeting Script'
          )}
        </button>

        {/* Error */}
        {genError && (
          <div style={{
            marginTop: 16, background: '#fdf0ef', border: '1px solid #C0392B',
            borderRadius: 6, padding: '12px 16px', color: '#922b21', fontSize: 14,
          }}>
            ⚠️ {genError}
          </div>
        )}

        {/* Downloads */}
        {downloads && (
          <div style={{
            marginTop: 24, background: '#eafaf1', border: '1px solid #27AE60',
            borderRadius: 8, padding: '20px 24px',
          }}>
            <div style={{ fontWeight: 800, color: STYLES.navy, fontSize: 16, marginBottom: 4 }}>
              ✅ Files ready for {downloads.name}
            </div>
            <div style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>
              Click below to download both .docx files.
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => downloadFile(downloads.gamePlan, `${downloads.name}_GamePlan.docx`)}
                style={{
                  background: STYLES.navy, color: '#fff', border: 'none', borderRadius: 6,
                  padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                📋 Download Game Plan (.docx)
              </button>
              <button
                onClick={() => downloadFile(downloads.script, `${downloads.name}_MeetingScript.docx`)}
                style={{
                  background: STYLES.blue, color: '#fff', border: 'none', borderRadius: 6,
                  padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                🎤 Download Meeting Script (.docx)
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#aaa' }}>
          StudyCore Game Plan Generator — Internal Use Only &nbsp;·&nbsp; All generated documents are confidential.
        </div>
      </div>
    </>
  );
}
