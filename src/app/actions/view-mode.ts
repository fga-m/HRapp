"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function enableStaffView() {
  const store = await cookies();
  store.set("fga_view_as_staff", "1", { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/dashboard", "layout");
}

export async function disableStaffView() {
  const store = await cookies();
  store.delete("fga_view_as_staff");
  revalidatePath("/dashboard", "layout");
}
