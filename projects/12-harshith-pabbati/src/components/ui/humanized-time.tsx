'use client';

import { useEffect, useState } from 'react';
import { intervalToDuration, parseISO } from 'date-fns';

const calculateCurrentTime = (time: string) => {
  const duration = intervalToDuration({
    start: parseISO(time),
    end: new Date(),
  });

  if (duration.years) return duration.years + 'y';
  if (duration.months) return duration.months + 'mo';
  if (duration.days) return duration.days + 'd';
  if (duration.hours) return duration.hours + 'h';
  if (duration.minutes) return duration.minutes + 'm';
  return 'now';
};

export function HumanizedTime({ time }: { time: string }) {
  const [currentTime, setCurrentTime] = useState(() =>
    calculateCurrentTime(time)
  );

  useEffect(() => {
    // eslint-disable-next-line
    setCurrentTime(calculateCurrentTime(time));
    const timer = setInterval(
      () => setCurrentTime(calculateCurrentTime(time)),
      60000
    );
    return () => clearInterval(timer);
  }, [time]);

  return (
    <span
      title={parseISO(time).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}
      className="text-foreground text-xs"
    >
      {currentTime}
    </span>
  );
}
