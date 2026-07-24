import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeSheet, encodeSheet, MAX_SHARE_URL_LENGTH } from './mixSheetCodec.js';
import type { MixSheetModel } from './mixSheetModel.js';

const model: MixSheetModel = {
  name: 'Harbor at dusk',
  artworkDataUrl: 'data:image/jpeg;base64,shouldnotsurvive',
  colors: [
    {
      hex: '#89C5F4',
      label: 'Sky',
      notes: 'wash first — thin layers',
      mix: [
        { paintName: 'Titanium White', parts: 4 },
        { paintName: 'Phthalocyanine Blue', parts: 1 },
      ],
    },
    { hex: '#222222', mix: [] },
  ],
};

test('encode/decode round-trips name, colors, labels, notes, and mix lines', () => {
  const decoded = decodeSheet(encodeSheet(model));
  assert.ok(decoded);
  assert.equal(decoded.name, 'Harbor at dusk');
  assert.equal(decoded.colors.length, 2);
  assert.deepEqual(decoded.colors[0], {
    hex: '#89C5F4',
    label: 'Sky',
    notes: 'wash first — thin layers',
    mix: [
      { paintName: 'Titanium White', parts: 4 },
      { paintName: 'Phthalocyanine Blue', parts: 1 },
    ],
  });
  assert.deepEqual(decoded.colors[1], { hex: '#222222', mix: [] });
});

test('the artwork image never travels in the payload', () => {
  const decoded = decodeSheet(encodeSheet(model));
  assert.ok(decoded);
  assert.equal(decoded.artworkDataUrl, null);
  assert.ok(!encodeSheet(model).includes('shouldnotsurvive'));
});

test('unicode notes round-trip', () => {
  const unicode: MixSheetModel = {
    name: '光色の眠り',
    artworkDataUrl: null,
    colors: [{ hex: '#AAB4E7', notes: '空 — céu ✦', mix: [] }],
  };
  const decoded = decodeSheet(encodeSheet(unicode));
  assert.ok(decoded);
  assert.equal(decoded.name, '光色の眠り');
  assert.equal(decoded.colors[0].notes, '空 — céu ✦');
});

test('the encoded string is URL-hash-safe', () => {
  const encoded = encodeSheet(model);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
});

test('decodeSheet rejects garbage, tampering, and wrong shapes', () => {
  assert.equal(decodeSheet('not-base64!!!'), null);
  assert.equal(decodeSheet(''), null);
  // Valid base64url of JSON that is not a sheet payload:
  assert.equal(decodeSheet(btoa('{"hello":"world"}').replace(/=+$/, '')), null);
  // Right shape, wrong version:
  assert.equal(decodeSheet(btoa('{"v":2,"n":"x","c":[]}').replace(/=+$/, '')), null);
  // Bad hex:
  assert.equal(decodeSheet(btoa('{"v":1,"n":"x","c":[{"h":"red","m":[]}]}').replace(/=+$/, '')), null);
  // Truncated mid-payload:
  assert.equal(decodeSheet(encodeSheet(model).slice(0, 10)), null);
  // Oversized input:
  assert.equal(decodeSheet('A'.repeat(MAX_SHARE_URL_LENGTH * 4)), null);
});

test('MAX_SHARE_URL_LENGTH is the agreed 8000', () => {
  assert.equal(MAX_SHARE_URL_LENGTH, 8000);
});
