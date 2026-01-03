import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  authApi,
  type RegisterData,
  type LoginData,
  type UpdateProfileData,
  type ChangePasswordData,
} from "@/api";
import { QUERY_KEYS } from "@/constants";
import type { User } from "@/types";
import { useState, useEffect } from "react";

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(authApi.getStoredUser());

  // Get current user
  const {
    data: meData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [QUERY_KEYS.AUTH_ME],
    queryFn: authApi.me,
    enabled: authApi.isAuthenticated(),
    retry: false,
  });

  useEffect(() => {
    if (meData?.data?.user) {
      setUser(meData.data.user);
    }
  }, [meData]);

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data),
    onSuccess: (data) => {
      if (data.data?.user) {
        // Immediately update local state
        setUser(data.data.user);
        // Update query cache to prevent refetch from overriding
        queryClient.setQueryData([QUERY_KEYS.AUTH_ME], data);
      }
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (data: LoginData) => authApi.login(data),
    onSuccess: (data) => {
      if (data.data?.user) {
        // Immediately update local state
        setUser(data.data.user);
        // Update query cache to prevent refetch from overriding
        queryClient.setQueryData([QUERY_KEYS.AUTH_ME], data);
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
      navigate("/auth/login", { replace: true });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => authApi.updateProfile(data),
    onSuccess: (data) => {
      if (data.data?.user) {
        setUser(data.data.user);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUTH_ME] });
      }
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordData) => authApi.changePassword(data),
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
    onSuccess: () => {
      navigate("/login");
    },
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    refetch,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    updateProfileError: updateProfileMutation.error,
    changePassword: changePasswordMutation.mutate,
    changePasswordAsync: changePasswordMutation.mutateAsync,
    isChangingPassword: changePasswordMutation.isPending,
    changePasswordError: changePasswordMutation.error,
    forgotPassword: forgotPasswordMutation.mutate,
    forgotPasswordAsync: forgotPasswordMutation.mutateAsync,
    isSendingResetLink: forgotPasswordMutation.isPending,
    forgotPasswordError: forgotPasswordMutation.error,
    resetPassword: resetPasswordMutation.mutate,
    resetPasswordAsync: resetPasswordMutation.mutateAsync,
    isResettingPassword: resetPasswordMutation.isPending,
    resetPasswordError: resetPasswordMutation.error,
  };
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return { isAuthenticated, isLoading };
}

export function useRequireRole(allowedRoles: string[]) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate("/login");
      } else if (user && !allowedRoles.includes(user.role)) {
        navigate("/unauthorized");
      }
    }
  }, [user, isAuthenticated, isLoading, allowedRoles, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    hasAccess: user ? allowedRoles.includes(user.role) : false,
  };
}
