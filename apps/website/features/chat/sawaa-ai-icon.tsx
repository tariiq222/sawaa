import { MessageCircle } from 'lucide-react';

const SIZE_STYLES = {
  sm: { frame: 'size-7 rounded-lg', bubble: 21, label: 'text-[0.42rem]' },
  md: { frame: 'size-10 rounded-xl', bubble: 29, label: 'text-[0.5rem]' },
  lg: { frame: 'size-11 rounded-[0.9rem]', bubble: 32, label: 'text-[0.54rem]' },
} as const;

export function SawaaAiIcon({ size = 'md' }: { size?: keyof typeof SIZE_STYLES }) {
  const styles = SIZE_STYLES[size];

  return (
    <span
      data-ai-chat-icon="ai-chat-bubble"
      aria-hidden="true"
      className={`relative inline-grid shrink-0 place-items-center bg-[var(--sw-primary-50)] text-[var(--sw-primary-600)] ${styles.frame}`}
    >
      <MessageCircle
        className="absolute lucide-message-circle"
        size={styles.bubble}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <span className={`relative -translate-y-px font-black leading-none tracking-[-0.08em] ${styles.label}`}>
        AI
      </span>
    </span>
  );
}
