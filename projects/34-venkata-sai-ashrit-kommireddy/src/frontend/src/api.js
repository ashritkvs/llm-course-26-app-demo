import axios from "axios";

const api = axios.create({
  baseURL: "https://modelscope-lite.onrender.com",
});

export async function uploadDataset(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function analyzeDataset(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function removeDuplicates(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/clean/remove-duplicates", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function fillMissing(file, strategy) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post(`/clean/fill-missing?strategy=${strategy}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function downloadCleanedDataset(file, options) {
  const { removeDuplicatesOption, fillMissingOption, strategy } = options;
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({
    remove_duplicates: String(removeDuplicatesOption),
    fill_missing: String(fillMissingOption),
    strategy,
  });
  const response = await api.post(`/clean/download?${params.toString()}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    responseType: "blob",
  });
  return response.data;
}
