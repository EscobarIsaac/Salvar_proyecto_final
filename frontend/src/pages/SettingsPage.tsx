import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Leaf, Zap, Fingerprint, LogOut, ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";
import fondo1 from "@/assets/fondo1.jpg";
import { API_ENDPOINTS } from "@/config/api";
import { Switch } from "@/components/ui/switch";

interface UserProfile {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  facial_recognition_enabled: boolean;
}

interface TotpSetup {
  user_id: string;
  issuer: string;
  account_name: string;
  otpauth_url: string;
  qr_png_base64: string;
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [facialSaving, setFacialSaving] = useState(false);
  const [totpSaving, setTotpSaving] = useState(false);
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          navigate("/");
          return;
        }

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Error obteniendo perfil", err);
        setError("No se pudo cargar la información del usuario");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, token]);

  const refreshProfileFlags = (updates: Partial<UserProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const toggleFacial = async (enable: boolean) => {
    if (!profile || !token) return;
    setFacialSaving(true);
    setError(null);
    setMessage(null);

    try {
      const endpoint = enable ? API_ENDPOINTS.FACIAL_ENABLE : API_ENDPOINTS.FACIAL_DISABLE;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "No se pudo actualizar el reconocimiento facial");

      refreshProfileFlags({ facial_recognition_enabled: enable });
      setMessage(data?.message || (enable ? "Reconocimiento facial habilitado" : "Reconocimiento facial deshabilitado"));
    } catch (err: any) {
      setError(err?.message || "Error cambiando estado facial");
    } finally {
      setFacialSaving(false);
    }
  };

  const startTotpSetup = async () => {
    if (!profile) return;
    setTotpSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_ENDPOINTS.TOTP_SETUP}?user_id=${profile.user_id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "No se pudo generar el QR");

      setTotpSetup(data);
      setMessage("Escanea el QR y escribe el código de 6 dígitos para habilitar Authenticator.");
    } catch (err: any) {
      setError(err?.message || "Error iniciando configuración de Authenticator");
    } finally {
      setTotpSaving(false);
    }
  };

  const verifyTotpSetup = async () => {
    if (!profile) return;
    setTotpSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_ENDPOINTS.TOTP_VERIFY_SETUP}?user_id=${profile.user_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Código inválido");

      refreshProfileFlags({ two_factor_enabled: true });
      setTotpSetup(null);
      setTotpCode("");
      setMessage("Authenticator habilitado correctamente.");
    } catch (err: any) {
      setError(err?.message || "Error verificando código");
    } finally {
      setTotpSaving(false);
    }
  };

  const disableTotp = async () => {
    if (!profile) return;
    setTotpSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_ENDPOINTS.TOTP_DISABLE}?user_id=${profile.user_id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "No se pudo deshabilitar Authenticator");

      refreshProfileFlags({ two_factor_enabled: false });
      setTotpSetup(null);
      setTotpCode("");
      setMessage(data?.message || "Authenticator deshabilitado.");
    } catch (err: any) {
      setError(err?.message || "Error deshabilitando Authenticator");
    } finally {
      setTotpSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 z-0">
        <img src={fondo1} alt="Nature background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-3 shadow-xl border border-[#005F02]/20">
          <Shield className="w-5 h-5 text-[#005F02]" />
          <span className="text-[#005F02] font-bold uppercase tracking-wider text-sm">Centro de Seguridad</span>
          <Leaf className="w-4 h-4 text-[#427A43]" />
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 pt-28 pb-16">
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 text-gray-800 font-semibold hover:bg-white shadow"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("token_type");
                localStorage.removeItem("user_id");
                navigate("/");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 text-[#005F02] font-semibold hover:bg-white shadow"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ajustes de verificación</h1>
                <p className="text-gray-600 mt-1">Activa o desactiva métodos de seguridad y configura Authenticator.</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4" />
                Sesión segura
              </div>
            </div>

            {message && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                {message}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            {loading || !profile ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-[#005F02] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-gray-900 text-white p-6 shadow-lg flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Zap className="w-6 h-6 text-emerald-400" />
                      <div>
                        <p className="text-xs uppercase text-gray-400">Reconocimiento Facial</p>
                        <p className="text-lg font-semibold">Estado: {profile.facial_recognition_enabled ? "Habilitado" : "Deshabilitado"}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                      <div>
                        <p className="text-sm text-gray-200">Permitir verificación con cámara</p>
                        <p className="text-xs text-gray-400">Al desactivar, solo usarás usuario y contraseña.</p>
                      </div>
                      <Switch
                        checked={profile.facial_recognition_enabled}
                        onCheckedChange={(checked) => toggleFacial(checked)}
                        disabled={facialSaving}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-gray-900 text-white p-6 shadow-lg flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-6 h-6 text-emerald-400" />
                      <div>
                        <p className="text-xs uppercase text-gray-400">Huella (Authenticator)</p>
                        <p className="text-lg font-semibold">Estado: {profile.two_factor_enabled ? "Habilitado" : "No configurado"}</p>
                      </div>
                    </div>

                    {profile.two_factor_enabled ? (
                      <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                        <div>
                          <p className="text-sm text-gray-200">Usar Authenticator en el login</p>
                          <p className="text-xs text-gray-400">Puedes desactivar para volver a solo contraseña.</p>
                        </div>
                        <Switch
                          checked={profile.two_factor_enabled}
                          onCheckedChange={(checked) => {
                            if (!checked) disableTotp();
                          }}
                          disabled={totpSaving}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-gray-200">Agrega Authenticator para códigos de 6 dígitos.</p>
                        <button
                          onClick={startTotpSetup}
                          disabled={totpSaving}
                          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
                        >
                          {totpSaving ? "Generando QR..." : "Habilitar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {totpSetup && (
                  <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-[#005F02]" />
                      <div>
                        <p className="font-semibold text-gray-900">Configura Authenticator</p>
                        <p className="text-sm text-gray-600">Escanea el QR y escribe el código de 6 dígitos.</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex-shrink-0 flex items-center justify-center">
                        <img
                          alt="QR Authenticator"
                          className="w-48 h-48"
                          src={`data:image/png;base64,${totpSetup.qr_png_base64}`}
                        />
                      </div>

                      <div className="flex-1 space-y-3">
                        <input
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          maxLength={6}
                          placeholder="Código de 6 dígitos"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#005F02]"
                        />

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={verifyTotpSetup}
                            disabled={totpCode.trim().length !== 6 || totpSaving}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#005F02] to-[#427A43] text-white font-semibold hover:opacity-95"
                          >
                            {totpSaving ? "Verificando..." : "Verificar y habilitar"}
                          </button>
                          <button
                            onClick={() => setTotpSetup(null)}
                            className="px-4 py-3 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
