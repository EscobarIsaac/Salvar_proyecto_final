import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FacialCaptureModal from "@/components/FacialCaptureModal";

type ApiResult = any;

export default function CameraTestPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [imgBase64, setImgBase64] = useState<string>("");
  const [result, setResult] = useState<ApiResult>(null);
  const [error, setError] = useState<string>("");

  // Para probar login facial (tu login actual manda user_id por query)
  const [userId, setUserId] = useState<string>(localStorage.getItem("user_id") || "");

  const handleCapture = async (imageBase64: string) => {
    setImgBase64(imageBase64);
    setError("");
    setResult(null);

    try {
      // 1) Probar /api/facial/detect (no requiere token según tu swagger)
      const detectRes = await fetch("http://localhost:8000/api/facial/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });

      const detectData = await detectRes.json();
      if (!detectRes.ok) throw new Error(detectData.detail || "Error en /facial/detect");
      
      // 2) Probar verify facial for login (como tu LoginPage)
      if (userId) {
        const verifyRes = await fetch(
          `http://localhost:8000/api/auth/verify-facial-for-login?user_id=${userId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_base64: imageBase64 }),
          }
        );

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyData.detail || "Error en verify facial");
        
        setResult({ detect: detectData, verify: verifyData });
      } else {
        setResult({ detect: detectData, note: "Pon un user_id para probar verify-facial-for-login" });
      }

      setOpen(false);
    } catch (e: any) {
      setError(e.message || "Error desconocido");
    }
  };

  return (
    <div className="min-h-screen cam-test-bg text-white">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prueba de Cámara</h1>
            <p className="text-white/70">
              Captura desde webcam (tu modal actual) y prueba endpoints del backend.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/home")}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10"
            >
              Volver a Home
            </button>

            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-400 text-black font-semibold hover:bg-emerald-300"
            >
              Abrir cámara
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-3">
            <h2 className="text-lg font-semibold">Config</h2>

            <label className="block text-sm text-white/70">user_id (para verify facial)</label>
            <input
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                localStorage.setItem("user_id", e.target.value);
              }}
              placeholder="pega tu UUID aquí"
              className="w-full px-4 py-2 rounded-xl bg-black/30 border border-white/10 outline-none"
            />

            <p className="text-xs text-white/60">
              Tip: si ya hiciste login antes, tu LoginPage guarda user_id en localStorage.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-3">
            <h2 className="text-lg font-semibold">Resultado</h2>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            {result ? (
              <pre className="text-xs whitespace-pre-wrap text-white/80">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <p className="text-white/70 text-sm">
                Abre la cámara, parpadea 3 veces y se enviará al backend.
              </p>
            )}
          </div>
        </div>

        {imgBase64 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 space-y-3">
            <h2 className="text-lg font-semibold">Preview</h2>
            <img
              className="max-w-md rounded-2xl border border-white/10"
              src={`data:image/jpeg;base64,${imgBase64}`}
              alt="captura"
            />
          </div>
        )}
      </div>

      <FacialCaptureModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onCapture={handleCapture}
        mode="verify"
        title="🎥 Prueba de Cámara (Demo)"
        description="Mira a la cámara y parpadea 3 veces. Luego se prueba /facial/detect y verify-facial-for-login."
      />
    </div>
  );
}
