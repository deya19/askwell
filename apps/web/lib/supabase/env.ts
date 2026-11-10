/** Reads a required environment variable at call time, so a missing one fails loudly. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}.`);
  return value;
}
