export interface Clinic {
  slug: string;
  name: string;
  desc: string;
  icon: string;
  image: string;
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
}

export interface BlogPost {
  title: string;
  date: string;
  author?: string;
  tag: string;
  image: string;
}

export interface Testimonial {
  text: string;
  name: string;
  label: string;
  letter: string;
}

export interface FaqItem {
  q: string;
  a: string;
}
