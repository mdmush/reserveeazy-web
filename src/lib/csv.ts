function escapeCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: string[],
  rows: (string | number)[][]
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");
}
