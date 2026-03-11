import Replicate from "replicate";
import { acquireReplicateRateLimit } from "~/lib/replicate-ratelimit";

const MODEL_ID = "black-forest-labs/flux-schnell";

const replicate = new Replicate();

/**
 * Generate a PNG image using Flux Schnell via Replicate.
 *
 * Automatically respects the Replicate rate limit (local 10s delay +
 * distributed Redis limiter when configured).
 */
export async function generateImageWithFlux(prompt: string): Promise<Buffer> {
  await acquireReplicateRateLimit();

  const output = await replicate.run(MODEL_ID, {
    input: {
      prompt,
      num_outputs: 1,
      output_format: "png",
    },
  });

  // Replicate SDK returns different types depending on version/model:
  //  - FileOutput: extends ReadableStream, has .blob() method
  //  - Blob: has .arrayBuffer() directly
  //  - string: a URL to fetch
  const images = output as unknown[];
  const firstImage = images[0];
  if (!firstImage) {
    throw new Error("No image output from Replicate");
  }

  let blob: Blob;
  if (firstImage instanceof Blob) {
    blob = firstImage;
  } else if (typeof (firstImage as { blob?: unknown }).blob === "function") {
    blob = await (firstImage as { blob(): Promise<Blob> }).blob();
  } else if (typeof firstImage === "string") {
    const resp = await fetch(firstImage);
    if (!resp.ok) {
      throw new Error(`Failed to fetch generated image: ${resp.statusText}`);
    }
    blob = await resp.blob();
  } else if (typeof (firstImage as { url?: unknown }).url === "function") {
    const imageUrl = (firstImage as { url(): string }).url();
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch generated image: ${resp.statusText}`);
    }
    blob = await resp.blob();
  } else {
    throw new Error(`Unexpected Replicate output type: ${typeof firstImage}`);
  }

  return Buffer.from(await blob.arrayBuffer());
}
