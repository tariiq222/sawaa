import Image from "next/image"

interface SawaaMarkProps {
  /** Pixel size of the mark (square). Default 40. */
  size?: number
}

export function SawaaMark({ size = 40 }: SawaaMarkProps) {
  const inner = Math.round(size * 0.72)
  return (
    <div
      aria-hidden="true"
      className="relative flex aspect-square items-center justify-center rounded-[16px] bg-primary/[0.10] ring-1 ring-primary/20"
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-dark.png"
        alt=""
        width={inner}
        height={inner}
        priority
        className="object-contain"
      />
    </div>
  )
}
