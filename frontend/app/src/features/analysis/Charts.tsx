import type { ReactNode } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { buildTicks, chartTokens, formatPipValue, monoFont, niceMax } from './presentation';

export interface ChartDatum {
  key: string;
  label: string;
  /** Signed for the diverging chart; magnitude charts use the absolute value. */
  value: number;
  tooltip: ReactNode;
}

const barHeight = 14;
const labelWidth = { xs: 76, md: 92 };
const valueWidth = 64;

function ChartFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 2 } }}>
      <Typography component="h3" variant="subtitle2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2, mb: 1.75 }}>
        {subtitle}
      </Typography>
      {children}
    </Box>
  );
}

function EmptyPlot({ message }: { message: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
      {message}
    </Typography>
  );
}

/**
 * Horizontal magnitude bars — one flat hue for every instrument, because currency
 * pairs have no natural order and a ramp would just repeat the bar's length.
 */
export function MagnitudeBarChart({
  title,
  subtitle,
  unit,
  data,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  unit: string;
  data: ChartDatum[];
  emptyMessage: string;
}) {
  const axisMax = niceMax(Math.max(...data.map((datum) => datum.value), 0));
  const ticks = buildTicks(axisMax);

  return (
    <ChartFrame title={title} subtitle={subtitle}>
      {data.length ? (
        <>
          <Stack spacing={0.75}>
            {data.map((datum) => (
              <Tooltip key={datum.key} title={datum.tooltip} placement="top" arrow>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: `${labelWidth.xs}px 1fr ${valueWidth}px`, md: `${labelWidth.md}px 1fr ${valueWidth}px` },
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'default',
                    borderRadius: 0.75,
                    py: 0.35,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 650, fontSize: '0.72rem' }} noWrap>
                    {datum.label}
                  </Typography>
                  <Box sx={{ position: 'relative', height: barHeight }}>
                    {ticks.slice(1).map((tick) => (
                      <Box
                        key={tick}
                        sx={{
                          position: 'absolute',
                          left: `${(tick / axisMax) * 100}%`,
                          top: -2,
                          bottom: -2,
                          width: '1px',
                          bgcolor: chartTokens.grid,
                        }}
                      />
                    ))}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: barHeight,
                        width: `${Math.max(0.5, (datum.value / axisMax) * 100)}%`,
                        bgcolor: chartTokens.magnitude,
                        borderRadius: '0 4px 4px 0',
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.72rem' }}
                  >
                    {formatPipValue(datum.value)}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: `${labelWidth.xs}px 1fr ${valueWidth}px`, md: `${labelWidth.md}px 1fr ${valueWidth}px` },
              gap: 1,
              mt: 0.75,
            }}
          >
            <Box />
            <Box sx={{ position: 'relative', height: 16 }}>
              {ticks.map((tick) => (
                <Typography
                  key={tick}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    position: 'absolute',
                    left: `${(tick / axisMax) * 100}%`,
                    transform: tick === 0 ? 'none' : 'translateX(-100%)',
                    fontSize: '0.66rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPipValue(tick)}
                </Typography>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', fontSize: '0.66rem' }}>
              {unit}
            </Typography>
          </Box>
        </>
      ) : (
        <EmptyPlot message={emptyMessage} />
      )}
    </ChartFrame>
  );
}

/**
 * Diverging bars around a zero baseline. Direction is carried three ways — which
 * side of the line the bar sits on, the arrow glyph, and the hue — so the chart
 * still reads for anyone who cannot separate the two colours.
 */
export function DivergingBarChart({
  title,
  subtitle,
  unit,
  data,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  unit: string;
  data: ChartDatum[];
  emptyMessage: string;
}) {
  const axisMax = niceMax(Math.max(...data.map((datum) => Math.abs(datum.value)), 0));

  return (
    <ChartFrame title={title} subtitle={subtitle}>
      {data.length ? (
        <>
          <Stack spacing={0.75}>
            {data.map((datum) => {
              const isUp = datum.value >= 0;
              const width = (Math.abs(datum.value) / axisMax) * 50;

              return (
                <Tooltip key={datum.key} title={datum.tooltip} placement="top" arrow>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: `${labelWidth.xs}px 1fr ${valueWidth}px`, md: `${labelWidth.md}px 1fr ${valueWidth}px` },
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'default',
                      borderRadius: 0.75,
                      py: 0.35,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 650, fontSize: '0.72rem' }} noWrap>
                      {datum.label}
                    </Typography>

                    <Box sx={{ position: 'relative', height: barHeight }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: -3,
                          bottom: -3,
                          width: '1px',
                          bgcolor: chartTokens.zeroLine,
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          height: barHeight,
                          width: `${Math.max(0.4, width)}%`,
                          bgcolor: isUp ? chartTokens.up : chartTokens.down,
                          ...(isUp
                            ? { left: '50%', borderRadius: '0 4px 4px 0' }
                            : { right: '50%', borderRadius: '4px 0 0 4px' }),
                        }}
                      />
                    </Box>

                    <Stack
                      direction="row"
                      spacing={0.4}
                      sx={{ justifyContent: 'flex-end', alignItems: 'center' }}
                    >
                      <Box
                        component="span"
                        aria-hidden
                        sx={{ fontSize: '0.6rem', lineHeight: 1, color: isUp ? chartTokens.up : chartTokens.down }}
                      >
                        {isUp ? '▲' : '▼'}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.72rem', fontFamily: monoFont }}
                      >
                        {isUp ? '+' : '\u2212'}
                        {formatPipValue(Math.abs(datum.value))}
                      </Typography>
                    </Stack>
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: `${labelWidth.xs}px 1fr ${valueWidth}px`, md: `${labelWidth.md}px 1fr ${valueWidth}px` },
              gap: 1,
              mt: 0.75,
            }}
          >
            <Box />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
                −{formatPipValue(axisMax)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
                0
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>
                +{formatPipValue(axisMax)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', fontSize: '0.66rem' }}>
              {unit}
            </Typography>
          </Box>
        </>
      ) : (
        <EmptyPlot message={emptyMessage} />
      )}
    </ChartFrame>
  );
}
