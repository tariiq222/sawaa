import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const useLocaleMock = vi.fn<() => { locale: "ar" | "en"; t: (k: string) => string }>(
  () => ({ locale: "en", t: (k: string) => k }),
)
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => useLocaleMock(),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ className }: { className?: string }) => <span data-testid="icon" className={className} />,
}))

import { TopPerformers } from "@/components/features/employees/top-performers"
import type { Employee } from "@/lib/types/employee"

function emp(
  partial: Partial<Employee> & {
    id: string
    firstName: string
    lastName: string
    rating?: number
    bookings?: number
  },
): Employee {
  return {
    id: partial.id,
    ref: 1,
    userId: partial.id + "-u",
    name: `${partial.firstName} ${partial.lastName}`,
    nameAr: null,
    nameEn: `${partial.firstName} ${partial.lastName}`,
    title: null,
    specialty: partial.specialty ?? "Cardiology",
    specialtyAr: "قلب",
    gender: null,
    bio: null,
    bioAr: null,
    education: null,
    educationAr: null,
    experience: null,
    phone: null,
    email: "e@test",
    avatarUrl: null,
    employmentType: "FULL_TIME",
    onboardingStatus: "COMPLETED",
    isActive: true,
    isAcceptingBookings: true,
    isPublic: false,
    slug: null,
    publicBioAr: null,
    publicBioEn: null,
    publicImageUrl: null,
    averageRating: partial.rating ?? null,
    ratingCount: 0,
    bookingCount: partial.bookings ?? 0,
    branchIds: [],
    serviceIds: [],
    availability: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    user: {
      id: partial.id + "-u",
      firstName: partial.firstName,
      lastName: partial.lastName,
      email: "e@test",
      phone: null,
    },
  }
}

describe("TopPerformers", () => {
  it("renders nothing when no employee has a rating > 0", () => {
    const { container } = render(
      <TopPerformers employees={[emp({ id: "1", firstName: "A", lastName: "B" })]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders only the top 3 by rating, in descending order", () => {
    const employees = [
      emp({ id: "1", firstName: "Low", lastName: "Mid", rating: 3.1 }),
      emp({ id: "2", firstName: "Zero", lastName: "Rating", rating: 0 }), // filtered out
      emp({ id: "3", firstName: "Top", lastName: "Star", rating: 4.9 }),
      emp({ id: "4", firstName: "Second", lastName: "Best", rating: 4.5 }),
      emp({ id: "5", firstName: "Fourth", lastName: "Place", rating: 3.8 }),
    ]
    render(<TopPerformers employees={employees} />)
    const names = screen.getAllByText(/Star|Best|Place|Mid|Rating/).map((n) => n.textContent)
    expect(names[0]).toBe("Top Star")
    expect(names[1]).toBe("Second Best")
    expect(names[2]).toBe("Fourth Place")
    expect(names).toHaveLength(3)
  })

  it("renders the rating to one decimal and the bookings count", () => {
    render(
      <TopPerformers
        employees={[emp({ id: "1", firstName: "Ali", lastName: "H", rating: 4, bookings: 12 })]}
      />,
    )
    expect(screen.getByText("4.0")).toBeTruthy()
    expect(screen.getByText(/12 employees\.card\.bookings/)).toBeTruthy()
  })

  it("falls back to Arabic specialty when locale is ar", () => {
    useLocaleMock.mockReturnValueOnce({ locale: "ar", t: (k) => k })
    render(
      <TopPerformers
        employees={[emp({ id: "1", firstName: "Ali", lastName: "H", rating: 4.5 })]}
      />,
    )
    expect(screen.getByText("قلب")).toBeTruthy()
  })

  it("shows an em-dash when the active-locale specialty is null/undefined", () => {
    const e = emp({ id: "1", firstName: "Ali", lastName: "H", rating: 4.5 })
    // Component uses `?? "—"` — falls back only on null/undefined, not empty string.
    ;(e as { specialty: string | null }).specialty = null
    e.specialtyAr = null
    useLocaleMock.mockReturnValueOnce({ locale: "en", t: (k) => k })
    render(<TopPerformers employees={[e]} />)
    expect(screen.getByText("—")).toBeTruthy()
  })

  it("defaults bookings count to 0 when _count is missing", () => {
    render(
      <TopPerformers
        employees={[emp({ id: "1", firstName: "Ali", lastName: "H", rating: 4.0 })]}
      />,
    )
    expect(screen.getByText(/0 employees\.card\.bookings/)).toBeTruthy()
  })
})
