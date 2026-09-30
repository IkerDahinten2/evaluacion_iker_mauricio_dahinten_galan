-- =====================================================================
-- Gestión de postulaciones - PostgreSQL 13+
-- Uso:  createdb job_applications && psql -d job_applications -f database.sql
-- El script es re-ejecutable (borra y recrea las tablas).
-- =====================================================================

DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS vacancies   CASCADE;
DROP TABLE IF EXISTS candidates  CASCADE;

-- ---------------------------------------------------------------------
-- candidato
-- ---------------------------------------------------------------------
CREATE TABLE candidates (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR(150) NOT NULL CHECK (length(trim(name)) > 0),
    email            VARCHAR(255) NOT NULL UNIQUE,
    experience_years INTEGER      NOT NULL DEFAULT 0 CHECK (experience_years >= 0)
);

-- ---------------------------------------------------------------------
-- vacante
-- ---------------------------------------------------------------------
CREATE TABLE vacancies (
    id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                VARCHAR(150) NOT NULL CHECK (length(trim(title)) > 0),
    min_experience_years INTEGER      NOT NULL DEFAULT 0 CHECK (min_experience_years >= 0),
    status               VARCHAR(10)  NOT NULL DEFAULT 'OPEN'
                         CHECK (status IN ('OPEN', 'CLOSED'))
);

-- ---------------------------------------------------------------------
-- postulación
-- ---------------------------------------------------------------------
CREATE TABLE applications (
    id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    candidate_id      INTEGER      NOT NULL REFERENCES candidates (id) ON DELETE RESTRICT,
    vacancy_id        INTEGER      NOT NULL REFERENCES vacancies  (id) ON DELETE RESTRICT,
    cover_letter      TEXT         NOT NULL CHECK (length(trim(cover_letter)) > 0),
    source            VARCHAR(20)  NOT NULL
                      CHECK (source IN ('REFERRAL', 'INTERNAL', 'JOB_BOARD', 'OTHER')),
    score             INTEGER      NOT NULL,
    priority          VARCHAR(10)  NOT NULL
                      CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'TOP')),
    status            VARCHAR(20)  NOT NULL DEFAULT 'RECEIVED'
                      CHECK (status IN ('RECEIVED', 'IN_REVIEW', 'REJECTED', 'HIRED')),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    status_updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (status_updated_at >= created_at)
);

-- Garantiza a nivel de BD que un candidato no tenga dos postulaciones
-- abiertas (RECEIVED / IN_REVIEW) a la misma vacante, aun con concurrencia.
CREATE UNIQUE INDEX uq_applications_one_active_per_candidate_vacancy
    ON applications (candidate_id, vacancy_id)
    WHERE status IN ('RECEIVED', 'IN_REVIEW');

CREATE INDEX idx_applications_score_desc  ON applications (score DESC, created_at);
CREATE INDEX idx_applications_status      ON applications (status);
CREATE INDEX idx_applications_candidate   ON applications (candidate_id);

-- =====================================================================
-- DATOS DE PRUEBA
-- =====================================================================
INSERT INTO candidates (name, email, experience_years) VALUES
    ('Ana Morales',  'ana.morales@gmail.com',  5),   -- id 1
    ('Luis Pérez',   'luis.perez@gmail.com',   1),   -- id 2
    ('María Gómez',  'maria.gomez@gmail.com',  4),   -- id 3
    ('Carlos Ruiz',  'carlos.ruiz@gmail.com',  2);   -- id 4

INSERT INTO vacancies (title, min_experience_years, status) VALUES
    ('Backend Developer Node.js', 3, 'OPEN'),        -- id 1
    ('Analista de Datos SQL',     2, 'CLOSED');      -- id 2

INSERT INTO applications
    (candidate_id, vacancy_id, cover_letter, source, score, priority, status, created_at, status_updated_at)
VALUES
    -- exp 5>=3 (+4) + REFERRAL (+3) + palabras clave (+2) = 9 -> TOP
    (1, 1, 'Desarrollo APIs con Node.js y SQL desde hace cinco años.',
     'REFERRAL', 9, 'TOP', 'IN_REVIEW', now() - interval '3 days', now() - interval '1 day'),
    -- exp 1<3 (0) + JOB_BOARD (0) = 0 -> LOW
    (2, 1, 'Me interesa la posición.',
     'JOB_BOARD', 0, 'LOW', 'RECEIVED', now() - interval '2 days', now() - interval '2 days'),
    -- vacante CLOSED, postulación rechazada hace 45 días (ya puede volver a postularse)
    (2, 2, 'Saludos cordiales.',
     'OTHER', 0, 'LOW', 'REJECTED', now() - interval '60 days', now() - interval '45 days');
