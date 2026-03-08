import { getColoringPages } from "./pdf-service";

export interface GeneratedPage {
  id: string;
  prompt: string;
  imageUrl: string;
  fileKey: string;
  createdAt: string;
  approved: boolean | null;
  rejected: boolean;
  pdfUrl?: string;
}

// Simple JSON-based storage using Vercel KV or filesystem
// In production, this should use a proper database like Vercel KV, Redis, or PostgreSQL
const DB_KEY = "daily-doodle-pages";

// For Vercel: use a simple in-memory store with fallback
// In a real deployment, replace this with Vercel KV or similar
let memoryStore: Map<string, GeneratedPage> = new Map();

export async function getStoredPages(): Promise<GeneratedPage[]> {
  try {
    // Try to load from environment-based JSON if available
    const dbJson = process.env.PAGES_DB;
    if (dbJson) {
      const pages = JSON.parse(dbJson);
      return Object.values(pages);
    }

    // Fallback to memory store
    return Array.from(memoryStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error loading pages:", error);
    return [];
  }
}

export async function savePage(page: GeneratedPage): Promise<void> {
  try {
    memoryStore.set(page.id, page);

    // Also save to local JSON file for persistence (in non-Vercel environments)
    if (!process.env.VERCEL) {
      const fs = await import("fs");
      const path = await import("path");
      const dbPath = path.join(process.cwd(), "data", "pages.json");

      // Ensure directory exists
      if (!fs.existsSync(path.dirname(dbPath))) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }

      const existing = fs.existsSync(dbPath)
        ? JSON.parse(fs.readFileSync(dbPath, "utf-8"))
        : {};

      existing[page.id] = page;
      fs.writeFileSync(dbPath, JSON.stringify(existing, null, 2));
    }
  } catch (error) {
    console.error("Error saving page:", error);
    throw error;
  }
}

export async function updatePageApproval(
  id: string,
  approved: boolean
): Promise<void> {
  const page = memoryStore.get(id);
  if (page) {
    page.approved = approved;
    page.rejected = !approved;
    await savePage(page);
  }
}

export async function getPageById(id: string): Promise<GeneratedPage | null> {
  const pages = await getStoredPages();
  return pages.find((p) => p.id === id) || null;
}

export async function deletePage(id: string): Promise<void> {
  memoryStore.delete(id);
}

// Initialize with some sample data if empty (for testing)
export async function initializeDb(): Promise<void> {
  const existing = await getStoredPages();
  if (existing.length === 0) {
    // Load from existing PDFs if available
    try {
      const pdfs = await getColoringPages();
      for (const pdf of pdfs) {
        const id = pdf.filename.replace(".pdf", "");
        await savePage({
          id,
          prompt: "Auto-imported from existing PDF",
          imageUrl: "",
          fileKey: "",
          createdAt: pdf.createdAt.toISOString(),
          approved: null,
          rejected: false,
        });
      }
    } catch (e) {
      console.log("No existing PDFs to import");
    }
  }
}
