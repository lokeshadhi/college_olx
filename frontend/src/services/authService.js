import api from "./api.js";

export const registerUser = async (payload) => {
  const { data } = await api.post("/auth/register", payload);
  return data.data;
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
