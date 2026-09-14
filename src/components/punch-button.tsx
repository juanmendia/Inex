"use client";

import { useEffect, useState, useTransition } from "react";
import { punch } from "@/modules/attendance/actions";

const DEVICE_KEY = "inex_punch_device";

function deviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function readGps() {
  if (!navigator.geolocation) return Promise.resolve(null);
  const once = (high: boolean) =>
    new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: high,
        timeout: high ? 8000 : 12000,
        maximumAge: high ? 0 : 60_000,
      });
    });
  return once(true).then((pos) => pos ?? once(false));
}

function friendlyActionError(e: unknown) {
  const raw = e instanceof Error ? e.message : "";
  if (raw.includes("441") || raw.includes("Server Components") || raw.includes("digest")) {
    return "No se pudo fichar. En la PC el navegador suele dar una ubicación lejos de la sucursal. Probalo desde el celular o pedile a RRHH que suba el radio (metros) de la sucursal.";
  }
  return raw || "No se pudo fichar.";
}

export function PunchPad({ next }: { next: "in" | "out" }) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhoto(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function go(punch_type: "in" | "out") {
    start(async () => {
      setErr(null);
      setOk(null);
      if (!photo) {
        setErr("Sacate una foto de la cara antes de fichar.");
        return;
      }
      const pos = await readGps();
      if (!pos) {
        setErr(
          "El navegador no dio la ubicación. En la PC: permití ubicación para este sitio (candado de la barra). Si sigue fallando, fichá desde el celular.",
        );
        return;
      }
      const fd = new FormData();
      fd.set("punch_type", punch_type);
      fd.set("latitude", String(pos.coords.latitude));
      fd.set("longitude", String(pos.coords.longitude));
      fd.set("device_id", deviceId());
      fd.set("photo", photo);
      try {
        const msg = await punch(fd);
        if (msg) setErr(msg);
        else {
          setOk(punch_type === "in" ? "Entrada registrada." : "Salida registrada.");
          setPhoto(null);
          setPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } catch (e) {
        setErr(friendlyActionError(e));
      }
    });
  }

  return (
    <div>
      <label className="mb-3 block text-sm">
        Foto de tu cara (la cámara se abre en el celular)
        <input
          type="file"
          accept="image/*"
          capture="user"
          className="mt-1 block w-full text-xs"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa" className="mb-3 h-28 w-28 rounded-xl object-cover" />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy || next !== "in"}
          className="rounded-2xl py-6 text-lg font-medium disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-fg, #fff)" }}
          onClick={() => go("in")}
        >
          {busy && next === "in" ? "…" : "Entrada"}
        </button>
        <button
          type="button"
          disabled={busy || next !== "out"}
          className="rounded-2xl py-6 text-lg font-medium disabled:opacity-40"
          style={{ background: next === "out" ? "var(--accent)" : "#d7cfc3", color: next === "out" ? "var(--accent-fg, #fff)" : "#3d3830" }}
          onClick={() => go("out")}
        >
          {busy && next === "out" ? "…" : "Salida"}
        </button>
      </div>
      {ok ? (
        <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>
          {ok}
        </p>
      ) : null}
      {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
      <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
        Podés fichar desde el celular o la PC. En la PC el mapa del navegador suele fallar o quedar a cientos de metros: si te rechaza, usá el celular. El primer dispositivo (PC o celu) queda atado a tu usuario.
      </p>
    </div>
  );
}
