import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Check,
  X,
  Shield,
  Leaf,
  UserPlus,
  Fingerprint,
} from "lucide-react";
import fondo1 from "@/assets/fondo1.jpg";
import FacialCaptureModal from "@/components/FacialCaptureModal";
import { API_ENDPOINTS } from "@/config/api";

interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

interface RegistrationResponse {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  message: string;
  next_step: string;
  // a veces backend manda detail en error; lo dejo opcional por seguridad
  detail?: string;
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

function credentialToJSON(cred: PublicKeyCredential) {
  const response: any = cred.response;

  const clientDataJSON = bufferToBase64url(response.clientDataJSON);
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
    },
  };
}

/** =========================
 * Modal simple: ¿Configurar huella?
 * ========================= */
function PasskeyOptionalModal({
  open,
  onClose,
  onSetup,
  onSkip,
  isLoading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSetup: () => void;
  onSkip: () => void;
  isLoading: boolean;
  error: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#005F02] to-[#427A43] p-5 text-white">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Configurar huella (opcional)
          </h3>
          <p className="text-sm text-white/90 mt-1">
            Puedes registrar una Passkey para desbloquear luego con tu Android (huella).
          </p>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              ❌ {error}
            </div>
          )}

          <button
            className="w-full py-3 rounded-xl font-semibold bg-[#005F02] text-white hover:bg-[#004501] transition"
            onClick={onSetup}
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : "Sí, configurar ahora"}
          </button>

          <button
            className="w-full py-3 rounded-xl font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition"
            onClick={onSkip}
            disabled={isLoading}
          >
            Omitir por ahora
          </button>

          <p className="text-xs text-gray-500">
            En PC, Chrome puede mostrar un QR para usar tu Android y confirmar con huella.
          </p>
        </div>
      </div>
    </div>
  );
}

const RegisterPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [showFacialModal, setShowFacialModal] = useState(false);
  const [registrationData, setRegistrationData] = useState<RegistrationResponse | null>(null);

  const [isSavingFacial, setIsSavingFacial] = useState(false);

  // (La tenías pero no se usaba, la dejo igual)
  const [facialImageBase64, setFacialImageBase64] = useState<string>("");

  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // ✅ NUEVO: modal opcional Passkey
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [isSettingPasskey, setIsSettingPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState("");

  // Validar requisitos de contraseña
  useEffect(() => {
    const password = formData.password;
    setPasswordRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, [formData.password]);

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const isFormValid =
    formData.full_name &&
    formData.email &&
    formData.username &&
    formData.password &&
    formData.confirmPassword === formData.password &&
    isPasswordValid;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const goToLoginWithMessage = async (message: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    navigate("/", { state: { message } });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Primero pedir captura facial ANTES de registrar en BD
    setShowFacialModal(true);
  };

  /** =========================
   * Registro con imagen facial
   * ========================= */
  const handleFacialCapture = async (imageBase64: string) => {
    setIsSavingFacial(true);
    setError("");

    try {
      setFacialImageBase64(imageBase64);

      const registerResponse = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          full_name: formData.full_name,
          facial_image_base64: imageBase64,
        }),
      });

      const data: any = await registerResponse.json();

      if (!registerResponse.ok) {
        if (registerResponse.status === 409) {
          const errorDetail = data.detail || data.message || "";
          if (String(errorDetail).includes("rostro")) {
            throw new Error(
              "❌ Este rostro ya está registrado en el sistema. " +
                "Por favor, intenta con una foto diferente o crea una cuenta diferente."
            );
          } else {
            throw new Error("El email o nombre de usuario ya está registrado. Intenta con otro.");
          }
        } else if (registerResponse.status === 400) {
          throw new Error(data.message || data.detail || "Datos inválidos. Verifica el formulario.");
        } else {
          throw new Error(data.detail || data.message || "Error al registrar usuario");
        }
      }

      // ✅ Registro exitoso con captura facial
      setRegistrationData(data as RegistrationResponse);
      setShowFacialModal(false);

      // ✅ NUEVO: después del registro facial, ofrecer huella opcional
      setPasskeyError("");
      setShowPasskeyModal(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al registrar usuario";
      setError(errorMessage);
      console.error("❌ Error en registro:", errorMessage);
    } finally {
      setIsSavingFacial(false);
    }
  };

  /** =========================
   * Passkey (opcional): configurar
   * ========================= */
  const setupPasskey = async () => {
    if (!registrationData) return;

    setIsSettingPasskey(true);
    setPasskeyError("");

    try {
      // 1) pedir options al backend
      const optRes = await fetch(API_ENDPOINTS.WEBAUTHN_REGISTER_OPTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: registrationData.user_id,
          email: registrationData.email,
          username: registrationData.username,
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
          user_id: registrationData.user_id,
          credential: credentialToJSON(cred),
        }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyJson?.detail || "No se pudo registrar la Passkey");
      }

      // ✅ listo, ir a login
      setShowPasskeyModal(false);
      await goToLoginWithMessage("✅ Registro completado con rostro + huella. Por favor, inicia sesión.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to setup passkey";

      // Si sigue saliendo Failed to fetch aquí, casi siempre es CORS
      // (o que el backend no tenga incluidas las rutas /api/webauthn)
      setPasskeyError(msg);
      console.error("setupPasskey:", msg);
    } finally {
      setIsSettingPasskey(false);
    }
  };

  const skipPasskey = async () => {
    setShowPasskeyModal(false);
    await goToLoginWithMessage("✅ Registro completado con rostro. Puedes configurar huella después.");
  };

  return (
    <div className="min-h-screen relative">
      {/* Background Image - Full Screen */}
      <div className="fixed inset-0 z-0">
        <img src={fondo1} alt="Nature background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      {/* Header Badge */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-3 shadow-xl border border-[#005F02]/20">
          <Shield className="w-5 h-5 text-[#005F02]" />
          <span className="text-[#005F02] font-bold uppercase tracking-wider text-sm">Sistema Seguro</span>
          <Leaf className="w-4 h-4 text-[#427A43]" />
        </div>
      </div>

      {/* Main Content - Centered Card with Scroll */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-24">
        <div className="w-full max-w-md">
          {/* Register Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#005F02] to-[#427A43] mb-4">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Crear Cuenta</h1>
              <p className="text-gray-600">Únete con seguridad biométrica</p>
            </div>

            {/* Error Message */}
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

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    placeholder="Juan Pérez"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="tu@email.com"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de Usuario</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="usuario123"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
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

                {/* Password Requirements */}
                {formData.password && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">Requisitos:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        {passwordRequirements.minLength ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-300" />
                        )}
                        <span className={passwordRequirements.minLength ? "text-green-600" : "text-gray-500"}>
                          8+ caracteres
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {passwordRequirements.hasUppercase ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-300" />
                        )}
                        <span className={passwordRequirements.hasUppercase ? "text-green-600" : "text-gray-500"}>
                          Mayúscula
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {passwordRequirements.hasLowercase ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-300" />
                        )}
                        <span className={passwordRequirements.hasLowercase ? "text-green-600" : "text-gray-500"}>
                          Minúscula
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {passwordRequirements.hasNumber ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-300" />
                        )}
                        <span className={passwordRequirements.hasNumber ? "text-green-600" : "text-gray-500"}>
                          Número
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs col-span-2">
                        {passwordRequirements.hasSpecialChar ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-300" />
                        )}
                        <span className={passwordRequirements.hasSpecialChar ? "text-green-600" : "text-gray-500"}>
                          Carácter especial (!@#$%...)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02] focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#005F02] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                    <X className="w-3.5 h-3.5" />
                    Las contraseñas no coinciden
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className={`w-full py-4 bg-gradient-to-r from-[#005F02] to-[#427A43] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 mt-6 ${
                  isFormValid && !isLoading
                    ? "hover:shadow-lg hover:shadow-[#005F02]/30 hover:scale-[1.02]"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creando cuenta...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Registrarse</span>
                  </>
                )}
              </button>
            </form>

            {/* Login Link */}
            <p className="text-center text-gray-600 text-sm">
              ¿Ya tienes cuenta?{" "}
              <Link to="/" className="text-[#005F02] font-semibold hover:text-[#004501] hover:underline transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>

          {/* Footer Info */}
          <div className="mt-6 text-center">
            <p className="text-white text-sm flex items-center justify-center gap-2">
              <Leaf className="w-4 h-4" />
              <span>Registro seguro con biometría facial</span>
            </p>
          </div>
        </div>
      </div>

      {/* Facial Capture Modal */}
      <FacialCaptureModal
        isOpen={showFacialModal}
        onCapture={handleFacialCapture}
        onClose={() => setShowFacialModal(false)}
        isLoading={isSavingFacial}
        mode="capture"
        title="📸 Registro Facial"
        description="Por favor, mire directamente a la cámara para completar su registro"
      />

      {/* ✅ Passkey Optional Modal */}
      <PasskeyOptionalModal
        open={showPasskeyModal}
        onClose={() => setShowPasskeyModal(false)}
        onSetup={setupPasskey}
        onSkip={skipPasskey}
        isLoading={isSettingPasskey}
        error={passkeyError}
      />
    </div>
  );
};

export default RegisterPage;
