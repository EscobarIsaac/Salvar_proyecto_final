import React, { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCamera: () => void;
  onSetupPasskey: () => Promise<void>;
  onPasskeyLogin: () => Promise<void>;
};

export default function UnlockMethodModal({
  isOpen,
  onClose,
  onCamera,
  onSetupPasskey,
  onPasskeyLogin,
}: Props) {
  const [loading, setLoading] = useState<null | "setup" | "login">(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const run = async (kind: "setup" | "login", fn: () => Promise<void>) => {
    setError("");
    setLoading(kind);
    try {
      await fn();
    } catch (e: any) {
      const msg = e?.message || "Error desconocido";
      setError(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-indigo-600 to-sky-500 text-white">
          <h3 className="text-lg font-bold">Elige método de desbloqueo</h3>
          <p className="text-sm opacity-90">
            Puedes usar cámara (rostro) o huella (Passkey con tu Android).
          </p>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              ❌ {error}
            </div>
          )}

          <button
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold transition"
            onClick={onCamera}
            disabled={!!loading}
          >
            Desbloquear con Cámara
          </button>

          <button
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition"
            onClick={() => run("login", onPasskeyLogin)}
            disabled={!!loading}
          >
            {loading === "login" ? "Verificando Passkey..." : "Desbloquear con Huella (Passkey)"}
          </button>

          <button
            className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold transition"
            onClick={() => run("setup", onSetupPasskey)}
            disabled={!!loading}
          >
            {loading === "setup" ? "Configurando..." : "Configurar Huella / Passkey (primera vez)"}
          </button>

          <div className="pt-2 flex justify-end">
            <button className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300" onClick={onClose}>
              Cerrar
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Nota: en PC, el navegador puede mostrar QR para usar tu Android y confirmar con huella.
          </p>
        </div>
      </div>
    </div>
  );
}
