import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api",
  timeout: 10000,
});
let adminKey = "";
export const setAdminKey = (value: string) => {
  adminKey = value;
};
api.interceptors.request.use((config) => {
  if (adminKey) config.headers.set("X-API-Key", adminKey);
  return config;
});
export function messageFromError(error: unknown) {
  if (axios.isAxiosError(error))
    return error.response?.status === 401
      ? "Administrator API key was rejected."
      : String(error.response?.data?.detail ?? error.message);
  return error instanceof Error ? error.message : "Unexpected request failure.";
}
