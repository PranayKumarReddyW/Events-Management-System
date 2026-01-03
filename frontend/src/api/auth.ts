import { apiClient } from "./client";
import type { User, AuthResponse } from "@/types";
import { TOKEN_KEY, SESSION_KEY, USER_KEY } from "@/constants";

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  departmentId?: string;
  yearOfStudy?: number;
  rollNumber?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  fullName?: string;
  phone?: string;
  bio?: string;
  profilePicture?: string;
  yearOfStudy?: number;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    in_app?: boolean;
  };
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  // Register a new user
  register: async (data: RegisterData) => {
    const response = await apiClient.post<AuthResponse>("/auth/register", data);
    if (response.success && response.data) {
      localStorage.setItem(TOKEN_KEY, response.data.token);
      localStorage.setItem(SESSION_KEY, response.data.sessionId);
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    }
    return response;
  },

  // Login user
  login: async (data: LoginData) => {
    const response = await apiClient.post<AuthResponse>("/auth/login", data);
    if (response.success && response.data) {
      localStorage.setItem(TOKEN_KEY, response.data.token);
      localStorage.setItem(SESSION_KEY, response.data.sessionId);
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    }
    return response;
  },

  // Get current user
  me: async () => {
    const response = await apiClient.get<{ user: User }>("/auth/me");
    if (response.success && response.data) {
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    }
    return response;
  },

  // Logout
  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  // Update profile
  updateProfile: async (data: UpdateProfileData) => {
    const response = await apiClient.put<{ user: User }>("/auth/profile", data);
    if (response.success && response.data) {
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
    }
    return response;
  },

  // Change password
  changePassword: async (data: ChangePasswordData) => {
    return apiClient.post("/auth/change-password", data);
  },

  // Forgot password
  forgotPassword: async (email: string) => {
    return apiClient.post("/auth/forgot-password", { email });
  },

  // Reset password
  resetPassword: async (token: string, password: string) => {
    return apiClient.post(`/auth/reset-password/${token}`, { password });
  },

  // Get stored user from localStorage
  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  // Get stored token
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
};
