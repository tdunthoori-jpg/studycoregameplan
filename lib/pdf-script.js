import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const C = {
  navy:       '#1B365D',
  blue:       '#2E75B6',
  white:      '#FFFFFF',
  offWhite:   '#F7FAFD',
  lightBlue:  '#EAF3FB',
  amber:      '#FFF8E1',
  amberBorder:'#D4740E',
  border:     '#DDE3EC',
  textDark:   '#1A1A1A',
  textMid:    '#444444',
  textLight:  '#888888',
  stageDir:   '#6B7E91',
  boldColor:  '#1B365D',
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 54,
    paddingRight: 54,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: C.textDark,
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.navy,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerBrand: {
    color: '#7FB3D8',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  headerTitle: {
    color: C.white,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  headerDate: {
    color: '#B8CDE0',
    fontSize: 8.5,
  },
  usageNote: {
    backgroundColor: C.offWhite,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  usageNoteText: {
    fontSize: 8,
    color: C.textLight,
    fontFamily: 'Helvetica-Oblique',
    lineHeight: 1.5,
  },
  // ── Caller Notes ────────────────────────────────────────────────────────────
  callerNotes: {
    backgroundColor: C.amber,
    borderLeftWidth: 3,
    borderLeftColor: C.amberBorder,
    borderLeftStyle: 'solid',
    borderRadius: 3,
    padding: 10,
    marginBottom: 12,
  },
  callerNotesTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.amberBorder,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  callerNotesBody: {
    fontSize: 9.5,
    lineHeight: 1.6,
    color: '#5D4037',
  },
  // ── Section header ──────────────────────────────────────────────────────────
  sectionHeader: {
    backgroundColor: C.navy,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 16,
    marginBottom: 7,
  },
  sectionHeaderText: {
    color: C.white,
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  // ── Divider ─────────────────────────────────────────────────────────────────
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
    marginVertical: 10,
  },
  // ── Paragraph ───────────────────────────────────────────────────────────────
  para: {
    fontSize: 10.5,
    lineHeight: 1.7,
    color: C.textMid,
    marginBottom: 5,
  },
  // ── Bullet ──────────────────────────────────────────────────────────────────
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletDot: {
    fontSize: 10.5,
    color: C.blue,
    marginRight: 6,
    width: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.6,
    color: C.textMid,
  },
  // ── Numbered list ───────────────────────────────────────────────────────────
  numberedRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  numberedIndex: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    marginRight: 6,
    width: 18,
  },
  numberedText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.6,
    color: C.textMid,
  },
  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 54,
    right: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#AABBCC',
  },
});

// ── Inline text parser ─────────────────────────────────────────────────────────
// Handles **bold**, [stage direction], *italic*
function parseInline(text) {
  const parts = [];
  let str = text;
  // Pattern: **bold** | [stage dir] | *italic*
  const pattern = /(\*\*(.+?)\*\*|\[([^\]]+)\]|\*([^*\n]+)\*)/;
  while (str.length > 0) {
    const m = pattern.exec(str);
    if (!m) { parts.push({ t: 'text', s: str }); break; }
    if (m.index > 0) parts.push({ t: 'text', s: str.slice(0, m.index) });
    if (m[2] !== undefined) parts.push({ t: 'bold',  s: m[2] });
    else if (m[3] !== undefined) parts.push({ t: 'stage', s: '[' + m[3] + ']' });
    else if (m[4] !== undefined) parts.push({ t: 'italic', s: m[4] });
    str = str.slice(m.index + m[0].length);
  }
  return parts;
}

function InlineLine({ text, baseStyle }) {
  const parts = parseInline(text);
  // If no special formatting, render as plain Text
  if (parts.length === 1 && parts[0].t === 'text') {
    return <Text style={baseStyle}>{text}</Text>;
  }
  return (
    <Text style={baseStyle}>
      {parts.map((p, i) => {
        if (p.t === 'bold')  return <Text key={i} style={{ fontFamily: 'Helvetica-Bold',    color: C.boldColor }}>{p.s}</Text>;
        if (p.t === 'stage') return <Text key={i} style={{ fontFamily: 'Helvetica-Oblique', color: C.stageDir  }}>{p.s}</Text>;
        if (p.t === 'italic')return <Text key={i} style={{ fontFamily: 'Helvetica-Oblique', color: '#5D6B7A'   }}>{p.s}</Text>;
        return <Text key={i}>{p.s}</Text>;
      })}
    </Text>
  );
}

// ── Markdown → PDF elements ────────────────────────────────────────────────────

function renderLines(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) { i++; continue; }

    // CALLER NOTES block — collect until next ## or ---
    if (trimmed.startsWith('CALLER NOTES')) {
      const noteLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('## ') && lines[i].trim() !== '---') {
        if (lines[i].trim()) noteLines.push(lines[i].trim());
        i++;
      }
      out.push(
        <View key={`cn-${i}`} style={s.callerNotes} wrap={false}>
          <Text style={s.callerNotesTitle}>CALLER NOTES (Read Before the Call)</Text>
          <Text style={s.callerNotesBody}>{noteLines.join('\n')}</Text>
        </View>
      );
      continue;
    }

    // ## Section header
    if (trimmed.startsWith('## ')) {
      const title = trimmed.replace(/^##\s+/, '');
      out.push(
        <View key={`sh-${i}`} style={s.sectionHeader} wrap={false}>
          <Text style={s.sectionHeaderText}>{title}</Text>
        </View>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (trimmed === '---') {
      out.push(<View key={`hr-${i}`} style={s.divider} />);
      i++;
      continue;
    }

    // Bullet point (- or * followed by space)
    if (/^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '');
      out.push(
        <View key={`b-${i}`} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <InlineLine text={text} baseStyle={s.bulletText} />
        </View>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+([\s\S]+)/);
    if (numMatch) {
      out.push(
        <View key={`n-${i}`} style={s.numberedRow}>
          <Text style={s.numberedIndex}>{numMatch[1]}.</Text>
          <InlineLine text={numMatch[2]} baseStyle={s.numberedText} />
        </View>
      );
      i++;
      continue;
    }

    // Regular paragraph line
    out.push(<InlineLine key={`p-${i}`} text={trimmed} baseStyle={s.para} />);
    i++;
  }

  return out;
}

// ── Main document ──────────────────────────────────────────────────────────────

function ScriptDocument({ markdown, studentName }) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const allLines = (markdown || '').split('\n');

  // Skip Claude's header block — start from CALLER NOTES or first ##
  const bodyStart = allLines.findIndex(l => l.startsWith('CALLER NOTES') || l.startsWith('## '));
  const lines = bodyStart >= 0 ? allLines.slice(bodyStart) : allLines;

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerBrand}>STUDYCORE  ·  MEETING SCRIPT  ·  CONFIDENTIAL</Text>
          <Text style={s.headerTitle}>{studentName || 'Student'}  —  SAT Prep Consultation</Text>
          <Text style={s.headerDate}>{today}</Text>
        </View>

        {/* Usage note */}
        <View style={s.usageNote}>
          <Text style={s.usageNoteText}>
            How to use this script: Read the talking points — don't read verbatim. Adapt to the family's energy.{'\n'}
            Bold text = key phrases to hit.  [Brackets] = stage directions for you.
          </Text>
        </View>

        {/* Body content */}
        {renderLines(lines)}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>StudyCore  ·  {studentName || 'Student'}  ·  Meeting Script  ·  Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}

export async function buildMeetingScriptPdf(markdown, studentName) {
  const element = React.createElement(ScriptDocument, { markdown, studentName: studentName || 'Student' });
  return await renderToBuffer(element);
}
