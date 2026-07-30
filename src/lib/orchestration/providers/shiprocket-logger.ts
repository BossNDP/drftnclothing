export interface ShiprocketCallParams {
  endpoint: string;             // e.g. "auth/login", "orders/create/adhoc", "courier/assign/awb", "courier/generate/label", "orders/show/fulfillment/pickup"
  url: string;                  // Full URL being fetched
  options: RequestInit;         // Method, headers, body
  orderId?: string;             // Order number or order UUID if available
  correlationId?: string;       // Correlation ID if available
  requestPayload?: any;         // Parsed JSON request object (if applicable)
}

export interface ShiprocketCallResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  durationMs: number;
}

/**
 * Utility helper that performs every Shiprocket API HTTP fetch call with
 * standardized, greppable [ShiprocketAPI] request & response logging.
 */
export async function callShiprocketApi<T = any>(params: ShiprocketCallParams): Promise<ShiprocketCallResult<T>> {
  const { endpoint, url, options, orderId = 'N/A', correlationId, requestPayload } = params;
  const startTime = Date.now();
  const corrStr = correlationId ? ` | correlationId=${correlationId}` : '';

  // Non-sensitive summary for BEFORE log
  let reqSummary = '';
  if (requestPayload) {
    if (requestPayload.order_id) reqSummary += ` order_id=${requestPayload.order_id}`;
    if (requestPayload.billing_pincode) reqSummary += ` pincode=${requestPayload.billing_pincode}`;
    if (Array.isArray(requestPayload.order_items)) reqSummary += ` itemsCount=${requestPayload.order_items.length}`;
    if (requestPayload.sub_total) reqSummary += ` subtotal=${requestPayload.sub_total}`;
    if (requestPayload.payment_method) reqSummary += ` paymentMethod=${requestPayload.payment_method}`;
    if (requestPayload.shipment_id) reqSummary += ` shipment_id=${JSON.stringify(requestPayload.shipment_id)}`;
  }

  console.log(`[ShiprocketAPI] ${endpoint} | orderId=${orderId}${corrStr} | STARTING${reqSummary}`);

  let res: Response;
  let durationMs: number;
  let data: any;

  try {
    res = await fetch(url, options);
    durationMs = Date.now() - startTime;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }
  } catch (netErr: any) {
    durationMs = Date.now() - startTime;
    // Redact sensitive data in payload before logging failure
    const redactedPayload = redactSensitiveData(requestPayload);
    console.error(
      `[ShiprocketAPI] ${endpoint} | orderId=${orderId}${corrStr} | status=NETWORK_ERROR | duration=${durationMs}ms | ERROR=${netErr.message || String(netErr)} | payload=${JSON.stringify(redactedPayload)}`,
      netErr.stack
    );
    throw netErr;
  }

  if (res.ok) {
    console.log(
      `[ShiprocketAPI] ${endpoint} | orderId=${orderId}${corrStr} | status=${res.status} | duration=${durationMs}ms | response=${JSON.stringify(data)}`
    );
  } else {
    const redactedPayload = redactSensitiveData(requestPayload);
    console.error(
      `[ShiprocketAPI] ${endpoint} | orderId=${orderId}${corrStr} | status=${res.status} | duration=${durationMs}ms | ERROR=${JSON.stringify(data)} | payload=${JSON.stringify(redactedPayload)}`
    );
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    durationMs,
  };
}

function redactSensitiveData(payload: any): any {
  if (!payload) return payload;
  return JSON.parse(
    JSON.stringify(payload, (key, value) => {
      if (key === 'billing_phone' || key === 'customerPhone' || key === 'phone' || key === 'password') {
        return '***REDACTED***';
      }
      return value;
    })
  );
}
