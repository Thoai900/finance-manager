export type ActionResult = { ok: true } | { ok: false; error: string };

export const fail = (error: string): ActionResult => ({ ok: false, error });
export const OK: ActionResult = { ok: true };
