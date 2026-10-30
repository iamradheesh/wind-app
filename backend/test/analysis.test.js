import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../src/analysis.js';

test('computeStats basic metrics', () => {
  const s = computeStats([
    { forecast: 110, actual: 100 },
    { forecast: 90, actual: 100 },
    { forecast: 100, actual: 100 },
    { forecast: 130, actual: 100 },
  ]);
  assert.equal(s.n, 4);
  assert.equal(s.mae, 12.5);
  assert.equal(s.bias, 7.5);
  assert.equal(s.maxAbsError, 30);
  assert.ok(Math.abs(s.rmse - Math.sqrt((100 + 100 + 0 + 900) / 4)) < 1e-9);
  assert.ok(Math.abs(s.mape - 12.5) < 1e-9);
});

test('computeStats handles empty and zero actuals', () => {
  assert.equal(computeStats([]).n, 0);
  assert.equal(computeStats([{ forecast: 5, actual: 0 }]).mape, null);
});
