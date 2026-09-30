'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkReapplication } = require('../src/domain/duplicity');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-30T12:00:00Z');
const ago = (days) => new Date(now.getTime() - days * DAY);

test('sin historial: permitido', () => {
  assert.equal(checkReapplication([], now).allowed, true);
});

test('postulación abierta (RECEIVED / IN_REVIEW): bloqueado', () => {
  for (const status of ['RECEIVED', 'IN_REVIEW']) {
    const r = checkReapplication([{ id: 1, status, createdAt: ago(5), statusUpdatedAt: ago(5) }], now);
    assert.equal(r.allowed, false);
    assert.equal(r.code, 'ACTIVE_APPLICATION_EXISTS');
  }
});

test('REJECTED hace menos de 30 días: bloqueado; con 30 o más días: permitido', () => {
  const rejected = (days) => [{ id: 1, status: 'REJECTED', createdAt: ago(days + 5), statusUpdatedAt: ago(days) }];
  const blocked = checkReapplication(rejected(29), now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'REAPPLY_WAIT_PERIOD');
  assert.equal(checkReapplication(rejected(30), now).allowed, true);
  assert.equal(checkReapplication(rejected(90), now).allowed, true);
});

test('solo la ÚLTIMA postulación determina la espera de 30 días', () => {
  const history = [
    { id: 2, status: 'HIRED', createdAt: ago(10), statusUpdatedAt: ago(2) },
    { id: 1, status: 'REJECTED', createdAt: ago(40), statusUpdatedAt: ago(35) },
  ];
  assert.equal(checkReapplication(history, now).allowed, true);
});
