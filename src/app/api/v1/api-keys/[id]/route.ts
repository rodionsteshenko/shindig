import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { success, error, sanitizeError } from "@/lib/apiResponse";
import type { ApiKey } from "@/lib/types";

/**
 * DELETE /api/v1/api-keys/[id]
 *
 * Revokes (deletes) an API key. Session auth only.
 * Verifies the key belongs to the authenticated user before deletion.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Session auth only - revoking API keys requires full user auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return error("Unauthorized", 401);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return error("Invalid API key ID format", 400);
  }

  const adminClient = createAdminClient();

  try {
    // First, verify the key exists and belongs to this user
    const { data: existingKey, error: lookupError } = await adminClient
      .from("api_keys")
      .select("id, user_id")
      .eq("id", id)
      .single<Pick<ApiKey, "id" | "user_id">>();

    if (lookupError || !existingKey) {
      return error("API key not found", 404);
    }

    // Verify ownership
    if (existingKey.user_id !== user.id) {
      // Return 404 to avoid leaking information about other users' keys
      return error("API key not found", 404);
    }

    // Delete the key
    const { error: deleteError } = await adminClient
      .from("api_keys")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return error(sanitizeError(deleteError), 400);
    }

    return success({ deleted: true, id });
  } catch (err) {
    return error(sanitizeError(err), 500);
  }
}
