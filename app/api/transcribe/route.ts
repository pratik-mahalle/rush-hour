import { z } from "zod";
import { apiKey, ApiError, errorResponse, sarvam } from "@/lib/sarvam";
export async function POST(request: Request) {
  try {
    const key = apiKey(request);
    if (Number(request.headers.get("content-length") || 0) > 8_000_000)
      throw new ApiError(
        "Please use an audio clip under 8 MB and 25 seconds.",
        413,
      );
    const form = await request.formData();
    const file = form.get("file");
    if (
      !file ||
      typeof file === "string" ||
      !file.size ||
      file.size > 8_000_000
    )
      throw new ApiError(
        "Upload an audio clip under 8 MB and 25 seconds.",
        400,
      );
    const audio = new FormData();
    audio.set("file", file, file.name || "order.webm");
    audio.set("model", "saaras:v4");
    audio.set("mode", "codemix");
    audio.set("language_code", "unknown");
    const start = performance.now();
    const data = z
      .object({ transcript: z.string(), language_code: z.string().optional() })
      .parse(await sarvam("/speech-to-text", key, audio, false));
    if (!data.transcript?.trim())
      throw new ApiError(
        "No speech was detected. Please record another instruction.",
        422,
      );
    return Response.json(
      {
        transcript: data.transcript,
        language: data.language_code,
        latency: performance.now() - start,
        model: "saaras:v4",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
