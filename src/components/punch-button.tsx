"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

export function PunchPad({ next, hasFace }: { next: "in" | "out"; hasFace: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cam, setCam] = useState(false);
  const [busy, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopCam(), []);
  useEffect(() => {
    if (cam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cam]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam(false);
  }

  function setShot(file: File) {
    setPhoto(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function openCam() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCam(true);
    } catch {
      fileRef.current?.click();
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        setShot(new File([blob], "cara.jpg", { type: "image/jpeg" }));
        stopCam();
      },
      "image/jpeg",
      0.85,
    );
  }

  function go(punch_type: "in" | "out") {
    start(async () => {
      setErr(null);
      setOk(null);
      if (!photo) {
        setErr(hasFace ? "Sacate una foto al fichar." : "La primera vez tenés que sacarte una foto de la cara. Queda de referencia para RRHH.");
        return;
      }
      const pos = await readGps();
      if (!pos) {
        setErr("El navegador no dio la ubicación. Permití ubicación o fichá desde el celular.");
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
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setShot(f);
        }}
      />
      {!hasFace ? (
        <p className="mb-2 text-sm font-medium">Primera vez: sacate una foto de la cara. RRHH la usa de referencia.</p>
      ) : (
        <p className="mb-2 text-sm" style={{ color: "var(--muted)" }}>
          Foto al fichar (cada entrada/salida)
        </p>
      )}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa" className="mb-3 h-32 w-32 rounded-xl object-cover" />
      ) : null}
      <button type="button" className="btn btn-primary mb-4 w-full" onClick={() => void openCam()}>
        {preview ? "Sacar otra foto" : "Abrir cámara"}
      </button>
      {cam ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <video ref={videoRef} playsInline autoPlay muted className="min-h-0 flex-1 object-cover" />
          <div className="flex gap-2 p-4">
            <button type="button" className="btn btn-primary flex-1" onClick={snap}>
              Capturar
            </button>
            <button type="button" className="btn btn-ghost flex-1 text-white" onClick={stopCam}>
              Cancelar
            </button>
          </div>
        </div>
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
    </div>
  );
}
