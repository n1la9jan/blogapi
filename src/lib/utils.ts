export function generateID(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`;
}
