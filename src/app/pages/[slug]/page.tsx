import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await api.coloringPage.getBySlug({ slug });
  if (!page) return { title: "Not Found | Daily Doodle" };
  return {
    title: `${page.title} | Daily Doodle`,
    description: page.description ?? `Download "${page.title}" coloring page`,
  };
}

export default async function ColoringPageDetail({ params }: Props) {
  const { slug } = await params;
  const page = await api.coloringPage.getBySlug({ slug });
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Gallery
        </Button>
      </Link>

      <h1 className="mb-4 text-3xl font-bold">{page.title}</h1>

      {page.description && (
        <p className="mb-6 text-muted-foreground">{page.description}</p>
      )}

      {page.previewUrl && (
        <img
          src={page.previewUrl}
          alt={page.title}
          className="mb-6 w-full max-w-md rounded-lg border"
        />
      )}

      {page.downloadUrl && (
        <a href={page.downloadUrl} target="_blank" rel="noopener noreferrer">
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </a>
      )}
    </main>
  );
}
