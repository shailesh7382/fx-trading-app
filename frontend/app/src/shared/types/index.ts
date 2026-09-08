/** Domain model shared by the API client, the workspace hook, and the screens. */

export type Direction = 'Buy' | 'Sell';

/** Tenors the desk trades. The API may publish others, so this stays a plain string. */
export type Tenor = string;

export type TimeInForce = 'GTC' | 'GTD';

export type ProductType = 'SPOT_FWD' | 'SWAP' | 'NDF' | 'BULLION';

export type LimitOrderStatus = 'ACTIVE' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';

export type NotificationCategory =
  | 'TRADE'
  | 'ORDER_EXECUTION'
  | 'ORDER_STATUS'
  | 'MARKET_COMMENTARY';

/** A quote as it arrives from the pricing API. */
export interface FxRate {
  quoteId?: string;
  requestId?: string;
  originalRequestId?: string;
  responseId?: string;
  responseAt?: string;
  channel?: string;
  segment?: string;
  customerId?: string;
  ccyPair: string;
  tenor: Tenor;
  contractTenor?: string;
  qty: number;
  quantityCurrency?: string;
  bid: number;
  ask: number;
  bidCoverPrice?: number;
  askCoverPrice?: number;
  bidPoints?: number;
  askPoints?: number;
  spotDate?: string;
  valueDate?: string;
  quotedAt?: string;
  expiresAt?: string;
  source?: string;
  status?: string;
  updatedAt?: string;
}

/** An {@link FxRate} enriched by `useWorkspaceData` with derived analytics fields. */
export interface NormalizedRate extends FxRate {
  source: string;
  status: string;
  updatedAt: string;
  mid: number;
  spreadPips: number;
  bidDelta: number;
  askDelta: number;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface AuthenticatedUser {
  username: string;
  userType?: string;
  lastLoginTimestamp?: string;
  email?: string;
  region?: string;
  message?: string;
}

/** Customers, relationship managers and sales people all share this shape. */
export interface LookupItem {
  id: number;
  name: string;
}

export interface Trade {
  id: string;
  quoteId?: string;
  requestId?: string;
  originalRequestId?: string;
  responseId?: string;
  responseAt?: string;
  channel?: string;
  segment?: string;
  customerId?: string;
  idempotencyKey?: string;
  ccyPair: string;
  tenor: Tenor;
  qty: number;
  direction: Direction;
  dealtCurrency: string;
  quantityCurrency?: string;
  price: number;
  coverPrice?: number;
  swapPoints?: number;
  buyCurrency?: string;
  buyQuantity?: number;
  sellCurrency?: string;
  sellQuantity?: number;
  spotDate?: string;
  valueDate?: string;
  customer?: string;
  rm?: string;
  sales?: string;
  tradeDate?: string;
  settlementDate?: string;
  comments?: string;
  trader?: string;
  status?: string;
  bookingMode?: 'live' | 'local';
  executionType?: 'MARKET' | 'LIMIT';
  productType?: ProductType;
  productDetails?: string;
  marketSource?: string;
  bookedAt?: string;
}

/** The ticket handed to `bookTrade`; the server assigns the identity fields. */
export type TradeDraft = Omit<Trade, 'id' | 'status' | 'bookingMode' | 'bookedAt'> &
  Partial<Pick<Trade, 'id' | 'status' | 'bookingMode' | 'bookedAt'>>;

export interface LimitOrder {
  id: string;
  requestId?: string;
  originalRequestId?: string;
  responseId?: string;
  responseAt?: string;
  channel?: string;
  segment?: string;
  customerId?: string;
  ccyPair: string;
  tenor: Tenor;
  qty: number;
  direction: Direction;
  dealtCurrency: string;
  quantityCurrency?: string;
  contractTenor?: string;
  limitPrice: number;
  timeInForce: TimeInForce;
  goodTillDate?: string | null;
  status: LimitOrderStatus;
  trader?: string;
  comments?: string;
  submittedAt?: string;
  executedAt?: string;
  executedPrice?: number;
  expiresAt?: string | null;
  lastEvaluatedAt?: string | null;
  lastEvaluatedPrice?: number | null;
  closedAt?: string | null;
  simulatorTradeId?: string | null;
  callbackUrl?: string;
  callbackStatus?: string;
  callbackAttempts?: number;
  lastEventId?: string | null;
  eventReceivedAt?: string | null;
  tradeDate?: string;
  settlementDate?: string;
}

export interface LimitOrderDraft {
  ccyPair: string;
  tenor: Tenor;
  qty: number;
  direction: Direction;
  dealtCurrency: string;
  limitPrice: number;
  timeInForce: TimeInForce;
  goodTillDate: string | null;
  tradeDate: string;
  settlementDate: string;
  trader: string;
  requestId?: string;
  channel?: string;
  segment?: string;
  customerId?: string;
}

export interface LimitOrderAmendment {
  qty: number;
  limitPrice: number;
  timeInForce: TimeInForce;
  goodTillDate: string | null;
  comments: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory | string;
  severity?: string;
  source?: string;
  relatedId?: string;
  createdAt?: string;
  unread?: boolean;
}

/** `/notifications` returns either a bare list or an envelope with an unread count. */
export type NotificationsPayload =
  | AppNotification[]
  | { notifications?: AppNotification[]; unreadCount?: number };
