import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, Check, X, Shield, Leaf, UserPlus, Fingerprint } from "lucide-react";
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
}

type TotpSetupResponse = {
  user_id: string;
  issuer: string;
  account_name: string;
  otpauth_url: string;
  qr_png_base64: string;
};

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
  const [isSavingFacial, setIsSavingFacial] = useState(false);

  const [registrationData, setRegistrationData] = useState<RegistrationResponse | null>(null);

  // Paso opcional Authenticator
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetupResponse | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isTotpLoading, setIsTotpLoading] = useState(false);

  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowFacialModal(true); // capturar facial primero
  };

  const handleFacialCapture = async (imageBase64: string) => {
    setIsSavingFacial(true);
    setError("");

    try {
      const registerResponse = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          full_name: formData.full_name,
          facial_image_base64: imageBase64,
        }),
      });

      const data = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(data.detail || data.message || "Error al registrar usuario");
      }

      setRegistrationData(data);
      setShowFacialModal(false);

      // Aquí NO redirigimos aún: damos opción de configurar Authenticator (opcional)
      setShowTotpSetup(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar usuario";
      setError(msg);
    } finally {
      setIsSavingFacial(false);
    }
  };

  const startTotpSetup = async () => {
    if (!registrationData) return;
    setIsTotpLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_ENDPOINTS.TOTP_SETUP}?user_id=${registrationData.user_id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo generar el QR");

      setTotpSetup(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error configurando Authenticator";
      setError("❌ " + msg);
    } finally {
      setIsTotpLoading(false);
    }
  };

  const verifyTotpSetup = async () => {
    if (!registrationData) return;
    setIsTotpLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_ENDPOINTS.TOTP_VERIFY_SETUP}?user_id=${registrationData.user_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Código inválido");

      // listo, vamos al login
      navigate("/", { state: { message: "✅ Registro completado. Ahora inicia sesión." } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error verificando código";
      setError("❌ " + msg);
    } finally {
      setIsTotpLoading(false);
    }
  };

  const skipTotp = () => {
    navigate("/", { state: { message: "✅ Registro completado. Ahora inicia sesión." } });
  };

  return (
    <div className="min-h-screen relative">
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

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-24">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#005F02] to-[#427A43] mb-4">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Crear Cuenta</h1>
              <p className="text-gray-600">Únete con seguridad biométrica</p>
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

            {!showTotpSetup && (
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
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
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
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
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
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
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
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
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

                  {formData.password && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                      <p className="text-xs font-medium text-gray-700 mb-2">Requisitos:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          {passwordRequirements.minLength ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                          <span className={passwordRequirements.minLength ? "text-green-600" : "text-gray-500"}>8+ caracteres</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {passwordRequirements.hasUppercase ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                          <span className={passwordRequirements.hasUppercase ? "text-green-600" : "text-gray-500"}>Mayúscula</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {passwordRequirements.hasLowercase ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                          <span className={passwordRequirements.hasLowercase ? "text-green-600" : "text-gray-500"}>Minúscula</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {passwordRequirements.hasNumber ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                          <span className={passwordRequirements.hasNumber ? "text-green-600" : "text-gray-500"}>Número</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs col-span-2">
                          {passwordRequirements.hasSpecialChar ? <Check className="w-3.5 h-3.5 text-green-600" /> : <X className="w-3.5 h-3.5 text-gray-300" />}
                          <span className={passwordRequirements.hasSpecialChar ? "text-green-600" : "text-gray-500"}>Carácter especial (!@#$%...)</span>
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
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#005F02]"
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

                <button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  className={`w-full py-4 bg-gradient-to-r from-[#005F02] to-[#427A43] text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-300 mt-6 ${
                    isFormValid && !isLoading ? "hover:shadow-lg hover:shadow-[#005F02]/30 hover:scale-[1.02]" : "opacity-50 cursor-not-allowed"
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
            )}

            {/* Paso opcional Authenticator */}
            {showTotpSetup && registrationData && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="font-semibold text-gray-900">✅ Registro facial completado</p>
                  <p className="text-sm text-gray-600 mt-1">
                    ¿Deseas configurar Authenticator (huella) ahora? Es opcional.
                  </p>
                </div>

                {!totpSetup ? (
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={startTotpSetup}
                      disabled={isTotpLoading}
                      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-[#005F02] to-[#427A43] text-white hover:opacity-95"
                    >
                      <Fingerprint className="w-5 h-5" />
                      {isTotpLoading ? "Generando QR..." : "Configurar Authenticator"}
                    </button>

                    <button
                      type="button"
                      onClick={skipTotp}
                      className="w-full py-3 rounded-xl font-semibold bg-white border-2 border-gray-200 hover:bg-gray-50"
                    >
                      Omitir (por ahora)
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-white border border-gray-200 rounded-xl">
                      <p className="text-sm font-semibold text-gray-800">1) Escanea el QR con Microsoft Authenticator</p>
                      <p className="text-xs text-gray-600 mt-1">
                        En la app: “Agregar cuenta” → “Otra (Google)” o “Cuenta de trabajo/escuela” según tu app, pero normalmente funciona con “Otra”.
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <img
                        alt="QR Authenticator"
                        className="w-48 h-48"
                        src={`data:image/png;base64,${totpSetup.qr_png_base64}`}
                      />
                    </div>

                    <div className="p-3 bg-white border border-gray-200 rounded-xl">
                      <p className="text-sm font-semibold text-gray-800">2) Ingresa el código de 6 dígitos</p>
                      <input
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        maxLength={6}
                        placeholder="123456"
                        className="mt-2 w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
                      />

                      <button
                        type="button"
                        onClick={verifyTotpSetup}
                        disabled={isTotpLoading || totpCode.trim().length !== 6}
                        className={`mt-3 w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                          isTotpLoading ? "bg-gray-200 text-gray-600" : "bg-gradient-to-r from-[#005F02] to-[#427A43] text-white hover:opacity-95"
                        }`}
                      >
                        {isTotpLoading ? "Verificando..." : "Verificar y habilitar"}
                      </button>

                      <button
                        type="button"
                        onClick={skipTotp}
                        className="mt-2 w-full py-3 rounded-xl font-semibold bg-white border-2 border-gray-200 hover:bg-gray-50"
                      >
                        Omitir (por ahora)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-gray-600 text-sm">
              ¿Ya tienes cuenta?{" "}
              <Link to="/" className="text-[#005F02] font-semibold hover:text-[#004501] hover:underline transition-colors">
                Inicia sesión
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white text-sm flex items-center justify-center gap-2">
              <Leaf className="w-4 h-4" />
              <span>Registro seguro con biometría facial</span>
            </p>
          </div>
        </div>
      </div>

      <FacialCaptureModal
        isOpen={showFacialModal}
        onCapture={handleFacialCapture}
        onClose={() => setShowFacialModal(false)}
        isLoading={isSavingFacial}
        mode="capture"
        title="📸 Registro Facial"
        description="Por favor, mire directamente a la cámara para completar su registro"
      />
    </div>
  );
};

export default RegisterPage;
