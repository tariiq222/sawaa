export type EmailBlock =
  | { type: 'heading'; id: string; text: string; level: 1 | 2 | 3 }
  | { type: 'paragraph'; id: string; text: string }
  | { type: 'button'; id: string; text: string; url: string; color?: string }
  | { type: 'divider'; id: string }
  | { type: 'image'; id: string; src: string; alt: string; width?: number }
  | { type: 'spacer'; id: string; height: number };
