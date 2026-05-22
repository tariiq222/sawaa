export interface Clinic {
  slug: string;
  name: string;
  desc: string;
  icon: string;
  image: string;
  nameEn?: string;
  descEn?: string;
}

export type GroupFormat = 'حضوري' | 'عن بُعد' | 'مختلط';

export interface SupportGroup {
  slug: string;
  name: string;
  desc: string;
  icon: string;
  image: string;
  participants: string;
  sessions: string;
  format: GroupFormat;
  nameEn?: string;
  descEn?: string;
  participantsEn?: string;
  sessionsEn?: string;
  formatEn?: string;
}

export interface Therapist {
  slug: string;
  name: string;
  role: string;
  badge: string;
  exp: string;
  letter: string;
  image?: string;
  clinicSlugs: string[];
  nameEn?: string;
  roleEn?: string;
}

export interface BlogPost {
  title: string;
  date: string;
  author?: string;
  tag: string;
  image: string;
  titleEn?: string;
  tagEn?: string;
}

export interface Testimonial {
  text: string;
  name: string;
  label: string;
  letter: string;
  textEn?: string;
  nameEn?: string;
  labelEn?: string;
}

export interface FaqItem {
  q: string;
  a: string;
  qEn?: string;
  aEn?: string;
}
