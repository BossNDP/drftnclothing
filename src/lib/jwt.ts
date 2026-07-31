const secret = process.env.ADMIN_JWT_SECRET || 'drftn_default_jwt_secret_key_2026_fallback';

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8');
}

async function buildToken(payload: object, expSeconds: number): Promise<string> {
  const headerStr = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const header = base64UrlEncode(headerStr);
  
  const stringifiedPayload = JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expSeconds,
  });
  const encodedPayload = base64UrlEncode(stringifiedPayload);
  const data = `${header}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const encodedSignature = Buffer.from(signature).toString('base64url');

  return `${data}.${encodedSignature}`;
}

/** 30-day session token for authenticated users. */
export async function signToken(payload: { userId: string }): Promise<string> {
  return buildToken(payload, 30 * 24 * 60 * 60);
}

/** 15-minute temp token that encodes a verified phone for profile completion step. */
export async function signTempToken(payload: { phone: string; isTemp: true }): Promise<string> {
  return buildToken(payload, 15 * 60);
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(Buffer.from(signature, 'base64url'));
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    if (!isValid) return null;

    const decodedPayload = JSON.parse(base64UrlDecode(payload));

    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return decodedPayload;
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}
