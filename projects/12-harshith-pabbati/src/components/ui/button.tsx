import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-mono font-bold uppercase tracking-widest ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[#FF4500] text-white border-2 border-[#FF4500] hover:bg-transparent hover:text-[#FF4500]',
        shadow:
          'bg-transparent text-foreground border-2 border-foreground hover:border-[#FF4500] hover:text-[#FF4500]',
        noShadow: 'bg-[#FF4500] text-white border-2 border-[#FF4500]',
        outline:
          'bg-transparent text-[#FF4500] border-2 border-[#FF4500] hover:bg-[#FF4500] hover:text-white',
        link: 'text-[#FF4500] underline-offset-4 hover:underline',
        neutral: 'bg-background text-foreground border-2 border-foreground hover:border-[#FF4500] hover:text-[#FF4500]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
