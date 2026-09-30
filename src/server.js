'use strict';

const { port } = require('./config/env');
const pool = require('./config/db');
const { createPgRepositories, createPgUnitOfWork } = require('./repositories/pgRepositories');
const { createApplicationService } = require('./services/applicationService');
const { createApp } = require('./app');

const applicationService = createApplicationService({
  unitOfWork: createPgUnitOfWork(pool),
  repositories: createPgRepositories(pool),
});

const server = createApp({ applicationService }).listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
