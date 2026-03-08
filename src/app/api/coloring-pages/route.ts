import { NextResponse } from 'next/server';
import { getColoringPages } from '@/lib/pdf-service';

export async function GET() {
  const pages = await getColoringPages();
  return NextResponse.json(pages);
}
