'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getRecommendation, weeksUntilDate, SAT_TEST_DATES, ACT_TEST_DATES, PERFORMANCE_BANDS, STATE_COLLEGES, parseStateFromLocation } from '../lib/recommend';

// ─── Band normalization ────────────────────────────────────────────────────────
// Maps whatever Claude Vision returns → exact dropdown option
function normalizeBand(raw) {
  if (!raw || raw === 'null') return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (s === 'N/A' || /^n\/?a$/i.test(s)) return 'N/A';
  if (/below\s*400/i.test(s)) return 'Below 400';

  // Normalize various dash characters → en-dash
  const normalized = s.replace(/[\u002D\u2014\u2013]/g, '–').replace(/\s*–\s*/g, '–');
  if (PERFORMANCE_BANDS.includes(normalized)) return normalized;

  // Extract first 3-digit number and map to closest band
  const match = s.match(/\d{3}/);
  if (match) {
    const n = parseInt(match[0]);
    if (n < 400) return 'Below 400';
    if (n <= 450) return '400–450';
    if (n <= 500) return '450–500';
    if (n <= 540) return '490–540';
    if (n <= 550) return '500–550';
    if (n <= 600) return '550–600';
    if (n <= 670) return '610–670';
    if (n <= 760) return '680–760';
    return '680–800';
  }
  return '';
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const STYLES = {
  navy:   '#1B365D',
  blue:   '#2E75B6',
  green:  '#27AE60',
  orange: '#D4740E',
  red:    '#C0392B',
};

function gapColor(gap, isACT = false) {
  if (!gap || gap <= 0) return STYLES.green;
  if (isACT) {
    if (gap <= 3) return STYLES.green;
    if (gap <= 6) return STYLES.orange;
    return STYLES.red;
  }
  if (gap <= 200) return STYLES.green;
  if (gap <= 300) return STYLES.orange;
  return STYLES.red;
}
function gapLabel(gap, isACT = false) {
  if (!gap || gap <= 0) return '✅ Already at or above target';
  if (isACT) {
    if (gap <= 2) return '✅ Very achievable';
    if (gap <= 5) return '📈 Ambitious but achievable with full homework';
    return '⚠️ Plan will set honest realistic + aspirational targets';
  }
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
  const [fileQueue, setFileQueue] = useState([]);
  const inputRef = useRef();
  const idRef = useRef(0);

  async function processFiles(fileList) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    const files = Array.from(fileList).filter(f => allowed.includes(f.type));

    if (files.length === 0) {
      onError('Unsupported file type. Please upload PDFs or images (PNG, JPG, WEBP).');
      return;
    }

    const newEntries = files.map(f => ({ id: idRef.current++, name: f.name, status: 'pending' }));
    setFileQueue(prev => [...prev, ...newEntries]);
    setIsParsing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = newEntries[i].id;

      setFileQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'parsing' } : e));

      try {
        const base64 = await toBase64(file);
        const res = await fetch('/api/parse-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: base64, mediaType: file.type }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setFileQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'error', msg: json.error || 'Parse failed' } : e));
        } else {
          const d = json.data;
          const score = d.totalScore || ((d.rwScore || 0) + (d.mathScore || 0)) || null;
          const label = [d.testType, score].filter(Boolean).join(' · ');
          setFileQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'done', label } : e));
          onParsed(json.data, file.name);
        }
      } catch {
        setFileQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'error', msg: 'Network error — try again' } : e));
      }
    }

    setIsParsing(false);
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const anyActive = isParsing && fileQueue.some(e => e.status === 'parsing' || e.status === 'pending');

  return (
    <div>
      <div
        onClick={() => !isParsing && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragOver ? STYLES.blue : '#b0c4d8'}`,
          borderRadius: 8,
          padding: '28px 20px',
          textAlign: 'center',
          background: dragOver ? '#eaf3fb' : '#f7fafd',
          cursor: isParsing ? 'wait' : 'pointer',
          marginBottom: fileQueue.length > 0 ? 10 : 20,
          transition: 'all 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          style={{ display: 'none' }}
          onChange={e => { processFiles(e.target.files); e.target.value = ''; }}
        />
        {anyActive ? (
          <div>
            <Spinner />
            <div style={{ marginTop: 10, color: STYLES.navy, fontWeight: 600 }}>
              Parsing score report{fileQueue.filter(e => e.status === 'parsing' || e.status === 'pending').length > 1 ? 's' : ''}…
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 700, color: STYLES.navy, fontSize: 15, marginBottom: 4 }}>
              Drag & drop score reports here
            </div>
            <div style={{ color: '#666', fontSize: 13 }}>
              or click to browse — PDF, PNG, or JPG · multiple files OK
            </div>
            <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
              College Board, Huntington, StudyCore, or any practice test
            </div>
          </>
        )}
      </div>

      {/* Per-file status list */}
      {fileQueue.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {fileQueue.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: item.status === 'done' ? '#eafaf1' : item.status === 'error' ? '#fdf0ef' : '#f7fafd',
              border: `1px solid ${item.status === 'done' ? '#27AE60' : item.status === 'error' ? '#C0392B' : '#dde3ec'}`,
              borderRadius: 6, padding: '7px 12px', fontSize: 13,
            }}>
              <span>
                {item.status === 'done' ? '✅' : item.status === 'error' ? '⚠️' : item.status === 'parsing' ? '⏳' : '⌛'}
              </span>
              <span style={{ color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </span>
              {item.label && (
                <span style={{ color: STYLES.navy, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.label}</span>
              )}
              {item.msg && (
                <span style={{ color: '#922b21', whiteSpace: 'nowrap' }}>{item.msg}</span>
              )}
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 2 }}>
            Form fields updated below — later uploads overwrite earlier values where non-null.
          </div>
        </div>
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
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [colleges, setColleges]       = useState('');
  const [studentState, setStudentState] = useState('');
  const [collegeSuggestions, setCollegeSuggestions] = useState([]);

  // ACT section scores
  const [actEnglish, setActEnglish] = useState('');
  const [actMath, setActMath]       = useState('');
  const [actReading, setActReading] = useState('');
  const [actScience, setActScience] = useState('');

  // Domains (SAT only)
  const [domains, setDomains] = useState({ ...defaultDomains });

  // Program
  const [totalHours, setTotalHours]         = useState('20');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('2');
  const [sessionLength, setSessionLength]   = useState('1 hr');
  const [weeks, setWeeks]                   = useState('');
  const [homeworkHrs, setHomeworkHrs]       = useState('3-4');

  // Notes
  const [notes, setNotes] = useState('');

  // Pricing & Guarantee
  const [programPrice, setProgramPrice]           = useState('');
  const [guaranteeThreshold, setGuaranteeThreshold] = useState('');
  const [paymentStructure, setPaymentStructure]   = useState('');

  // PDF parse state
  const [parseStatus, setParseStatus] = useState(null); // null | 'success' | 'error'
  const [parseMessage, setParseMessage] = useState('');
  const [isParsing, setIsParsing]       = useState(false);
  const [highlightedFields, setHighlightedFields] = useState([]);
  const [additionalData, setAdditionalData] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus]       = useState(''); // progress message
  const [genError, setGenError]         = useState('');
  const [downloads, setDownloads]       = useState(null);

  // Recommendation
  const [rec, setRec] = useState(null);

  // ── Computed values ──────────────────────────────────────────────────────────
  const isACT = testType === 'ACT';

  const actCompositeNum = (() => {
    const e = parseInt(actEnglish), m = parseInt(actMath), r = parseInt(actReading), s = parseInt(actScience);
    if (e > 0 && m > 0 && r > 0 && s > 0) return Math.round((e + m + r + s) / 4);
    return 0;
  })();

  const satTotal = (parseInt(rwScore) || 0) + (parseInt(mathScore) || 0);
  const total    = isACT ? actCompositeNum : satTotal;
  const totalStr = total > 0 ? String(total) : '';
  const gap      = targetScore && total > 0 ? parseInt(targetScore) - total : null;

  // Auto-calc per-hour rate from total price ÷ total hours
  const perHourRate = (() => {
    const price = parseInt(programPrice.replace(/[^0-9]/g, '')) || 0;
    const hours = parseInt(totalHours) || 0;
    if (price > 0 && hours > 0) return `$${Math.round(price / hours)}/hr`;
    return '';
  })();

  // Reset target score and date when switching test type
  useEffect(() => {
    setTargetScore(isACT ? '30' : '1400');
    setTargetDate('');
  }, [isACT]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (rec.planWeeks) setWeeks(String(rec.planWeeks));
  }

  // ── Score report parsed ──────────────────────────────────────────────────────
  // Called once per file; later files overwrite fields where non-null.
  function handleParsed(data, filename) {
    const highlighted = [];
    if (data.studentName) { setStudentName(data.studentName); highlighted.push('studentName'); }
    if (data.grade)       { setGrade(data.grade);             highlighted.push('grade'); }
    if (data.testType)    { setTestType(data.testType);       highlighted.push('testType'); }

    if (data.testType === 'ACT') {
      // Fill ACT section scores
      if (data.actEnglish) { setActEnglish(String(data.actEnglish)); highlighted.push('actEnglish'); }
      if (data.actMath)    { setActMath(String(data.actMath));       highlighted.push('actMath'); }
      if (data.actReading) { setActReading(String(data.actReading)); highlighted.push('actReading'); }
      if (data.actScience) { setActScience(String(data.actScience)); highlighted.push('actScience'); }
    } else {
      if (data.rwScore)   { setRwScore(String(data.rwScore));     highlighted.push('rwScore'); }
      if (data.mathScore) { setMathScore(String(data.mathScore)); highlighted.push('mathScore'); }
    }

    // Normalize and fill all domain bands
    if (data.domains) {
      setDomains(prev => {
        const next = { ...prev };
        Object.keys(defaultDomains).forEach(k => {
          const normalized = normalizeBand(data.domains[k]);
          if (normalized) { next[k] = normalized; highlighted.push('domain_' + k); }
        });
        return next;
      });
    }

    // Handle location → state detection → college suggestions
    if (data.location) {
      setStudentState(data.location);
      highlighted.push('studentState');
      const stateCode = parseStateFromLocation(data.location);
      if (stateCode && STATE_COLLEGES[stateCode]) {
        setCollegeSuggestions(STATE_COLLEGES[stateCode]);
      }
    }

    // Accumulate additionalData across multiple reports
    if (data.additionalData) {
      setAdditionalData(prev => {
        if (!prev) return data.additionalData;
        const separator = filename ? `\n\n--- ${filename} ---\n` : '\n\n---\n';
        return `${prev}${separator}${data.additionalData}`;
      });
    }

    setHighlightedFields(highlighted);
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
    setGenStatus('Starting…');
    setIsGenerating(true);

    const payload = {
      studentName: studentName || 'Student',
      grade,
      testType,
      rwScore:    isACT ? null : (parseInt(rwScore)   || null),
      mathScore:  isACT ? null : (parseInt(mathScore) || null),
      totalScore: total || null,
      targetScore:  parseInt(targetScore) || (isACT ? 30 : 1400),
      targetTestDate: targetDate || '',
      targetColleges: colleges,
      studentLocation: studentState,
      domains: isACT ? {
        actEnglish: parseInt(actEnglish) || null,
        actMath:    parseInt(actMath)    || null,
        actReading: parseInt(actReading) || null,
        actScience: parseInt(actScience) || null,
      } : domains,
      totalHours:       parseInt(totalHours) || 20,
      sessionsPerWeek:  parseInt(sessionsPerWeek) || 2,
      sessionLength,
      weeks:            parseInt(weeks) || 10,
      homeworkHrs,
      notes,
      additionalData,
      programPrice:        programPrice || '',
      perHourRate:         perHourRate || '',
      guaranteeThreshold:  guaranteeThreshold || '',
      paymentStructure:    paymentStructure || '',
    };

    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok && !res.body) {
        setGenError(`Server error (${res.status}). Please try again.`);
        return;
      }

      // Read NDJSON stream line by line
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep any incomplete trailing line

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try { msg = JSON.parse(line); } catch { continue; }

          if (msg.status === 'generating') {
            setGenStatus(msg.message || 'Calling Claude Sonnet…');
          } else if (msg.status === 'building') {
            setGenStatus(msg.message || 'Building .docx files…');
          } else if (msg.status === 'done') {
            setDownloads({ gamePlan: msg.gamePlanBase64, presentation: msg.presentationBase64, pptx: msg.pptxBase64, name: msg.studentName });
            setGenStatus('');
            return;
          } else if (msg.status === 'error') {
            setGenError(msg.error || 'Generation failed. Please try again.');
            return;
          }
        }
      }

      // Flush any remaining buffer (handles large done message split across final chunk)
      if (buffer.trim()) {
        let msg;
        try { msg = JSON.parse(buffer); } catch { /* incomplete data */ }
        if (msg?.status === 'done') {
          setDownloads({ gamePlan: msg.gamePlanBase64, presentation: msg.presentationBase64, pptx: msg.pptxBase64, name: msg.studentName });
          setGenStatus('');
          return;
        } else if (msg?.status === 'error') {
          setGenError(msg.error || 'Generation failed. Please try again.');
          return;
        }
      }

      // If stream ended without a done/error message
      setGenError('Stream ended unexpectedly — generation timed out or was interrupted. Please try again.');

    } catch (err) {
      if (err.name === 'AbortError') {
        setGenError('Request timed out. Generation takes 60–120 seconds — please try again.');
      } else {
        setGenError(`Error: ${err.message || 'Check your connection and try again.'}`);
      }
    } finally {
      setIsGenerating(false);
      setGenStatus('');
    }
  }

  function downloadFile(base64, filename) {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: 'application/pdf' });
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
          <div style={{ fontSize: 16, color: '#d0dce8', fontWeight: 500 }}>Game Plan Generator</div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#7FB3D8', fontStyle: 'italic' }}>For Sales Reps Only</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Upload section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: STYLES.navy, marginBottom: 8, letterSpacing: 0.3 }}>
            UPLOAD SCORE REPORTS (OPTIONAL — AUTO-FILLS FORM · MULTIPLE OK)
          </div>
          <UploadZone
            onParsed={handleParsed}
            onError={handleParseError}
            isParsing={isParsing}
            setIsParsing={setIsParsing}
          />
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
              <Select value={testType} onChange={setTestType} options={['SAT','ACT','PSAT','PSAT 10','PSAT/NMSQT','Practice Test']} highlight={hl('testType')} />
            </Field>
            {isACT ? (
              <>
                <Field label="English Score">
                  <Input type="number" value={actEnglish} onChange={setActEnglish} placeholder="1–36" min="1" max="36" highlight={hl('actEnglish')} />
                </Field>
                <Field label="Math Score">
                  <Input type="number" value={actMath} onChange={setActMath} placeholder="1–36" min="1" max="36" highlight={hl('actMath')} />
                </Field>
                <Field label="Reading Score">
                  <Input type="number" value={actReading} onChange={setActReading} placeholder="1–36" min="1" max="36" highlight={hl('actReading')} />
                </Field>
                <Field label="Science Score">
                  <Input type="number" value={actScience} onChange={setActScience} placeholder="1–36" min="1" max="36" highlight={hl('actScience')} />
                </Field>
                <Field label="ACT Composite" hint="Auto-calculated (avg of 4 sections, rounded)">
                  <Input value={totalStr} onChange={() => {}} placeholder="—" style={{ background: '#f7fafd', color: '#555' }} />
                </Field>
                <Field label="Target Composite">
                  <Input type="number" value={targetScore} onChange={setTargetScore} placeholder="30" min="1" max="36" />
                </Field>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Gap indicator */}
          {gap !== null && (
            <div style={{
              background: '#f7fafd', border: `1px solid ${gapColor(gap, isACT)}44`,
              borderLeft: `4px solid ${gapColor(gap, isACT)}`,
              borderRadius: 6, padding: '10px 14px', marginTop: 4, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: gapColor(gap, isACT) }}>{gapLabel(gap, isACT)}</span>
              {gap > 0 && <span style={{ fontSize: 13, color: '#666' }}>— {gap}{isACT ? '-point composite gap' : '-point gap'}</span>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Field label="Target Test Date">
              <Select
                value={isCustomDate ? '__custom__' : targetDate}
                onChange={v => {
                  if (v === '__custom__') {
                    setIsCustomDate(true);
                    setTargetDate('');
                  } else {
                    setIsCustomDate(false);
                    setTargetDate(v);
                  }
                }}
                options={[
                  { label: '— Select date —', value: '' },
                  ...(isACT ? ACT_TEST_DATES : SAT_TEST_DATES),
                  { label: 'Custom date...', value: '__custom__' },
                ]}
              />
              {isCustomDate && (
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  min="2026-01-01"
                  max="2030-12-31"
                  style={{
                    marginTop: 8, width: '100%', padding: '10px 12px',
                    border: '1.5px solid #CBD5E1', borderRadius: 8,
                    fontSize: 15, fontFamily: 'inherit', color: '#1B3A5C',
                    background: 'white', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </Field>
            <Field label="Student Location" hint="City/State — auto-filled from score report">
              <Input
                value={studentState}
                onChange={v => {
                  setStudentState(v);
                  const code = parseStateFromLocation(v);
                  setCollegeSuggestions(code && STATE_COLLEGES[code] ? STATE_COLLEGES[code] : []);
                }}
                placeholder="e.g. Charlotte, NC"
                highlight={hl('studentState')}
              />
            </Field>
          </div>

          <Field label="Target Colleges" hint="Comma-separated — click suggestions below to add">
            <Input value={colleges} onChange={setColleges} placeholder="e.g. UNC Chapel Hill, UVA, Wake Forest" />
          </Field>

          {/* College suggestions based on detected state */}
          {collegeSuggestions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontStyle: 'italic' }}>
                💡 Top colleges in {studentState} — click to add:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {collegeSuggestions.map(c => {
                  const alreadyAdded = colleges.toLowerCase().includes(c.toLowerCase());
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        if (alreadyAdded) return;
                        setColleges(prev => prev ? `${prev}, ${c}` : c);
                      }}
                      style={{
                        background: alreadyAdded ? '#e8f5e9' : '#eaf3fb',
                        border: `1px solid ${alreadyAdded ? '#27AE60' : STYLES.blue}`,
                        borderRadius: 20,
                        padding: '4px 12px',
                        fontSize: 12,
                        color: alreadyAdded ? STYLES.green : STYLES.blue,
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        fontWeight: alreadyAdded ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {alreadyAdded ? '✓ ' : '+'} {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Section 2: Domain Performance */}
        <SectionCard number="2" title={isACT ? 'ACT Section Scores' : 'Domain Performance'}>
          {isACT ? (
            <div style={{ background: '#eaf3fb', border: `1px solid ${STYLES.blue}`, borderRadius: 6, padding: '14px 18px', fontSize: 13, color: '#444' }}>
              <strong style={{ color: STYLES.navy }}>ACT:</strong> Section scores entered in Section 1 (English, Math, Reading, Science) are used as the full diagnostic breakdown. No additional domain bands are needed — Claude analyzes each section score directly.
              {total > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'English', val: actEnglish },
                    { label: 'Math', val: actMath },
                    { label: 'Reading', val: actReading },
                    { label: 'Science', val: actScience },
                  ].map(({ label, val }) => val ? (
                    <div key={label} style={{ background: 'white', border: `1px solid ${STYLES.blue}33`, borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: STYLES.navy, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: STYLES.navy }}>{val}<span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>/36</span></div>
                    </div>
                  ) : null)}
                </div>
              )}
            </div>
          ) : (
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
          )}
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
                {rec.totalHours} hrs total &nbsp;·&nbsp; {rec.planWeeks}-week plan &nbsp;·&nbsp; {rec.sessionsPerWeek}x/week &nbsp;·&nbsp; {rec.sessionLength} sessions &nbsp;·&nbsp; {rec.homeworkHrs} hrs homework/week
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
              <span>{genStatus || 'Starting…'}</span>
            </>
          ) : (
            '⚡ Generate Game Plan + Presentation'
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
              Click below to download all deliverables. The .pptx can be imported into Google Slides for editing.
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => downloadFile(downloads.gamePlan, `${downloads.name}_GamePlan.pdf`)}
                style={{
                  background: STYLES.navy, color: '#fff', border: 'none', borderRadius: 6,
                  padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                📋 Download Game Plan (.pdf)
              </button>
              {downloads.presentation && (
                <button
                  onClick={() => downloadFile(downloads.presentation, `${downloads.name}_${isACT ? 'ACT' : 'SAT'}_GamePlan_Presentation.pdf`)}
                  style={{
                    background: '#FF6B5A', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  🖥️ Download Presentation (.pdf)
                </button>
              )}
              {downloads.pptx && (
                <button
                  onClick={() => downloadFile(downloads.pptx, `${downloads.name}_${isACT ? 'ACT' : 'SAT'}_GamePlan_Presentation.pptx`)}
                  style={{
                    background: '#217346', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  📊 Download Presentation (.pptx)
                </button>
              )}
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
