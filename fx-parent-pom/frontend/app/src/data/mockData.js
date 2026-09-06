const nowIso = () => new Date().toISOString();

const seedRates = [
  { ccyPair: 'EURUSD', tenor: 'SP', qty: 5000000, bid: 1.08321, ask: 1.08339, source: 'STREAM', status: 'LIVE' },
  { ccyPair: 'GBPUSD', tenor: 'SP', qty: 4000000, bid: 1.27411, ask: 1.27433, source: 'STREAM', status: 'LIVE' },
  { ccyPair: 'USDJPY', tenor: 'SP', qty: 8000000, bid: 156.281, ask: 156.309, source: 'STREAM', status: 'LIVE' },
  { ccyPair: 'AUDUSD', tenor: '1M', qty: 3500000, bid: 0.66414, ask: 0.66431, source: 'VOICE', status: 'LIVE' },
  { ccyPair: 'NZDUSD', tenor: '1M', qty: 2800000, bid: 0.60758, ask: 0.60773, source: 'VOICE', status: 'LIVE' },
  { ccyPair: 'USDSGD', tenor: 'SP', qty: 4500000, bid: 1.34612, ask: 1.34629, source: 'STREAM', status: 'LIVE' },
  { ccyPair: 'USDINR', tenor: '3M', qty: 7000000, bid: 83.114, ask: 83.178, source: 'NDF', status: 'INDICATIVE' },
  { ccyPair: 'EURGBP', tenor: 'SP', qty: 2500000, bid: 0.85006, ask: 0.85022, source: 'STREAM', status: 'LIVE' },
  { ccyPair: 'USDCHF', tenor: '6M', qty: 3200000, bid: 0.90611, ask: 0.90629, source: 'VOICE', status: 'LIVE' },
  { ccyPair: 'EURJPY', tenor: '1Y', qty: 4100000, bid: 169.348, ask: 169.401, source: 'FORWARD', status: 'LIVE' },
  { ccyPair: 'USDCNH', tenor: 'SP', qty: 6000000, bid: 7.2481, ask: 7.2493, source: 'OFFSHORE', status: 'LIVE' },
  { ccyPair: 'EURSGD', tenor: 'SP', qty: 2200000, bid: 1.4579, ask: 1.4584, source: 'STREAM', status: 'LIVE' },
];

export function getFallbackRates() {
  return seedRates.map((rate, index) => ({
    ...rate,
    updatedAt: new Date(Date.now() - index * 18000).toISOString(),
  }));
}

export function simulateMarketSnapshot(previousRates = getFallbackRates()) {
  const timestamp = Date.now();

  return previousRates.map((rate, index) => {
    const pulse = Math.sin(timestamp / 5000 + index);
    const precision = rate.bid > 20 ? 0.001 : 0.00001;
    const drift = Number((pulse * precision * 2).toFixed(rate.bid > 20 ? 3 : 5));
    const spread = Math.max(rate.ask - rate.bid, rate.bid > 20 ? 0.02 : 0.00012);
    const bid = Number(Math.max(rate.bid + drift, precision).toFixed(rate.bid > 20 ? 3 : 5));
    const ask = Number((bid + spread).toFixed(rate.bid > 20 ? 3 : 5));

    return {
      ...rate,
      bid,
      ask,
      updatedAt: nowIso(),
      source: 'DEMO',
      status: 'SIMULATED',
    };
  });
}

export const fallbackCustomers = [
  { id: 1, name: 'Northwind Treasury' },
  { id: 2, name: 'Lattice Capital' },
  { id: 3, name: 'BluePeak Holdings' },
  { id: 4, name: 'Sapphire Imports' },
];

export const fallbackRelationshipManagers = [
  { id: 1, name: 'Amelia Hart' },
  { id: 2, name: 'Noah Cheng' },
  { id: 3, name: 'Priya Raman' },
];

export const fallbackSales = [
  { id: 1, name: 'Sofia Miller' },
  { id: 2, name: 'Marcus Tan' },
  { id: 3, name: 'Daniel Brooks' },
];

export function createDemoUser(username = 'demo.trader') {
  return {
    username,
    userType: 'TRADER',
    lastLoginTimestamp: nowIso(),
    email: `${username.replace(/\s+/g, '.').toLowerCase()}@example.com`,
    region: 'SG',
    message: 'Demo mode enabled',
  };
}

export const sampleTrades = [
  {
    id: 'FX-240517-001',
    ccyPair: 'EURUSD',
    tenor: 'SP',
    qty: 2500000,
    direction: 'Buy',
    dealtCurrency: 'EUR',
    price: 1.08332,
    customer: 'Northwind Treasury',
    rm: 'Amelia Hart',
    sales: 'Sofia Miller',
    tradeDate: '2026-05-24',
    settlementDate: '2026-05-26',
    comments: 'Quarter-end hedge for receivables.',
    trader: 'demo.trader',
    status: 'BOOKED',
    bookingMode: 'live',
    bookedAt: '2026-05-24T08:34:00.000Z',
  },
  {
    id: 'FX-240517-002',
    ccyPair: 'USDJPY',
    tenor: '1M',
    qty: 5000000,
    direction: 'Sell',
    dealtCurrency: 'USD',
    price: 156.241,
    customer: 'BluePeak Holdings',
    rm: 'Noah Cheng',
    sales: 'Marcus Tan',
    tradeDate: '2026-05-24',
    settlementDate: '2026-06-24',
    comments: 'Overlay against JPY funding cost.',
    trader: 'demo.trader',
    status: 'BOOKED',
    bookingMode: 'local',
    bookedAt: '2026-05-24T10:10:00.000Z',
  },
  {
    id: 'FX-240517-003',
    ccyPair: 'USDSGD',
    tenor: 'SP',
    qty: 1500000,
    direction: 'Buy',
    dealtCurrency: 'USD',
    price: 1.34624,
    customer: 'Sapphire Imports',
    rm: 'Priya Raman',
    sales: 'Daniel Brooks',
    tradeDate: '2026-05-23',
    settlementDate: '2026-05-27',
    comments: 'Invoice cover for APAC vendor payables.',
    trader: 'demo.trader',
    status: 'BOOKED',
    bookingMode: 'live',
    bookedAt: '2026-05-23T07:48:00.000Z',
  },
];

