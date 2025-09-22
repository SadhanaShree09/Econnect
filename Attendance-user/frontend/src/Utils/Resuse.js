// import localstorageEncrypt from "localstorage-encrypt";
// import axios from "axios";
// var ip = import.meta.env.BACKEND_HOST || "localhost";
// var host = import.meta.env.BACKEND_PORT || "8000";
// export const LS = localstorageEncrypt.init("Quillbot", "RGBQUILLBOT");
// export const Baseaxios = axios.create({
//   baseURL: `https://${ip}:${host}/`,
//   headers: { Authorization: `Bearer ${LS.get("access_token")}` },
// });

import localstorageEncrypt from "localstorage-encrypt";
import axios from "axios";

// Use the full API URL from environment or default to localhost:8000
const API_BASE_URL = import.meta.env.VITE_HOST_IP || "http://127.0.0.1:8000";

export const ipadr = API_BASE_URL;
console.log("API Base URL:", API_BASE_URL); // Debugging step

export const LS = {
  save: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  get: (key) => {
    const val = localStorage.getItem(key);
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  },
  remove: (key) => localStorage.removeItem(key),
};

export const Baseaxios = axios.create({
  baseURL: `${API_BASE_URL}/`,
  headers: { Authorization: `Bearer ${LS.get("access_token")}` },
});