/**
 * Date constraints utility
 * Provides min and max date limits: 1 year before today to 1 year after today
 */

export const getDateConstraints = () => {
  const today = new Date();
  
  // Min date: 1 year before today
  const minDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  
  // Max date: 1 year after today
  const maxDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  
  return {
    minDate,
    maxDate,
    minDateString: formatDateForInput(minDate),
    maxDateString: formatDateForInput(maxDate)
  };
};

/**
 * Format date to YYYY-MM-DD format for HTML5 date input
 */
export const formatDateForInput = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Validate if date is within allowed range
 */
export const isDateWithinRange = (dateString) => {
  if (!dateString) return true; // Empty dates are valid (optional fields)
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  
  const constraints = getDateConstraints();
  
  // Normalize to midnight for comparison
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const normalizedMin = new Date(constraints.minDate.getFullYear(), constraints.minDate.getMonth(), constraints.minDate.getDate());
  const normalizedMax = new Date(constraints.maxDate.getFullYear(), constraints.maxDate.getMonth(), constraints.maxDate.getDate());
  
  return normalizedDate >= normalizedMin && normalizedDate <= normalizedMax;
};

/**
 * Clamp date to valid range if outside bounds
 */
export const clampDateToRange = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const constraints = getDateConstraints();
  
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const normalizedMin = new Date(constraints.minDate.getFullYear(), constraints.minDate.getMonth(), constraints.minDate.getDate());
  const normalizedMax = new Date(constraints.maxDate.getFullYear(), constraints.maxDate.getMonth(), constraints.maxDate.getDate());
  
  if (normalizedDate < normalizedMin) {
    return formatDateForInput(constraints.minDate);
  }
  if (normalizedDate > normalizedMax) {
    return formatDateForInput(constraints.maxDate);
  }
  
  return dateString;
};
