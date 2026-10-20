"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ranges = ["7D", "30D", "90D", "1Y"] as const;
type Range = (typeof ranges)[number];
// Fictional daily activity: invoice batches and later payment settlements are
// separate events. Quiet days stay at zero instead of inventing a smooth trend.
const october = {
  labels: Array.from({ length: 31 }, (_, day) => `Oct ${day + 1}`),
  collected: [
    0, 1250, 0, 0, 480, 0, 2200, 650, 0, 0, 0, 900, 0, 1250, 0, 3200, 0, 0, 750,
    1000, 0, 480, 0, 0, 0, 2400, 600, 0, 1800, 1490, 0,
  ],
  invoiced: [
    1200, 0, 0, 0, 2800, 650, 0, 0, 1900, 0, 0, 0, 3200, 0, 750, 480, 0, 0,
    1000, 0, 4500, 0, 1450, 0, 0, 2200, 0, 1800, 0, 2670, 0,
  ],
};
const series: Record<
  Range,
  {
    labels: string[];
    collected: number[];
    invoiced: number[];
    frequency: string;
  }
> = {
  "7D": {
    labels: october.labels.slice(-7),
    collected: october.collected.slice(-7),
    invoiced: october.invoiced.slice(-7),
    frequency: "Daily amounts",
  },
  "30D": { ...october, frequency: "Daily amounts" },
  "90D": {
    labels: [
      "Aug 8",
      "Aug 15",
      "Aug 22",
      "Aug 29",
      "Sep 5",
      "Sep 12",
      "Sep 19",
      "Sep 26",
      "Oct 3",
      "Oct 10",
      "Oct 17",
      "Oct 24",
      "Oct 31",
    ],
    collected: [
      4200, 1250, 7400, 3050, 13020, 2100, 0, 6200, 1250, 3330, 5350, 2230,
      6290,
    ],
    invoiced: [
      6800, 3400, 2100, 8600, 7650, 1500, 4500, 7600, 1200, 5350, 4430, 6950,
      6670,
    ],
    frequency: "Weekly amounts",
  },
  "1Y": {
    labels: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
    ],
    collected: [
      16100, 19250, 19700, 17500, 14750, 26100, 17350, 22900, 14320, 18450,
    ],
    invoiced: [
      20500, 23400, 16750, 28900, 18100, 30250, 20150, 25600, 16550, 24600,
    ],
    frequency: "Monthly amounts",
  },
};

type Point = { x: number; y: number };
function linePath(points: Point[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
}

export function CashFlowPreview() {
  const [range, setRange] = useState<Range>("30D");
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [width, setWidth] = useState(600);
  const chartRef = useRef<HTMLDivElement>(null);
  const gradientId = useId().replaceAll(":", "");
  const data = series[range];
  const format = (value: number) => `$${value.toLocaleString("en-US")}`;
  const totalCollected = format(
    data.collected.reduce((sum, value) => sum + value, 0),
  );
  const totalInvoiced = format(
    data.invoiced.reduce((sum, value) => sum + value, 0),
  );
  const scaleMax = Math.max(
    4000,
    Math.ceil(Math.max(...data.collected, ...data.invoiced) / 4000) * 4000,
  );
  const index = Math.min(
    activePoint ??
      data.labels.findLastIndex(
        (_, i) => data.collected[i] > 0 || data.invoiced[i] > 0,
      ),
    data.labels.length - 1,
  );
  const left = 34;
  const right = width - 14;
  const top = 20;
  const bottom = 160;
  const points = (values: number[]) =>
    values.map((value, i) => ({
      x: left + (i / (values.length - 1)) * (right - left),
      y: bottom - (value / scaleMax) * (bottom - top),
    }));
  const collected = points(data.collected);
  const invoiced = points(data.invoiced);
  const active = collected[index];

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, Math.round(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="dash-panel cash-flow-panel"
      aria-labelledby="cash-flow-heading"
    >
      <div className="dash-panel-heading">
        <div>
          <h4 id="cash-flow-heading">Cash flow overview</h4>
          <p>Collected vs. invoiced · {data.frequency}</p>
        </div>
        <div
          className="chart-ranges"
          role="group"
          aria-label="Cash flow date range"
        >
          {ranges.map(item => (
            <button
              type="button"
              key={item}
              aria-pressed={range === item}
              onClick={() => {
                setRange(item);
                setActivePoint(null);
              }}
              className={cn(range === item && "is-selected")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="bg-primary" /> Collected{" "}
          <strong>{totalCollected}</strong>
        </span>
        <span>
          <i className="bg-[#93ACFF]" /> Invoiced{" "}
          <strong>{totalInvoiced}</strong>
        </span>
      </div>
      <div ref={chartRef} className="cash-flow-chart">
        <svg
          width="100%"
          height="190"
          viewBox={`0 0 ${width} 190`}
          role="img"
          tabIndex={0}
          aria-label={`Sample ${range} cash flow. Collected ${totalCollected}; invoiced ${totalInvoiced}. Use left and right arrow keys to explore.`}
          onKeyDown={event => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setActivePoint(
                Math.max(
                  0,
                  Math.min(
                    data.labels.length - 1,
                    index + (event.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
              );
            }
          }}
          onPointerMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setActivePoint(
              Math.max(
                0,
                Math.min(
                  data.labels.length - 1,
                  Math.round(
                    ((event.clientX - bounds.left - left) / (right - left)) *
                      (data.labels.length - 1),
                  ),
                ),
              ),
            );
          }}
          onPointerLeave={() => setActivePoint(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#2453FF" stopOpacity=".13" />
              <stop offset="1" stopColor="#2453FF" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map(step => {
            const value = (step * scaleMax) / 4;
            const y = bottom - (value / scaleMax) * (bottom - top);
            return (
              <g key={value}>
                <text x="0" y={y + 4} fill="#7182A0" fontSize="10">
                  {value === 0 ? "$0" : `$${value / 1000}K`}
                </text>
                <path
                  d={`M${left} ${y}H${right}`}
                  stroke="#E6EDF9"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}
          <path
            d={`${linePath(collected)} L${right},${bottom} L${left},${bottom}Z`}
            fill={`url(#${gradientId})`}
          />
          <path
            d={linePath(invoiced)}
            stroke="#B3C3FF"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={linePath(collected)}
            stroke="#2453FF"
            strokeWidth="2.3"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M${active.x} ${top}V${bottom}`}
            stroke="#A9BCF0"
            strokeDasharray="4 4"
          />
          <circle
            cx={active.x}
            cy={invoiced[index].y}
            r="4.8"
            fill="#B3C3FF"
            stroke="white"
            strokeWidth="2"
          />
          <circle
            cx={active.x}
            cy={active.y}
            r="5.5"
            fill="#2453FF"
            stroke="white"
            strokeWidth="2"
          />
          {data.labels.map((label, i) => {
            const stride = Math.ceil(
              (data.labels.length - 1) / (width < 420 ? 3 : 6),
            );
            if (i % stride !== 0 && i !== data.labels.length - 1) return null;
            return (
              <text
                key={label}
                x={collected[i].x}
                y="184"
                textAnchor={
                  i === 0
                    ? "start"
                    : i === data.labels.length - 1
                      ? "end"
                      : "middle"
                }
                fill="#7182A0"
                fontSize="10"
              >
                {label}
              </text>
            );
          })}
        </svg>
        <div className="chart-tooltip" aria-hidden="true">
          <strong>
            {data.labels[index]}
            {range === "1Y" ? " 2026" : ", 2026"}
          </strong>
          <span>
            <i className="bg-[#93ACFF]" /> Invoiced{" "}
            <b>{format(data.invoiced[index])}</b>
          </span>
          <span>
            <i className="bg-primary" /> Collected{" "}
            <b>{format(data.collected[index])}</b>
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          {data.labels[index]}: collected {format(data.collected[index])},
          invoiced {format(data.invoiced[index])}.
        </span>
      </div>
    </section>
  );
}
