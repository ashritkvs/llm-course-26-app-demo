import { Tables } from '@/database.types';
import DOMPurify from 'isomorphic-dompurify';

import { getNameInitials } from '@/lib/gravatar';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Conversation({ email_from_name, body, role, created_at }: Tables<'email'>) {
  const isStaff = role === 'staff';
  const isUser = role === 'user';

  const sanitizedBody = DOMPurify.sanitize(body, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'blockquote',
      'code',
      'pre',
      'div',
      'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });

  return (
    <div className="group flex w-full gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
      {isUser && (
        <Avatar className="size-9 shrink-0 mt-1 ring-2 ring-[#FF4500]/20">
          <AvatarFallback className="bg-gradient-to-br from-[#FF4500] to-[#FF6B35] text-white text-xs font-bold">
            {getNameInitials(email_from_name)}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn('flex flex-col gap-1 max-w-[85%] md:max-w-[75%]', isStaff && 'ml-auto items-end')}>
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-[10px] uppercase tracking-wider font-semibold', isStaff ? 'text-[#FF4500]/70' : 'text-muted-foreground')}>
            {email_from_name}
          </span>
          {created_at && (
            <span className="font-mono text-[9px] text-muted-foreground/60">
              {new Date(created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        
        <div
          className={cn(
            'relative overflow-hidden transition-all duration-200',
            isStaff
              ? 'bg-gradient-to-br from-[#FF4500]/10 via-[#FF4500]/5 to-transparent border border-[#FF4500]/20 shadow-lg shadow-[#FF4500]/5'
              : 'bg-muted/50 border border-border/50',
            'p-4 text-sm leading-relaxed'
          )}
        >
          {isStaff && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FF4500]/10 to-transparent rounded-bl-full opacity-60" />
          )}
          <div
            className="email-content relative z-10"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
        </div>
        
        {isStaff && (
          <span className="font-mono text-[9px] text-[#FF4500]/50 uppercase tracking-wider">
            AI Assistant
          </span>
        )}
      </div>
      
      {isStaff && (
        <Avatar className="size-9 shrink-0 mt-1 ring-2 ring-[#FF4500]/10">
          <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-800 text-white text-xs font-bold">
            {getNameInitials(email_from_name)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
