"use client";

import { useEffect, useState } from "react";
import { getDocumentUrl } from "@/modules/documents/actions";

export function DocFrame({ documentId }: { documentId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDocumentUrl(documentId)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch((e) => {
        if (alive) setErr(e.message);
      });
    return () => {
      alive = false;
    };
  }, [documentId]);
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!url) return <p className="text-sm text-zinc-500">Cargando…</p>;
  return <iframe title="Documento" src={url} className="h-[70vh] w-full rounded-lg border bg-white" />;
}
