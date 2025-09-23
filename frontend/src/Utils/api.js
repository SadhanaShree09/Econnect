import axios from "axios";

// export baseURL separately so WebSocket can use it
export const baseURL = "http://127.0.0.1:8000"; // backend URL

const instance = axios.create({
  baseURL,
});

// ✅ Attach token automatically before every request
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ----------------------
// 🔹 Extra API functions
// ----------------------

// Get a single task
export const getTask = async (taskId) => {
  const res = await instance.get(`/tasks/${taskId}`);
  return res.data;
};

// Get comments for a task
export const getComments = async (taskId) => {
  const res = await instance.get(`/tasks/${taskId}/comments`);
  return res.data;
};

// Add a new comment
export const addComment = async (taskId, payload) => {
  const res = await instance.post(`/tasks/${taskId}/comments`, payload);
  return res.data;
};

// Update a task
export const updateTask = async (taskId, payload) => {
  const res = await instance.put(`/tasks/${taskId}`, payload);
  return res.data;
};

// Delete a task
export const deleteTask = async (taskId) => {
  const res = await instance.delete(`/tasks/${taskId}`);
  return res.data;
};

export default instance;
