/**
 * Centralized Role & Permission Management
 * Standardizes ranks, manager checks, and committee permissions across the application.
 */

export const COMMITTEE_OPTIONS = [
  { id: 'proje', label: 'Proje' },
  { id: 'etkinlik', label: 'Etkinlik' },
  { id: 'sosyal', label: 'Sosyal Medya' },
  { id: 'medium', label: 'Medium' }
];

export const MANAGEMENT_RANKS = [
  'başkan',
  'baskan',
  'başkan yardımcısı',
  'baskan yardimcisi',
  'komite başkanı',
  'komite baskani',
  'developer',
  'admin'
];

export const ADMIN_RANKS = [
  'başkan',
  'baskan',
  'başkan yardımcısı',
  'baskan yardimcisi',
  'developer',
  'admin'
];

/**
 * Checks if a user has high admin rank (global access across all committees & user management).
 * @param {Object} user
 * @returns {boolean}
 */
export const isAdmin = (user) => {
  if (!user) return false;
  const rank = normalizeRank(user.rank);
  return ADMIN_RANKS.includes(rank);
};

/**
 * Checks if a user has authority to manage and register users.
 * @param {Object} user
 * @returns {boolean}
 */
export const canManageUsers = (user) => {
  return isAdmin(user);
};

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
 * Checks if a user has managerial/administrative rank (includes komite başkanı).
 * @param {Object} user
 * @returns {boolean}
 */
export const isManager = (user) => {
  if (!user) return false;
  const rank = normalizeRank(user.rank);
  return MANAGEMENT_RANKS.includes(rank);
};

/**
 * Checks if a user has edit/participate permission for a specific committee board.
 * Admins have global access; committee heads and members have access only if their roles include the committee key.
 * @param {Object} user
 * @param {string} committeeKey - e.g. 'etkinlik', 'sosyal', 'medium', 'proje'
 * @returns {boolean}
 */
export const canManageCommittee = (user, committeeKey) => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return Array.isArray(user.roles) && user.roles.includes(committeeKey);
};

/**
 * Checks if a user has managerial authority (edit/delete/assign any task) for a specific committee.
 * Admins have global managerial access; committee heads have managerial access only in their assigned committees
 * (and for 'genel' tasks).
 * @param {Object} user
 * @param {string} committeeKey
 * @returns {boolean}
 */
export const isCommitteeManager = (user, committeeKey) => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!isManager(user)) return false;
  if (!committeeKey || committeeKey === 'genel') return true;
  return Array.isArray(user.roles) && user.roles.includes(committeeKey);
};
