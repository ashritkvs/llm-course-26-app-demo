export function slugify(str: string): string {
  const cleanedStr = str.replace(/[^\w\s-]/g, '');
  return cleanedStr.toLowerCase().replace(/\s+/g, '-');
}
