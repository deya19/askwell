import type { PGlite, Transaction } from "@electric-sql/pglite";
import { DEFAULT_WIDGET_CONFIG, PLAN_LIMITS, PUBLIC_KEY_PREFIX } from "@askwell/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asServiceRole, asUser, createTestDatabase } from "../supabase-pglite";
import { DB_ERROR_CODES } from "./errors";

/** Booting pglite and migrating takes a few seconds, more when test files run in parallel. */
const BOOT_TIMEOUT = 60_000;

const OWNER_A = "user_fn_owner_a";
const OWNER_B = "user_fn_owner_b";

/** The service functions, with a call that is valid apart from permissions. */
const SERVICE_FUNCTIONS = [
  "create_project(text, text, integer)",
  "reserve_knowledge_source(uuid, text, text, integer, text)",
  "consume_message(uuid, integer)",
  "save_chat_turn(uuid, text, text, text, uuid)",
  "match_chunks(uuid, extensions.vector, integer)",
] as const;

const ALL_FUNCTIONS = [...SERVICE_FUNCTIONS, "owner_activity()"] as const;

/** A 1536-dimension pgvector literal pointing mostly along axis `axis`. */
function axisVector(axis: number, lean = 0): string {
  return `[${Array.from({ length: 1536 }, (_, i) => (i === axis ? 1 : i === axis + 1 ? lean : 0)).join(",")}]`;
}

type ProjectRow = { id: string; owner_id: string; name: string; public_key: string; messages_used: number };

async function addAccount(db: PGlite, owner: string, plan: "free" | "pro" = "free"): Promise<void> {
  await db.query("insert into public.accounts (clerk_user_id, plan) values ($1, $2) on conflict do nothing", [
    owner,
    plan,
  ]);
}

/** Creates a project directly (as the superuser), bypassing the limit. */
async function addProject(db: PGlite, owner: string): Promise<string> {
  await addAccount(db, owner);
  const result = await db.query<{ id: string }>(
    `insert into public.projects (owner_id, name, public_key)
     values ($1, 'Fixture', 'pk_' || replace(gen_random_uuid()::text, '-', '')) returning id`,
    [owner],
  );
  return result.rows[0]!.id;
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  throw new Error("Expected the call to fail");
}

function createProject(tx: Transaction | PGlite, owner: string, name: string, max: number) {
  return tx.query<ProjectRow>("select * from public.create_project($1, $2, $3)", [owner, name, max]);
}

function consume(tx: Transaction | PGlite, projectId: string, max: number) {
  return tx
    .query<{ allowed: boolean }>("select public.consume_message($1, $2) as allowed", [projectId, max])
    .then((result) => result.rows[0]!.allowed);
}

function reserve(tx: Transaction | PGlite, projectId: string, type: string, max: number) {
  return tx.query<{ id: string; status: string; type: string }>(
    "select * from public.reserve_knowledge_source($1, $2, $3, $4, $5)",
    [projectId, "Source", type, max, type === "text" ? null : `${projectId}/file.${type}`],
  );
}

async function messagesUsed(db: PGlite, projectId: string): Promise<{ used: number; periodStart: Date }> {
  const result = await db.query<{ messages_used: number; period_start: Date }>(
    "select messages_used, period_start from public.projects where id = $1",
    [projectId],
  );
  return { used: result.rows[0]!.messages_used, periodStart: result.rows[0]!.period_start };
}

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase();
}, BOOT_TIMEOUT);

afterAll(async () => {
  await db.close();
});

describe("function settings and grants", () => {
  it("makes every function SECURITY INVOKER with an empty search_path", async () => {
    const result = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
      `select p.proname, p.prosecdef, p.proconfig from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
    );
    expect(result.rows.map((row) => row.proname).sort()).toEqual(
      ["consume_message", "create_project", "match_chunks", "owner_activity", "reserve_knowledge_source", "save_chat_turn"],
    );
    for (const row of result.rows) {
      expect(row.prosecdef, row.proname).toBe(false);
      expect(row.proconfig, row.proname).toEqual(['search_path=""']);
    }
  });

  it("lets only service_role execute the service functions", async () => {
    for (const fn of SERVICE_FUNCTIONS) {
      const result = await db.query<{ role: string; ok: boolean }>(
        `select r as role, has_function_privilege(r, $1, 'EXECUTE') as ok
         from unnest(array['anon', 'authenticated', 'service_role']) r`,
        [`public.${fn}`],
      );
      const byRole = Object.fromEntries(result.rows.map((row) => [row.role, row.ok]));
      expect(byRole, fn).toEqual({ anon: false, authenticated: false, service_role: true });
    }
  });

  it("lets only authenticated execute owner_activity", async () => {
    const result = await db.query<{ role: string; ok: boolean }>(
      `select r as role, has_function_privilege(r, 'public.owner_activity()', 'EXECUTE') as ok
       from unnest(array['anon', 'authenticated', 'service_role']) r`,
    );
    expect(Object.fromEntries(result.rows.map((row) => [row.role, row.ok]))).toEqual({
      anon: false,
      authenticated: true,
      service_role: false,
    });
  });

  it("grants nothing to PUBLIC", async () => {
    for (const fn of [...ALL_FUNCTIONS.map((name) => `public.${name}`), "private.current_period_start(timestamptz, timestamptz)"]) {
      const result = await db.query<{ acl: string[] }>("select proacl::text[] as acl from pg_proc where oid = $1::regprocedure", [fn]);
      // A PUBLIC grant shows as an ACL entry with an empty grantee: "=X/owner".
      expect(result.rows[0]!.acl.some((entry) => entry.startsWith("=")), fn).toBe(false);
    }
  });

  it("refuses the service functions to anon and authenticated at call time", async () => {
    const projectId = await addProject(db, OWNER_A);
    const calls = [
      `select public.create_project('${OWNER_A}', 'X', 5)`,
      `select public.reserve_knowledge_source('${projectId}', 'T', 'text', 5)`,
      `select public.consume_message('${projectId}', 5)`,
      `select public.save_chat_turn('${projectId}', 'v', 'q', 'a')`,
      `select * from public.match_chunks('${projectId}', '${axisVector(0)}', 5)`,
    ];
    for (const sql of calls) {
      expect(await errorCode(asAnon(db, (tx) => tx.query(sql))), `anon: ${sql}`).toBe("42501");
      expect(await errorCode(asUser(db, OWNER_A, (tx) => tx.query(sql))), `authenticated: ${sql}`).toBe("42501");
    }
    expect(await errorCode(asAnon(db, (tx) => tx.query("select * from public.owner_activity()")))).toBe("42501");
  });
});

describe("create_project", () => {
  const owner = "user_create_project";

  beforeAll(async () => {
    await addAccount(db, owner);
  });

  it("creates the project with a random public key and the default widget config", async () => {
    const result = await asServiceRole(db, async (tx) => {
      const project = (await createProject(tx, owner, "  My site  ", 2)).rows[0]!;
      const other = (await createProject(tx, owner, "Second", 2)).rows[0]!;
      const config = await tx.query("select * from public.widget_configs where project_id = $1", [project.id]);
      return { project, other, config: config.rows[0] };
    });

    expect(result.project).toMatchObject({ owner_id: owner, name: "My site", messages_used: 0 });
    expect(result.project.public_key.startsWith(PUBLIC_KEY_PREFIX)).toBe(true);
    expect(result.project.public_key).toMatch(/^pk_[0-9a-f]{64}$/);
    expect(result.other.public_key).not.toBe(result.project.public_key);
    expect(result.config).toEqual({
      project_id: result.project.id,
      button_color: DEFAULT_WIDGET_CONFIG.buttonColor,
      position: DEFAULT_WIDGET_CONFIG.position,
      label: DEFAULT_WIDGET_CONFIG.label,
      animation: DEFAULT_WIDGET_CONFIG.animation,
      header_text: DEFAULT_WIDGET_CONFIG.headerText,
      show_badge: DEFAULT_WIDGET_CONFIG.showBadge,
    });
  });

  it.each([
    ["free", PLAN_LIMITS.free.projects],
    ["pro", PLAN_LIMITS.pro.projects],
  ] as const)("allows the %s plan's last project and refuses the next one", async (plan, max) => {
    const planOwner = `user_create_limit_${plan}`;
    await addAccount(db, planOwner, plan);
    await asServiceRole(
      db,
      async (tx) => {
        for (let i = 0; i < max; i++) await createProject(tx, planOwner, `Project ${i + 1}`, max);
      },
      { commit: true },
    );
    expect(await errorCode(asServiceRole(db, (tx) => createProject(tx, planOwner, "One too many", max)))).toBe(
      DB_ERROR_CODES.projectLimitReached,
    );
    const count = await db.query<{ n: number }>("select count(*)::int as n from public.projects where owner_id = $1", [
      planOwner,
    ]);
    expect(count.rows[0]!.n).toBe(max);
  });

  it("counts only the owner's own projects", async () => {
    await addProject(db, "user_someone_else");
    await asServiceRole(db, async (tx) => {
      await createProject(tx, owner, "Mine", 1);
    });
  });

  it("refuses when the limit is missing, and for an unknown account", async () => {
    await asServiceRole(db, async (tx) => {
      expect(await errorCode(tx.query("select public.create_project($1, 'X', null)", [owner]))).toBe(
        DB_ERROR_CODES.projectLimitReached,
      );
    });
    await asServiceRole(db, async (tx) => {
      expect(await errorCode(createProject(tx, "user_missing", "X", 5))).toBe(DB_ERROR_CODES.notFound);
    });
  });

  it("lets only one of two concurrent calls take the last slot", async () => {
    const racer = "user_create_race";
    await addAccount(db, racer);
    const results = await Promise.allSettled([
      asServiceRole(db, (tx) => createProject(tx, racer, "A", 1), { commit: true }),
      asServiceRole(db, (tx) => createProject(tx, racer, "B", 1), { commit: true }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as { code?: string }).code).toBe(DB_ERROR_CODES.projectLimitReached);
    const count = await db.query<{ n: number }>("select count(*)::int as n from public.projects where owner_id = $1", [racer]);
    expect(count.rows[0]!.n).toBe(1);
  });
});

describe("reserve_knowledge_source", () => {
  let projectId: string;

  beforeEach(async () => {
    projectId = await addProject(db, OWNER_A);
  });

  it("starts files as uploading and pasted text as processing", async () => {
    await asServiceRole(db, async (tx) => {
      expect((await reserve(tx, projectId, "pdf", 5)).rows[0]).toMatchObject({ type: "pdf", status: "uploading" });
      expect((await reserve(tx, projectId, "text", 5)).rows[0]).toMatchObject({ type: "text", status: "processing" });
    });
  });

  it.each([
    ["free", PLAN_LIMITS.free.knowledgeSources],
    ["pro", PLAN_LIMITS.pro.knowledgeSources],
  ] as const)("allows the %s plan's last source and refuses the next one", async (_plan, max) => {
    await asServiceRole(db, async (tx) => {
      // Files and pasted text count toward the same limit.
      for (let i = 0; i < max; i++) await reserve(tx, projectId, i % 2 === 0 ? "text" : "md", max);
      expect(await errorCode(reserve(tx, projectId, "txt", max))).toBe(DB_ERROR_CODES.sourceLimitReached);
    });
  });

  it("counts only this project's sources", async () => {
    const other = await addProject(db, OWNER_B);
    await asServiceRole(
      db,
      async (tx) => {
        await reserve(tx, other, "text", 1);
        await reserve(tx, projectId, "text", 1);
      },
    );
  });

  it("refuses when the limit is missing, and for an unknown project", async () => {
    await asServiceRole(db, async (tx) => {
      expect(await errorCode(reserve(tx, projectId, "text", null as unknown as number))).toBe(
        DB_ERROR_CODES.sourceLimitReached,
      );
    });
    await asServiceRole(db, async (tx) => {
      expect(await errorCode(reserve(tx, "00000000-0000-4000-8000-000000000000", "text", 5))).toBe(
        DB_ERROR_CODES.notFound,
      );
    });
  });

  it("lets only one of two concurrent calls take the last slot", async () => {
    const results = await Promise.allSettled([
      asServiceRole(db, (tx) => reserve(tx, projectId, "text", 1), { commit: true }),
      asServiceRole(db, (tx) => reserve(tx, projectId, "pdf", 1), { commit: true }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const count = await db.query<{ n: number }>(
      "select count(*)::int as n from public.knowledge_sources where project_id = $1",
      [projectId],
    );
    expect(count.rows[0]!.n).toBe(1);
  });
});

describe("consume_message", () => {
  let projectId: string;

  beforeEach(async () => {
    projectId = await addProject(db, OWNER_A);
  });

  it.each([
    ["free", PLAN_LIMITS.free.messagesPerMonth],
    ["pro", PLAN_LIMITS.pro.messagesPerMonth],
  ] as const)("allows the %s plan's last message and refuses the next one", async (_plan, max) => {
    await db.query("update public.projects set messages_used = $2 where id = $1", [projectId, max - 1]);
    await asServiceRole(db, async (tx) => {
      expect(await consume(tx, projectId, max)).toBe(true);
      expect(await consume(tx, projectId, max)).toBe(false);
    }, { commit: true });
    expect((await messagesUsed(db, projectId)).used).toBe(max);
  });

  it("counts every accepted message from zero", async () => {
    await asServiceRole(db, async (tx) => {
      for (let i = 0; i < 3; i++) expect(await consume(tx, projectId, 3)).toBe(true);
      expect(await consume(tx, projectId, 3)).toBe(false);
    }, { commit: true });
    expect((await messagesUsed(db, projectId)).used).toBe(3);
  });

  it("refuses everything when the limit is missing or zero", async () => {
    await asServiceRole(db, async (tx) => {
      expect(await consume(tx, projectId, 0)).toBe(false);
      expect(await consume(tx, projectId, null as unknown as number)).toBe(false);
    }, { commit: true });
    expect((await messagesUsed(db, projectId)).used).toBe(0);
  });

  it("raises for an unknown project", async () => {
    expect(
      await errorCode(asServiceRole(db, (tx) => consume(tx, "00000000-0000-4000-8000-000000000000", 5))),
    ).toBe(DB_ERROR_CODES.notFound);
  });

  it("starts a new period once the stored one is over a month old", async () => {
    await db.query(
      "update public.projects set messages_used = 100, period_start = now() - interval '1 month 3 days' where id = $1",
      [projectId],
    );
    const before = await messagesUsed(db, projectId);
    await asServiceRole(db, async (tx) => {
      expect(await consume(tx, projectId, 100)).toBe(true);
    }, { commit: true });
    const after = await messagesUsed(db, projectId);
    expect(after.used).toBe(1);
    // The new period is the old one plus one whole month, so resets keep the same day of the month.
    const expected = await db.query<{ start: Date }>("select $1::timestamptz + interval '1 month' as start", [
      before.periodStart,
    ]);
    expect(after.periodStart.getTime()).toBe(expected.rows[0]!.start.getTime());
  });

  it("skips ahead several months after a long gap", async () => {
    await db.query(
      "update public.projects set messages_used = 50, period_start = now() - interval '3 months 2 days' where id = $1",
      [projectId],
    );
    const before = await messagesUsed(db, projectId);
    await asServiceRole(db, (tx) => consume(tx, projectId, 100), { commit: true });
    const after = await messagesUsed(db, projectId);
    const expected = await db.query<{ start: Date }>("select $1::timestamptz + interval '3 months' as start", [
      before.periodStart,
    ]);
    expect(after).toEqual({ used: 1, periodStart: expected.rows[0]!.start });
  });

  it("keeps counting within the month", async () => {
    await db.query(
      "update public.projects set messages_used = 100, period_start = now() - interval '27 days' where id = $1",
      [projectId],
    );
    const before = await messagesUsed(db, projectId);
    await asServiceRole(db, async (tx) => {
      expect(await consume(tx, projectId, 100)).toBe(false);
    }, { commit: true });
    expect(await messagesUsed(db, projectId)).toEqual(before);
  });

  it("lets only one of two concurrent calls take the last slot", async () => {
    await db.query("update public.projects set messages_used = 4 where id = $1", [projectId]);
    const results = await Promise.all([
      asServiceRole(db, (tx) => consume(tx, projectId, 5), { commit: true }),
      asServiceRole(db, (tx) => consume(tx, projectId, 5), { commit: true }),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect((await messagesUsed(db, projectId)).used).toBe(5);
  });
});

describe("save_chat_turn", () => {
  let projectId: string;

  beforeEach(async () => {
    projectId = await addProject(db, OWNER_A);
  });

  async function thread(conversationId: string) {
    const result = await db.query<{ role: string; body: string }>(
      "select role, body from public.messages where conversation_id = $1 order by created_at",
      [conversationId],
    );
    return result.rows.map((row) => `${row.role}: ${row.body}`);
  }

  function save(tx: Transaction, conversationId: string | null, project = projectId, q = "Hi?", a = "Hello.") {
    return tx
      .query<{ id: string }>(
        "select public.save_chat_turn(project_id => $1, visitor_id => 'visitor-1', visitor_message => $2, bot_reply => $3, conversation_id => $4) as id",
        [project, q, a, conversationId],
      )
      .then((result) => result.rows[0]!.id);
  }

  it("creates the conversation on the first turn and appends later turns in order", async () => {
    const conversationId = await asServiceRole(
      db,
      async (tx) => {
        const id = await save(tx, null, projectId, "Q1", "A1");
        expect(await save(tx, id, projectId, "Q2", "A2")).toBe(id);
        return id;
      },
      { commit: true },
    );
    const conversation = await db.query("select project_id, visitor_id from public.conversations where id = $1", [
      conversationId,
    ]);
    expect(conversation.rows[0]).toEqual({ project_id: projectId, visitor_id: "visitor-1" });
    expect(await thread(conversationId)).toEqual(["visitor: Q1", "bot: A1", "visitor: Q2", "bot: A2"]);
  });

  it("refuses a conversation from another project, and an unknown one", async () => {
    const otherProject = await addProject(db, OWNER_B);
    const otherConversation = await asServiceRole(db, (tx) => save(tx, null, otherProject), { commit: true });
    expect(await errorCode(asServiceRole(db, (tx) => save(tx, otherConversation)))).toBe(DB_ERROR_CODES.notFound);
    expect(await errorCode(asServiceRole(db, (tx) => save(tx, "00000000-0000-4000-8000-000000000000")))).toBe(
      DB_ERROR_CODES.notFound,
    );
    expect(await thread(otherConversation)).toEqual(["visitor: Hi?", "bot: Hello."]);
  });
});

describe("match_chunks", () => {
  let projectA: string;
  let projectB: string;

  async function addSource(projectId: string, status: string, chunks: Record<string, string>) {
    const source = await db.query<{ id: string }>(
      `insert into public.knowledge_sources (project_id, title, type, status) values ($1, 'S', 'text', $2) returning id`,
      [projectId, status],
    );
    for (const [content, vector] of Object.entries(chunks)) {
      await db.query(
        "insert into public.knowledge_chunks (project_id, source_id, content, embedding) values ($1, $2, $3, $4)",
        [projectId, source.rows[0]!.id, content, vector],
      );
    }
  }

  async function match(projectId: string, query: string, count: number) {
    return asServiceRole(db, (tx) =>
      tx.query<{ content: string; similarity: number }>("select * from public.match_chunks($1, $2, $3)", [
        projectId,
        query,
        count,
      ]),
    ).then((result) => result.rows);
  }

  beforeAll(async () => {
    projectA = await addProject(db, OWNER_A);
    projectB = await addProject(db, OWNER_B);
    await addSource(projectA, "ready", { "a exact": axisVector(0), "a near": axisVector(0, 1), "a far": axisVector(9) });
    await addSource(projectA, "processing", { "a not ready": axisVector(0) });
    await addSource(projectB, "ready", { "b exact": axisVector(0) });
  });

  it("returns the nearest chunks of ready sources, best first", async () => {
    const rows = await match(projectA, axisVector(0), 2);
    expect(rows.map((row) => row.content)).toEqual(["a exact", "a near"]);
    expect(rows[0]!.similarity).toBeCloseTo(1, 6);
    expect(rows[1]!.similarity).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("never returns another project's chunks", async () => {
    const rowsA = await match(projectA, axisVector(0), 10);
    expect(rowsA.map((row) => row.content).sort()).toEqual(["a exact", "a far", "a near"]);
    const rowsB = await match(projectB, axisVector(0), 10);
    expect(rowsB.map((row) => row.content)).toEqual(["b exact"]);
  });

  it("returns nothing for a zero count", async () => {
    expect(await match(projectA, axisVector(0), 0)).toEqual([]);
  });
});

describe("owner_activity", () => {
  const owner = "user_activity_a";
  const other = "user_activity_b";
  let current: string;
  let rolledOver: string;

  beforeAll(async () => {
    current = await addProject(db, owner);
    rolledOver = await addProject(db, owner);
    const otherProject = await addProject(db, other);
    await db.query("update public.projects set messages_used = 7 where id = $1", [current]);
    await db.query("update public.projects set messages_used = 9 where id = $1", [otherProject]);
    await db.query(
      "update public.projects set messages_used = 42, period_start = now() - interval '1 month 1 day' where id = $1",
      [rolledOver],
    );
  });

  it("shows each of the caller's projects, with a rolled-over period at zero", async () => {
    const rows = await asUser(db, owner, (tx) =>
      tx.query<{ project_id: string; messages_used: number; period_start: Date }>("select * from public.owner_activity()"),
    ).then((result) => result.rows);
    expect(Object.fromEntries(rows.map((row) => [row.project_id, row.messages_used]))).toEqual({
      [current]: 7,
      [rolledOver]: 0,
    });
    const stored = await messagesUsed(db, rolledOver);
    const shown = rows.find((row) => row.project_id === rolledOver)!.period_start;
    expect(shown.getTime()).toBeGreaterThan(stored.periodStart.getTime());
  });

  it("shows nothing to a token with no projects", async () => {
    const rows = await asUser(db, "user_nobody", (tx) => tx.query("select * from public.owner_activity()"));
    expect(rows.rows).toEqual([]);
  });
});
