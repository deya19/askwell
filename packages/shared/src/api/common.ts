import { z } from "zod";
import { PUBLIC_KEY_PREFIX } from "../limits";

/** A row id (uuid). */
export const idSchema = z.uuid();

/** Route params for `/api/.../:id`. */
export const idParamsSchema = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParamsSchema>;

/** A project's public key: `pk_` + random. It identifies a project; it grants nothing. */
export const publicKeySchema = z
  .string()
  .regex(new RegExp(`^${PUBLIC_KEY_PREFIX}[A-Za-z0-9_-]{8,128}$`), "Invalid public key");

/** An ISO 8601 timestamp, as returned in JSON. */
export const timestampSchema = z.iso.datetime({ offset: true });
