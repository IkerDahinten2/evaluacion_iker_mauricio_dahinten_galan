'use strict';

const { PRIORITY } = require('./constants');

// Reglas de negocio (puntos). Centralizadas para cambiarlas en un solo lugar.
const RULES = Object.freeze({
  EXPERIENCE_MET: 4,
  SOURCE_REFERRAL: 3,
  SOURCE_INTERNAL: 2,
  KEYWORDS: 2,
  LONG_LETTER: 1,
  TOO_MANY_ACTIVE: -2,
  LONG_LETTER_MIN_CHARS: 501, // "más de 500 caracteres"
  ACTIVE_APPLICATIONS_THRESHOLD: 3,
});

// Palabras completas (no subcadenas, para evitar falsos positivos como "rapid" -> "api"),
// sin distinguir mayúsculas/minúsculas. Acepta variantes comunes: node.js, nodejs, apis.
const KEYWORDS_REGEX = /\b(?:node(?:\.?js)?|sql|apis?)\b/i;

function hasKeywords(text) {
  // RegExp sin flag "g": test() no tiene estado y suma 1 sola vez aunque haya varias coincidencias.
  return KEYWORDS_REGEX.test(String(text || ''));
}

/**
 * @param {object} p
 * @param {number} p.candidateExperienceYears
 * @param {number} p.vacancyMinExperienceYears
 * @param {string} p.source
 * @param {string} p.coverLetter
 * @param {number} p.otherActiveApplications  postulaciones activas del candidato en OTRAS vacantes
 */
function calculateScore({
  candidateExperienceYears,
  vacancyMinExperienceYears,
  source,
  coverLetter,
  otherActiveApplications,
}) {
  let score = 0;

  if (candidateExperienceYears >= vacancyMinExperienceYears) score += RULES.EXPERIENCE_MET;

  if (source === 'REFERRAL') score += RULES.SOURCE_REFERRAL;
  else if (source === 'INTERNAL') score += RULES.SOURCE_INTERNAL;

  if (hasKeywords(coverLetter)) score += RULES.KEYWORDS;

  if (String(coverLetter || '').trim().length >= RULES.LONG_LETTER_MIN_CHARS) score += RULES.LONG_LETTER;

  if (otherActiveApplications >= RULES.ACTIVE_APPLICATIONS_THRESHOLD) score += RULES.TOO_MANY_ACTIVE;

  return score;
}

function priorityFromScore(score) {
  if (score >= 7) return PRIORITY.TOP;
  if (score >= 5) return PRIORITY.HIGH;
  if (score >= 3) return PRIORITY.MEDIUM;
  return PRIORITY.LOW; // 0 a 2 (y negativos)
}

function evaluateApplication(input) {
  const score = calculateScore(input);
  return { score, priority: priorityFromScore(score) };
}

module.exports = { RULES, hasKeywords, calculateScore, priorityFromScore, evaluateApplication };
