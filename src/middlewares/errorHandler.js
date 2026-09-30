'use strict';

const AppError = require('../errors/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
  }

  // JSON malformado en el body
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido.' } });
  }

  // Red de seguridad ante condiciones de carrera (las garantiza la BD)
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'ACTIVE_APPLICATION_EXISTS', message: 'El candidato ya tiene una postulación abierta para esta vacante.' } });
  }
  if (err.code === '23503') {
    return res.status(404).json({ error: { code: 'REFERENCE_NOT_FOUND', message: 'El candidato o la vacante no existe.' } });
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
}

module.exports = { notFoundHandler, errorHandler };
