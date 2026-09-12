import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { useLocation } from 'react-router-dom';
import { useUser } from '@/features/auth/UserProvider';
import { DirectionTag, MetaTag } from '@/shared/trading/Tags';
import { downloadCsv } from '@/shared/utils/csv';
import { formatDateTime, formatRate, formatRelativeTime } from '@/shared/utils/formatters';
import type { Trade } from '@/shared/types';
import TradeDetailDrawer from './TradeDetailDrawer';
import {
  formatQuantity,
  getCaptureLabel,
  getExecutionLabel,
  getProductLabel,
  getTradeNotional,
  monoFont,
} from './presentation';

type CaptureFilter = 'ALL' | 'live' | 'local';

const captureFilters: { value: CaptureFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'live', label: 'Live capture' },
  { value: 'local', label: 'Local fallback' },
];

type SortKey = 'bookedAt' | 'ccyPair' | 'qty' | 'price' | 'customer';
type SortDirection = 'asc' | 'desc';

interface ColumnDefinition {
  key: SortKey | null;
  label: string;
  align?: 'left' | 'right';
  hideBelow?: 'lg' | 'xl';
  width?: number;
}

const columns: ColumnDefinition[] = [
  { key: 'ccyPair', label: 'Instrument' },
  { key: null, label: 'Side', width: 76 },
  { key: 'qty', label: 'Quantity', align: 'right' },
  { key: 'price', label: 'Rate', align: 'right' },
  { key: null, label: 'Consideration', align: 'right', hideBelow: 'lg' },
  { key: 'customer', label: 'Customer' },
  { key: null, label: 'Settles', hideBelow: 'lg' },
  { key: null, label: 'Execution', hideBelow: 'xl' },
  { key: 'bookedAt', label: 'Booked', align: 'right' },
];

function sortValue(trade: Trade, key: SortKey): number | string {
  switch (key) {
    case 'bookedAt':
      return new Date(trade.bookedAt || 0).getTime();
    case 'qty':
      return Number(trade.qty || 0);
    case 'price':
      return Number(trade.price || 0);
    case 'customer':
      return String(trade.customer || '');
    case 'ccyPair':
    default:
      return String(trade.ccyPair || '');
  }
}

function StatTile({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: string;
}) {
  return (
    <Paper
      sx={{
        px: { xs: 1.25, md: 2 },
        py: { xs: 1, md: 1.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.35,
        borderLeft: accent ? '3px solid' : undefined,
        borderLeftColor: accent,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '1.15rem', md: '1.4rem' },
          fontWeight: 650,
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      {caption ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
          {caption}
        </Typography>
      ) : null}
    </Paper>
  );
}

function TradeBlotter() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { trades } = useUser();
  const location = useLocation();
  const bookedTradeId = (location.state as { bookedTradeId?: string } | null)?.bookedTradeId || '';

  const [search, setSearch] = useState('');
  const [captureFilter, setCaptureFilter] = useState<CaptureFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('bookedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTradeId, setSelectedTradeId] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuTradeId, setMenuTradeId] = useState('');
  const [feedback, setFeedback] = useState('');

  const captureCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: trades.length, live: 0, local: 0 };

    trades.forEach((trade) => {
      const mode = trade.bookingMode === 'local' ? 'local' : 'live';
      counts[mode] = (counts[mode] || 0) + 1;
    });

    return counts;
  }, [trades]);

  const summary = useMemo(() => {
    const buys = trades.filter((trade) => trade.direction === 'Buy').length;
    const ticketsByCustomer = new Map<string, number>();

    trades.forEach((trade) => {
      if (!trade.customer) return;
      ticketsByCustomer.set(trade.customer, (ticketsByCustomer.get(trade.customer) || 0) + 1);
    });

    const busiest = [...ticketsByCustomer.entries()].sort((left, right) => right[1] - left[1])[0];
    const latest = trades
      .map((trade) => trade.bookedAt || '')
      .filter(Boolean)
      .sort()
      .pop();

    return {
      count: trades.length,
      buys,
      sells: trades.length - buys,
      customers: ticketsByCustomer.size,
      topCustomer: busiest ? `Most active: ${busiest[0]}` : '',
      latest: latest || '',
    };
  }, [trades]);

  const visibleTrades = useMemo(() => {
    const query = search.trim().toLowerCase();
    const factor = sortDirection === 'asc' ? 1 : -1;

    return trades
      .filter((trade) => {
        if (captureFilter === 'ALL') return true;

        return (trade.bookingMode === 'local' ? 'local' : 'live') === captureFilter;
      })
      .filter((trade) => {
        if (!query) return true;

        return [trade.ccyPair, trade.customer, trade.trader, trade.id, trade.rm, trade.sales, trade.comments].some(
          (value) => String(value || '').toLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        const leftValue = sortValue(left, sortKey);
        const rightValue = sortValue(right, sortKey);

        if (leftValue < rightValue) return -1 * factor;
        if (leftValue > rightValue) return 1 * factor;

        return 0;
      });
  }, [captureFilter, search, sortDirection, sortKey, trades]);

  const selectedTrade = useMemo(
    () => trades.find((trade) => trade.id === selectedTradeId) || null,
    [selectedTradeId, trades]
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection(key === 'bookedAt' ? 'desc' : 'asc');
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuTradeId('');
  };

  const copyTradeId = async (tradeId: string) => {
    try {
      await navigator.clipboard?.writeText(tradeId);
      setFeedback(`Copied ${tradeId}.`);
    } catch {
      setFeedback('Clipboard is unavailable in this browser.');
    }
  };

  const exportBlotter = () => {
    downloadCsv(
      'fx-trade-blotter.csv',
      visibleTrades.map((trade) => {
        const notional = getTradeNotional(trade);

        return {
          TradeId: trade.id,
          Pair: trade.ccyPair,
          ProductType: getProductLabel(trade),
          ProductDetails: trade.productDetails || '',
          ExecutionType: trade.executionType || 'MARKET',
          Direction: trade.direction,
          Tenor: trade.tenor,
          Quantity: trade.qty,
          DealtCurrency: trade.dealtCurrency,
          Price: trade.price,
          Consideration: notional.amount,
          ConsiderationCurrency: notional.currency,
          Customer: trade.customer,
          RM: trade.rm,
          Sales: trade.sales,
          Trader: trade.trader,
          TradeDate: trade.tradeDate,
          SettlementDate: trade.settlementDate,
          BookingMode: trade.bookingMode,
          Status: trade.status,
          BookedAt: trade.bookedAt,
        };
      })
    );
  };

  const emptyState = (
    <Stack spacing={1} sx={{ alignItems: 'center', px: 3, py: { xs: 5, md: 8 }, textAlign: 'center' }}>
      <ReceiptLongRoundedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
      <Typography variant="subtitle1">No matching trades</Typography>
      <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 320 }}>
        {trades.length
          ? 'Nothing matches the current search or capture filter.'
          : 'Trades booked from the rates screen will appear here.'}
      </Typography>
      {trades.length && (search || captureFilter !== 'ALL') ? (
        <Button
          size="small"
          onClick={() => {
            setSearch('');
            setCaptureFilter('ALL');
          }}
          sx={{ mt: 0.5 }}
        >
          Clear filters
        </Button>
      ) : null}
    </Stack>
  );

  return (
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      {bookedTradeId ? <Alert severity="success">Trade {bookedTradeId} booked.</Alert> : null}
      {feedback ? (
        <Alert severity="info" onClose={() => setFeedback('')}>
          {feedback}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1, md: 1.5 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <StatTile
          label="Trades"
          value={String(summary.count)}
          caption={summary.latest ? `Last ${formatRelativeTime(summary.latest)}` : 'Nothing booked yet'}
          accent="#2563A8"
        />
        <StatTile
          label="Buy / Sell"
          value={`${summary.buys} / ${summary.sells}`}
          caption="Tickets by side"
          accent="#12855C"
        />
        <StatTile
          label="Customers"
          value={String(summary.customers)}
          caption={summary.topCustomer || 'No counterparties'}
          accent="#6688AD"
        />
        <StatTile
          label="Capture"
          value={`${captureCounts.live || 0} / ${captureCounts.local || 0}`}
          caption={captureCounts.local ? `${captureCounts.local} local fallback` : 'All captured live'}
          accent={captureCounts.local ? '#B3801F' : '#12855C'}
        />
      </Box>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1, md: 1.5 },
            gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(240px, 360px) 1fr auto' },
            alignItems: 'center',
            px: { xs: 1.5, md: 2 },
            pt: { xs: 1.5, md: 1.75 },
            pb: { xs: 1, md: 1.25 },
          }}
        >
          <TextField
            size="small"
            label="Search trades"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pair, customer, or trade ID"
            sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Typography
            color="text.secondary"
            variant="body2"
            sx={{
              whiteSpace: 'nowrap',
              textAlign: { xs: 'left', md: 'right' },
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {visibleTrades.length} shown · {trades.length} total
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<DownloadRoundedIcon />}
            onClick={exportBlotter}
            disabled={!visibleTrades.length}
            sx={{ whiteSpace: 'nowrap', justifySelf: { xs: 'start', md: 'end' } }}
          >
            Export blotter
          </Button>
        </Box>

        <Tabs
          value={captureFilter}
          onChange={(_event, value: CaptureFilter) => setCaptureFilter(value)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Booking mode"
          sx={{
            minHeight: 40,
            px: { xs: 0.75, md: 1.25 },
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 40,
              minWidth: 0,
              px: 1.5,
              fontSize: '0.82rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          {captureFilters.map((filter) => (
            <Tab
              key={filter.value}
              value={filter.value}
              label={`${filter.label} (${captureCounts[filter.value] || 0})`}
            />
          ))}
        </Tabs>

        {!visibleTrades.length ? (
          emptyState
        ) : isCompact ? (
          <Stack divider={<Divider />}>
            {visibleTrades.map((trade) => {
              const notional = getTradeNotional(trade);
              const isJustBooked = trade.id === bookedTradeId;

              return (
                <Box
                  key={trade.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTradeId(trade.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedTradeId(trade.id);
                    }
                  }}
                  sx={{
                    px: 1.75,
                    py: 1.5,
                    cursor: 'pointer',
                    borderLeft: '3px solid',
                    borderLeftColor: isJustBooked ? '#12855C' : 'transparent',
                    bgcolor: isJustBooked ? '#F3FAF7' : 'background.paper',
                    '&:active': { bgcolor: 'action.hover' },
                  }}
                >
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <DirectionTag direction={trade.direction} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                        {trade.ccyPair}
                      </Typography>
                      <MetaTag label={trade.tenor} />
                    </Stack>
                    {isJustBooked ? <MetaTag label="Just booked" /> : null}
                  </Stack>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, maxWidth: 460 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        Quantity
                      </Typography>
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatQuantity(trade.qty)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        Rate
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRate(trade.price)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', display: 'block' }}>
                        Customer
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {trade.customer || '—'}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontFamily: monoFont, minWidth: 0 }}>
                      {trade.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {formatQuantity(notional.amount)} {notional.currency} · {formatRelativeTime(trade.bookedAt)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <TableContainer sx={{ maxHeight: { md: 'calc(100vh - 360px)' } }}>
            <Table stickyHeader size="small" sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.label}
                      align={column.align || 'left'}
                      sortDirection={column.key && sortKey === column.key ? sortDirection : false}
                      sx={{
                        bgcolor: 'background.default',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                        py: 1,
                        width: column.width,
                        display: column.hideBelow ? { xs: 'none', [column.hideBelow]: 'table-cell' } : undefined,
                      }}
                    >
                      {column.key ? (
                        <TableSortLabel
                          active={sortKey === column.key}
                          direction={sortKey === column.key ? sortDirection : 'asc'}
                          onClick={() => handleSort(column.key as SortKey)}
                        >
                          {column.label}
                        </TableSortLabel>
                      ) : (
                        column.label
                      )}
                    </TableCell>
                  ))}
                  <TableCell sx={{ bgcolor: 'background.default', width: 52, py: 1 }} />
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleTrades.map((trade) => {
                  const notional = getTradeNotional(trade);
                  const isJustBooked = trade.id === bookedTradeId;

                  return (
                    <TableRow
                      key={trade.id}
                      hover
                      selected={trade.id === selectedTradeId}
                      onClick={() => setSelectedTradeId(trade.id)}
                      sx={{
                        cursor: 'pointer',
                        '& > td': { borderColor: 'divider' },
                        ...(isJustBooked
                          ? { bgcolor: '#F3FAF7', '& > td:first-of-type': { boxShadow: 'inset 3px 0 0 #12855C' } }
                          : null),
                      }}
                    >
                      <TableCell sx={{ py: 1 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 650, lineHeight: 1.3 }}>
                            {trade.ccyPair}
                          </Typography>
                          <MetaTag label={trade.tenor} />
                          {isJustBooked ? <MetaTag label="Just booked" /> : null}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ fontFamily: monoFont, display: 'block', maxWidth: 170 }}
                        >
                          {trade.id}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1 }}>
                        <DirectionTag direction={trade.direction} />
                      </TableCell>

                      <TableCell align="right" sx={{ py: 1 }}>
                        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatQuantity(trade.qty)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {trade.dealtCurrency}
                        </Typography>
                      </TableCell>

                      <TableCell align="right" sx={{ py: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                          {formatRate(trade.price)}
                        </Typography>
                        {trade.swapPoints ? (
                          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            pts {trade.swapPoints}
                          </Typography>
                        ) : null}
                      </TableCell>

                      <TableCell align="right" sx={{ py: 1, display: { xs: 'none', lg: 'table-cell' } }}>
                        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatQuantity(notional.amount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {notional.currency}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1 }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                          {trade.customer || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 180 }}>
                          {trade.trader || 'system'}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1, whiteSpace: 'nowrap', display: { xs: 'none', lg: 'table-cell' } }}>
                        <Typography variant="body2">{trade.settlementDate || '—'}</Typography>
                      </TableCell>

                      <TableCell sx={{ py: 1, whiteSpace: 'nowrap', display: { xs: 'none', xl: 'table-cell' } }}>
                        <Stack spacing={0.4} sx={{ alignItems: 'flex-start' }}>
                          <MetaTag label={getExecutionLabel(trade)} />
                          {trade.bookingMode === 'local' ? <MetaTag label={getCaptureLabel(trade)} tone="warning" /> : null}
                        </Stack>
                      </TableCell>

                      <TableCell align="right" sx={{ py: 1, whiteSpace: 'nowrap' }}>
                        <Tooltip title={formatDateTime(trade.bookedAt)} placement="left">
                          <Typography variant="body2">{formatRelativeTime(trade.bookedAt)}</Typography>
                        </Tooltip>
                      </TableCell>

                      <TableCell align="right" sx={{ py: 0.5 }}>
                        <IconButton
                          size="small"
                          aria-label={`Actions for ${trade.id}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuAnchor(event.currentTarget);
                            setMenuTradeId(trade.id);
                          }}
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setSelectedTradeId(menuTradeId);
            closeMenu();
          }}
        >
          <ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            copyTradeId(menuTradeId);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy trade ID</ListItemText>
        </MenuItem>
      </Menu>

      <TradeDetailDrawer trade={selectedTrade} onClose={() => setSelectedTradeId('')} />
    </Stack>
  );
}

export default TradeBlotter;
