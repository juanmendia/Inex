"use client";

export function Overlay({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-[#122033]/45 backdrop-blur-md"
        onClick={onClose}
      />
      <div className={`relative z-10 w-full ${wide ? "max-w-lg" : "max-w-md"}`}>{children}</div>
    </div>
  );
}

export function DialogSheet({ children }: { children: React.ReactNode }) {
  return <div className="max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">{children}</div>;
}
