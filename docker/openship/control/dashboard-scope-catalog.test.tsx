// @vitest-environment happy-dom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {baseDictionary} from "@/i18n";
import {permissionsApi} from "@/lib/api";
import {AccessEditorModal} from "./AccessEditorModal";
const stableToast=vi.hoisted(()=>vi.fn());
vi.mock("@/context/ToastContext",()=>({useToast:()=>({showToast:stableToast})}));
vi.mock("@/components/i18n-provider",async(importOriginal)=>({...await importOriginal<typeof import("@/components/i18n-provider")>(),useI18n:()=>({t:baseDictionary})}));
it("keeps a fetched project selectable after catalog labels update",async()=>{
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 const selected:unknown[]=[];
 const list=vi.spyOn(permissionsApi,"listResources").mockResolvedValueOnce({data:[{id:"proj_staging",label:"Sawaa Staging",meta:{slug:"sawaa-staging"}}]}).mockImplementation(()=>new Promise(()=>{}));
 try{
  await act(async()=>root.render(<AccessEditorModal title="Token scope" initial={[]} availableTypes={["project"]} show={{templates:false,readOnlySwitch:false,createCapability:false}} onSave={g=>{selected.push(g);}} onClose={()=>{}} />));
  expect(host.textContent).toContain("Sawaa Staging");
  const checkbox=host.querySelector<HTMLButtonElement>('button[role="checkbox"]');expect(checkbox).not.toBeNull();
  await act(async()=>checkbox!.click());
  const save=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==="Save");expect(save).toBeDefined();
  await act(async()=>save!.click());
  expect(selected).toHaveLength(1);
  expect(selected[0]).toEqual([{resourceType:"project",resourceId:"proj_staging",permissions:["read", "write"]}]);
 }finally{await act(async()=>root.unmount());host.remove();list.mockRestore();vi.unstubAllGlobals();}
});
