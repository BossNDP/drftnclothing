import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { v2 as cloudinary } from 'cloudinary';

export const maxDuration = 60;

function getCloudinaryCredentials() {
  const envCloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const cloudName = (envCloud && envCloud !== 'j4i7n9ru') ? envCloud : 'dtj01pdog';
  const apiKey = process.env.CLOUDINARY_API_KEY || '388993459747447';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || '1IHqRKjnjPKzu7ACR-JbGML7Xts';
  return { cloudName, apiKey, apiSecret };
}

export async function POST(request: Request) {
  try {
    // 1. Verify admin session/auth before proceeding
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Session missing' },
        { status: 401 }
      );
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();

    // Dynamically configure Cloudinary SDK with validated credentials
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    let fileBuffer: Buffer | null = null;
    let mimeType = 'image/png';
    let removeBackground = false;

    const contentType = request.headers.get('content-type') || '';

    // 2. Accept bg-removed image as multipart/form-data or base64 JSON
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const bgFlag = formData.get('removeBackground');
      if (bgFlag === 'true' || bgFlag === '1') removeBackground = true;

      if (!file) {
        return NextResponse.json(
          { error: 'No image file provided in form data.' },
          { status: 400 }
        );
      }

      // Enforce 5MB per-file limit
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image file exceeds 5MB limit.' },
          { status: 400 }
        );
      }

      mimeType = file.type || 'image/png';
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { imageBase64, mimeType: customMime, removeBackground: bgOpt } = body;
      if (bgOpt) removeBackground = true;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return NextResponse.json(
          { error: 'imageBase64 parameter is required.' },
          { status: 400 }
        );
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');

      if (fileBuffer.length > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image file exceeds 5MB limit.' },
          { status: 400 }
        );
      }

      if (customMime) mimeType = customMime;
    } else {
      return NextResponse.json(
        { error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
        { status: 400 }
      );
    }

    let currentBuffer = fileBuffer;
    let bgRemovedSuccessfully = false;
    let engineUsed: 'cloudinary_ai' | 'remove_bg' | 'none' = 'none';

    // Helper for uploading Buffer directly to Cloudinary via upload_stream
    const doCloudinaryUpload = async (buf: Buffer, uploadOptions: Record<string, any>) => {
      return new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'drftn-products',
            resource_type: 'image',
            transformation: [
              { quality: 'auto', fetch_format: 'auto' },
              { effect: 'improve' },
              { effect: 'sharpen:60' }
            ],
            ...uploadOptions,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(buf);
      });
    };

    let uploadResult: any = null;

    if (removeBackground) {
      // Attempt 1: Cloudinary built-in background_removal add-on transformation
      try {
        uploadResult = await doCloudinaryUpload(currentBuffer, { background_removal: 'cloudinary_ai' });
        bgRemovedSuccessfully = true;
        engineUsed = 'cloudinary_ai';
        console.log('[Upload Image API] Background removal completed via Cloudinary AI add-on');
      } catch (cAiError: any) {
        console.warn('[Upload Image API] Cloudinary AI background_removal failed/unavailable:', cAiError?.message || cAiError);

        // Attempt 2: remove.bg REST API fallback
        const removeBgKey = process.env.REMOVE_BG_API_KEY;
        if (removeBgKey) {
          try {
            console.log('[Upload Image API] Falling back to remove.bg REST API...');
            const removeBgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
              method: 'POST',
              headers: {
                'X-Api-Key': removeBgKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                image_file_b64: currentBuffer.toString('base64'),
                size: 'auto',
              }),
            });

            if (removeBgRes.ok) {
              const bgArrayBuffer = await removeBgRes.arrayBuffer();
              currentBuffer = Buffer.from(bgArrayBuffer);
              uploadResult = await doCloudinaryUpload(currentBuffer, {});
              bgRemovedSuccessfully = true;
              engineUsed = 'remove_bg';
              console.log('[Upload Image API] Background removal completed via remove.bg REST API fallback');
            } else {
              const errText = await removeBgRes.text();
              console.warn('[Upload Image API] remove.bg API error response:', errText);
            }
          } catch (rbgErr: any) {
            console.error('[Upload Image API] remove.bg API exception:', rbgErr?.message || rbgErr);
          }
        } else {
          console.warn('[Upload Image API] REMOVE_BG_API_KEY is not set in environment.');
        }
      }
    }

    // Fallback if background removal was not requested or failed both attempts
    if (!uploadResult) {
      uploadResult = await doCloudinaryUpload(currentBuffer, {});
    }

    let secureUrl: string = uploadResult.secure_url || uploadResult.url;

    // Ensure transformation delivery parameters are formatted into the URL
    if (secureUrl && secureUrl.includes('/upload/')) {
      if (!secureUrl.includes('f_auto,q_auto,e_improve,e_sharpen:60')) {
        secureUrl = secureUrl.replace('/upload/', '/upload/f_auto,q_auto,e_improve,e_sharpen:60/');
      }
    }

    return NextResponse.json({ 
      secure_url: secureUrl, 
      public_id: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bg_removed: bgRemovedSuccessfully,
      bg_removal_engine: engineUsed,
    });
  } catch (error: any) {
    console.error('[Upload Image API Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload image to Cloudinary.' },
      { status: 500 }
    );
  }
}
