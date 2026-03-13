import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BFL_API_BASE_URL = "https://api.bfl.ai/v1";
const MODEL_ID = "flux-2-flex";
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;
const DEFAULT_GUIDANCE = 4.5;
const DEFAULT_STEPS = 50;
const POLL_INTERVAL_MS = 750;
const MAX_POLL_ATTEMPTS = 120;

type HandwrittenHwRequest = {
  homeworkPreview?: string;
  handwritingReference?: string;
  pdfName?: string;
  handwritingName?: string;
};

type FluxCreateResponse = {
  id?: string;
  polling_url?: string;
  cost?: number | null;
  input_mp?: number | null;
  output_mp?: number | null;
  detail?: string;
  error?: string;
};

type FluxPollResponse = {
  id?: string;
  status?: string;
  result?: {
    sample?: string;
  } | null;
  detail?: string;
  error?: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDataUrl(value: string) {
  return value.startsWith("data:image/");
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.detail === "string") return payload.detail;
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.message === "string") return payload.message;
    return JSON.stringify(payload);
  } catch {
    const text = await response.text();
    return text || `Request failed with status ${response.status}.`;
  }
}

function buildPrompt({ pdfName, handwritingName }: HandwrittenHwRequest) {
  return [
    "Rewrite image 1 as a realistic handwritten homework solution on clean off-white paper.",
    "Preserve the exact mathematical content, equations, diagrams, ordering, and spacing from image 1.",
    "Match the handwriting style from image 2, including letterforms, slant, stroke weight, spacing, and pen pressure.",
    "Use dark ink, natural line breaks, and authentic photographed paper texture.",
    "Do not add or remove content, do not introduce typed text, no UI chrome, no watermarks, and no extra decorations.",
    pdfName ? `The source homework file is named ${pdfName}.` : "",
    handwritingName
      ? `The handwriting reference image is named ${handwritingName}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  const apiKey = process.env.BFL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing BFL_API_KEY. Add your Black Forest Labs API key to the server environment before generating.",
      },
      { status: 500 }
    );
  }

  let body: HandwrittenHwRequest;

  try {
    body = (await request.json()) as HandwrittenHwRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!body.homeworkPreview || !body.handwritingReference) {
    return NextResponse.json(
      { error: "Upload both a homework PDF and a handwriting reference." },
      { status: 400 }
    );
  }

  if (!isDataUrl(body.homeworkPreview) || !isDataUrl(body.handwritingReference)) {
    return NextResponse.json(
      { error: "Inputs must be valid image data URLs." },
      { status: 400 }
    );
  }

  const createResponse = await fetch(`${BFL_API_BASE_URL}/${MODEL_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify({
      prompt: buildPrompt(body),
      prompt_upsampling: true,
      input_image: body.homeworkPreview,
      input_image_2: body.handwritingReference,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      guidance: DEFAULT_GUIDANCE,
      steps: DEFAULT_STEPS,
      output_format: "png",
      safety_tolerance: 2,
    }),
  });

  if (!createResponse.ok) {
    const errorMessage = await readErrorMessage(createResponse);
    return NextResponse.json(
      { error: `FLUX.2 Flex request failed: ${errorMessage}` },
      { status: 502 }
    );
  }

  const createPayload = (await createResponse.json()) as FluxCreateResponse;

  if (!createPayload.polling_url) {
    return NextResponse.json(
      { error: "FLUX.2 Flex did not return a polling URL." },
      { status: 502 }
    );
  }

  let pollPayload: FluxPollResponse | null = null;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await delay(POLL_INTERVAL_MS);

    const pollResponse = await fetch(createPayload.polling_url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-key": apiKey,
      },
      cache: "no-store",
    });

    if (!pollResponse.ok) {
      const errorMessage = await readErrorMessage(pollResponse);
      return NextResponse.json(
        { error: `Polling failed: ${errorMessage}` },
        { status: 502 }
      );
    }

    pollPayload = (await pollResponse.json()) as FluxPollResponse;
    const status = pollPayload.status;

    if (status === "Ready") {
      break;
    }

    if (
      status === "Error" ||
      status === "Failed" ||
      status === "Request Moderated" ||
      status === "Content Moderated"
    ) {
      return NextResponse.json(
        {
          error:
            pollPayload.error ??
            pollPayload.detail ??
            `Generation ended with status "${status}".`,
        },
        { status: 502 }
      );
    }
  }

  if (pollPayload?.status !== "Ready" || !pollPayload.result?.sample) {
    return NextResponse.json(
      { error: "Timed out while waiting for FLUX.2 Flex to finish." },
      { status: 504 }
    );
  }

  const imageResponse = await fetch(pollPayload.result.sample, {
    cache: "no-store",
  });

  if (!imageResponse.ok) {
    const errorMessage = await readErrorMessage(imageResponse);
    return NextResponse.json(
      { error: `Generated image retrieval failed: ${errorMessage}` },
      { status: 502 }
    );
  }

  const contentType = imageResponse.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const imageDataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

  return NextResponse.json({
    imageDataUrl,
    model: MODEL_ID,
    requestId: createPayload.id ?? pollPayload.id ?? null,
    cost: createPayload.cost ?? null,
  });
}
