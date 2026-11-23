/// <reference types="node" />
/**
 * §9 Secrets: the widget bundle runs on every customer's site, so it may hold no secret.
 * Builds widget.js in memory with the same esbuild options as build.mjs and scans the output.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";

/** Server-only variables (project.md §11). Their values must never be in the bundle. */
const SECRET_VARIABLES = [
  "SUPABASE_SECRET_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "OPENAI_API_KEY",
  "ARCJET_KEY",
];

/** Shapes of secret keys from our providers. */
const SECRET_SHAPES = [
  /sb_secret_/, // Supabase secret key
  /sk_(live|test)_/, // Clerk secret key
  /whsec_/, // Clerk (Svix) webhook signing secret
  /sk-[A-Za-z0-9_-]{20,}/, // OpenAI
  /ajkey_/, // Arcjet
  /service_role/, // the role name in plain text
];

/** Roles of every JWT-shaped string in the source (a legacy Supabase key is a JWT; its payload is base64url). */
function jwtRoles(source: string): string[] {
  const roles: string[] = [];
  for (const [, payload] of source.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]*/g)) {
    try {
      const claims: unknown = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
      if (claims && typeof claims === "object" && "role" in claims && typeof claims.role === "string") roles.push(claims.role);
    } catch {
      // not a JWT payload
    }
  }
  return roles;
}

/** A synthetic, unsigned token: never a real credential. */
function fakeJwt(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.c2lnbmF0dXJl`;
}

let bundle: string;

beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("./index.ts", import.meta.url))],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2018",
    legalComments: "none",
    write: false,
    logLevel: "silent",
  });
  bundle = result.outputFiles[0]!.text;
});

describe("§9 Secrets: widget bundle", () => {
  it("builds with the same options as build.mjs", () => {
    const script = readFileSync(fileURLToPath(new URL("../build.mjs", import.meta.url)), "utf8");
    for (const option of ['format: "iife"', "minify: true", "bundle: true"]) expect(script).toContain(option);
    expect(bundle.length).toBeGreaterThan(1000);
  });

  it("reads no environment variable", () => {
    expect(bundle).not.toMatch(/process\.env|import\.meta\.env|NEXT_PUBLIC_/);
  });

  it("holds nothing shaped like a secret key", () => {
    for (const shape of SECRET_SHAPES) expect(bundle, String(shape)).not.toMatch(shape);
  });

  it("holds no service-role JWT (anon JWTs are public and allowed)", () => {
    expect(jwtRoles(bundle)).not.toContain("service_role");
  });

  it("decodes JWT roles that a plain-text check would miss", () => {
    const service = fakeJwt({ iss: "supabase", role: "service_role" });
    const anon = fakeJwt({ iss: "supabase", role: "anon" });
    expect(service).not.toMatch(/service_role/);
    expect(jwtRoles(`const k="${service}";`)).toEqual(["service_role"]);
    expect(jwtRoles(`const k="${anon}";`)).toEqual(["anon"]);
  });

  it("holds none of the server secrets set in this environment", () => {
    for (const name of SECRET_VARIABLES) {
      const value = process.env[name];
      if (value && value.length >= 8) expect(bundle.includes(value), name).toBe(false);
    }
  });
});
