/**
 * Blog-posts zod schema — unit tests.
 *
 * Covers:
 *  - blogPostSchema: required bilingual fields (title/titleEn), tag, image,
 *    content (no min length — empty content is allowed for placeholder posts),
 *    nullable author.
 *  - blogPostsSchema: 1-20 items bound (the dashboard list view caps at 20).
 */

import { describe, it, expect } from "vitest"
import {
  blogPostSchema,
  blogPostsSchema,
} from "@/lib/schemas/blog-posts.schema"

function validPost() {
  return {
    slug: "post-1",
    title: "مقال تجريبي",
    titleEn: "Test post",
    date: "2026-06-01",
    tag: "عام",
    tagEn: "General",
    author: "سارة",
    image: "/uploads/blog/post-1.jpg",
    content: "محتوى المقال",
  }
}

describe("blogPostSchema", () => {
  it("accepts a valid post", () => {
    const r = blogPostSchema.safeParse(validPost())
    expect(r.success).toBe(true)
  })

  it("accepts a null author (anonymous posts are allowed)", () => {
    const r = blogPostSchema.safeParse({ ...validPost(), author: null })
    expect(r.success).toBe(true)
  })

  it("accepts an empty content (placeholder posts)", () => {
    const r = blogPostSchema.safeParse({ ...validPost(), content: "" })
    expect(r.success).toBe(true)
  })

  it("rejects a missing title", () => {
    const { title: _title, ...rest } = validPost()
    const r = blogPostSchema.safeParse(rest)
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("title")
    }
  })

  it("rejects an empty titleEn", () => {
    const r = blogPostSchema.safeParse({ ...validPost(), titleEn: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("titleEn")
    }
  })

  it("rejects an empty slug", () => {
    const r = blogPostSchema.safeParse({ ...validPost(), slug: "" })
    expect(r.success).toBe(false)
  })

  it("rejects an empty image", () => {
    const r = blogPostSchema.safeParse({ ...validPost(), image: "" })
    expect(r.success).toBe(false)
  })
})

describe("blogPostsSchema", () => {
  it("accepts a single-post list", () => {
    const r = blogPostsSchema.safeParse({ posts: [validPost()] })
    expect(r.success).toBe(true)
  })

  it("accepts up to 20 posts", () => {
    const r = blogPostsSchema.safeParse({
      posts: Array.from({ length: 20 }, (_, i) => ({
        ...validPost(),
        slug: `post-${i}`,
      })),
    })
    expect(r.success).toBe(true)
  })

  it("rejects an empty list (must show ≥ 1 post on the public blog)", () => {
    const r = blogPostsSchema.safeParse({ posts: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("posts")
    }
  })

  it("rejects more than 20 posts (dashboard list cap)", () => {
    const r = blogPostsSchema.safeParse({
      posts: Array.from({ length: 21 }, (_, i) => ({
        ...validPost(),
        slug: `post-${i}`,
      })),
    })
    expect(r.success).toBe(false)
  })

  it("rejects when any post in the list is invalid", () => {
    const r = blogPostsSchema.safeParse({
      posts: [validPost(), { ...validPost(), title: "" }],
    })
    expect(r.success).toBe(false)
  })
})
