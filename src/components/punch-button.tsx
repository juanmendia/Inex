"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { punch } from "@/modules/attendance/actions";
import { descriptorFromPhoto, loadFaceModels } from "@/lib/face-client";
import { DialogSheet, Overlay } from "@/components/overlay";

const DEVICE_KEY = "inex_punch_device";

function deviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function onceGps(opts: PositionOptions) {
  return new Promise<{ pos: GeolocationPosition | null; code?: number }>((resolve) => {
    if (!navigator.geolocation) {
      resolve({ pos: null, code: 2 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ pos }),
      (err) => resolve({ pos: null, code: err.code }),
      opts,
    );
  });
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
  const [httpsHint, setHttpsHint] = useState(false);
  const [cam, setCam] = useState(false);
  const [gpsUi, setGpsUi] = useState<"off" | "asking" | "ok" | "denied" | "fail">("off");
  const [busy, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gpsRef = useRef<GeolocationPosition | null>(null);
  const watchRef = useRef<number | null>(null);
  const photoRef = useRef<File | null>(null);
  const deniedRef = useRef(false);

  function askGps() {
    if (!navigator.geolocation) {
      setGpsUi("fail");
      return;
    }
    deniedRef.current = false;
    setGpsUi((s) => (s === "ok" ? s : "asking"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        gpsRef.current = p;
        setGpsUi("ok");
      },
      (e) => {
        deniedRef.current = e.code === 1;
        if (e.code === 1) setGpsUi("denied");
        else if (!gpsRef.current) setGpsUi("fail");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 15_000 },
    );
    if (watchRef.current != null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        gpsRef.current = p;
        setGpsUi("ok");
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 15_000 },
    );
  }

  async function waitGps(ms = 20000) {
    if (gpsRef.current) return gpsRef.current;
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 250));
      if (gpsRef.current) return gpsRef.current;
    }
    const coarse = await onceGps({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 });
    if (coarse.pos) {
      gpsRef.current = coarse.pos;
      setGpsUi("ok");
      return coarse.pos;
    }
    if (coarse.code === 1) {
      deniedRef.current = true;
      setGpsUi("denied");
    }
    return null;
  }

  useEffect(() => {
    void loadFaceModels().catch(() => undefined);
    return () => {
      stopCam();
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (cam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cam]);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam(false);
  }

  async function openCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCam(true);
    } catch {
      if (!window.isSecureContext) {
        setHttpsHint(true);
        return;
      }
      setErr("Hay que permitir la cámara. Si el celular preguntó, tocá Permitir y volvé a fichar.");
    }
  }

  async function beginPunch() {
    setErr(null);
    setOk(null);
    setHttpsHint(false);
    if (!window.isSecureContext) {
      setHttpsHint(true);
      return;
    }
    if (!navigator.geolocation) {
      setErr("Este navegador no da ubicación. En el Samsung abrí Chrome (no el navegador de Samsung) y permití Ubicación.");
      return;
    }
    askGps();
    const pos = await waitGps(22000);
    if (!pos) {
      setErr(
        deniedRef.current
          ? "Bloqueaste la ubicación. En Chrome: candado al lado de la web → Permisos → Ubicación → Permitir. En Samsung también: Ajustes → Ubicación → encendida."
          : "No llegó el GPS. Dejalo prendido, tocá Permitir si aparece el cartel, y después Reintentar.",
      );
      return;
    }
    await openCam();
  }

  function submit(photo: File) {
    start(async () => {
      setErr(null);
      setOk(null);
      let desc: number[] | null = null;
      try {
        desc = await descriptorFromPhoto(photo);
      } catch {
        setErr("No se pudo analizar la cara. Probá de nuevo con más luz.");
        return;
      }
      if (!desc) {
        setErr("No se ve una cara. Mirá a la cámara de frente, con luz, y tocá de nuevo.");
        return;
      }
      const pos = await waitGps(12000);
      if (!pos) {
        setErr(
          deniedRef.current
            ? "Bloqueaste la ubicación. Candado de Chrome → Permisos → Ubicación → Permitir."
            : "No llegó la ubicación. Tocá Reintentar ubicación y Permitir en el cartel.",
        );
        return;
      }
      const fd = new FormData();
      fd.set("punch_type", next);
      fd.set("latitude", String(pos.coords.latitude));
      fd.set("longitude", String(pos.coords.longitude));
      fd.set("device_id", deviceId());
      fd.set("photo", photo);
      fd.set("face_descriptor", JSON.stringify(desc));
      try {
        const msg = await punch(fd);
        if (msg) setErr(msg);
        else setOk(next === "in" ? "Entrada registrada." : "Salida registrada.");
      } catch (e) {
        setErr(friendlyActionError(e));
      }
    });
  }

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setErr("Esperá un segundo a que se vea la cámara y volvé a tocar Capturar.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        stopCam();
        const file = new File([blob], "cara.jpg", { type: "image/jpeg" });
        photoRef.current = file;
        submit(file);
      },
      "image/jpeg",
      0.85,
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
        {hasFace
          ? "Primero el celular pide la ubicación (tocá Permitir). Después se abre la cámara."
          : "Primera vez: sacate una foto de frente. Queda como tu cara de referencia."}
      </p>
      <div
        className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--text)" }}
      >
        <span>
          {gpsUi === "ok"
            ? "Ubicación lista"
            : gpsUi === "asking"
              ? "Esperando que permitas la ubicación…"
              : gpsUi === "denied"
                ? "Ubicación bloqueada en el navegador"
                : "Hace falta la ubicación para fichar"}
        </span>
        {gpsUi !== "ok" ? (
          <button type="button" className="btn btn-primary px-3 py-1.5 text-xs" onClick={() => askGps()}>
            Permitir ubicación
          </button>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy || gpsUi === "asking"}
        className="w-full rounded-2xl py-6 text-lg font-medium disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--accent-fg, #fff)" }}
        onClick={() => void beginPunch()}
      >
        {busy || gpsUi === "asking" ? "Pidiendo ubicación…" : next === "in" ? "Fichar entrada" : "Fichar salida"}
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
      {ok ? (
        <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>
          {ok}
        </p>
      ) : null}
      {err ? (
        <div className="mt-3">
          <p className="text-sm text-red-600">{err}</p>
          {photoRef.current && err.includes("ubicación") ? (
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost mt-2 text-xs"
              onClick={() => {
                askGps();
                if (photoRef.current) submit(photoRef.current);
              }}
            >
              Reintentar ubicación
            </button>
          ) : null}
        </div>
      ) : null}
      {httpsHint ? (
        <Overlay onClose={() => setHttpsHint(false)}>
          <DialogSheet>
            <p className="text-base font-semibold">El celular no abre la cámara acá</p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Entrá con candado (https). En la PC corré <span className="font-mono">npm run dev:https</span> y
              en el celu abrí <span className="font-mono">https://{typeof window !== "undefined" ? window.location.host : ""}</span>.
              Aceptá el aviso del certificado. O usá la web publicada.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn btn-primary" onClick={() => setHttpsHint(false)}>
                Entendido
              </button>
            </div>
          </DialogSheet>
        </Overlay>
      ) : null}
    </div>
  );
}
