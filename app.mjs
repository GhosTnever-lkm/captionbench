import { analyze, formatTimestamp, parseSrt, toSrt } from './captions.mjs';

const $ = id => document.getElementById(id);
const sample = `1\n00:00:01,000 --> 00:00:03,100\nДобро пожаловать в CaptionBench.\n\n2\n00:00:03,000 --> 00:00:04,000\nЭта реплика специально слишком быстрая для чтения.\n\n3\n00:00:04,300 --> 00:00:07,000\nИсправь текст прямо здесь —\nи сохрани обновлённый SRT.`;
let cues = parseSrt(sample); let fileName = 'captionbench-demo.srt'; let toastTimer;

function render() {
  const rules = { maxChars: Number($('max-chars').value) || 42, maxLines: Number($('max-lines').value) || 2, maxCps: Number($('max-cps').value) || 20 };
  const findings = analyze(cues, rules); const byId = new Map();
  for (const item of findings) { const list = byId.get(item.id) ?? []; list.push(item); byId.set(item.id, list); }
  const filter = $('filter-select').value;
  const visible = cues.filter(cue => filter === 'all' || (filter === 'issues' ? byId.has(cue.id) : !byId.has(cue.id)));
  $('stat-cues').textContent = cues.length;
  $('stat-issues').textContent = findings.length;
  $('stat-fast').textContent = findings.filter(item => item.code === 'fast').length;
  $('stat-overlap').textContent = findings.filter(item => item.code === 'overlap').length;
  $('file-title').textContent = fileName;
  $('visible-count').textContent = `${visible.length} из ${cues.length} реплик`;
  $('empty-state').hidden = cues.length !== 0;
  $('cue-list').hidden = cues.length === 0;
  $('export-button').disabled = cues.length === 0;
  $('cue-list').replaceChildren(...visible.map((cue, idx) => {
    const row = document.createElement('article'); row.className = 'cue';
    const time = document.createElement('div'); time.className = 'cue-time';
    const number = document.createElement('b'); number.textContent = `#${String(idx + 1).padStart(2, '0')}`;
    const range = document.createElement('span'); range.textContent = `${formatTimestamp(cue.start)}\n↓ ${formatTimestamp(cue.end)}`;
    time.append(number, range);
    const body = document.createElement('div'); body.className = 'cue-body';
    const head = document.createElement('div'); head.className = 'cue-head';
    const label = document.createElement('strong'); label.textContent = `${cue.text.split('\n').length} строк${cue.text.split('\n').length === 1 ? 'а' : 'и'}`;
    const issueList = document.createElement('div'); issueList.className = 'issue-list';
    for (const issue of byId.get(cue.id) ?? []) { const badge = document.createElement('span'); badge.className = `issue ${issue.level}`; badge.textContent = issue.message; issueList.append(badge); }
    head.append(label, issueList);
    const input = document.createElement('textarea'); input.value = cue.text; input.setAttribute('aria-label', `Текст реплики ${idx + 1}`); input.rows = Math.max(2, Math.min(5, cue.text.split('\n').length + 1));
    input.addEventListener('input', () => { cue.text = input.value; render(); const next = [...document.querySelectorAll('.cue textarea')].find(el => el.value === cue.text); next?.focus(); next?.setSelectionRange(next.value.length, next.value.length); });
    const chars = [...cue.text.replace(/\s/g, '')].length; const cps = chars / ((cue.end - cue.start) / 1000);
    const meta = document.createElement('div'); meta.className = 'cue-stats';
    const count = document.createElement('span'); count.textContent = `${chars} знаков`;
    const speed = document.createElement('span'); speed.textContent = `${cps.toFixed(1)} симв./с`;
    meta.append(count, speed); body.append(head, input, meta); row.append(time, body); return row;
  }));
}

function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200); }
function download() { if (!cues.length) return; const blob = new Blob([toSrt(cues)], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName.replace(/\.srt$/i, '') + '-checked.srt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

async function openFile(file) {
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) { showToast('Файл больше лимита 25 МБ.'); return; }
  try { const parsed = parseSrt(await file.text()); cues = parsed; fileName = file.name; $('file-size').textContent = `${(file.size / 1024).toFixed(1)} КБ · локально`; render(); showToast(`Загружено реплик: ${parsed.length}`); }
  catch (error) { showToast(error.message); }
  $('file-input').value = '';
}

$('open-button').addEventListener('click', () => $('file-input').click());
$('empty-open').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', event => openFile(event.target.files?.[0]));
$('export-button').addEventListener('click', download);
$('load-sample').addEventListener('click', () => { cues = parseSrt(sample); fileName = 'captionbench-demo.srt'; $('file-size').textContent = 'Демонстрационные данные'; render(); });
for (const id of ['max-chars', 'max-lines', 'max-cps', 'filter-select']) $(id).addEventListener('input', render);
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); download(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); $('file-input').click(); } });
const dropZone = $('cue-list');
for (const type of ['dragenter', 'dragover']) dropZone.addEventListener(type, event => { event.preventDefault(); $('file-title').textContent = 'Отпусти SRT, чтобы открыть'; });
dropZone.addEventListener('dragleave', () => { $('file-title').textContent = fileName; });
dropZone.addEventListener('drop', event => { event.preventDefault(); openFile(event.dataTransfer.files?.[0]); });
render();
