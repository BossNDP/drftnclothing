import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { params } = body; // Parameters sent by the frontend (e.g. folder, timestamp)

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;

    if (!apiSecret || !apiKey) {
      return NextResponse.json({ error: 'Cloudinary credentials not configured on the server' }, { status: 500 });
    }

    if (!params) {
      return NextResponse.json({ error: 'Params to sign are required' }, { status: 400 });
    }

    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    // Create SHA-1 signature with api_secret
    const stringToSign = `${paramString}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dtj01pdog';

    return NextResponse.json({
      signature,
      apiKey,
      cloudName,
      timestamp: params.timestamp,
    });

  } catch (error) {
    console.error('Cloudinary signing server error:', error);
    return NextResponse.json({ error: 'Failed to generate upload signature' }, { status: 500 });
  }
}
