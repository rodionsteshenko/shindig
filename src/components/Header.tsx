import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          🎉 Shindig
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Features
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/create"
                className="bg-shindig-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-shindig-700 transition-colors"
              >
                Create Event
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="bg-shindig-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold hover:bg-shindig-700 transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
