'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApplicationService } = require('../src/services/applicationService');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-30T12:00:00Z');
const ago = (d) => new Date(NOW.getTime() - d * DAY);

// Repositorios en memoria que respetan el contrato de pgRepositories
function setup({ applications = [] } = {}) {
  const db = {
    candidates: [
      { id: 1, name: 'Ana', email: 'ana@gmail.com', experienceYears: 5 },
      { id: 2, name: 'Luis', email: 'luis@gmail.com', experienceYears: 1 },
      { id: 3, name: 'María', email: 'maria@gmail.com', experienceYears: 4 },
    ],
    vacancies: [
      { id: 1, title: 'Backend', minExperienceYears: 3, status: 'OPEN' },
      { id: 2, title: 'Datos', minExperienceYears: 2, status: 'CLOSED' },
      { id: 3, title: 'Frontend', minExperienceYears: 1, status: 'OPEN' },
      { id: 4, title: 'QA', minExperienceYears: 1, status: 'OPEN' },
      { id: 5, title: 'DevOps', minExperienceYears: 1, status: 'OPEN' },
    ],
    applications: [...applications],
  };
  let nextId = db.applications.reduce((m, a) => Math.max(m, a.id), 0) + 1;

  const repos = {
    candidates: { findByIdForUpdate: async (id) => db.candidates.find((c) => c.id === id) || null },
    vacancies: { findById: async (id) => db.vacancies.find((v) => v.id === id) || null },
    applications: {
      findByCandidateAndVacancy: async (c, v) =>
        db.applications.filter((a) => a.candidateId === c && a.vacantId === v),
      countActiveByCandidateExcludingVacancy: async (c, v) =>
        db.applications.filter(
          (a) => a.candidateId === c && a.vacantId !== v && ['RECEIVED', 'IN_REVIEW'].includes(a.status)
        ).length,
      create: async (d) => {
        const row = {
          id: nextId++, candidateId: d.candidateId, vacantId: d.vacancyId, source: d.source,
          coverLetter: d.coverLetter, score: d.score, priority: d.priority, status: d.status,
          createdAt: d.now, statusUpdatedAt: d.now,
        };
        db.applications.push(row);
        return row;
      },
      findByIdForUpdate: async (id) => db.applications.find((a) => a.id === id) || null,
      updateStatus: async (id, status, now) => {
        const a = db.applications.find((x) => x.id === id);
        a.status = status;
        a.statusUpdatedAt = now;
        return a;
      },
      list: async ({ status }) =>
        db.applications
          .filter((a) => !status || a.status === status)
          .sort((a, b) => b.score - a.score),
    },
  };

  const service = createApplicationService({
    unitOfWork: { run: (work) => work(repos) },
    repositories: repos,
    clock: () => NOW,
  });
  return { service, db };
}

const valid = {
  candidateId: 3,
  vacantId: 1,
  source: 'REFERRAL',
  coverLetter: 'Tengo cuatro años de experiencia armando API REST con Node.js y bases de datos SQL',
};

const rejects = (promise, status, code) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.status, status);
    assert.equal(e.code, code);
    return true;
  });

test('crear postulación válida: 201-path, RECEIVED, puntaje 9 y prioridad TOP', async () => {
  const { service } = setup();
  const app = await service.create(valid);
  assert.equal(app.status, 'RECEIVED');
  assert.equal(app.score, 9);
  assert.equal(app.priority, 'TOP');
});

test('validación: campos obligatorios y fuente no permitida -> 400', async () => {
  const { service } = setup();
  await rejects(service.create({}), 400, 'VALIDATION_ERROR');
  await rejects(service.create({ ...valid, source: 'LINKEDIN' }), 400, 'VALIDATION_ERROR');
  await rejects(service.create({ ...valid, coverLetter: '   ' }), 400, 'VALIDATION_ERROR');
});

test('candidato o vacante inexistente -> 404; vacante CLOSED -> 409', async () => {
  const { service } = setup();
  await rejects(service.create({ ...valid, candidateId: 99 }), 404, 'CANDIDATE_NOT_FOUND');
  await rejects(service.create({ ...valid, vacantId: 99 }), 404, 'VACANCY_NOT_FOUND');
  await rejects(service.create({ ...valid, vacantId: 2 }), 409, 'VACANCY_CLOSED');
});

test('duplicidad: postulación abierta -> 409; rechazada hace <30 días -> 409; >=30 días -> ok', async () => {
  const mk = (status, updatedDaysAgo) => ({
    id: 1, candidateId: 3, vacantId: 1, source: 'OTHER', coverLetter: 'x', score: 0, priority: 'LOW',
    status, createdAt: ago(updatedDaysAgo + 5), statusUpdatedAt: ago(updatedDaysAgo),
  });
  await rejects(setup({ applications: [mk('IN_REVIEW', 2)] }).service.create(valid), 409, 'ACTIVE_APPLICATION_EXISTS');
  await rejects(setup({ applications: [mk('REJECTED', 10)] }).service.create(valid), 409, 'REAPPLY_WAIT_PERIOD');
  const ok = await setup({ applications: [mk('REJECTED', 31)] }).service.create(valid);
  assert.equal(ok.status, 'RECEIVED');
});

test('penalización: candidato con 3 postulaciones activas en otras vacantes resta 2', async () => {
  const active = (id, vacantId) => ({
    id, candidateId: 3, vacantId, source: 'OTHER', coverLetter: 'x', score: 0, priority: 'LOW',
    status: 'RECEIVED', createdAt: ago(1), statusUpdatedAt: ago(1),
  });
  const { service } = setup({ applications: [active(1, 3), active(2, 4), active(3, 5)] });
  const app = await service.create(valid);
  assert.equal(app.score, 7); // 4 + 3 + 2 - 2
  assert.equal(app.priority, 'TOP');
});

test('cambio de estado: actualiza fecha; estado final no cambia; inexistente -> 404; inválido -> 400', async () => {
  const { service, db } = setup();
  const created = await service.create(valid);

  const updated = await service.updateStatus({ id: String(created.id) }, { status: 'IN_REVIEW' });
  assert.equal(updated.status, 'IN_REVIEW');
  assert.equal(updated.statusUpdatedAt, NOW);

  await service.updateStatus({ id: String(created.id) }, { status: 'HIRED' });
  await rejects(service.updateStatus({ id: String(created.id) }, { status: 'IN_REVIEW' }), 409, 'FINAL_STATUS');
  await rejects(service.updateStatus({ id: '999' }, { status: 'IN_REVIEW' }), 404, 'APPLICATION_NOT_FOUND');
  await rejects(service.updateStatus({ id: '1' }, { status: 'PENDING' }), 400, 'VALIDATION_ERROR');
  await rejects(service.updateStatus({ id: 'abc' }, { status: 'HIRED' }), 400, 'VALIDATION_ERROR');
  assert.equal(db.applications.length, 1);
});

test('listado: ordenado por puntaje desc y filtrable por estado', async () => {
  const { service } = setup();
  await service.create({ ...valid, candidateId: 2, source: 'OTHER', coverLetter: 'hola' }); // 0
  await service.create(valid); // 9
  const all = await service.list({});
  assert.deepEqual(all.map((a) => a.score), [9, 0]);

  await service.updateStatus({ id: String(all[0].id) }, { status: 'IN_REVIEW' });
  const inReview = await service.list({ status: 'IN_REVIEW' });
  assert.equal(inReview.length, 1);
  await rejects(service.list({ status: 'NOPE' }), 400, 'VALIDATION_ERROR');
});
