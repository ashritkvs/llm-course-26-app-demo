import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

export const SignUpSchema = z.object({
  name: z.string().min(3, 'Please enter atleast 3 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must contain 8 characters at minimum'),
});

export type SignUpSchema = z.infer<typeof SignUpSchema>;

export const defaultValues: SignUpSchema = {
  name: '',
  email: '',
  password: '',
};

export const resolver = zodResolver(SignUpSchema);
