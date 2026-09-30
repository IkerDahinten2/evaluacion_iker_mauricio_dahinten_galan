'use strict';

function createApplicationController(service) {
  return {
    async create(req, res) {
      const application = await service.create(req.body);
      res.status(201).location(`/applications/${application.id}`).json(application);
    },
    async list(req, res) {
      const applications = await service.list(req.query);
      res.status(200).json(applications);
    },
    async updateStatus(req, res) {
      const application = await service.updateStatus(req.params, req.body);
      res.status(200).json(application);
    },
  };
}

module.exports = { createApplicationController };
