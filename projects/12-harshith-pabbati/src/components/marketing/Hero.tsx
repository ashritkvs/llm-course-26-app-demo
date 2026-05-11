import { Link } from 'next-view-transitions';

import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export function Hero() {
  return (
    <div className="relative flex h-[80dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-background p-4">
      {/* grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(to right, #FF4500 1px, transparent 1px), linear-gradient(to bottom, #FF4500 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <p className="font-mono z-10 text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
        {`// AI-POWERED SUPPORT INTELLIGENCE`}
      </p>
      <h1 className="font-display z-10 text-center text-4xl font-black uppercase leading-none tracking-tight text-foreground md:text-6xl lg:text-7xl">
        {siteConfig.hero.heading}
      </h1>
      <p className="font-mono z-10 max-w-3xl text-center text-sm leading-relaxed text-gray-400 md:text-base">
        {siteConfig.hero.description}
      </p>
      <div className="z-10 flex items-center gap-4">
        <Link
          href="/auth/sign-up"
          className={cn(
            'font-mono h-12 text-sm uppercase tracking-widest md:text-base lg:h-14',
            buttonVariants({ size: 'lg', variant: 'default' })
          )}
        >
          Deploy Now
        </Link>
        <Link
          href="/auth/sign-in"
          className={cn(
            'font-mono h-12 text-sm uppercase tracking-widest md:text-base lg:h-14',
            buttonVariants({ size: 'lg', variant: 'outline' })
          )}
        >
          Sign In
        </Link>
      </div>
      <div className="font-mono z-10 mt-4 flex gap-8 text-[10px] uppercase tracking-widest text-gray-600">
        <span>
          STATUS: <span className="text-emerald-400">OPERATIONAL</span>
        </span>
        <span>
          BUILD: <span className="text-[#FF4500]">v2.4.1</span>
        </span>
        <span>
          NODES: <span className="text-foreground">1,047</span>
        </span>
      </div>
    </div>
  );
}
