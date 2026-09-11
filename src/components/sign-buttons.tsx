"use client";

import { useState, useTransition } from "react";
import { signReceipt } from "@/modules/receipts/actions";

export function SignButtons({ receiptId, pending }: { receiptId: string; pending: boolean }) {
  const [open, setOpen] = useState<null | "conform" | "non">(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (!pending) return <p className="text-sm text-zinc-500">Este recibo ya fue firmado.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
        onClick={() => setOpen("conform")}
      >
        Firmar en conformidad
      </button>
      <button
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
        onClick={() => setOpen("non")}
      >
        Firmar NO en conformidad
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            {open === "conform" ? (
              <>
                <p className="text-sm text-zinc-700">
                  ¿Confirmás que recibiste y aceptás el presente recibo? Esto es una conformidad
                  electrónica, no una firma digital certificada.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setOpen(null)}>Cancelar</button>
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const e = await signReceipt(receiptId, "conform");
                        if (e) setErr(e);
                        else setOpen(null);
                      })
                    }
                  >
                    Confirmar firma
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Indicá el motivo de la disconformidad</p>
                <textarea
                  className="mt-2 w-full rounded-lg border p-2 text-sm"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setOpen(null)}>Cancelar</button>
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 text-white"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const e = await signReceipt(receiptId, "non_conform", reason);
                        if (e) setErr(e);
                        else setOpen(null);
                      })
                    }
                  >
                    Confirmar disconformidad
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
