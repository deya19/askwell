import { createHmac, randomBytes } from "node:crypto";

/** A Svix-style signing secret for tests (`whsec_` + base64 key). Tests only. */
export const TEST_SIGNING_SECRET = `whsec_${randomBytes(24).toString("base64")}`;

let nextId = 0;

/**
 * A webhook request signed the way Clerk (Svix) signs deliveries: HMAC-SHA256 of
 * `<svix-id>.<svix-timestamp>.<body>` with the secret's key. Pass the same `id` to replay
 * an event. Tests only.
 */
export function signedRequest(
  payload: unknown,
  { id = `msg_${++nextId}`, secret = TEST_SIGNING_SECRET, timestamp = Math.floor(Date.now() / 1000) } = {},
): Request {
  const body = JSON.stringify(payload);
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Request("http://localhost/api/clerk/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(timestamp),
      "svix-signature": `v1,${signature}`,
    },
    body,
  });
}

/** A `subscriptionItem.*` event, shaped like Clerk Billing's payload (the parts we read). */
export function subscriptionItemEvent(
  type: string,
  options: { slug?: string; userId?: string; organizationId?: string } = {},
) {
  const { slug = "pro", organizationId } = options;
  // An explicit `userId: undefined` means "no user payer" (e.g. an organization).
  const userId = "userId" in options ? options.userId : "user_payer";
  return {
    object: "event",
    type,
    timestamp: Date.now(),
    data: {
      id: "csubi_123",
      object: "commerce_subscription_item",
      status: type.split(".")[1],
      plan: { id: "cplan_1", slug, name: slug },
      payer: { id: "cpayer_1", user_id: userId, organization_id: organizationId, email: "payer@example.com" },
    },
  };
}

type AccountRow = { clerk_user_id: string; plan: string };
type UpsertOptions = { onConflict?: string; ignoreDuplicates?: boolean };
type Result = { data: { clerk_user_id: string }[] | null; error: { message: string } | null };

/**
 * A fake `accounts` table for the service client, covering the calls `lib/accounts.ts` makes:
 * - `upsert(row, { ignoreDuplicates })…select()`: insert … on conflict do nothing; returns
 *   only inserted rows.
 * - `update(values).eq(col, v).neq(col, v)…select()`: returns only updated rows.
 * `failWith` makes every call return a database error. `beforeInsert` runs just before an
 * insert, to simulate a request that creates the row first (a race). Tests only.
 */
export function fakeAccountsTable() {
  const rows = new Map<string, AccountRow>();
  const state = {
    failWith: null as string | null,
    beforeInsert: null as (() => void) | null,
  };
  const fail = (): Result => ({ data: null, error: { message: state.failWith ?? "" } });

  const upsert = (row: AccountRow, options: UpsertOptions) => ({
    select: async (): Promise<Result> => {
      if (state.failWith) return fail();
      state.beforeInsert?.();
      state.beforeInsert = null;
      if (rows.has(row.clerk_user_id)) {
        if (!options.ignoreDuplicates) rows.set(row.clerk_user_id, { ...row });
        return { data: [], error: null };
      }
      rows.set(row.clerk_user_id, { ...row });
      return { data: [{ clerk_user_id: row.clerk_user_id }], error: null };
    },
  });

  const update = (values: Partial<AccountRow>) => {
    const filters: ((row: AccountRow) => boolean)[] = [];
    const query = {
      eq: (column: keyof AccountRow, value: string) => {
        filters.push((row) => row[column] === value);
        return query;
      },
      neq: (column: keyof AccountRow, value: string) => {
        filters.push((row) => row[column] !== value);
        return query;
      },
      select: async (): Promise<Result> => {
        if (state.failWith) return fail();
        const updated = [...rows.values()].filter((row) => filters.every((f) => f(row)));
        for (const row of updated) Object.assign(row, values);
        return { data: updated.map((row) => ({ clerk_user_id: row.clerk_user_id })), error: null };
      },
    };
    return query;
  };

  const from = (table: string) => {
    if (table !== "accounts") throw new Error(`Unexpected table: ${table}`);
    return { upsert, update };
  };

  return { rows, state, client: { from } };
}
