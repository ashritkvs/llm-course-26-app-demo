import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.string(),
});

export type InviteMemberSchema = z.infer<typeof InviteMemberSchema>;

export const resolver = zodResolver(InviteMemberSchema);
