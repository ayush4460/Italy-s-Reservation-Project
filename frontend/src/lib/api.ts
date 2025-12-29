import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Trigger global loader
  if (typeof window !== 'undefined') {
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
      window.dispatchEvent(new Event('ax-loading-stop'));
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
