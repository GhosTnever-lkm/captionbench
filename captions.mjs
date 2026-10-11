export function parseTimestamp(value) {
  const match = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value.trim());
  if (!match) return null;
  const [, hh, mm, ss, ms] = match.map(Number);
  if (mm > 59 || ss > 59) return null;
  return ((hh * 60 + mm) * 60 + ss) * 1000 + ms;
}

export function formatTimestamp(ms) {
  const safe = Math.max(0, Math.round(ms));
  const h = Math.floor(safe / 3600000); const m = Math.floor(safe / 60000) % 60;
  const s = Math.floor(safe / 1000) % 60; const milli = safe % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

export function parseSrt(text) {
  const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  return normalized.split(/\n\s*\n/).map((block, index) => {
    const lines = block.split('\n');
    const timeIndex = lines.findIndex(line => line.includes('-->'));
    if (timeIndex < 0) throw new Error(`Блок ${index + 1}: не найдена строка тайминга`);
    const match = /^\s*(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2,}:\d{2}:\d{2}[,.]\d{3})(?:\s+.*)?$/.exec(lines[timeIndex]);
    if (!match) throw new Error(`Блок ${index + 1}: неверный формат времени`);
    const start = parseTimestamp(match[1]); const end = parseTimestamp(match[2]);
    if (start === null || end === null || end <= start) throw new Error(`Блок ${index + 1}: тайминг некорректен или длительность равна нулю`);
    return { id: lines[0].trim() && timeIndex > 0 ? lines[0].trim() : String(index + 1), start, end, text: lines.slice(timeIndex + 1).join('\n').trim() };
  });
}

export function analyze(cues, { maxChars = 42, minCps = 4, maxCps = 20, maxLines = 2 } = {}) {
  const findings = [];
  const ordered = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  let furthestEndingCue = null;
  for (let i = 0; i < ordered.length; i++) {
    const cue = ordered[i]; const lines = cue.text.split('\n');
    const chars = [...cue.text.replace(/\s/g, '')].length;
    const cps = chars / ((cue.end - cue.start) / 1000);
    if (!cue.text.trim()) findings.push({ id: cue.id, code: 'empty', level: 'error', message: 'Пустая реплика' });
    if (lines.some(line => [...line].length > maxChars)) findings.push({ id: cue.id, code: 'long-line', level: 'warning', message: `Строка длиннее ${maxChars} символов` });
    if (lines.length > maxLines) findings.push({ id: cue.id, code: 'many-lines', level: 'warning', message: `Больше ${maxLines} строк` });
    if (cps > maxCps) findings.push({ id: cue.id, code: 'fast', level: 'warning', message: `Скорость чтения ${cps.toFixed(1)} симв./с` });
    if (cps > 0 && cps < minCps) findings.push({ id: cue.id, code: 'slow', level: 'notice', message: `Низкая плотность текста: ${cps.toFixed(1)} симв./с` });
    if (furthestEndingCue && cue.start < furthestEndingCue.end) {
      findings.push({ id: cue.id, code: 'overlap', level: 'error', message: `Пересечение с репликой ${furthestEndingCue.id}` });
    }
    if (!furthestEndingCue || cue.end > furthestEndingCue.end) furthestEndingCue = cue;
  }
  return findings;
}

export function toSrt(cues) {
  return [...cues].sort((a, b) => a.start - b.start).map((cue, i) => `${i + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}`).join('\n\n') + '\n';
}
