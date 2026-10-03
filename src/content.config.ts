import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './constants';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    draft: z.boolean().default(false),
    sourcePath: z.string().optional(),
    slug: z.string().optional(),
    // 来自 vault 的 Obsidian cssclasses，用于给单篇文章加样式（见 PostLayout 的 CSS）
    cssclasses: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
