'use client';

import Marquee from 'react-fast-marquee';

const tickerItems = [
  { label: 'RESPONSE TIME', value: '0.23s', change: '▼ 12.4%', up: false },
  { label: 'TICKETS RESOLVED', value: '14,293', change: '▲ 8.7%', up: true },
  { label: 'THREAT LEVEL', value: 'CRITICAL', change: '▲ 23.4%', up: true },
  { label: 'UPTIME', value: '99.97%', change: '—', up: null },
  { label: 'AVG RESOLUTION', value: '4m 32s', change: '▼ 3.1%', up: false },
  { label: 'AI ACCURACY', value: '98.6%', change: '▲ 1.2%', up: true },
  { label: 'ACTIVE AGENTS', value: '1,047', change: '▲ 5.0%', up: true },
  { label: 'ESCALATIONS', value: '0.3%', change: '▼ 0.8%', up: false },
];

export function TickerBar() {
  return (
    <div className="border-b border-[#FF4500] bg-background py-1.5">
      <Marquee speed={50} gradient={false}>
        {tickerItems.map((item) => (
          <span
            key={item.label}
            className="font-mono mx-8 flex items-center gap-2 text-[11px] uppercase tracking-widest"
          >
            <span className="text-[#FF4500]">{item.label}</span>
            <span className="font-bold text-foreground">{item.value}</span>
            <span
              className={
                item.up === true
                  ? 'text-emerald-400'
                  : item.up === false
                    ? 'text-red-400'
                    : 'text-gray-500'
              }
            >
              {item.change}
            </span>
            <span className="mx-4 text-[#FF4500] opacity-50">◆</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
