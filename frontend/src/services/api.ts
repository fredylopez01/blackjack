import axios from "axios";

const API_URL = "http://localhost:3001";
const AUTH_URL = "http://localhost:3000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const authApi = axios.create({
  baseURL: AUTH_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar token a las peticiones de api
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth-token");
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor para agregar token a las peticiones de authApi
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth-token");
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth endpoints
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await authApi.post("/api/auth/login", { email, password });
    localStorage.setItem("auth-token", response.data.token);
    return response.data;
  },

  register: async (email: string, password: string) => {
    const response = await authApi.post("/api/users/register", {
      email,
      password,
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await authApi.get("/api/users/profile");
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await authApi.post("/api/password/forgot-password", {
      email,
    });
    return response.data;
  },
};

// Rooms endpoints
export const roomsAPI = {
  list: async () => {
    const response = await api.get("/api/rooms");
    return response.data;
  },

  create: async (data: {
    name: string;
    isPublic: boolean;
    password?: string;
    maxPlayers?: number;
    minBet?: number;
    maxBet?: number;
  }) => {
    const response = await api.post("/api/rooms", data);
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/api/rooms/${id}`);
    return response.data;
  },

  join: async (id: string, password?: string) => {
    const response = await api.post(`/api/rooms/${id}/join`, { password });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/rooms/${id}`);
    return response.data;
  },
};

// Ranking endpoints
export const rankingAPI = {
  getGlobal: async (limit = 100) => {
    const response = await api.get(`/api/ranking?limit=${limit}`);
    return response.data;
  },

  getMyStats: async () => {
    const response = await api.get("/api/ranking/me");
    return response.data;
  },
};

// History endpoints
export const historyAPI = {
  getMyHistory: async (limit = 20) => {
    const response = await api.get(`/api/history/me?limit=${limit}`);
    return response.data;
  },

  getRoomHistory: async (roomId: string) => {
    const response = await api.get(`/api/history/room/${roomId}`);
    return response.data;
  },
};

export default api;
