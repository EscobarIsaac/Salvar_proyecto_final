import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Mail, User, Calendar, Lock, Zap, Shield, Leaf, LogOut, Settings, Edit } from "lucide-react";
import fondo1 from "@/assets/fondo1.jpg";

interface UserData {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  facial_recognition_enabled: boolean;
  created_at: string;
}

const HomePage = () => {
  const navigate = useNavigate();
  const [showContent, setShowContent] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setShowContent(true), 100);

    // Obtener datos del usuario
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch("http://localhost:8000/api/users/me", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else if (response.status === 401) {
          navigate("/login");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src={fondo1}
          alt="Nature background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>

      {/* Header Badge */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-3 shadow-xl border border-[#005F02]/20">
          <Shield className="w-5 h-5 text-[#005F02]" />
          <span className="text-[#005F02] font-bold uppercase tracking-wider text-sm">Sesión Segura</span>
          <Leaf className="w-4 h-4 text-[#427A43]" />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pt-32 pb-16">
        <div className={`w-full max-w-2xl transition-all duration-700 ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          {/* Success Icon */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#005F02] to-[#427A43] shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Welcome Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-center text-white mb-3">
            ¡Bienvenido!
          </h1>
          <p className="text-center text-white/90 text-lg mb-8">
            Has iniciado sesión correctamente
          </p>

          {/* User Profile Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#005F02]/20 border-t-[#005F02]"></div>
              </div>
            ) : userData ? (
              <>
                {/* Profile Header */}
                <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#005F02] to-[#427A43] flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">{userData.full_name}</h2>
                    <p className="text-gray-600">@{userData.username}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    userData.is_active 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {userData.is_active ? "● Activo" : "○ Inactivo"}
                  </div>
                </div>

                {/* User Information Grid */}
                <div className="space-y-3">
                  {/* Email */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#005F02]/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-[#005F02]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</p>
                      <p className="text-sm text-gray-900 font-medium truncate">{userData.email}</p>
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#005F02]/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-[#005F02]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ID de Usuario</p>
                      <p className="text-sm text-gray-900 font-mono truncate">{userData.user_id}</p>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#005F02]/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#005F02]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Miembro desde</p>
                      <p className="text-sm text-gray-900 font-medium">
                        {new Date(userData.created_at).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Security Features */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                    {/* Two Factor */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50">
                      <div className="w-10 h-10 rounded-lg bg-[#005F02]/10 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-[#005F02]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium">2FA</p>
                        <p className={`text-sm font-semibold ${userData.two_factor_enabled ? "text-green-600" : "text-gray-400"}`}>
                          {userData.two_factor_enabled ? "✓ Activo" : "○ Inactivo"}
                        </p>
                      </div>
                    </div>

                    {/* Facial Recognition */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50">
                      <div className="w-10 h-10 rounded-lg bg-[#005F02]/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-[#005F02]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 font-medium">Facial</p>
                        <p className={`text-sm font-semibold ${userData.facial_recognition_enabled ? "text-green-600" : "text-gray-400"}`}>
                          {userData.facial_recognition_enabled ? "✓ Activo" : "○ Inactivo"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-6 border-t border-gray-200">
                  <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all hover:scale-[1.02]">
                    <Edit className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all hover:scale-[1.02]">
                    <Settings className="w-4 h-4" />
                    <span>Ajustes</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No se pudieron cargar los datos del usuario</p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("token_type");
                localStorage.removeItem("user_id");
                navigate("/");
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/95 backdrop-blur-md text-[#005F02] font-semibold hover:bg-white hover:shadow-lg transition-all hover:scale-105 border border-[#005F02]/20"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-white text-sm flex items-center justify-center gap-2">
              <Leaf className="w-4 h-4" />
              <span>Sistema de Autenticación Segura</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;