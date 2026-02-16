import { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  webauthnRegisterOptions,
  webauthnRegisterVerify,
  webauthnLoginOptions,
  webauthnLoginVerify,
} from "@/services/webauthnApi";

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onChooseCamera: () => void;
  onFingerprintSuccess: () => void;
};

export default function AuthMethodModal({
  open,
  userId,
  onClose,
  onChooseCamera,
  onFingerprintSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  if (!open) return null;

  const doRegisterPasskey = async () => {
    setLoading(true);
    setMsg("");
    try {
      const options = await webauthnRegisterOptions(userId);
      const attResp = await startRegistration(options);
      await webauthnRegisterVerify(userId, attResp);
      setMsg("✅ Huella/Passkey registrada. Ya puedes usar 'Desbloquear con huella'.");
    } catch (e: any) {
      setMsg(`❌ No se pudo registrar huella: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const doLoginPasskey = async () => {
    setLoading(true);
    setMsg("");
    try {
      const options = await webauthnLoginOptions(userId);
      const authResp = await startAuthentication(options);
      await webauthnLoginVerify(userId, authResp);
      onFingerprintSuccess();
    } catch (e: any) {
      setMsg(`❌ Huella falló: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-sky-600 text-white">
          <h2 className="text-lg font-semibold">Elige método de desbloqueo</h2>
          <p className="text-sm opacity-90">
            Puedes usar cámara (rostro) o huella (Passkey con tu Android).
          </p>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={onChooseCamera}
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Desbloquear con Cámara
          </button>

          <button
            onClick={doLoginPasskey}
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Desbloquear con Huella (Passkey)
          </button>

          <button
            onClick={doRegisterPasskey}
            disabled={loading}
            className="w-full rounded-xl px-4 py-3 font-medium bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200 disabled:opacity-60"
          >
            Configurar Huella / Passkey (solo la primera vez)
          </button>

          {msg ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
              {msg}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 border-t border-slate-200 bg-white">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 border border-slate-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
