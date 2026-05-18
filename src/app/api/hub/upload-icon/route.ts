import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("staff")
    .select("role")
    .eq("email", session.user?.email ?? "")
    .single();
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image file" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Max file size is 2MB" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Create bucket if it doesn't exist yet
  await supabaseAdmin.storage.createBucket("hub-icons", { public: true }).catch(() => {});

  const { error } = await supabaseAdmin.storage
    .from("hub-icons")
    .upload(filename, buffer, { contentType: file.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("hub-icons")
    .getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
