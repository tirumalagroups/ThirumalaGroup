/**
 * Returns the current date in local browser timezone formatted as YYYY-MM-DD.
 * Avoids UTC timezone shifting issues.
 */
export function getLocalBusinessDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
