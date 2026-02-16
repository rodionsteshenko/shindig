export interface CSVGuest {
  name: string;
  email: string;
  phone?: string;
}

export function parseGuestCSV(text: string): CSVGuest[] {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return [];

  // Detect if first line is a header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("email");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const results: CSVGuest[] = [];

  for (const line of dataLines) {
    const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    if (parts.length < 2) continue;

    const name = parts[0];
    const email = parts[1];
    if (name.length === 0 || email.length === 0) continue;

    results.push({ name, email, phone: parts[2] || undefined });
  }

  return results;
}
