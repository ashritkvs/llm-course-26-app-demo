import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

export const SignInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must contain 8 characters at minimum'),
});

export type SignInSchema = z.infer<typeof SignInSchema>;

export const defaultValues: SignInSchema = {
  email: '',
  password: '',
};

export const resolver = zodResolver(SignInSchema);
