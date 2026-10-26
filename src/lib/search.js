/**
 * Search and string normalization utilities.
 */

/**
 * Normalizes text for resilient Turkish search:
 * - Converts to Turkish lowercase (ı -> ı, i -> i, I -> ı, İ -> i)
 * - Converts Turkish accented characters to ASCII equivalents for fuzzy tolerance (ğ->g, ü->u, ş->s, ı->i, ö->o, ç->c)
 * - Strips leading @ or # symbols
 * - Trims whitespace
 * @param {string} text
 * @returns {string}
 */
export const normalizeSearchText = (text) => {
  return String(text || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[@#]/g, '')
    .trim();
};

/**
 * Checks if a member/user matches a search term across full_name, username, and rank.
 * Tolerant to Turkish characters, case, and @ prefixes.
 * @param {object} member - { full_name, username, rank, ... }
 * @param {string} searchTerm - Search query
 * @returns {boolean}
 */
export const matchesMember = (member, searchTerm) => {
  if (!searchTerm || !searchTerm.trim()) return true;
  if (!member) return false;

  const cleanQuery = searchTerm.trim().toLocaleLowerCase('tr-TR');
  const normalizedQuery = normalizeSearchText(searchTerm);

  const fullName = String(member.full_name || '');
  const username = String(member.username || '');
  const rank = String(member.rank || '');

  // 1. Direct Turkish case-insensitive match
  if (
    fullName.toLocaleLowerCase('tr-TR').includes(cleanQuery) ||
    username.toLocaleLowerCase('tr-TR').includes(cleanQuery) ||
    rank.toLocaleLowerCase('tr-TR').includes(cleanQuery)
  ) {
    return true;
  }

  // 2. Accent-insensitive / normalized match (e.g. 'baris' matches 'Barış Yağar', 'yagar' matches 'Yağar')
  const normFullName = normalizeSearchText(fullName);
  const normUsername = normalizeSearchText(username);
  const normRank = normalizeSearchText(rank);

  return (
    normFullName.includes(normalizedQuery) ||
    normUsername.includes(normalizedQuery) ||
    normRank.includes(normalizedQuery)
  );
};
