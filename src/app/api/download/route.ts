import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPdfDirectory, getDownloadUrl } from '@/lib/pdf-service';

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('file');

  if (!filename) {
    return NextResponse.json({ error: 'No file specified' }, { status: 400 });
  }

  const safeFilename = path.basename(filename);

  // First try UploadThing
  const uploadThingUrl = await getDownloadUrl(safeFilename);
  if (uploadThingUrl) {
    // Redirect to the UploadThing URL (faster, no bandwidth on our server)
    return NextResponse.redirect(uploadThingUrl);
  }

  // Fallback to local filesystem
  const pdfDir = getPdfDirectory();
  const filePath = path.join(pdfDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
    },
  });
}
