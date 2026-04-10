export function capitalizeFirstLetter(string: string): string {
  if (!string) return ''; // Handle empty or null strings safely
  return string.charAt(0).toUpperCase() + string.slice(1);
}
