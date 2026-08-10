"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input, Label } from "./Field";

type ConfirmOptions = {
  title: string;
  body?: string;
  /** Names the action, so the button matches the verb the user clicked to get here. */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type PromptOptions = {
  title: string;
  body?: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  /** Return a message to block submission and show it inline. */
  validate?: (value: string) => string | null;
};

type Request =
  | ({ kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (v: string | null) => void } & PromptOptions);

const Ctx = createContext<{
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
} | null>(null);

/**
 * Promise-based replacements for `window.confirm` / `window.prompt`, so call
 * sites keep reading top-to-bottom:
 *
 *   if (!(await confirm({ title: "Delete 3 contacts?" }))) return;
 */
export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const settle = useCallback((result: boolean | string | null) => {
    setReq((current) => {
      if (!current) return null;
      if (current.kind === "confirm") current.resolve(result === true);
      else current.resolve(typeof result === "string" ? result : null);
      return null;
    });
    setError(null);
  }, []);

  const api = useMemo(
    () => ({
      confirm: (o: ConfirmOptions) =>
        new Promise<boolean>((resolve) => {
          setError(null);
          setReq({ kind: "confirm", resolve, ...o });
        }),
      prompt: (o: PromptOptions) =>
        new Promise<string | null>((resolve) => {
          setError(null);
          setValue(o.defaultValue ?? "");
          setReq({ kind: "prompt", resolve, ...o });
          // Focus once the element is in the top layer.
          requestAnimationFrame(() => inputRef.current?.select());
        }),
    }),
    [],
  );

  const submitPrompt = useCallback(() => {
    if (!req || req.kind !== "prompt") return;
    const trimmed = value.trim();
    const message = req.validate ? req.validate(trimmed) : trimmed ? null : `${req.label} is required.`;
    if (message) {
      setError(message);
      inputRef.current?.focus();
      return;
    }
    settle(trimmed);
  }, [req, value, settle]);

  return (
    <Ctx.Provider value={api}>
      {children}

      <Dialog
        open={req?.kind === "confirm"}
        onClose={() => settle(false)}
        title={req?.kind === "confirm" ? req.title : ""}
        description={req?.kind === "confirm" ? req.body : undefined}
        dismissOnBackdrop={req?.kind === "confirm" && req.tone !== "danger"}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => settle(false)}>
              {(req?.kind === "confirm" && req.cancelLabel) || "Cancel"}
            </Button>
            <Button
              variant={req?.kind === "confirm" && req.tone === "danger" ? "danger" : "primary"}
              size="sm"
              onClick={() => settle(true)}
            >
              {(req?.kind === "confirm" && req.confirmLabel) || "Confirm"}
            </Button>
          </>
        }
      />

      <Dialog
        open={req?.kind === "prompt"}
        onClose={() => settle(null)}
        title={req?.kind === "prompt" ? req.title : ""}
        description={req?.kind === "prompt" ? req.body : undefined}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => settle(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitPrompt}>
              {(req?.kind === "prompt" && req.confirmLabel) || "Save"}
            </Button>
          </>
        }
      >
        {req?.kind === "prompt" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPrompt();
            }}
          >
            <Label htmlFor="ft-prompt-input">{req.label}</Label>
            <Input
              id="ft-prompt-input"
              ref={inputRef}
              value={value}
              placeholder={req.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "ft-prompt-error" : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
            />
            {error && (
              <p id="ft-prompt-error" role="alert" className="mt-1.5 text-sm text-danger">
                {error}
              </p>
            )}
          </form>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}

function useDialogs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm/usePrompt must be used inside <DialogsProvider>");
  return ctx;
}

export const useConfirm = () => useDialogs().confirm;
export const usePrompt = () => useDialogs().prompt;
