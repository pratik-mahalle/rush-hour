import { z } from "zod";
import {
  apiKey,
  ApiError,
  errorResponse,
  limitedJson,
  sarvam,
} from "@/lib/sarvam";
export async function POST(request: Request) {
  try {
    const key = apiKey(request);
    const parsed = z
      .object({
        text: z.string().min(1).max(800),
        language: z.enum(["hi-IN", "en-IN"]).default("en-IN"),
      })
      .safeParse(await limitedJson(request, 4000));
    if (!parsed.success) throw new ApiError("Invalid speech request.", 400);
    const start = performance.now();
    const data = z
      .object({ audios: z.array(z.string()) })
      .parse(
        await sarvam(
          "/text-to-speech",
          key,
          JSON.stringify({
            text: parsed.data.text,
            language_code: parsed.data.language,
            model: "bulbul:v3",
            speaker: "shubh",
            speech_sample_rate: 24000,
          }),
        ),
      );
    if (!data.audios?.[0])
      throw new ApiError("Speech synthesis returned no audio.", 502);
    return Response.json(
      {
        audio: data.audios[0],
        latency: performance.now() - start,
        model: "bulbul:v3",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
