import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border px-2.5 font-mono py-0.5 text-xs tracking-widest uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF4500] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-[#FF4500] text-white border-[#FF4500]',
        neutral: 'bg-transparent text-foreground border-foreground/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
