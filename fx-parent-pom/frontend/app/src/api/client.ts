import axios from 'axios';
import type {
  AuthenticatedUser,
  Credentials,
  FxRate,
  LimitOrder,
  LimitOrderAmendment,
  LimitOrderDraft,
  LookupItem,
  NotificationsPayload,
  Trade,
  TradeDraft,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

export async function loginUser(credentials: Credentials): Promise<AuthenticatedUser> {
  const response = await api.post<AuthenticatedUser>('/login', credentials);
  return response.data;
}

export async function fetchFxPrices(): Promise<FxRate[]> {
  const response = await api.get<FxRate[]>('/fxprices');
  return response.data;
}

export async function fetchFxGrid(params: Record<string, unknown> = {}): Promise<FxRate[]> {
  const response = await api.get<FxRate[]>('/fxprices/grid', { params });
  return response.data;
}

export async function fetchLookup(path: string, fallback: LookupItem[]): Promise<LookupItem[]> {
  try {
    const response = await api.get<LookupItem[]>(path);
    return Array.isArray(response.data) && response.data.length ? response.data : fallback;
  } catch {
    return fallback;
  }
}

export async function submitTrade(payload: TradeDraft): Promise<Trade> {
  const response = await api.post<Trade>('/bookTrade', payload);
  return response.data;
}

export async function fetchTrades(): Promise<Trade[]> {
  const response = await api.get<Trade[]>('/trades');
  return response.data;
}

export async function fetchLimitOrders(params: Record<string, unknown> = {}): Promise<LimitOrder[]> {
  const response = await api.get<LimitOrder[]>('/limit-orders', { params });
  return response.data;
}

export async function fetchNotifications(
  params: Record<string, unknown> = {}
): Promise<NotificationsPayload> {
  const response = await api.get<NotificationsPayload>('/notifications', { params });
  return response.data;
}

export async function submitLimitOrder(payload: LimitOrderDraft): Promise<LimitOrder> {
  const response = await api.post<LimitOrder>('/limit-orders', payload);
  return response.data;
}

export async function amendLimitOrder(
  orderId: string,
  payload: LimitOrderAmendment
): Promise<LimitOrder> {
  const response = await api.put<LimitOrder>(`/limit-orders/${orderId}`, payload);
  return response.data;
}

export async function cancelLimitOrder(orderId: string): Promise<LimitOrder> {
  const response = await api.post<LimitOrder>(`/limit-orders/${orderId}/cancel`);
  return response.data;
}

export function extractApiMessage(error: unknown, fallbackMessage: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}
