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

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFacialModal, setShowFacialModal] = useState(false);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [isVerifyingFacial, setIsVerifyingFacial] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Credenciales inválidas. Por favor, verifica email y contraseña.");
      }

      setLoginData(data);
      setShowFacialModal(true);
      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
      console.error("❌ Error en login:", errorMessage);
      setIsLoading(false);
    }
  };

  const handleFacialVerification = async (imageBase64: string) => {
    if (!loginData) return;

    setIsVerifyingFacial(true);
    setError("");

    try {
      // ✅ VERIFICACIÓN CRÍTICA: Enviar a nueva ruta que valida que el rostro pertenezca al usuario
      const response = await fetch(
        `${API_ENDPOINTS.VERIFY_FACIAL_LOGIN}?user_id=${loginData.user_id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_base64: imageBase64,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Manejo detallado de errores - Verificación de existencia de rostro en BD
        if (response.status === 401) {
          // Error 401: El rostro NO existe en BD o NO pertenece al usuario
          const errorDetail = data.detail || "";
          
          // Casos específicos de error 401:
          if (errorDetail.includes("No hay rostro registrado")) {
            // El usuario NO tiene rostro en la base de datos
            throw new Error("❌ No tienes un rostro registrado en la base de datos. Por favor, registra primero tu información facial en tu perfil.");
          } else if (errorDetail.includes("rostro no pertenece")) {
            // El rostro capturado no coincide con el del usuario
            throw new Error("❌ El rostro no pertenece a este usuario. Acceso denegado.");
          } else if (errorDetail.includes("Usuario no encontrado")) {
            // El usuario no existe
            throw new Error("❌ Usuario no encontrado en el sistema.");
          } else if (errorDetail.includes("Verificación de liveness")) {
            // Falló la verificación de liveness (foto estática)
            throw new Error("❌ Se detectó una foto o imagen estática. Por favor, realiza la captura en vivo.");
          } else {
            // Error genérico 401
            throw new Error("❌ " + errorDetail);
          }
        } else if (response.status === 400) {
          throw new Error("❌ " + (data.detail || "Error en la detección del rostro. Por favor, asegúrate de estar mirando la cámara."));
        } else if (response.status === 403) {
          throw new Error("❌ " + (data.detail || "Facial recognition no habilitado para tu cuenta."));
        } else {
          throw new Error("❌ " + (data.detail || "Error en la verificación facial"));
        }
      }

      // ✅ Verificación exitosa - Guardar token y navegar
      localStorage.setItem("access_token", loginData.access_token);
      localStorage.setItem("token_type", loginData.token_type);
      localStorage.setItem("user_id", loginData.user_id);

      setShowFacialModal(false);
      setIsExiting(true);

      // Transición animada al home
      setTimeout(() => {
        navigate("/home");
      }, 400);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "❌ Error en la verificación facial";
      setError(errorMessage);
      console.error("Error en verificación facial:", errorMessage);
      // Modal sigue abierto para que el usuario pueda reintentar
    } finally {
      setIsVerifyingFacial(false);
    }
  };

  return (
    <div className={`min-h-screen relative transition-all duration-500 ${isExiting ? "opacity-0" : ""}`}>
      {/* Background Image - Full Screen */}
      <div className="fixed inset-0 z-0">
        <img
          src={fondo1}
          alt="Nature background"
          className="w-full h-full object-cover"
        />
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

      {/* Main Content - Centered Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#005F02] to-[#427A43] mb-4">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Bienvenido
              </h1>
              <p className="text-gray-600">
                Ingresa a tu cuenta de forma segura
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-red-800 text-sm font-semibold">Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico
                </label>
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

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
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

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button 
                  type="button" 
                  className="text-sm text-[#005F02] hover:text-[#004501] font-medium transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Submit Button */}
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

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">o continúa con</span>
              </div>
            </div>

            {/* Google Button */}
            <button
              type="button"
              className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all duration-300 hover:border-gray-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="font-medium text-gray-700">Google</span>
            </button>

            {/* Register Link */}
            <p className="text-center text-gray-600">
              ¿No tienes cuenta?{" "}
              <Link 
                to="/register" 
                className="text-[#005F02] font-semibold hover:text-[#004501] hover:underline transition-colors"
              >
                Regístrate aquí
              </Link>
            </p>
          </div>

          {/* Footer Info */}
          <div className="mt-6 text-center">
            <p className="text-white text-sm flex items-center justify-center gap-2">
              <Leaf className="w-4 h-4" />
              <span>Proyecto Desarrollo de Software Seguro</span>
            </p>
          </div>
        </div>
      </div>

      {/* Facial Verification Modal */}
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
