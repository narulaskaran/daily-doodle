import { NextRequest, NextResponse } from "next/server";
import { uploadPdf, type UploadedFile } from "@/lib/uploadthing";

// POST - Upload a PDF to UploadThing for cloud storage
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const apiKey = request.headers.get("GENERATE_API_KEY");
    const expectedKey = process.env.GENERATE_API_KEY;

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing API key" },
        { status: 401 }
      );
    }

    // Check if UploadThing is configured
    if (!process.env.UPLOADTHING_TOKEN) {
      return NextResponse.json(
        { error: "UploadThing not configured: UPLOADTHING_TOKEN missing" },
        { status: 500 }
      );
    }

    // Get the PDF file from the request
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to UploadThing
    const filename = file.name || `coloring-page-${Date.now()}.pdf`;
    const uploaded: UploadedFile = await uploadPdf(buffer, filename);

    return NextResponse.json({
      success: true,
      file: {
        url: uploaded.url,
        key: uploaded.key,
        name: uploaded.name,
        size: uploaded.size,
      },
    });
  } catch (error) {
    console.error("PDF upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET - Check UploadThing status
export async function GET() {
  const configured = !!process.env.UPLOADTHING_TOKEN;
  
  return NextResponse.json({
    message: "PDF Upload API",
    status: configured ? "ready" : "not_configured",
    uploadthing: configured ? "configured" : "missing_token",
  });
}