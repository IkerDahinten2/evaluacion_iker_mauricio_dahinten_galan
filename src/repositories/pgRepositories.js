'use strict';

// `db` puede ser un Pool o un Client (ambos exponen .query), por lo que los mismos
// repositorios sirven para lecturas simples y para operaciones dentro de una transacción.

const mapApplication = (r) => ({
  id: r.id,
  candidateId: r.candidate_id,
  vacantId: r.vacancy_id,
  source: r.source,
  coverLetter: r.cover_letter,
  score: r.score,
  priority: r.priority,
  status: r.status,
  createdAt: r.created_at,
  statusUpdatedAt: r.status_updated_at,
});

function createPgRepositories(db) {
  const candidates = {
    async findByIdForUpdate(id) {
      const { rows } = await db.query(
        'SELECT id, name, email, experience_years FROM candidates WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email,
        experienceYears: rows[0].experience_years,
      };
    },
  };

  const vacancies = {
    async findById(id) {
      const { rows } = await db.query(
        'SELECT id, title, min_experience_years, status FROM vacancies WHERE id = $1',
        [id]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        title: rows[0].title,
        minExperienceYears: rows[0].min_experience_years,
        status: rows[0].status,
      };
    },
  };

  const applications = {
    async findByCandidateAndVacancy(candidateId, vacancyId) {
      const { rows } = await db.query(
        `SELECT * FROM applications
          WHERE candidate_id = $1 AND vacancy_id = $2
          ORDER BY created_at DESC, id DESC`,
        [candidateId, vacancyId]
      );
      return rows.map(mapApplication);
    },

    async countActiveByCandidateExcludingVacancy(candidateId, vacancyId) {
      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS total FROM applications
          WHERE candidate_id = $1 AND vacancy_id <> $2
            AND status IN ('RECEIVED', 'IN_REVIEW')`,
        [candidateId, vacancyId]
      );
      return rows[0].total;
    },

    async create({ candidateId, vacancyId, source, coverLetter, score, priority, status, now }) {
      const { rows } = await db.query(
        `INSERT INTO applications
           (candidate_id, vacancy_id, cover_letter, source, score, priority, status, created_at, status_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING *`,
        [candidateId, vacancyId, coverLetter, source, score, priority, status, now]
      );
      return mapApplication(rows[0]);
    },

    async findByIdForUpdate(id) {
      const { rows } = await db.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [id]);
      return rows[0] ? mapApplication(rows[0]) : null;
    },

    async updateStatus(id, status, now) {
      const { rows } = await db.query(
        `UPDATE applications SET status = $2, status_updated_at = $3
          WHERE id = $1 RETURNING *`,
        [id, status, now]
      );
      return mapApplication(rows[0]);
    },

    async list({ status }) {
      const { rows } = await db.query(
        `SELECT a.id, a.candidate_id, c.name AS candidate_name, c.email AS candidate_email,
                a.vacancy_id, v.title AS vacancy_title, a.source, a.cover_letter,
                a.score, a.priority, a.status, a.created_at, a.status_updated_at
           FROM applications a
           JOIN candidates c ON c.id = a.candidate_id
           JOIN vacancies  v ON v.id = a.vacancy_id
          WHERE ($1::text IS NULL OR a.status = $1)
          ORDER BY a.score DESC, a.created_at ASC, a.id ASC`,
        [status]
      );
      return rows.map((r) => ({
        ...mapApplication(r),
        candidate: { id: r.candidate_id, name: r.candidate_name, email: r.candidate_email },
        vacancy: { id: r.vacancy_id, title: r.vacancy_title },
      }));
    },
  };

  return { candidates, vacancies, applications };
}

function createPgUnitOfWork(pool) {
  return {
    async run(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(createPgRepositories(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = { createPgRepositories, createPgUnitOfWork };
