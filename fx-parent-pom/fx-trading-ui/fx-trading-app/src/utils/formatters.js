export function formatRate(value) {
  return Number(value || 0).toFixed(Number(value || 0) > 20 ? 3 : 5);
}

export function formatNotional(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return 'just now';
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatDateTime(timestamp) {
  if (!timestamp) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function getCurrencyCodes(ccyPair = '') {
  return {
    base: ccyPair.slice(0, 3),
    terms: ccyPair.slice(3, 6),
  };
}

function addBusinessDays(baseDate, days) {
  const date = new Date(baseDate);
  let remaining = days;

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return date;
}

export function calculateSettlementDate(tradeDate, tenor = 'SP') {
  const baseDate = tradeDate ? new Date(tradeDate) : new Date();

  if (tenor === 'SP') {
    return addBusinessDays(baseDate, 2).toISOString().slice(0, 10);
  }

  const numeric = Number.parseInt(tenor, 10);

  if (Number.isNaN(numeric)) {
    return addBusinessDays(baseDate, 2).toISOString().slice(0, 10);
  }

  const settlementDate = new Date(baseDate);

  if (tenor.endsWith('M')) {
    settlementDate.setMonth(settlementDate.getMonth() + numeric);
  } else if (tenor.endsWith('Y')) {
    settlementDate.setFullYear(settlementDate.getFullYear() + numeric);
  } else {
    settlementDate.setDate(settlementDate.getDate() + numeric);
  }

  const day = settlementDate.getDay();
  if (day === 6) settlementDate.setDate(settlementDate.getDate() + 2);
  if (day === 0) settlementDate.setDate(settlementDate.getDate() + 1);

  return settlementDate.toISOString().slice(0, 10);
}

export function formatSignedDelta(delta) {
  if (!delta) {
    return '0.00000';
  }

  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${formatRate(delta)}`;
}

