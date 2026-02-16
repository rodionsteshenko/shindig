import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/components/EventForm";

export default async function CreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Create an Event</h1>
      <EventForm />
    </div>
  );
}
