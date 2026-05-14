export function DeqahMark() {
  return (
    <div
      aria-hidden="true"
      className="relative flex aspect-square size-10 items-center justify-center rounded-[16px] bg-primary text-primary-foreground shadow-primary"
    >
      <span className="translate-y-[-1px] text-xl font-bold leading-none">س</span>
      <span className="absolute bottom-2 h-1 w-4 rounded-full bg-accent" />
    </div>
  );
}
