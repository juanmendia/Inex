"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { RECEIPT_STATUS } from "@/lib/labels";
import { ReceiptViewer } from "@/components/receipt-viewer";
import { ConfirmForm } from "@/components/confirm-dialog";
import { deleteReceipt } from "@/modules/receipts/actions";

export type ReceiptChip = {
  id: string;
  period_year: number;
  period_month: number;
  kind: string;
  status: string;
  employee_id?: string;
};

export function ReceiptPaperButton({
  r,
  hr,
  canSign,
}: {
  r: ReceiptChip;
  hr?: boolean;
  canSign?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const period = `${String(r.period_month).padStart(2, "0")}/${r.period_year}`;
  const title = r.kind === "aguinaldo" ? `SAC ${period}` : `Haberes ${period}`;
  return (
    <>
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100"
          title={RECEIPT_STATUS[r.status] ?? r.status}
        >
          <span className="flex h-9 w-8 items-center justify-center rounded-sm bg-white shadow-sm ring-1 ring-zinc-300">
            <FileText size={16} className="text-zinc-600" />
          </span>
          <span>
            <span className="block font-medium leading-tight">{title}</span>
            <span className="block text-xs opacity-60">{RECEIPT_STATUS[r.status] ?? r.status}</span>
          </span>
        </button>
        {hr ? (
          <ConfirmForm
            action={deleteReceipt}
            title={`¿Eliminar recibo ${title}?`}
            body="Sale del portal del empleado. Después podés generarlo de nuevo o subir otro PDF."
            confirm="Eliminar"
          >
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="rounded p-1 text-red-700 opacity-60 hover:opacity-100" title="Eliminar recibo">
              <Trash2 size={14} />
            </button>
          </ConfirmForm>
        ) : null}
      </span>
      {open ? (
        <ReceiptViewer
          receiptId={r.id}
          hr={hr}
          title={`Recibo ${title}`}
          status={r.status}
          canSign={canSign}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
