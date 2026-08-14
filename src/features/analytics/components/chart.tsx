'use client';

/**
 * The one client component that talks to Chart.js.
 *
 * WHY A SINGLE COMPONENT AND A DATA-ONLY SPEC
 * Charts are described to it as plain data - kind, labels, series, a few flags - and it
 * builds the Chart.js configuration itself. That boundary is not decoration: a Server
 * Component can only pass serialisable props, and Chart.js configuration is full of
 * callbacks. Keeping the functions on this side means the pages stay server-rendered and
 * every board describes its charts the same way.
 *
 * WHY NOT A WRAPPER LIBRARY
 * react-chartjs-2 is a fine package and would replace roughly forty lines here, at the
 * cost of a dependency between React's release cycle and ours. The whole surface we need
 * is: create on mount, destroy on unmount, rebuild when the data or the theme changes.
 *
 * WHY THE IMPORTS ARE ENUMERATED
 * `chart.js/auto` registers every controller, scale and element in the library. Naming
 * the six we use keeps the radar charts, the financial scales and the animation plugins
 * we do not use out of the bundle.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartDataset,
} from 'chart.js';

import { fallbackPalette, readPalette, type ChartPalette } from './palette';
import type { ChartSpec } from './spec';

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend
);

/**
 * A chart, sized by its container.
 *
 * `aria-label` rather than nothing: a canvas is opaque to a screen reader. The figure
 * around it (see `ChartCard`) also renders the same numbers as a table, so the data is
 * reachable without sight of the drawing.
 */
export function Chart({ spec, label }: { spec: ChartSpec; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [palette, setPalette] = useState<ChartPalette>(fallbackPalette);

  /*
   * Re-read the tokens whenever the theme attribute changes.
   *
   * Switching theme is a cookie write followed by a server re-render, which does not
   * remount this component - so without the observer the page would turn light and the
   * charts would keep their dark-theme colours until the next full load.
   */
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setPalette(readPalette(root));

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const chart = new ChartJS(canvas, configure(spec, palette));

    return () => chart.destroy();
    // Rebuilt rather than mutated when the data changes. A dashboard redraws on
    // navigation, not sixty times a second, so the simpler lifecycle is worth more than
    // the animation continuity an in-place update would preserve.
  }, [spec, palette]);

  return <canvas ref={canvasRef} role="img" aria-label={label} />;
}

/**
 * The union in the return type rather than the bare `ChartConfiguration` default: options
 * like `cutout` exist only on the doughnut controller, and the default parameter widens
 * to every registered type, where none of them do.
 */
function configure(
  spec: ChartSpec,
  palette: ChartPalette
): ChartConfiguration<'bar' | 'line' | 'doughnut'> {
  const font = { family: palette.fontFamily, size: 11 };

  const colourFor = (index: number, tone?: string | null): string => {
    if (tone != null && tone in palette.tone) {
      return palette.tone[tone as keyof typeof palette.tone];
    }
    return palette.series[index % palette.series.length] ?? palette.series[0] ?? palette.ink;
  };

  const shared = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 220 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: palette.surface,
        borderColor: palette.grid,
        borderWidth: 1,
        titleColor: palette.ink,
        bodyColor: palette.ink,
        titleFont: font,
        bodyFont: font,
        padding: 8,
        displayColors: spec.kind === 'doughnut',
        callbacks: {
          label: (item: { parsed: { y?: number } | number; raw: unknown; label: string }) => {
            const value = typeof item.parsed === 'number' ? item.parsed : (item.parsed.y ?? 0);
            const noun = value === 1 ? spec.unit.one : spec.unit.many;

            if (spec.total === undefined || spec.total === 0) return ` ${value} ${noun}`;

            const percent = Math.round((value / spec.total) * 1000) / 10;
            return ` ${value} ${noun} · ${percent}%`;
          },
        },
      },
    },
  } as const;

  if (spec.kind === 'doughnut') {
    return {
      type: 'doughnut',
      data: {
        labels: spec.labels,
        datasets: [
          {
            data: spec.values,
            backgroundColor: spec.values.map((_, index) => colourFor(index, spec.tones?.[index])),
            borderColor: palette.surface,
            borderWidth: 2,
            hoverOffset: 4,
          } as ChartDataset<'doughnut', number[]>,
        ],
      },
      options: {
        ...shared,
        cutout: '62%',
        plugins: {
          ...shared.plugins,
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: palette.muted,
              font,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
        },
      },
    };
  }

  const horizontal = spec.kind === 'bar' && spec.horizontal === true;

  const valueAxis = {
    beginAtZero: true,
    border: { display: false },
    grid: { color: palette.grid, drawTicks: false },
    ticks: {
      color: palette.muted,
      font,
      padding: 6,
      // Whole enquiries only: there is no such thing as 2.5 of them, and Chart.js will
      // happily label the axis that way on a small range.
      precision: 0,
    },
  };

  const categoryAxis = {
    border: { color: palette.grid },
    grid: { display: false },
    ticks: {
      color: palette.muted,
      font,
      autoSkip: !horizontal,
      maxRotation: 0,
      padding: 4,
    },
  };

  return {
    type: spec.kind === 'line' ? 'line' : 'bar',
    data: {
      labels: spec.labels,
      datasets: [
        spec.kind === 'line'
          ? ({
              data: spec.values,
              borderColor: colourFor(0),
              backgroundColor: withAlpha(colourFor(0), 0.16),
              borderWidth: 2,
              fill: true,
              tension: 0.28,
              pointRadius: spec.values.length > 40 ? 0 : 2.5,
              pointHoverRadius: 4,
              pointBackgroundColor: colourFor(0),
            } as ChartDataset<'line', number[]>)
          : ({
              data: spec.values,
              backgroundColor: spec.values.map((_, index) =>
                // A single-series bar chart is one measure, not many, so every bar takes
                // the first colour unless the dimension carries its own tones. Eight
                // colours for eight bars of the same thing is decoration that reads as
                // meaning.
                colourFor(spec.tones === undefined ? 0 : index, spec.tones?.[index])
              ),
              borderRadius: 3,
              maxBarThickness: horizontal ? 18 : 44,
            } as ChartDataset<'bar', number[]>),
      ],
    },
    options: {
      ...shared,
      indexAxis: horizontal ? 'y' : 'x',
      scales: horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
    },
  };
}

/**
 * A hex colour at partial opacity, for the area under a line.
 *
 * Chart.js accepts `rgba()`, and the tokens are hex, so the two have to be bridged
 * somewhere. Non-hex input is returned untouched rather than mangled.
 */
function withAlpha(colour: string, alpha: number): string {
  const hex = colour.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;

  const value = Number.parseInt(hex.slice(1), 16);

  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
