'use strict';

const AppError = require('../errors/AppError');
const { VACANCY_STATUS, APPLICATION_STATUS, FINAL_STATUSES } = require('../domain/constants');
const { evaluateApplication } = require('../domain/scoring');
const { checkReapplication } = require('../domain/duplicity');
const {
  validateCreateApplication,
  validateListQuery,
  validateUpdateStatus,
} = require('../validators/applicationValidator');

/**
 * @param {object} deps
 * @param {{run:(work:(repos:object)=>Promise<any>)=>Promise<any>}} deps.unitOfWork  ejecuta `work` dentro de una transacción
 * @param {object} deps.repositories  repositorios para lecturas sin transacción
 * @param {()=>Date} [deps.clock]
 */
function createApplicationService({ unitOfWork, repositories, clock = () => new Date() }) {
  async function create(input) {
    const data = validateCreateApplication(input);
    const now = clock();

    return unitOfWork.run(async (repos) => {
      // Bloquea al candidato: serializa postulaciones concurrentes del mismo candidato
      // para que el conteo de postulaciones activas y la regla de duplicidad sean consistentes.
      const candidate = await repos.candidates.findByIdForUpdate(data.candidateId);
      if (!candidate) throw new AppError(404, 'CANDIDATE_NOT_FOUND', 'El candidato no existe.');

      const vacancy = await repos.vacancies.findById(data.vacancyId);
      if (!vacancy) throw new AppError(404, 'VACANCY_NOT_FOUND', 'La vacante no existe.');
      if (vacancy.status !== VACANCY_STATUS.OPEN) {
        throw new AppError(409, 'VACANCY_CLOSED', 'La vacante está cerrada.');
      }

      const history = await repos.applications.findByCandidateAndVacancy(candidate.id, vacancy.id);
      const dup = checkReapplication(history, now);
      if (!dup.allowed) {
        throw new AppError(409, dup.code, dup.message, dup.retryAfter && { retryAfter: dup.retryAfter });
      }

      const otherActiveApplications = await repos.applications.countActiveByCandidateExcludingVacancy(
        candidate.id,
        vacancy.id
      );
      const { score, priority } = evaluateApplication({
        candidateExperienceYears: candidate.experienceYears,
        vacancyMinExperienceYears: vacancy.minExperienceYears,
        source: data.source,
        coverLetter: data.coverLetter,
        otherActiveApplications,
      });

      return repos.applications.create({
        candidateId: candidate.id,
        vacancyId: vacancy.id,
        source: data.source,
        coverLetter: data.coverLetter,
        score,
        priority,
        status: APPLICATION_STATUS.RECEIVED,
        now,
      });
    });
  }

  async function list(query) {
    const { status } = validateListQuery(query);
    return repositories.applications.list({ status });
  }

  async function updateStatus(params, body) {
    const { id, status } = validateUpdateStatus(params, body);
    const now = clock();

    return unitOfWork.run(async (repos) => {
      const current = await repos.applications.findByIdForUpdate(id);
      if (!current) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'La postulación no existe.');

      if (FINAL_STATUSES.includes(current.status)) {
        throw new AppError(
          409,
          'FINAL_STATUS',
          `La postulación está en estado final (${current.status}) y no puede cambiar.`
        );
      }
      if (current.status === status) {
        throw new AppError(409, 'SAME_STATUS', `La postulación ya se encuentra en estado ${status}.`);
      }

      return repos.applications.updateStatus(id, status, now);
    });
  }

  return { create, list, updateStatus };
}

module.exports = { createApplicationService };
