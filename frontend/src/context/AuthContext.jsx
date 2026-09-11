import { createContext, useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  loginUser,
  registerUser,
  logoutUser,
  fetchProfile,
  updateProfile as updateProfileService,
  verifyEmail as verifyEmailService,
  resendVerification as resendVerificationService,
} from "../services/authService.js";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the backend if the httpOnly cookie still represents a
  // valid session. Silently ignore failures — it just means we're logged out.
  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchProfile();
        setUser(profile);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginUser(credentials);
    setUser(data);
    toast.success(`Welcome back, ${data.name.split(" ")[0]}!`);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await registerUser(payload);
    if (data.data && !data.requiresVerification) {
      setUser(data.data);
    }
    return data;
  }, []);

  const verifyEmail = useCallback(async ({ email, otp }) => {
    const res = await verifyEmailService({ email, otp });
    if (res.data) {
      setUser(res.data);
    }
    toast.success("Email verified! Welcome to CampusX.");
    return res;
  }, []);

  const resendVerification = useCallback(async (email) => {
    const res = await resendVerificationService(email);
    toast.success("Verification code sent to your student email.");
    return res;
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    toast.success("Logged out successfully");
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const data = await updateProfileService(payload);
    setUser(data);
    toast.success("Profile updated");
    return data;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        verifyEmail,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
