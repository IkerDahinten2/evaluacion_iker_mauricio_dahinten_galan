'use strict';

const { Router } = require('express');

// Express 4 no captura promesas rechazadas: se encauzan al middleware de errores.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function createApplicationRoutes(controller) {
  const router = Router();
  router.post('/applications', wrap(controller.create));
  router.get('/applications', wrap(controller.list));
  // Ruta canónica + alias singular tal como aparece en el enunciado (/application/:id/status)
  router.put(['/applications/:id/status', '/application/:id/status'], wrap(controller.updateStatus));
  return router;
}

module.exports = { createApplicationRoutes };
