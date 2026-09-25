import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

export interface ToastMessages<R> {
  /** Shown on success; return nothing to stay quiet. */
  success?: (result: R) => string | undefined;
  /** Shown when the thrown value carries no message of its own. */
  error: string;
}

/**
 * Runs a user-triggered async action and reports the outcome as a toast. Resolves to the result,
 * or to `undefined` if it failed — the failure has already been shown, so callers never catch.
 */
export async function runWithToast<R>(
  action: () => Promise<R>,
  messages: ToastMessages<R>,
): Promise<R | undefined> {
  try {
    const result = await action();
    const message = messages.success?.(result);
    if (message) toast.success(message);
    return result;
  } catch (error) {
    toast.error(errorMessage(error, messages.error));
    return undefined;
  }
}

export interface AsyncAction<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>;
  /** True while a run is in flight — for disabling the button that started it. */
  isRunning: boolean;
}

/** `runWithToast` plus a busy flag, for actions a button starts and must not start twice. */
export function useAsyncAction<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
  messages: ToastMessages<R>,
): AsyncAction<A, R> {
  const [isRunning, setRunning] = useState(false);

  const run = async (...args: A) => {
    setRunning(true);
    try {
      return await runWithToast(() => action(...args), messages);
    } finally {
      setRunning(false);
    }
  };

  return { run, isRunning };
}
