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
  const [httpsHint, setHttpsHint] = useState(false);
  const [cam, setCam] = useState(false);
  const [busy, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    void loadFaceModels().catch(() => undefined);
    return () => stopCam();
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
    setErr(null);
    setOk(null);
    setHttpsHint(false);
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
      const pos = await readGps();
      if (!pos) {
        setErr("El navegador no dio la ubicación. Permití ubicación y volvé a fichar.");
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
        submit(new File([blob], "cara.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.85,
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
        {hasFace
          ? "Tocá fichar: se abre la cámara, sacás la foto ahora y se registra."
          : "Primera vez: sacate una foto de frente. Queda como tu cara de referencia."}
      </p>
      <button
        type="button"
        disabled={busy}
        className="w-full rounded-2xl py-6 text-lg font-medium disabled:opacity-40"
        style={{ background: "var(--accent)", color: "var(--accent-fg, #fff)" }}
        onClick={() => void openCam()}
      >
        {busy ? "Registrando…" : next === "in" ? "Fichar entrada" : "Fichar salida"}
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
      {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
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
