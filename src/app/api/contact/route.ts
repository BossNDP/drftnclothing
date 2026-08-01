import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = contactSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid message contents' }, { status: 400 });
    }

    const { name, email, message } = validation.data;

    // Save submission to database
    const [submission] = await db
      .insert(schema.contactMessages)
      .values({ name, email, message })
      .returning();

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    console.error('Contact submission API Error:', error);
    return NextResponse.json({ error: 'Failed to record message' }, { status: 500 });
  }
}
