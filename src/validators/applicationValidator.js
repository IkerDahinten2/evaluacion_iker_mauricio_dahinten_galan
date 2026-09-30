'use strict';

const AppError = require('../errors/AppError');
const { SOURCES, APPLICATION_STATUSES } = require('../domain/constants');

const MAX_COVER_LETTER = 10000;
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

function validationError(details) {
  return new AppError(400, 'VALIDATION_ERROR', 'Datos de entrada inválidos.', details);
}

function validateCreateApplication(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = [];

  if (!isPositiveInt(b.candidateId)) {
    errors.push({ field: 'candidateId', message: 'Es obligatorio y debe ser un entero positivo.' });
  }
  if (!isPositiveInt(b.vacantId)) {
    errors.push({ field: 'vacantId', message: 'Es obligatorio y debe ser un entero positivo.' });
  }

  if (b.source === undefined || b.source === null || b.source === '') {
    errors.push({ field: 'source', message: 'Es obligatorio.' });
  } else if (!SOURCES.includes(b.source)) {
    errors.push({ field: 'source', message: `Valor no permitido. Permitidos: ${SOURCES.join(', ')}.` });
  }

  if (typeof b.coverLetter !== 'string' || b.coverLetter.trim().length === 0) {
    errors.push({ field: 'coverLetter', message: 'Es obligatorio y debe ser un texto no vacío.' });
  } else if (b.coverLetter.length > MAX_COVER_LETTER) {
    errors.push({ field: 'coverLetter', message: `Máximo ${MAX_COVER_LETTER} caracteres.` });
  }

  if (errors.length) throw validationError(errors);

  return {
    candidateId: b.candidateId,
    vacancyId: b.vacantId,
    source: b.source,
    coverLetter: b.coverLetter,
  };
}

function validateApplicationId(rawId) {
  if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
    throw validationError([{ field: 'id', message: 'Debe ser un entero positivo.' }]);
  }
  return Number(rawId);
}

function validateStatusValue(status, field = 'status') {
  if (status === undefined || status === null || status === '') {
    throw validationError([{ field, message: 'Es obligatorio.' }]);
  }
  if (!APPLICATION_STATUSES.includes(status)) {
    throw validationError([
      { field, message: `Valor no permitido. Permitidos: ${APPLICATION_STATUSES.join(', ')}.` },
    ]);
  }
  return status;
}

function validateListQuery(query) {
  const q = query || {};
  return { status: q.status === undefined ? null : validateStatusValue(q.status, 'status') };
}

function validateUpdateStatus(params, body) {
  const id = validateApplicationId(params.id);
  const status = validateStatusValue(body && typeof body === 'object' ? body.status : undefined);
  return { id, status };
}

module.exports = { validateCreateApplication, validateListQuery, validateUpdateStatus };
