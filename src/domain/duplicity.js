'use strict';

const { ACTIVE_STATUSES, APPLICATION_STATUS, REAPPLY_WAIT_DAYS } = require('./constants');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Regla de duplicidad para (candidato, vacante).
 * @param {Array<{id:number,status:string,createdAt:Date,statusUpdatedAt:Date}>} history
 *        postulaciones previas del candidato a ESA vacante
 * @param {Date} now
 */
function checkReapplication(history, now) {
  if (history.some((a) => ACTIVE_STATUSES.includes(a.status))) {
    return {
      allowed: false,
      code: 'ACTIVE_APPLICATION_EXISTS',
      message: 'El candidato ya tiene una postulación abierta para esta vacante.',
    };
  }

  if (history.length === 0) return { allowed: true };

  const last = [...history].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id
  )[0];

  if (last.status === APPLICATION_STATUS.REJECTED) {
    const retryAfter = new Date(new Date(last.statusUpdatedAt).getTime() + REAPPLY_WAIT_DAYS * DAY_MS);
    if (now < retryAfter) {
      return {
        allowed: false,
        code: 'REAPPLY_WAIT_PERIOD',
        message: `Su última postulación fue rechazada; debe esperar ${REAPPLY_WAIT_DAYS} días para volver a postularse.`,
        retryAfter,
      };
    }
  }

  return { allowed: true };
}

module.exports = { checkReapplication };
