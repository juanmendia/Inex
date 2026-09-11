"use client";

import { useEffect, useState } from "react";
import { getReceiptPdfUrl, getReceiptPdfUrlHr } from "@/modules/receipts/actions";

export function PdfFrame({ receiptId, hr }: { receiptId: string; hr?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (hr ? getReceiptPdfUrlHr : getReceiptPdfUrl)(receiptId)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch((e) => {
        if (alive) setErr(e.message);
      });
    return () => {
      alive = false;
    };
  }, [receiptId, hr]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!url) return <p className="text-sm text-zinc-500">Cargando PDF…</p>;
  return <iframe title="Recibo" src={url} className="h-[70vh] w-full rounded-lg border bg-white" />;
}
