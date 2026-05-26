import axios from 'axios';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '/auth-api';
const PRICING_API_URL = import.meta.env.VITE_PRICING_API_URL || '/pricing-api';

const authApi = axios.create({
  baseURL: AUTH_API_URL,
  timeout: 5000,
});

const pricingApi = axios.create({
  baseURL: PRICING_API_URL,
  timeout: 5000,
});

export async function loginUser(credentials) {
  const response = await authApi.post('/login', credentials);
  return response.data;
}

export async function fetchFxPrices() {
  const response = await pricingApi.get('/fxprices');
  return response.data;
}

export async function fetchFxGrid(params = {}) {
  const response = await pricingApi.get('/fxprices/grid', { params });
  return response.data;
}

export async function fetchLookup(path, fallback) {
  try {
    const response = await pricingApi.get(path);
    return Array.isArray(response.data) && response.data.length ? response.data : fallback;
  } catch (error) {
    return fallback;
  }
}

export async function submitTrade(payload) {
  const response = await pricingApi.post('/bookTrade', payload);
  return response.data;
}

export function extractApiMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

