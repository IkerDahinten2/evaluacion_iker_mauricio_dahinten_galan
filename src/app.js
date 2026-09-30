'use strict';

const express = require('express');
const { createApplicationController } = require('./controllers/applicationController');
const { createApplicationRoutes } = require('./routes/applicationRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

function createApp({ applicationService }) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(createApplicationRoutes(createApplicationController(applicationService)));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
