// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth
  REGISTER: `${API_URL}/api/auth/register`,
  LOGIN: `${API_URL}/api/auth/login`,
  VERIFY_FACIAL_LOGIN: `${API_URL}/api/auth/verify-facial-for-login`,
  HEALTH: `${API_URL}/api/auth/health`,
  
  // Facial
  CAPTURE_FACIAL: `${API_URL}/api/facial/capture`,
  VERIFY_FACIAL: `${API_URL}/api/facial/verify`,
};

export default API_URL;
