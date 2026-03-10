import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const coloringPageRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z
        .object({
          cursor: z.string().nullish(),
          limit: z.number().min(1).max(50).default(20),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.coloringPage.findMany({
        take: input.limit + 1,
        where: { approved: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          imageUrl: true,
          pdfKey: true,
          createdAt: true,
          updatedAt: true,
        },
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      // Return proxy URLs instead of raw UploadThing URLs
      const safeItems = items.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        hasImage: !!item.imageUrl,
        previewUrl: item.imageUrl ? `/api/preview?id=${item.id}` : null,
        downloadUrl: item.pdfKey ? `/api/download?id=${item.id}&type=pdf` : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      return { items: safeItems, nextCursor };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.coloringPage.findFirst({
        where: { slug: input.slug, approved: true },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          imageUrl: true,
          pdfKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!page) return null;

      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        description: page.description,
        hasImage: !!page.imageUrl,
        previewUrl: page.imageUrl ? `/api/preview?id=${page.id}` : null,
        downloadUrl: page.pdfKey ? `/api/download?id=${page.id}&type=pdf` : null,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      };
    }),
});
