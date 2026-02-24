import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeError } from "@/lib/apiResponse";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * POST /api/events/manage/[id]/cover
 *
 * Upload a cover image for an event.
 * Accepts multipart/form-data with a "file" field.
 * Stores in Supabase Storage "event-covers" bucket.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify event ownership
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Parse the form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: PNG, JPEG, WebP, GIF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB" },
      { status: 400 }
    );
  }

  // Determine file extension
  const ext = file.type === "image/png" ? ".png"
    : file.type === "image/jpeg" ? ".jpg"
    : file.type === "image/webp" ? ".webp"
    : ".gif";

  const storagePath = `${id}/cover${ext}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Upload to Supabase Storage using admin client (bypasses RLS)
  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("event-covers")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: sanitizeError(uploadError) },
      { status: 500 }
    );
  }

  // Get the public URL
  const { data: urlData } = adminClient.storage
    .from("event-covers")
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // Update the event
  const { error: updateError } = await supabase
    .from("events")
    .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: sanitizeError(updateError) },
      { status: 500 }
    );
  }

  return NextResponse.json({ cover_image_url: publicUrl });
}
