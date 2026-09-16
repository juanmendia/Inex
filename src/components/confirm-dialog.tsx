"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState, useTransition } from "react";
import { DialogSheet, Overlay } from "@/components/overlay";

export type ConfirmOpts = {
  title: string;
  body?: string;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
};

type Ask = (opts: ConfirmOpts) => Promise<boolean>;

const Ctx = createContext<Ask | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback<Ask>((opts) => new Promise((resolve) => setJob({ opts, resolve })), []);

  function close(v: boolean) {
    job?.resolve(v);
    setJob(null);
  }

  return (
    <Ctx.Provider value={ask}>
      {children}
      {job ? (
        <Overlay onClose={() => close(false)}>
          <DialogSheet>
            <p className="text-base font-semibold">{job.opts.title}</p>
            {job.opts.body ? (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {job.opts.body}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
                {job.opts.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={job.opts.danger ? { background: "#b42318" } : undefined}
                onClick={() => close(true)}
              >
                {job.opts.confirm ?? "Aceptar"}
              </button>
            </div>
          </DialogSheet>
        </Overlay>
      ) : null}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ask = useContext(Ctx);
  if (!ask) throw new Error("ConfirmProvider");
  return ask;
}

export function ConfirmForm({
  action,
  title,
  body,
  confirm,
  children,
}: {
  action: (formData: FormData) => Promise<unknown> | unknown;
  title: string;
  body?: string;
  confirm?: string;
  children: React.ReactNode;
}) {
  const ask = useConfirm();
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void ask({ title, body, confirm: confirm ?? "Borrar", danger: true }).then((ok) => {
          if (!ok) return;
          start(async () => {
            await action(fd);
            router.refresh();
          });
        });
      }}
    >
      {children}
    </form>
  );
}
