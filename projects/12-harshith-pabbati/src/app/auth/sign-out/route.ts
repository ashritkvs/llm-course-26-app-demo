import { NextResponse } from 'next/server';
import { signOut } from '@/actions/auth';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { error } = await signOut();
  if (!error) return NextResponse.redirect(origin);
}
