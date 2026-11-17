"use client";

import {
  APP_NAME,
  MAX_WIDGET_HEADER_TEXT_LENGTH,
  MAX_WIDGET_LABEL_LENGTH,
  OPEN_ANIMATIONS,
  type WidgetConfig,
} from "@askwell/shared";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass-panel";
import { saveWidgetConfig } from "./api";
import { ANIMATION_LABELS, POSITION_GRID, POSITION_LABELS, isDirty, previewConfig, validateDraft } from "./copy";
import { UpgradePrompt } from "./upgrade-prompt";
import { WidgetPreview } from "./widget-preview";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "upgrade" }
  | { kind: "error"; message: string };

const inputClasses =
  "h-10 w-full min-w-0 rounded-pill border border-border bg-bg-raised px-4 text-sm outline-none focus:border-fg/40 aria-invalid:border-fg";

const tileClasses =
  "flex cursor-pointer items-center justify-center rounded-md border border-border bg-bg-raised px-3 text-sm font-medium text-muted transition has-checked:border-fg has-checked:text-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg";

/**
 * The Customize form and its live preview (project.md §6.8). The plan comes from the server:
 * on Free the form is locked behind an upgrade prompt, and the server refuses a save (402)
 * anyway. Every value is validated with the shared schema before it is sent.
 */
export function CustomizeView({
  projectId,
  initialConfig,
  canCustomize,
}: {
  projectId: string;
  initialConfig: WidgetConfig;
  canCustomize: boolean;
}) {
  const [saved, setSaved] = useState(initialConfig);
  const [draft, setDraft] = useState(initialConfig);
  const [locked, setLocked] = useState(!canCustomize);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const validation = validateDraft(draft);
  const errors = validation.ok ? {} : validation.errors;
  // The preview keeps each field's last valid value while the owner is mid-edit (e.g. a
  // half-typed color), not the saved one. Updated during render, so it never lags a frame.
  const [lastPreview, setLastPreview] = useState(initialConfig);
  const preview = previewConfig(draft, lastPreview);
  if (isDirty(preview, lastPreview)) setLastPreview(preview);
  const dirty = isDirty(draft, saved);
  const saving = status.kind === "saving";

  function update<K extends keyof WidgetConfig>(field: K, value: WidgetConfig[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (status.kind !== "saving") setStatus({ kind: "idle" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !validation.ok) return;

    setStatus({ kind: "saving" });
    const result = await saveWidgetConfig(projectId, validation.config);

    if (result.ok) {
      setSaved(result.data.config);
      setDraft(result.data.config);
      setStatus({ kind: "saved" });
    } else if (result.code === "plan_required") {
      // The plan changed (or the lock was bypassed): the server said no, so lock the form.
      setLocked(true);
      setStatus({ kind: "upgrade" });
    } else {
      setStatus({ kind: "error", message: result.message });
    }
  }

  const ids = {
    color: useId(),
    colorText: useId(),
    label: useId(),
    header: useId(),
    badge: useId(),
    error: useId(),
  };

  return (
    <div className="mt-8 space-y-6">
      {locked && <UpgradePrompt role={status.kind === "upgrade" ? "alert" : undefined} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section aria-label="Preview" className="lg:sticky lg:top-6 lg:order-last">
          <WidgetPreview config={preview} />
          <p className="mt-2 text-xs text-muted">Preview. Click the button to open and close the panel.</p>
        </section>

        <GlassPanel as="form" onSubmit={submit} noValidate className="p-4 sm:p-6" aria-label="Widget settings">
          {/* Locked on Free, and while a save is in flight so no edit is overwritten by its reply. */}
          <fieldset disabled={locked || saving} className={cn("min-w-0 space-y-6", locked && "opacity-60")}>
            <Field label="Button color" htmlFor={ids.colorText} error={errors.buttonColor}>
              <div className="flex gap-2">
                <input
                  id={ids.color}
                  type="color"
                  aria-label="Pick a button color"
                  value={preview.buttonColor}
                  onChange={(e) => update("buttonColor", e.target.value)}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-bg-raised p-1"
                />
                <input
                  id={ids.colorText}
                  value={draft.buttonColor}
                  onChange={(e) => update("buttonColor", e.target.value.trim())}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={errors.buttonColor ? true : undefined}
                  className={cn(inputClasses, "font-mono")}
                />
              </div>
            </Field>

            <fieldset className="min-w-0">
              <legend className="text-sm font-medium">Position</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {POSITION_GRID.map((position) => (
                  <label key={position} className={cn(tileClasses, "h-10")}>
                    <input
                      type="radio"
                      name="position"
                      value={position}
                      checked={draft.position === position}
                      onChange={() => update("position", position)}
                      className="sr-only"
                    />
                    {POSITION_LABELS[position]}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field
              label="Button label"
              htmlFor={ids.label}
              error={errors.label}
              hint={`Up to ${MAX_WIDGET_LABEL_LENGTH} characters.`}
            >
              <input
                id={ids.label}
                value={draft.label}
                onChange={(e) => update("label", e.target.value)}
                maxLength={MAX_WIDGET_LABEL_LENGTH}
                autoComplete="off"
                aria-invalid={errors.label ? true : undefined}
                className={inputClasses}
              />
            </Field>

            <fieldset className="min-w-0">
              <legend className="text-sm font-medium">Open animation</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {OPEN_ANIMATIONS.map((animation) => (
                  <label key={animation} className={cn(tileClasses, "h-10")}>
                    <input
                      type="radio"
                      name="animation"
                      value={animation}
                      checked={draft.animation === animation}
                      onChange={() => update("animation", animation)}
                      className="sr-only"
                    />
                    {ANIMATION_LABELS[animation]}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field
              label="Header text"
              htmlFor={ids.header}
              error={errors.headerText}
              hint={`Up to ${MAX_WIDGET_HEADER_TEXT_LENGTH} characters.`}
            >
              <input
                id={ids.header}
                value={draft.headerText}
                onChange={(e) => update("headerText", e.target.value)}
                maxLength={MAX_WIDGET_HEADER_TEXT_LENGTH}
                autoComplete="off"
                aria-invalid={errors.headerText ? true : undefined}
                className={inputClasses}
              />
            </Field>

            <label htmlFor={ids.badge} className="flex cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0 text-sm">
                <span className="block font-medium">&ldquo;Powered by {APP_NAME}&rdquo; badge</span>
                <span className="block text-muted">Shown under the chat input.</span>
              </span>
              <input
                id={ids.badge}
                type="checkbox"
                role="switch"
                checked={draft.showBadge}
                onChange={(e) => update("showBadge", e.target.checked)}
                className="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-pill border border-border bg-fg/15 transition before:absolute before:top-0.5 before:left-0.5 before:size-4.5 before:rounded-full before:bg-bg-raised before:shadow before:transition checked:bg-accent checked:before:translate-x-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
              />
            </label>

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 sm:flex-none" disabled={saving || !dirty || !validation.ok}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 sm:flex-none"
                  disabled={saving || !dirty}
                  onClick={() => {
                    setDraft(saved);
                    setStatus({ kind: "idle" });
                  }}
                >
                  Discard
                </Button>
              </div>
              <StatusMessage status={status} id={ids.error} />
            </div>
          </fieldset>
        </GlassPanel>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

function StatusMessage({ status, id }: { status: Status; id: string }) {
  switch (status.kind) {
    case "saved":
      return (
        <p id={id} role="status" className="text-sm text-muted">
          Saved. Sites pick up the change within a minute of a reload.
        </p>
      );
    case "upgrade":
      return (
        <p id={id} role="alert" className="text-sm">
          Saving needs the Pro plan. Nothing was changed.
        </p>
      );
    case "error":
      return (
        <p id={id} role="alert" className="text-sm">
          {status.message}
        </p>
      );
    default:
      return null;
  }
}
