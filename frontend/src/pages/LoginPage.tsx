import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Shield, Leaf, KeyRound, Fingerprint, CheckCircle2 } from "lucide-react";
import fondo1 from "@/assets/fondo1.jpg";
import FacialCaptureModal from "@/components/FacialCaptureModal";
import { API_ENDPOINTS } from "@/config/api";

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  message: string;
  next_step: string;
  facial_recognition_enabled: boolean;
  two_factor_enabled: boolean;
  fingerprint_enabled: boolean;
}

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginData, setLoginData] = useState<LoginResponse | null>(null);

  const [showFacialModal, setShowFacialModal] = useState(false);
  const [isVerifyingFacial, setIsVerifyingFacial] = useState(false);
  const [isVerifyingFingerprint, setIsVerifyingFingerprint] = useState(false);
  const [fingerprintMessage, setFingerprintMessage] = useState<string | null>(null);
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const [fingerprintAttempts, setFingerprintAttempts] = useState(0);
  const [fingerprintCountdown, setFingerprintCountdown] = useState(0);

  const [show2FA, setShow2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState<"facial" | "totp" | "fingerprint" | null>(null);

  const [isExiting, setIsExiting] = useState(false);

  const finalizeLogin = () => {
    if (!loginData) return;

    localStorage.setItem("access_token", loginData.access_token);
    localStorage.setItem("token_type", loginData.token_type);
    localStorage.setItem("user_id", loginData.user_id);

    setIsExiting(true);
    setTimeout(() => navigate("/home"), 300);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setLoginData(null);
    setShow2FA(false);
    setSelectedMethod(null);
    setShowFacialModal(false);
    setTotpCode("");

    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error((data as any)?.detail || data.message || "Credenciales inválidas.");
      }

      setLoginData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacialVerification = async (imageBase64: string) => {
    if (!loginData) return;

    setIsVerifyingFacial(true);
    setError("");

    try {
      const response = await fetch(
        `${API_ENDPOINTS.VERIFY_FACIAL_LOGIN}?user_id=${loginData.user_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: imageBase64 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error en verificación facial");
      }

      setShowFacialModal(false);
      finalizeLogin();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en verificación facial";
      setError("❌ " + msg);
    } finally {
      setIsVerifyingFacial(false);
    }
  };

  const handleFingerprintVerification = async () => {
    if (!loginData) return;
    setIsVerifyingFingerprint(true);
    setError("");
    setFingerprintMessage("Inicializando dispositivo y conectando... coloca tu huella (25s)");
    setFingerprintReady(false);
    setFingerprintAttempts(0);
    setFingerprintCountdown(0);

    // Verifica estado del lector antes de iniciar captura
    try {
      const statusRes = await fetch("http://localhost:9000/fingerprint/zk9500/status");
      const statusData = await statusRes.json();
      if (!statusRes.ok || !statusData?.ready) {
        throw new Error("Lector no disponible. Revisa la conexión del ZK9500.");
      }
      setFingerprintReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo inicializar el lector ZK9500";
      setError("❌ " + msg);
      setIsVerifyingFingerprint(false);
      setFingerprintMessage(null);
      setFingerprintReady(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_ENDPOINTS.VERIFY_FINGERPRINT_LOGIN}?user_id=${loginData.user_id}`,
        { method: "POST" }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "Error en verificación dactilar");
      }

      if (!data?.match) {
        throw new Error("La huella no coincide");
      }

      finalizeLogin();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en verificación dactilar";
      setError("❌ " + msg);
    } finally {
      setIsVerifyingFingerprint(false);
      setFingerprintMessage(null);
      setFingerprintReady(false);
      setFingerprintAttempts(0);
      setFingerprintCountdown(0);
    }
  };

  useEffect(() => {
    if (!isVerifyingFingerprint || !fingerprintReady) return undefined;

    setFingerprintCountdown(25);
    setFingerprintAttempts(0);

    const tick = setInterval(() => {
      setFingerprintCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    const attemptTick = setInterval(() => {
      setFingerprintAttempts((a) => (a < 3 ? a + 1 : a));
    }, 4500);

    return () => {
      clearInterval(tick);
      clearInterval(attemptTick);
    };
  }, [isVerifyingFingerprint, fingerprintReady]);

  const verifyTotpForLogin = async () => {
    if (!loginData) return;

    setIsVerifyingTotp(true);
    setError("");

    try {
      const response = await fetch(`${API_ENDPOINTS.TOTP_VERIFY_LOGIN}?user_id=${loginData.user_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Código inválido");
      }

      finalizeLogin();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error verificando código";
      setError("❌ " + msg);
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  const canUseFace = !!loginData?.facial_recognition_enabled;
  const canUseTotp = !!loginData?.two_factor_enabled;
  const canUseFingerprint = !!loginData?.fingerprint_enabled;

  useEffect(() => {
    if (!loginData) return;

    const faceEnabled = !!loginData.facial_recognition_enabled;
    const totpEnabled = !!loginData.two_factor_enabled;
    const fpEnabled = !!loginData.fingerprint_enabled;

    if (!faceEnabled && !totpEnabled && !fpEnabled) {
      finalizeLogin();
      return;
    }

    setShow2FA(true);

    const enabledMethods = [
      faceEnabled ? "facial" : null,
      totpEnabled ? "totp" : null,
      fpEnabled ? "fingerprint" : null,
    ].filter(Boolean) as Array<"facial" | "totp" | "fingerprint">;

    if (enabledMethods.length === 1) {
      const only = enabledMethods[0];
      setSelectedMethod(only);
      if (only === "facial") setShowFacialModal(true);
      if (only === "fingerprint") handleFingerprintVerification();
    } else {
      setSelectedMethod(null);
    }
  }, [loginData]);

  const chooseMethod = (method: "facial" | "totp" | "fingerprint") => {
    setSelectedMethod(method);
    if (method === "facial") {
      setShowFacialModal(true);
    }
    if (method === "fingerprint") {
      handleFingerprintVerification();
    }
  };

  return (
    <div className={`min-h-screen relative transition-all duration-500 ${isExiting ? "opacity-0" : ""}`}>
      {isVerifyingFingerprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative w-full max-w-sm bg-gray-900 text-white rounded-2xl border border-emerald-400/30 shadow-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-400/60 bg-emerald-500/10 flex items-center justify-center animate-pulse">
                <Fingerprint className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm text-emerald-200">Verificación dactilar</p>
                <p className="text-lg font-semibold">Inicializando dispositivo y conectando...</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-100">
              {fingerprintReady ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              ) : (
                <div className="w-5 h-5 border-2 border-gray-500 border-t-emerald-300 rounded-full animate-spin" />
              )}
              <span>{fingerprintMessage || "Inicializando dispositivo y conectando..."}</span>
            </div>

            {fingerprintReady && (
              <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                <p className="text-sm font-semibold text-emerald-200">Lector listo</p>
                <p className="text-sm text-gray-200">Coloca tu huella ahora. Esperando captura...</p>
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-500 border-t-emerald-300 rounded-full animate-spin" />
                    <span>Intento {Math.min(fingerprintAttempts + 1, 3)} de 3</span>
                  </div>
                  <span>{fingerprintCountdown}s</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.min(((fingerprintAttempts) / 3) * 100, 100)}%` }}
                  />
                </div>
                {fingerprintAttempts >= 3 && (
                  <p className="text-xs text-emerald-300">Generando template...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-0">
        <img src={fondo1} alt="Nature background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-3 shadow-xl border border-[#005F02]/20">
          <Shield className="w-5 h-5 text-[#005F02]" />
          <span className="text-[#005F02] font-bold uppercase tracking-wider text-sm">Sistema Seguro</span>
          <Leaf className="w-4 h-4 text-[#427A43]" />
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#005F02] to-[#427A43] mb-4">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Bienvenido</h1>
              <p className="text-gray-600">Ingresa a tu cuenta de forma segura</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-red-800 text-sm font-semibold">Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#005F02] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 bg-gradient-to-r from-[#005F02] to-[#427A43] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-[#005F02]/30 ${
                  isLoading ? "opacity-75 cursor-not-allowed" : "hover:scale-[1.02]"
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </form>


            <p className="text-center text-gray-600">
              ¿No tienes cuenta?{" "}
              <Link to="/register" className="text-[#005F02] font-semibold hover:text-[#004501] hover:underline transition-colors">
                Regístrate aquí
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white text-sm flex items-center justify-center gap-2">
              <Leaf className="w-4 h-4" />
              <span>Proyecto Desarrollo de Software Seguro</span>
            </p>
          </div>
        </div>
      </div>

        {show2FA && loginData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Elige un método de verificación</p>
                  <p className="text-xs text-gray-600 mt-1">Si hay uno solo disponible, se selecciona automáticamente.</p>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-800"
                  onClick={() => {
                    setShow2FA(false);
                    setSelectedMethod(null);
                    setTotpCode("");
                    setShowFacialModal(false);
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {canUseFace && (
                  <button
                    type="button"
                    onClick={() => chooseMethod("facial")}
                    className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      selectedMethod === "facial"
                        ? "bg-[#005F02] text-white shadow"
                        : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    Verificar con cámara
                  </button>
                )}

                {canUseTotp && (
                    <button
                    type="button"
                    onClick={() => chooseMethod("totp")}
                    className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      selectedMethod === "totp"
                      ? "bg-gradient-to-r from-[#005F02] to-[#427A43] text-white shadow"
                      : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
                    }`}
                    >
                    <KeyRound className="w-5 h-5" />
                    Verificar con Authenticator
                    </button>
                )}

                {canUseFingerprint && (
                  <button
                    type="button"
                    onClick={() => chooseMethod("fingerprint")}
                    className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                      selectedMethod === "fingerprint"
                        ? "bg-emerald-600 text-white shadow"
                        : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <Fingerprint className="w-5 h-5" />
                    Verificar con huella
                  </button>
                )}
              </div>

              {selectedMethod === "totp" && canUseTotp && (
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-5 h-5 text-[#005F02]" />
                    <p className="font-semibold text-gray-800">Ingresa el código de 6 dígitos</p>
                  </div>

                  <input
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    maxLength={6}
                    placeholder="Código de 6 dígitos"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
                  />

                  <button
                    type="button"
                    onClick={verifyTotpForLogin}
                    disabled={totpCode.trim().length !== 6 || isVerifyingTotp}
                    className="mt-3 w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-[#005F02] to-[#427A43] text-white hover:opacity-95 disabled:opacity-60"
                  >
                    {isVerifyingTotp ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-5 h-5" />
                        Verificar con Authenticator
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedMethod === "fingerprint" && canUseFingerprint && (
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-5 h-5 text-[#005F02]" />
                    <p className="font-semibold text-gray-800">Verificación dactilar</p>
                  </div>
                  <p className="text-sm text-gray-700">
                    Inicializando dispositivo y conectando... coloca tu huella en los próximos 25 segundos.
                  </p>
                  {fingerprintMessage && (
                    <p className="mt-2 text-xs text-gray-500">{fingerprintMessage}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    {isVerifyingFingerprint && (
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-[#005F02] rounded-full animate-spin" />
                    )}
                    <span>{isVerifyingFingerprint ? "Esperando huella..." : "Listo para capturar"}</span>
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={handleFingerprintVerification}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#005F02] to-[#427A43] text-white font-semibold hover:opacity-95"
                      disabled={isVerifyingFingerprint}
                    >
                      {isVerifyingFingerprint ? "Capturando..." : "Reintentar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMethod(null)}
                      className="px-4 py-3 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {selectedMethod === "facial" && !showFacialModal && (
                <button
                  type="button"
                  onClick={() => setShowFacialModal(true)}
                  className="w-full py-3 rounded-xl bg-[#005F02] text-white font-semibold hover:opacity-95"
                >
                  Abrir cámara
                </button>
              )}
            </div>
          </div>
        )}

        <FacialCaptureModal
          isOpen={showFacialModal}
          onCapture={handleFacialVerification}
          onClose={() => setShowFacialModal(false)}
          isLoading={isVerifyingFacial}
          mode="verify"
          title="🔐 Verificación Facial"
          description="Por favor, mire directamente a la cámara para completar el inicio de sesión"
          authToken={loginData?.access_token || ""}
        />
    </div>
  );
};

export default LoginPage;
