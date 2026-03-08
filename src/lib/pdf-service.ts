import { listFiles, type UploadedFile } from './uploadthing';

export interface ColoringPage {
  filename: string;
  path: string;
  createdAt: Date;
  url: string;
  key: string;
}

// Get coloring pages from UploadThing (only source - fully cloud-native)
export async function getColoringPages(): Promise<ColoringPage[]> {
  if (!process.env.UPLOADTHING_TOKEN) {
    console.warn('UPLOADTHING_TOKEN not configured');
    return [];
  }

  try {
    const files = await listFiles();
    const pdfFiles = files
      .filter(f => f.name.toLowerCase().endsWith('.pdf'))
      .map(file => ({
        filename: file.name,
        path: file.url,
        createdAt: new Date(), // UploadThing doesn't provide creation date
        url: file.url,
        key: file.key,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return pdfFiles;
  } catch (error) {
    console.error('Error fetching from UploadThing:', error);
    return [];
  }
}

// Get PNG images (generated coloring sheets)
export async function getColoringImages(): Promise<ColoringPage[]> {
  if (!process.env.UPLOADTHING_TOKEN) {
    return [];
  }

  try {
    const files = await listFiles();
    const imageFiles = files
      .filter(f => f.name.toLowerCase().endsWith('.png'))
      .map(file => ({
        filename: file.name,
        path: file.url,
        createdAt: new Date(),
        url: file.url,
        key: file.key,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return imageFiles;
  } catch (error) {
    console.error('Error fetching images from UploadThing:', error);
    return [];
  }
}

// Legacy compatibility
export async function getLocalColoringPages(): Promise<ColoringPage[]> {
  return getColoringPages();
}

export function getPdfDirectory(): string {
  return '/tmp/coloring-pages';
}

export async function getDownloadUrl(filename: string): Promise<string | null> {
  if (!process.env.UPLOADTHING_TOKEN) {
    return null;
  }

  try {
    const files = await listFiles();
    const file = files.find(f => f.name === filename);
    return file?.url || null;
  } catch (error) {
    console.error('Error getting download URL:', error);
    return null;
  }
}
