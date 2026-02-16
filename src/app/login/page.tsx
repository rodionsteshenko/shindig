import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Link href="/" className="text-3xl font-bold mb-8">
        🎉 Shindig
      </Link>
      <h1 className="text-2xl font-bold mb-2">Sign in</h1>
      <p className="text-gray-600 mb-8">Enter your email to get a magic link</p>
      <LoginForm />
    </div>
  );
}
