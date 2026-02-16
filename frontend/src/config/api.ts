const BASE_URL = "http://127.0.0.1:8000";

export const API_ENDPOINTS = {
  LOGIN: `${BASE_URL}/api/auth/login`,
  REGISTER: `${BASE_URL}/api/auth/register`,
  VERIFY_FACIAL_LOGIN: `${BASE_URL}/api/auth/verify-facial-for-login`,

  // Authenticator (TOTP)
  TOTP_SETUP: `${BASE_URL}/api/auth/2fa/setup`,
  TOTP_VERIFY_SETUP: `${BASE_URL}/api/auth/2fa/verify`,
  TOTP_VERIFY_LOGIN: `${BASE_URL}/api/auth/2fa/verify-login`,
};
