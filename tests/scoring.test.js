'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateScore, priorityFromScore, evaluateApplication, hasKeywords } = require('../src/domain/scoring');

const base = {
  candidateExperienceYears: 0,
  vacancyMinExperienceYears: 3,
  source: 'OTHER',
  coverLetter: 'Hola',
  otherActiveApplications: 0,
};

test('ejemplo del enunciado: experiencia + REFERRAL + palabras clave = 9 -> TOP', () => {
  const r = evaluateApplication({
    candidateExperienceYears: 4,
    vacancyMinExperienceYears: 3,
    source: 'REFERRAL',
    coverLetter: 'Tengo cuatro años de experiencia armando API REST con Node.js y bases de datos SQL',
    otherActiveApplications: 0,
  });
  assert.deepEqual(r, { score: 9, priority: 'TOP' });
});

test('experiencia: igual al mínimo suma 4; por debajo no suma', () => {
  assert.equal(calculateScore({ ...base, candidateExperienceYears: 3 }), 4);
  assert.equal(calculateScore({ ...base, candidateExperienceYears: 2 }), 0);
});

test('fuente: REFERRAL +3, INTERNAL +2, JOB_BOARD/OTHER +0', () => {
  assert.equal(calculateScore({ ...base, source: 'REFERRAL' }), 3);
  assert.equal(calculateScore({ ...base, source: 'INTERNAL' }), 2);
  assert.equal(calculateScore({ ...base, source: 'JOB_BOARD' }), 0);
  assert.equal(calculateScore({ ...base, source: 'OTHER' }), 0);
});

test('palabras clave: sin distinguir mayúsculas y suman una sola vez', () => {
  assert.equal(calculateScore({ ...base, coverLetter: 'NODE' }), 2);
  assert.equal(calculateScore({ ...base, coverLetter: 'api api API sql SQL Sql' }), 2);
  assert.equal(calculateScore({ ...base, coverLetter: 'Trabajo con Node.js' }), 2);
});

test('palabras clave: no cuenta subcadenas dentro de otras palabras', () => {
  assert.equal(hasKeywords('aprendo rápido y soy capaz'), false);
  assert.equal(hasKeywords('me gusta la música'), false);
});

test('carta larga: 500 caracteres no suma, 501 suma +1', () => {
  assert.equal(calculateScore({ ...base, coverLetter: 'a'.repeat(500) }), 0);
  assert.equal(calculateScore({ ...base, coverLetter: 'a'.repeat(501) }), 1);
});

test('penalización -2 con 3 o más postulaciones activas en otras vacantes', () => {
  const b = { ...base, candidateExperienceYears: 5 }; // +4
  assert.equal(calculateScore({ ...b, otherActiveApplications: 2 }), 4);
  assert.equal(calculateScore({ ...b, otherActiveApplications: 3 }), 2);
  assert.equal(calculateScore({ ...b, otherActiveApplications: 7 }), 2);
});

test('prioridad: umbrales 0-2 LOW, 3-4 MEDIUM, 5-6 HIGH, 7+ TOP', () => {
  const cases = [
    [-2, 'LOW'], [0, 'LOW'], [2, 'LOW'],
    [3, 'MEDIUM'], [4, 'MEDIUM'],
    [5, 'HIGH'], [6, 'HIGH'],
    [7, 'TOP'], [10, 'TOP'],
  ];
  for (const [score, expected] of cases) assert.equal(priorityFromScore(score), expected, `score ${score}`);
});

test('puntaje máximo posible (4+3+2+1) = 10 y mínimo con penalización = -2', () => {
  assert.equal(
    calculateScore({
      candidateExperienceYears: 10,
      vacancyMinExperienceYears: 1,
      source: 'REFERRAL',
      coverLetter: 'sql ' + 'x'.repeat(600),
      otherActiveApplications: 0,
    }),
    10
  );
  assert.equal(calculateScore({ ...base, otherActiveApplications: 5 }), -2);
});
