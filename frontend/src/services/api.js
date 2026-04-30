import axios from 'axios';
import { getBackendOrigin } from '../utils/media';

const backendOrigin = getBackendOrigin();
const apiBaseUrl = import.meta.env.VITE_API_URL || (backendOrigin ? `${backendOrigin}/api` : '/api');

const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers['x-auth-token'] = token;
    }

    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
