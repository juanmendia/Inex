const SCRIPT = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.min.js";
const MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

type FaceApi = {
  nets: {
    tinyFaceDetector: { loadFromUri: (u: string) => Promise<void> };
    faceLandmark68TinyNet: { loadFromUri: (u: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (u: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (o?: { inputSize?: number; scoreThreshold?: number }) => unknown;
  detectSingleFace: (img: HTMLImageElement, opts?: unknown) => {
    withFaceLandmarks: (useTiny?: boolean) => {
      withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined>;
    };
  };
};

let ready: Promise<FaceApi> | null = null;

function api(): FaceApi {
  return (window as unknown as { faceapi: FaceApi }).faceapi;
}

function loadScript() {
  if ((window as unknown as { faceapi?: FaceApi }).faceapi) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el reconocedor."));
    document.head.appendChild(s);
  });
}

export function loadFaceModels() {
  if (!ready) {
    ready = (async () => {
      await loadScript();
      const faceapi = api();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS),
      ]);
      return faceapi;
    })();
  }
  return ready;
}

function fileToImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la foto."));
    };
    img.src = url;
  });
}

/** Vector de 128 números. null si no hay cara. */
export async function descriptorFromPhoto(file: File): Promise<number[] | null> {
  const faceapi = await loadFaceModels();
  const img = await fileToImage(file);
  const det = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  if (!det?.descriptor) return null;
  return Array.from(det.descriptor);
}
