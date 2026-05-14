/**
 * Email Template Types — Deqah Dashboard
 */

export type EmailBlock =
  | { type: 'heading'; id: string; text: string; level: 1 | 2 | 3 }
  | { type: 'paragraph'; id: string; text: string }
  | { type: 'button'; id: string; text: string; url: string; color?: string }
  | { type: 'divider'; id: string }
  | { type: 'image'; id: string; src: string; alt: string; width?: number }
  | { type: 'spacer'; id: string; height: number }

export interface EmailTemplate {
  id: string
  slug: string
  name: string
  subject: string
  htmlBody: string
  blocks: EmailBlock[] | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UpdateEmailTemplatePayload {
  name?: string
  subject?: string
  htmlBody?: string
  blocks?: EmailBlock[]
  isActive?: boolean
}

export interface TemplatePreviewPayload {
  context: Record<string, unknown>
}

export interface TemplatePreviewResult {
  subject: string
  body: string
}
