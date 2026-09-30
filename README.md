# Job Applications API

API REST con **Node.js + Express + PostgreSQL** para gestionar postulaciones a vacantes. Calcula automáticamente un **puntaje y una prioridad de revisión** para atender primero a los candidatos más afines.

## Requisitos
- Node.js 18 o superior
- PostgreSQL 13 o superior

## Instalación
```bash
npm install            # instala dependencias y genera package-lock.json
cp .env.example .env   # (Windows: copy .env.example .env) y ajusta DATABASE_URL
```

## Base de datos
```bash
createdb job_applications
psql -d job_applications -f database.sql
```
Con usuario/host explícitos: `psql "postgresql://postgres:postgres@localhost:5432/job_applications" -f database.sql`

El script es re-ejecutable (borra y recrea las tablas) e incluye 4 candidatos, 2 vacantes (id 2 en `CLOSED`) y 3 postulaciones de ejemplo.

## Ejecutar
```bash
npm start        # http://localhost:3000
npm run dev      # recarga automática
```

## Pruebas automatizadas
```bash
npm test
```
20 pruebas con el runner nativo de Node (`node:test`), sin BD: puntaje, prioridad, duplicidad y el flujo del servicio con repositorios en memoria.

## Endpoints

### POST /applications
```bash
curl -i -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{"candidateId":3,"vacantId":1,"source":"REFERRAL","coverLetter":"Tengo cuatro años de experiencia armando API REST con Node.js y bases de datos SQL"}'
```
| Código | Caso |
|---|---|
| 201 | Creada (estado `RECEIVED`, con `score` y `priority`) |
| 400 | Campos faltantes/inválidos o `source` no permitida |
| 404 | Candidato o vacante inexistente |
| 409 | Vacante `CLOSED`, postulación abierta duplicada, o espera de 30 días tras un `REJECTED` |

### GET /applications
```bash
curl http://localhost:3000/applications
curl "http://localhost:3000/applications?status=IN_REVIEW"
```
Ordenadas por puntaje descendente (desempate: más antigua primero). Incluye nombre y correo del candidato. `status` inválido → 400.

### PUT /applications/:id/status
(también disponible como `/application/:id/status`)
```bash
curl -i -X PUT http://localhost:3000/applications/2/status \
  -H "Content-Type: application/json" -d '{"status":"IN_REVIEW"}'
```
| Código | Caso |
|---|---|
| 200 | Estado actualizado (se actualiza `statusUpdatedAt`) |
| 400 | `id` o `status` inválido |
| 404 | Postulación inexistente |
| 409 | Ya está en estado final (`REJECTED`/`HIRED`) o ya tiene ese estado |

## Reglas de puntaje
| Regla | Puntos |
|---|---|
| Experiencia del candidato ≥ mínima de la vacante | +4 |
| Fuente `REFERRAL` / `INTERNAL` | +3 / +2 |
| Carta contiene `node`, `sql` o `api` (sin distinguir mayúsculas; suma una sola vez) | +2 |
| Carta con más de 500 caracteres | +1 |
| 3 o más postulaciones activas en otras vacantes | −2 |

Prioridad: 0–2 `LOW`, 3–4 `MEDIUM`, 5–6 `HIGH`, 7+ `TOP`.

## Arquitectura
```
src/
  domain/        reglas puras (scoring, duplicidad, constantes) - sin dependencias
  validators/    validación de entrada
  services/      casos de uso (orquestan reglas + repositorios, transaccionales)
  repositories/  acceso a PostgreSQL (pg) + unit of work
  controllers/ routes/ middlewares/   capa HTTP
  app.js (Express) · server.js (composición)
tests/           pruebas automatizadas
database.sql     esquema + datos de prueba
```
Decisiones clave:
- Los casos de uso reciben sus dependencias por inyección, por eso se prueban sin BD ni Express.
- La creación y el cambio de estado corren en **transacción** con bloqueo de fila (`FOR UPDATE`), y la BD tiene un **índice único parcial** que impide dos postulaciones abiertas del mismo candidato a la misma vacante aun con concurrencia.
- La búsqueda de palabras usa **palabras completas** (acepta `node.js`, `nodejs`, `apis`), así "rápido" no cuenta como `api`.
- La espera de 30 días se cuenta desde `status_updated_at` de la última postulación a esa vacante, si terminó en `REJECTED`.
- La prioridad `HIGHT` del enunciado se interpretó como `HIGH` (constante en `src/domain/constants.js` y `CHECK` en `database.sql`).
- Nombres de tablas en inglés: `candidates`, `vacancies`, `applications`.
