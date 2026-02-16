import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Shield, Leaf, KeyRound } from "lucide-react";
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
}

/** =========================
 * Helpers WebAuthn
 * ========================= */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function normalizeRegisterOptions(options: any) {
  // Espera: { publicKey: { challenge: "b64url", user: { id: "b64url" }, ... } }
  const pk = options.publicKey ?? options;

  return {
    publicKey: {
      ...pk,
      challenge: base64urlToBuffer(pk.challenge),
      user: {
        ...pk.user,
        id: base64urlToBuffer(pk.user.id),
      },
      excludeCredentials: (pk.excludeCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      })),
    },
  };
}

function normalizeAuthOptions(options: any) {
  // Espera: { publicKey: { challenge: "b64url", allowCredentials: [{id:"b64url"}], ... } }
  const pk = options.publicKey ?? options;

  return {
    publicKey: {
      ...pk,
      challenge: base64urlToBuffer(pk.challenge),
      allowCredentials: (pk.allowCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      })),
    },
  };
}

function credentialToJSON(cred: PublicKeyCredential) {
  const response: any = cred.response;

  const clientDataJSON = bufferToBase64url(response.clientDataJSON);
  const authenticatorData = response.authenticatorData
    ? bufferToBase64url(response.authenticatorData)
    : undefined;
  const signature = response.signature ? bufferToBase64url(response.signature) : undefined;
  const userHandle = response.userHandle ? bufferToBase64url(response.userHandle) : undefined;
  const attestationObject = response.attestationObject
    ? bufferToBase64url(response.attestationObject)
    : undefined;

  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON,
      attestationObject,
      authenticatorData,
      signature,
      userHandle,
    },
  };
}

/** =========================
 * UI Modal para elegir método
 * ========================= */
type UnlockMethod = "camera" | "passkey";

function UnlockMethodModal({
  open,
  onClose,
  onChooseCamera,
  onChoosePasskey,
  onSetupPasskey,
  passkeyLoading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onChooseCamera: () => void;
  onChoosePasskey: () => void;
  onSetupPasskey: () => void;
  passkeyLoading: boolean;
  error: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-600 p-5 text-white">
          <h3 className="text-lg font-bold">Elige método de desbloqueo</h3>
          <p className="text-sm text-white/90 mt-1">
            Puedes usar cámara (rostro) o huella (Passkey con tu Android).
          </p>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              ❌ {error}
            </div>
          )}

          <button
            className="w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
            onClick={onChooseCamera}
            disabled={passkeyLoading}
          >
            Desbloquear con Cámara
          </button>

          <button
            className="w-full py-3 rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            onClick={onChoosePasskey}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? "Procesando..." : "Desbloquear con Huella (Passkey)"}
          </button>

          <button
            className="w-full py-3 rounded-xl font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition"
            onClick={onSetupPasskey}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? "Procesando..." : "Configurar Huella / Passkey (solo la primera vez)"}
          </button>

          <p className="text-xs text-gray-500 mt-2">
            Nota: en PC, el navegador puede mostrar un QR para usar tu Android y confirmar con huella.
          </p>

          <div className="flex justify-end pt-2">
            <button
              className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800"
              onClick={onClose}
              disabled={passkeyLoading}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =========================
 * LoginPage
 * ========================= */
const LoginPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState("");

  // Auth flow
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);

  // Modal choice
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [methodError, setMethodError] = useState("");

  // Facial modal
  const [showFacialModal, setShowFacialModal] = useState(false);
  const [isVerifyingFacial, setIsVerifyingFacial] = useState(false);

  // transition
  const [isExiting, setIsExiting] = useState(false);

  const saveSessionAndGoHome = (data: LoginResponse) => {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("token_type", data.token_type);
    localStorage.setItem("user_id", data.user_id);

    setIsExiting(true);
    setTimeout(() => navigate("/home"), 300);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMethodError("");
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Credenciales inválidas.");
      }

      setLoginData(data);

      // ✅ Ahora no obligamos a cámara de una
      // mostramos modal: Cámara o Huella
      setShowMethodModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      console.error("❌ Error en login:", msg);
    } finally {
      setIsLoading(false);
    }
  };

  /** =========================
   * 1) Cámara: verificación facial
   * ========================= */
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
        const detail = data?.detail || data?.message || "Error en verificación facial";
        throw new Error(detail);
      }

      setShowFacialModal(false);
      saveSessionAndGoHome(loginData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en la verificación facial";
      setError("❌ " + msg);
      console.error("Error en verificación facial:", msg);
    } finally {
      setIsVerifyingFacial(false);
    }
  };

  /** =========================
   * 2) Passkey: configurar (registro) — opcional
   * ========================= */
  const setupPasskey = async () => {
    if (!loginData) return;
    setMethodError("");
    setPasskeyLoading(true);

    try {
      // 1) pedir options al backend
      const optRes = await fetch(API_ENDPOINTS.WEBAUTHN_REGISTER_OPTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: loginData.user_id,
          email: email,
          username: email,
        }),
      });

      const optJson = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optJson?.detail || "No se pudo obtener options de registro Passkey");
      }

      // 2) crear credencial en navegador
      const normalized = normalizeRegisterOptions(optJson);

      const cred = (await navigator.credentials.create(
        normalized as unknown as CredentialCreationOptions
      )) as PublicKeyCredential;

      if (!cred) throw new Error("No se pudo crear la credencial Passkey");

      // 3) enviar verify al backend
      const verifyRes = await fetch(API_ENDPOINTS.WEBAUTHN_REGISTER_VERIFY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: loginData.user_id,
          credential: credentialToJSON(cred),
        }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyJson?.detail || "No se pudo registrar la Passkey");
      }

      setMethodError("✅ Passkey registrada. Ya puedes desbloquear con huella.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to setup passkey";
      setMethodError("❌ " + msg);
      console.error("setupPasskey:", msg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  /** =========================
   * 3) Passkey: autenticar (huella)
   * ========================= */
  const loginWithPasskey = async () => {
    if (!loginData) return;
    setMethodError("");
    setPasskeyLoading(true);

    try {
      // 1) pedir options
      const optRes = await fetch(API_ENDPOINTS.WEBAUTHN_AUTH_OPTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: loginData.user_id }),
      });

      const optJson = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optJson?.detail || "No se pudo obtener options de autenticación Passkey");
      }

      // 2) pedir credencial (huella)
      const normalized = normalizeAuthOptions(optJson);

      const assertion = (await navigator.credentials.get(
        normalized as unknown as CredentialRequestOptions
      )) as PublicKeyCredential;

      if (!assertion) throw new Error("No se pudo obtener la credencial Passkey");

      // 3) verificar en backend
      const verifyRes = await fetch(API_ENDPOINTS.WEBAUTHN_AUTH_VERIFY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: loginData.user_id,
          credential: credentialToJSON(assertion),
        }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyJson?.detail || "No se pudo verificar la Passkey");
      }

      // ✅ login final
      setShowMethodModal(false);
      saveSessionAndGoHome(loginData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to authenticate passkey";
      setMethodError("❌ " + msg);
      console.error("loginWithPasskey:", msg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className={`min-h-screen relative transition-all duration-500 ${isExiting ? "opacity-0" : ""}`}>
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <img src={fondo1} alt="Nature background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      {/* Header badge */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-3 shadow-xl border border-[#005F02]/20">
          <Shield className="w-5 h-5 text-[#005F02]" />
          <span className="text-[#005F02] font-bold uppercase tracking-wider text-sm">Sistema Seguro</span>
          <Leaf className="w-4 h-4 text-[#427A43]" />
        </div>
      </div>

      {/* Card */}
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

            {/* Error (login/password o facial) */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
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
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
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
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#005F02]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" className="text-sm text-[#005F02] hover:text-[#004501] font-medium">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 bg-gradient-to-r from-[#005F02] to-[#427A43] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  isLoading ? "opacity-75 cursor-not-allowed" : "hover:shadow-lg hover:shadow-[#005F02]/30"
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">o continúa con</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-700">Google</span>
            </button>

            <p className="text-center text-gray-600">
              ¿No tienes cuenta?{" "}
              <Link to="/register" className="text-[#005F02] font-semibold hover:underline">
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

      {/* Modal elegir método */}
      <UnlockMethodModal
        open={showMethodModal}
        onClose={() => setShowMethodModal(false)}
        onChooseCamera={() => {
          setShowMethodModal(false);
          setShowFacialModal(true);
        }}
        onChoosePasskey={loginWithPasskey}
        onSetupPasskey={setupPasskey}
        passkeyLoading={passkeyLoading}
        error={methodError}
      />

      {/* Modal facial */}
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
