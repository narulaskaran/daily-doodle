"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

export function GalleryGrid() {
  const { data, isLoading } = api.coloringPage.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-[8.5/11] w-full" />
            <CardContent className="p-3">
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const pages = data?.items ?? [];

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No coloring pages yet</h2>
        <p className="text-muted-foreground">
          Check back soon for new coloring pages!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {pages.map((page) => (
        <Link key={page.id} href={`/pages/${page.slug}`}>
          <Card className="overflow-hidden transition-shadow hover:shadow-lg">
            {page.imageUrl ? (
              <img
                src={`/api/preview?id=${page.id}`}
                alt={page.title}
                className="aspect-[8.5/11] w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-[8.5/11] items-center justify-center bg-muted">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <CardContent className="p-3">
              <p className="truncate text-sm font-medium">{page.title}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
