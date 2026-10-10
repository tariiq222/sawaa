import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
const { canDo } = vi.hoisted(() => ({canDo:vi.fn((module:string,action:string)=>module==='booking' && action!=='manage')}))
vi.mock("@/components/providers/auth-provider",()=>({useAuth:()=>({canDo})}))
vi.mock("@/components/locale-provider",()=>({useLocale:()=>({t:(k:string)=>k})}))
vi.mock("@/components/features/breadcrumbs",()=>({Breadcrumbs:()=>null}))
vi.mock("@/components/features/programs/program-form-page",()=>({ProgramFormPage:()=> <form aria-label="program-editor" />}))
vi.mock("@/hooks/use-programs",()=>({usePrograms:()=>({data:[],isLoading:false,isError:false})}))
import ProgramsPage from "@/app/(dashboard)/programs/page"
import NewProgramPage from "@/app/(dashboard)/programs/create/page"
import EditProgramRoute from "@/app/(dashboard)/programs/[id]/edit/page"
describe("program route write permissions",()=>{
  it("hides the creation link from readers",()=>{
    render(<ProgramsPage />)
    expect(screen.queryByRole("link",{name:"programs.create"})).toBeNull()
  })
  it("denies creation to a reader without backend manage permission",()=>{
    render(<NewProgramPage />)
    expect(screen.queryByRole("form")).toBeNull()
    expect(screen.getByText("common.noPermission")).toBeVisible()
  })
  it("denies editing to a reader without backend manage permission",async()=>{
    render(await EditProgramRoute({params:Promise.resolve({id:"p1"})}))
    expect(screen.queryByRole("form")).toBeNull()
    expect(screen.getByText("common.noPermission")).toBeVisible()
  })
})
