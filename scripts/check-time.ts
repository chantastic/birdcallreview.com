import assert from 'node:assert/strict';
import { hashFor, labelFor, momentUrl, parseTimeToken, timeFromUrl } from '../src/lib/time-link';
import { parseTranscript, speakerName } from '../src/lib/transcript';

assert.equal(parseTimeToken('754'), 754);
assert.equal(parseTimeToken('12:34'), 12 * 60 + 34);
assert.equal(parseTimeToken('00:09'), 9);
assert.equal(parseTimeToken('1:02:03'), 3723);
assert.equal(parseTimeToken('12m34s'), 12 * 60 + 34);
assert.equal(parseTimeToken('1h2m3s'), 3723);
assert.equal(parseTimeToken('nope'), null);

assert.equal(timeFromUrl(new URL('https://birdcallreview.com/nate#t=12:34')), 754);
assert.equal(timeFromUrl(new URL('https://birdcallreview.com/nate?t=754')), 754);
assert.equal(timeFromUrl(new URL('https://birdcallreview.com/nate?t=12m34s')), 754);
assert.equal(hashFor(754), '12:34');
assert.equal(labelFor(9), '0:09');
assert.equal(
  momentUrl('https://birdcallreview.com/nate?t=1', '/nate', 9),
  'https://birdcallreview.com/nate#t=00:09',
);

assert.equal(speakerName('Michael Chan'), 'Michael Chan');
assert.equal(speakerName('Jeremy Ricketts - 1'), 'Jeremy Ricketts');
assert.equal(speakerName('C'), 'Speaker C');
assert.equal(speakerName('C', { C: 'Clip' }), 'Clip');
assert.equal(speakerName('Zach'), 'Zach');

const turns = parseTranscript('**[00:00:09] Michael Chan:** Hello there.\n\n**[00:01:02] C:** Chirp.\n');
assert.equal(turns.length, 2);
assert.equal(turns[0].hash, '00:09');
assert.equal(turns[0].id, 't=00:09');
assert.equal(turns[0].label, '0:09');
assert.equal(turns[0].speaker, 'Michael Chan');
assert.equal(turns[0].text, 'Hello there.');
assert.equal(turns[1].seconds, 62);
assert.equal(turns[1].speaker, 'Speaker C');

console.log('TIME_OK');
