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
        orderBy: { createdAt: "desc" },
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.coloringPage.findUnique({
        where: { slug: input.slug },
      });
    }),
});
