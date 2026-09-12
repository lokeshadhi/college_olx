import api from "./api.js";

export const registerUser = async (payload) => {
  const { data } = await api.post("/auth/register", payload);
  return data;
};

export const verifyEmail = async ({ email, otp }) => {
  const { data } = await api.post("/auth/verify-email", { email, otp });
  return data;
};

export const resendVerification = async (email) => {
  const { data } = await api.post("/auth/resend-verification", { email });
  return data;
};

export const loginUser = async (payload) => {
  const { data } = await api.post("/auth/login", payload);
  return data.data;
};

export const logoutUser = async () => {
  await api.post("/auth/logout");
};

export const fetchProfile = async () => {
  const { data } = await api.get("/auth/profile");
  return data.data;
};

export const updateProfile = async (payload) => {
  const { data } = await api.put("/auth/profile", payload);
  return data.data;
};

export const forgotPassword = async (email) => {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
};

export const verifyPasswordResetOTP = async ({ email, otp }) => {
  const { data } = await api.post("/auth/verify-password-reset-otp", { email, otp });
  return data;
};

export const resendPasswordResetOTP = async (email) => {
  const { data } = await api.post("/auth/resend-password-reset-otp", { email });
  return data;
};

export const resetPassword = async (arg1, arg2, arg3) => {
  let resetToken;
  let password;
  let confirmPassword;

  if (typeof arg1 === "object" && arg1 !== null) {
    resetToken = arg1.resetToken;
    password = arg1.password;
    confirmPassword = arg1.confirmPassword;
  } else {
    resetToken = arg1;
    password = arg2;
    confirmPassword = arg3;
  }

  const { data } = await api.post("/auth/reset-password", {
    resetToken,
    password,
    confirmPassword,
  });
  return data;
};
