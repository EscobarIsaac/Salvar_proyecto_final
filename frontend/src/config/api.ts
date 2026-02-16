const BASE_URL = "http://localhost:8000";

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${BASE_URL}/api/auth/login`,
  REGISTER: `${BASE_URL}/api/auth/register`,
  VERIFY_FACIAL_LOGIN: `${BASE_URL}/api/auth/verify-facial-for-login`,

  // WebAuthn (Passkeys)
  WEBAUTHN_REGISTER_OPTIONS: `${BASE_URL}/api/webauthn/register/options`,
  WEBAUTHN_REGISTER_VERIFY: `${BASE_URL}/api/webauthn/register/verify`,
  WEBAUTHN_AUTH_OPTIONS: `${BASE_URL}/api/webauthn/authenticate/options`,
  WEBAUTHN_AUTH_VERIFY: `${BASE_URL}/api/webauthn/authenticate/verify`,

  WEBAUTHN_HEALTH: `${BASE_URL}/api/webauthn/health`,
};

export default API_ENDPOINTS;
