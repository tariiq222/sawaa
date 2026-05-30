import { z } from "zod"

export const blogPostSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  titleEn: z.string().min(1),
  date: z.string().min(1),
  tag: z.string().min(1),
  tagEn: z.string().min(1),
  author: z.string().nullable(),
  image: z.string().min(1),
  content: z.string(),
})

export const blogPostsSchema = z.object({
  posts: z.array(blogPostSchema).min(1).max(20),
})

export type BlogPostSchema = z.infer<typeof blogPostSchema>
export type BlogPostsSchema = z.infer<typeof blogPostsSchema>
