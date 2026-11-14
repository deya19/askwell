import type { Plan } from "@askwell/shared";
import Link from "next/link";
import { PRICING_PATH } from "@/components/projects/copy";
import { sourceLimitMessage } from "./copy";

/** The plan's source limit, with a pricing link on Free. Shown at the limit and after a 402. */
export function LimitMessage({ plan, id }: { plan: Plan; id?: string }) {
  return (
    <p id={id} role="alert" className="text-sm text-pretty">
      {sourceLimitMessage(plan)}{" "}
      {plan === "free" && (
        <Link href={PRICING_PATH} className="font-medium underline underline-offset-4">
          See pricing
        </Link>
      )}
    </p>
  );
}
