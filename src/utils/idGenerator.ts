export function generateId(prefix: 'EQ' | 'MF' | 'ALT' | 'CASH' | 'DIV'): string {
  const date = new Date();
  const yyyymmdd = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000).toString(); // Ensures exactly 4 digits
  return `TRC-${prefix}-${yyyymmdd}-${rand}`;
}
