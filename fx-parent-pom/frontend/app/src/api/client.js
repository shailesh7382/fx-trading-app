import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

export async function loginUser(credentials) {
  const response = await api.post('/login', credentials);
  return response.data;
}

export async function fetchFxPrices() {
  const response = await api.get('/fxprices');
  return response.data;
}

export async function fetchFxGrid(params = {}) {
  const response = await api.get('/fxprices/grid', { params });
  return response.data;
}

export async function fetchLookup(path, fallback) {
  try {
    const response = await api.get(path);
    return Array.isArray(response.data) && response.data.length ? response.data : fallback;
  } catch (error) {
    return fallback;
  }
}

export async function submitTrade(payload) {
  const response = await api.post('/bookTrade', payload);
  return response.data;
}

export async function fetchTrades() {
  const response = await api.get('/trades');
  return response.data;
}

export async function fetchLimitOrders(params = {}) {
  const response = await api.get('/limit-orders', { params });
  return response.data;
}

export async function fetchNotifications(params = {}) {
  const response = await api.get('/notifications', { params });
  return response.data;
}

export async function submitLimitOrder(payload) {
  const response = await api.post('/limit-orders', payload);
  return response.data;
}

export async function amendLimitOrder(orderId, payload) {
  const response = await api.put(`/limit-orders/${orderId}`, payload);
  return response.data;
}

export async function cancelLimitOrder(orderId) {
  const response = await api.post(`/limit-orders/${orderId}/cancel`);
  return response.data;
}

export function extractApiMessage(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage
  );
}

