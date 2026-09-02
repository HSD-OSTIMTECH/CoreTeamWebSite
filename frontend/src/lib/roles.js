/**
 * Centralized Role & Permission Management
 * Standardizes ranks, manager checks, and committee permissions across the application.
 */

export const MANAGEMENT_RANKS = [
  'başkan',
  'baskan',
  'başkan yardımcısı',
  'baskan yardimcisi',
  'komite başkanı',
  'komite baskani',
  'yönetici',
  'yonetici',
  'developer',
  'admin'
];

/**
 * Normalizes a rank string for safe comparisons (Turkish locale aware).
 * @param {string} rank
 * @returns {string}
 */
export const normalizeRank = (rank) => {
  return String(rank || '')
    .toLocaleLowerCase('tr-TR')
    .trim();
};

/**
 * Checks if a user has managerial/administrative rank.
 * @param {Object} user
 * @returns {boolean}
 */
export const isManager = (user) => {
  if (!user) return false;
  const rank = normalizeRank(user.rank);
  return MANAGEMENT_RANKS.includes(rank);
};

/**
 * Checks if a user has edit/manage permission for a specific committee.
 * Managers have global access; committee members have access if their roles include the committee key.
 * @param {Object} user
 * @param {string} committeeKey - e.g. 'etkinlik', 'sosyal', 'medium', 'proje'
 * @returns {boolean}
 */
export const canManageCommittee = (user, committeeKey) => {
  if (!user) return false;
  if (isManager(user)) return true;
  return Array.isArray(user.roles) && user.roles.includes(committeeKey);
};
