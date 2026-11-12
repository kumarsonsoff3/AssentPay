"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { InvoiceTotals } from "@/lib/dashboard/overview-summary";

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

export function CashFlowPreview({ invoices }: {
  invoices?: { points: { day: string; currencies: InvoiceTotals[] }[]; currencies: string[]; partial: boolean };
} = {}) {
  const [range, setRange] = useState<Range>("30D");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [width, setWidth] = useState(600);
  const chartRef = useRef<HTMLDivElement>(null);
  const gradientId = useId().replaceAll(":", "");
  const currency = invoices?.currencies.includes(selectedCurrency) ? selectedCurrency : invoices?.currencies[0];
  const availableRanges = invoices ? ranges.slice(0, 2) : ranges;
  const days = invoices?.points.slice(range === "7D" ? -7 : -30);
  const totals = days?.map(point => point.currencies.find(item => item.currency === currency));
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const data = days && totals ? {
    labels: days.map(point => dateLabel.format(new Date(`${point.day}T00:00:00Z`))),
    collected: totals.map(point => Number(point?.collected ?? 0)),
    invoiced: totals.map(point => Number(point?.outstanding ?? 0) + Number(point?.drafts ?? 0)),
    frequency: "UTC",
  } : series[range];
  const title = invoices ? "PayPal invoice totals" : "Cash flow overview";
  const firstLabel = invoices ? "Verified paid" : "Collected";
  const secondLabel = invoices ? "Open and draft invoices" : "Invoiced";
  const headingId = `${gradientId}-heading`;
  const currencyFormat = currency ? new Intl.NumberFormat("en-US", { style: "currency", currency }) : null;
  const axisFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
  const format = (value: number) => currencyFormat?.format(value) ?? `$${value.toLocaleString("en-US")}`;
  const totalCollected = format(
    data.collected.reduce((sum, value) => sum + value, 0),
  );
  const totalInvoiced = format(
    data.invoiced.reduce((sum, value) => sum + value, 0),
  );
  const scaleStep = invoices ? 1 : 4000;
  const scaleMax = Math.max(scaleStep, Math.ceil(Math.max(...data.collected, ...data.invoiced) / scaleStep) * scaleStep);
  const index = Math.max(0, Math.min(
    activePoint ??
      data.labels.findLastIndex(
        (_, i) => data.collected[i] > 0 || data.invoiced[i] > 0,
      ),
    data.labels.length - 1,
  ));
  const left = invoices ? 57 : 34;
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
      aria-label={invoices ? title : undefined}
      aria-labelledby={invoices ? undefined : headingId}
    >
      <div className="dash-panel-heading">
        <div>
          {!invoices && <h4 id={headingId}>{title}</h4>}
          <p>{invoices ? `Current face values by workflow creation date · ${data.frequency}${invoices.partial ? " · Partial data" : ""}` : `Collected vs. invoiced · ${data.frequency}`}</p>
        </div>
        <div
          className="chart-ranges"
          role="group"
          aria-label={`${title} date range`}
        >
          {availableRanges.map(item => (
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
        {invoices && invoices.currencies.length > 1 && <select aria-label="Invoice currency" value={currency} onChange={event => {
          setSelectedCurrency(event.target.value);
          setActivePoint(null);
        }}>
          {invoices.currencies.map(code => <option key={code} value={code}>{code}</option>)}
        </select>}
        {invoices && invoices.currencies.length === 1 && <span>{currency}</span>}
        <span>
          <i className="bg-primary" /> {firstLabel}{" "}
          <strong>{totalCollected}</strong>
        </span>
        <span>
          <i className="bg-[#93ACFF]" /> {secondLabel}{" "}
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
          aria-label={`${invoices ? "" : "Sample "}${range} ${title}. ${firstLabel} ${totalCollected}. ${secondLabel} ${totalInvoiced}. Use left and right arrow keys to explore.`}
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
                  {invoices ? axisFormat.format(value) : value === 0 ? "$0" : `$${value / 1000}K`}
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
            {!invoices && (range === "1Y" ? " 2026" : ", 2026")}
          </strong>
          <span>
            <i className="bg-[#93ACFF]" /> {secondLabel}{" "}
            <b>{format(data.invoiced[index])}</b>
          </span>
          <span>
            <i className="bg-primary" /> {firstLabel}{" "}
            <b>{format(data.collected[index])}</b>
          </span>
        </div>
        <span className="sr-only" aria-live="polite">
          {data.labels[index]}. {firstLabel} {format(data.collected[index])}.
          {secondLabel} {format(data.invoiced[index])}.
        </span>
      </div>
    </section>
  );
}
