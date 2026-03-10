import { UTApi } from "uploadthing/server";

export interface UploadedFile {
  url: string;
  key: string;
  name: string;
  size: number;
}

// Initialize UploadThing API client lazily - only when token is present
function getUtapi(): UTApi {
  if (!process.env.UPLOADTHING_TOKEN) {
    throw new Error("UPLOADTHING_TOKEN not configured");
  }
  return new UTApi({
    token: process.env.UPLOADTHING_TOKEN,
  });
}

// Upload an image (PNG/JPG)
export async function uploadImage(
  buffer: Buffer,
  filename: string
): Promise<UploadedFile> {
  const utapi = getUtapi();
  const file = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
  const response = await utapi.uploadFiles([file]);

  if (!response || response.length === 0) {
    throw new Error("Failed to upload image to UploadThing");
  }

  if (response[0].error) {
    throw new Error(`UploadThing error: ${response[0].error.message}`);
  }

  return {
    url: response[0].data.ufsUrl || response[0].data.url,
    key: response[0].data.key,
    name: response[0].data.name,
    size: response[0].data.size,
  };
}

// Upload a PDF
export async function uploadPdf(
  buffer: Buffer,
  filename: string
): Promise<UploadedFile> {
  const utapi = getUtapi();
  const file = new File([new Uint8Array(buffer)], filename, { type: "application/pdf" });
  const response = await utapi.uploadFiles([file]);

  if (!response || response.length === 0) {
    throw new Error("Failed to upload PDF to UploadThing");
  }

  if (response[0].error) {
    throw new Error(`UploadThing error: ${response[0].error.message}`);
  }

  return {
    url: response[0].data.ufsUrl || response[0].data.url,
    key: response[0].data.key,
    name: response[0].data.name,
    size: response[0].data.size,
  };
}

// Generate a short-lived signed URL for a private file (no API call, local only)
export async function getSignedFileUrl(
  fileKey: string,
  expiresIn: number = 300, // 5 minutes default
): Promise<string> {
  const utapi = getUtapi();
  const result = await utapi.generateSignedURL(fileKey, {
    expiresIn,
  });
  return result.ufsUrl;
}

export async function deleteFile(fileKey: string): Promise<void> {
  const utapi = getUtapi();
  await utapi.deleteFiles([fileKey]);
}

export async function listFiles(): Promise<UploadedFile[]> {
  const utapi = getUtapi();
  const result = await utapi.listFiles();
  return result.files.map((file: any) => ({
    url: file.url,
    key: file.key,
    name: file.name,
    size: file.size || 0,
  }));
}

