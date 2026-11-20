const test = require('node:test');
const assert = require('node:assert/strict');
const { pagination, dateRange } = require('../src/utils/query');

test('pagination defaults and caps offsets', () => {
  assert.deepEqual(pagination({}), { page: 1, limit: 10, skip: 0 });
  assert.deepEqual(pagination({ page: '4', limit: '500' }), { page: 4, limit: 100, skip: 300 });
  assert.deepEqual(pagination({ page: '-5', limit: '0' }), { page: 1, limit: 10, skip: 0 });
});

test('date range uses inclusive UTC calendar days', () => {
  assert.deepEqual(dateRange({ from: '2026-02-01', to: '2026-02-28' }), {
    createdAt: {
      $gte: new Date('2026-02-01T00:00:00.000Z'),
      $lte: new Date('2026-02-28T23:59:59.999Z'),
    },
  });
});
