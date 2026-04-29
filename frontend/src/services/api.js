import axios from 'axios';

const api = axios.create({
  baseURL: 'https://study-hub-tq9w.onrender.com/api'
});

// Add token automatically
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

// Handle unauthorized access
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