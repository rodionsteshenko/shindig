import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ApiKeysList from "@/components/ApiKeysList";
import type { ApiKey } from "@/lib/types";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminClient = createAdminClient();
  const { data: apiKeys } = await adminClient
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-gray-600 mt-1">
            Manage your API keys for programmatic access to Shindig.
          </p>
        </div>
      </div>

      <ApiKeysList initialKeys={(apiKeys as Omit<ApiKey, "key_hash" | "user_id">[]) ?? []} />
    </div>
  );
}
