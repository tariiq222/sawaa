"use client"

import { useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { blogPostsSchema, type BlogPostsSchema } from "@/lib/schemas/blog-posts.schema"
import {
  BLOG_POST_DEFAULTS,
  BLOG_POSTS_KEY,
  type SiteSettingRow,
  type BlogPostItem,
} from "@/lib/types/site-settings"
import { useUpsertSiteSettings } from "@/hooks/use-site-settings"
import { useLocale } from "@/components/locale-provider"

function buildInitial(rows: SiteSettingRow[]): BlogPostItem[] {
  const row = rows.find((r) => r.key === BLOG_POSTS_KEY)
  if (row?.valueJson && Array.isArray(row.valueJson)) {
    return row.valueJson as BlogPostItem[]
  }
  return BLOG_POST_DEFAULTS
}

function buildEntry(posts: BlogPostItem[]) {
  return { key: BLOG_POSTS_KEY, valueJson: posts }
}

interface Props {
  rows: SiteSettingRow[]
}

export function BlogPostsForm({ rows }: Props) {
  const { t } = useLocale()
  const mutation = useUpsertSiteSettings()
  const form = useForm<BlogPostsSchema>({
    resolver: zodResolver(blogPostsSchema),
    defaultValues: { posts: BLOG_POST_DEFAULTS },
  })
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "posts",
  })

  useEffect(() => {
    form.reset({ posts: buildInitial(rows) })
  }, [rows, form])

  const onSubmit = (values: BlogPostsSchema) => {
    mutation.mutate({ entries: [buildEntry(values.posts)] })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border border-border p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                {t("content.blog.postHeading").replace("{index}", String(index + 1))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                className="text-destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("content.blog.title")}</Label>
                <Input {...form.register(`posts.${index}.title`)} />
                {form.formState.errors.posts?.[index]?.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.posts[index]?.title?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("content.blog.titleEn")}</Label>
                <Input {...form.register(`posts.${index}.titleEn`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.blog.date")}</Label>
                <Input {...form.register(`posts.${index}.date`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.blog.tag")}</Label>
                <Input {...form.register(`posts.${index}.tag`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.blog.tagEn")}</Label>
                <Input {...form.register(`posts.${index}.tagEn`)} />
              </div>
              <div className="space-y-2">
                <Label>{t("content.blog.author")}</Label>
                <Input {...form.register(`posts.${index}.author`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.blog.image")}</Label>
                <Input {...form.register(`posts.${index}.image`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.blog.slug")}</Label>
                <Input {...form.register(`posts.${index}.slug`)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("content.blog.content")}</Label>
                <Textarea rows={6} {...form.register(`posts.${index}.content`)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            slug: "",
            title: "",
            titleEn: "",
            date: "",
            tag: "",
            tagEn: "",
            author: null,
            image: "",
            content: "",
          })
        }
      >
        <HugeiconsIcon icon={Add01Icon} className="w-4 h-4 me-2" />
        {t("content.blog.addPost")}
      </Button>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset({ posts: buildInitial(rows) })}
        >
          {t("content.form.reset")}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t("content.form.saving") : t("content.form.save")}
        </Button>
      </div>
    </form>
  )
}
