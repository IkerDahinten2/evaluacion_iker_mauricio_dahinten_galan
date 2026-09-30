# CHAT.md — Historial del chat

> Registro de la conversación con Claude que originó este proyecto.

## Usuario

Eres un programador Senior que le dan esta propuesta para terminarla lo antes posible. Necesito que utilices toda esta información para generar un .zip con la aplicación funcional, con la mejor arquitectura que consideres como programador senior. No me des entendimiento de la app, necesito que comiences a codificar; si tienes alguna duda hazla de manera sencilla antes de comenzar. Crea desde 0 archivos y carpetas.

Se debe crear una aplicación con Node.js y Express con datos SQL para una empresa que desea controlar las vacantes laborales que entran, calculando automáticamente una prioridad de revisión (atender primero a los más afines).

Resumen del documento adjunto:
- Tablas: candidato (Id, nombre, gmail, años de experiencia), vacante (Id, título, años mínimos, estado), postulación (Id, candidato, vacante, carta, fuente, puntaje, prioridad, estado, fecha de creación, fecha de última actualización de estado), con claves primarias, foráneas y restricciones.
- `database.sql` con datos de prueba (≥3 candidatos y 2 vacantes, una CLOSED).
- Fuentes: REFERRAL, INTERNAL, JOB_BOARD, OTHER. Estados de postulación: RECEIVED, IN_REVIEW, REJECTED, HIRED (abiertas: RECEIVED e IN_REVIEW). Estados de vacante: OPEN, CLOSED.
- Puntaje: experiencia ≥ mínima +4; REFERRAL +3; INTERNAL +2; carta con "node", "sql" o "api" +2 (sin distinguir mayúsculas, una sola vez); carta > 500 caracteres +1; 3+ postulaciones activas en otras vacantes −2.
- Prioridad: 0–2 LOW, 3–4 MEDIUM, 5–6 HIGH, 7+ TOP.
- Duplicidad: no postular a una vacante con postulación abierta; si la última fue REJECTED, esperar 30 días.
- Endpoints: POST /applications, GET /applications (nombre y correo, orden por puntaje desc, filtro por estado), PUT /applications/:id/status (existencia, estado válido, estados finales inmutables, actualizar fecha, códigos HTTP apropiados).
- Mínimo 3 pruebas automatizadas de puntaje/prioridad.
- Entregables: código fuente, package.json y lockfile, database.sql, .env.example, README.md, pruebas y CHAT.md.

## Claude

Generé el proyecto completo desde cero:

- Stack y decisiones: Node.js + Express + PostgreSQL (`pg`); arquitectura en capas (dominio puro → validadores → servicios transaccionales → repositorios → HTTP) con inyección de dependencias.
- `database.sql` con tablas, PK, FK, CHECK, índice único parcial (una sola postulación abierta por candidato/vacante) y datos de prueba.
- Endpoints POST /applications, GET /applications y PUT /applications/:id/status con códigos 201/200/400/404/409.
- 20 pruebas automatizadas (`npm test`, runner nativo de Node) sobre puntaje, prioridad, duplicidad y flujo del servicio; todas pasan.
- Supuestos: `HIGHT` interpretado como `HIGH`; palabras clave buscadas como palabra completa; espera de 30 días contada desde la fecha de cambio a REJECTED.
- Limitación: el entorno no tenía acceso a npm ni a PostgreSQL, por lo que `package-lock.json` se genera al ejecutar `npm install`, y la capa SQL no se ejecutó contra una BD real (solo la lógica, con repositorios en memoria).
