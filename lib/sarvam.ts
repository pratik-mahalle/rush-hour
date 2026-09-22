export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function apiKey(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError("Cross-origin requests are not allowed.", 403);
  const key = request.headers.get("x-sarvam-key")?.trim();
  if (!key || key.length < 10 || key.length > 300)
    throw new ApiError("Connect your Sarvam API key to use live mode.", 401);
  return key;
}
export function errorResponse(e: unknown) {
  const message =
    e instanceof ApiError
      ? e.message
      : e instanceof Error && e.name === "AbortError"
        ? "The request was interrupted."
        : e instanceof Error && e.name === "TimeoutError"
          ? "Sarvam took too long to respond. Please retry."
          : "Could not process this request. Please try again.";
  return Response.json(
    { error: message },
    {
      status: e instanceof ApiError ? e.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function sarvam(
  path: string,
  key: string,
  body: BodyInit,
  json = true,
) {
  const response = await fetch(`https://api.sarvam.ai${path}`, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(35000),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "Sarvam rejected this API key. Check your key in Connect Sarvam.",
      403: "This key cannot access the requested Sarvam model. Check its permissions and account access.",
      429: "Sarvam rate limit or credit limit reached. Check your account, then retry.",
      400: "Sarvam could not accept this request. Check the audio or try a shorter instruction.",
      422: "Sarvam could not process this audio or request. Try a short, clear recording.",
    };
    throw new ApiError(
      messages[response.status] ||
        `Sarvam is unavailable (HTTP ${response.status}). Your orders have not been changed.`,
      response.status === 429 ? 429 : 502,
    );
  }
  return response.json();
}
export async function limitedJson(request: Request, max = 120000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new ApiError("Request is too large.", 413);
  const text = await request.text();
  if (text.length > max) throw new ApiError("Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Invalid JSON.", 400);
  }
}
