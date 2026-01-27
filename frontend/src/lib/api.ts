import axios from 'axios';

// Use dynamic hostname if in browser, otherwise fallback to provided network IP or localhost
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.');
    // If we are on localhost but API_URL is pointed to production, we might want to force local 5000 
    // unless explicitly overridden for remote debugging.
    if (isLocal && !process.env.NEXT_PUBLIC_FORCE_PROD_API) {
        return `http://${window.location.hostname}:5000/api`;
    }
    return `http://${window.location.hostname}:5000/api`;
  }
  return 'http://192.168.29.138:5000/api'; 
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Trigger global loader unless explicitly skipped
  // @ts-expect-error: skipLoader is custom config
  if (typeof window !== 'undefined' && !config.skipLoader) {
    window.dispatchEvent(new Event('ax-loading-start'));
  }
  return config;
}, (error) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ax-loading-stop'));
  }
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') {
        // We can't easily check config.skipLoader here in response interceptor without custom types or side-channel
        // But simply dispatching stop is "safe" (idempotent usually) or we can check response.config config.
        // @ts-expect-error: skipLoader is custom config
        if(!response.config.skipLoader) {
            window.dispatchEvent(new Event('ax-loading-stop'));
        }
    }
    return response;
  },
  (error) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ax-loading-stop'));
    }
    return Promise.reject(error);
  }
);

export default api;
