"use client";

import { useEffect, useState } from "react";
import { Download, Forward, Share2, X } from "lucide-react";
import { getReceiptPdfUrl, getReceiptPdfUrlHr } from "@/modules/receipts/actions";
import { SignButtons } from "@/components/sign-buttons";

export function ReceiptViewer({
  receiptId,
  hr,
  title,
  status,
  canSign,
  onClose,
}: {
  receiptId: string;
  hr?: boolean;
  title: string;
  status: string;
  canSign?: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (hr ? getReceiptPdfUrlHr : getReceiptPdfUrl)(receiptId)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "No se pudo abrir");
      });
    return () => {
      alive = false;
    };
  }, [receiptId, hr]);

  async function blobFile() {
    if (!url) return null;
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], `${title.replace(/\s+/g, "-")}.pdf`, { type: "application/pdf" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-8">
      <button className="absolute inset-0 bg-zinc-900/45 backdrop-blur-md" aria-label="Cerrar" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <p className="mr-auto text-sm font-medium">{title}</p>
          <a className="btn btn-ghost inline-flex items-center gap-1 text-sm" href={url ?? undefined} download={`${title}.pdf`}>
            <Download size={16} /> Bajar
          </a>
          <button
            className="btn btn-ghost inline-flex items-center gap-1 text-sm"
            type="button"
            onClick={async () => {
              const file = await blobFile();
              if (file && navigator.share) {
                try {
                  await navigator.share({ title, files: [file] });
                  return;
                } catch {
                  /* canceló */
                }
              }
              if (url) window.open(url, "_blank");
            }}
          >
            <Share2 size={16} /> Compartir
          </button>
          <a
            className="btn btn-ghost inline-flex items-center gap-1 text-sm"
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent("Te reenvío el recibo. Abrilo desde el portal Inex.")}`}
          >
            <Forward size={16} /> Reenviar
          </a>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-zinc-200 p-3">
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {!url && !err ? <p className="text-sm text-zinc-500">Cargando…</p> : null}
          {url ? <iframe title={title} src={url} className="h-[70vh] w-full rounded-lg bg-white" /> : null}
        </div>
        {canSign ? (
          <div className="border-t px-4 py-3">
            <SignButtons receiptId={receiptId} pending={status === "pending"} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
