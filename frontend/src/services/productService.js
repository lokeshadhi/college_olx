import api from "./api.js";

export const getProducts = async (params = {}) => {
  const { data } = await api.get("/products", { params });
  return data; // { data, pagination }
};

export const getProductById = async (id) => {
  const { data } = await api.get(`/products/${id}`);
  return data; // { data, related }
};

export const getMyProducts = async () => {
  const { data } = await api.get("/products/user/me");
  return data; // { data, stats }
};

// payload: plain object of fields, imageFiles: FileList/array of File objects
export const createProduct = async (payload, imageFiles = []) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  Array.from(imageFiles).forEach((file) => formData.append("images", file));

  const { data } = await api.post("/products", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const updateProduct = async (id, payload, imageFiles = []) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
  Array.from(imageFiles).forEach((file) => formData.append("images", file));

  const { data } = await api.put(`/products/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const deleteProduct = async (id) => {
  const { data } = await api.delete(`/products/${id}`);
  return data;
};

export const toggleSold = async (id) => {
  const { data } = await api.patch(`/products/${id}/sold`);
  return data.data;
};
