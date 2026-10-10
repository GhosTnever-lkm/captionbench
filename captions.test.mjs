import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, formatTimestamp, parseSrt, parseTimestamp, toSrt } from './captions.mjs';

test('SRT parser accepts BOM, CRLF and comma/dot millisecond separators', () => {
  const cues = parseSrt('\uFEFF1\r\n00:00:01,250 --> 00:00:02.500\r\nHello\r\nworld');
  assert.equal(cues[0].start, 1250); assert.equal(cues[0].end, 2500); assert.equal(cues[0].text, 'Hello\nworld');
});
test('timestamp parsing validates minute and second ranges', () => {
  assert.equal(parseTimestamp('00:61:00,000'), null); assert.equal(parseTimestamp('02:00:00,000'), 7200000);
});
test('SRT round trip emits stable numbered cues', () => {
  const cues = parseSrt('7\n00:00:03,000 --> 00:00:04,000\nLater\n\n2\n00:00:01,000 --> 00:00:02,000\nFirst');
  assert.match(toSrt(cues), /^1\n00:00:01,000 --> 00:00:02,000\nFirst/);
  assert.equal(parseSrt(toSrt(cues)).length, 2); assert.equal(formatTimestamp(3600999), '01:00:00,999');
});
test('parser rejects missing timestamps and non-positive durations', () => {
  assert.throws(() => parseSrt('1\nCaption'), /тайминга/);
  assert.throws(() => parseSrt('1\n00:00:02,000 --> 00:00:01,000\nBad'), /некорректен/);
});
test('analysis reports long lines, high reading speed, overlap and empty cues', () => {
  const cues = [
    { id: '1', start: 0, end: 1000, text: 'A'.repeat(45) },
    { id: '2', start: 900, end: 1400, text: 'Fast line' },
    { id: '3', start: 1500, end: 2000, text: '' }
  ];
  const codes = analyze(cues).map(f => f.code);
  assert.ok(codes.includes('long-line')); assert.ok(codes.includes('fast')); assert.ok(codes.includes('overlap')); assert.ok(codes.includes('empty'));
});
