import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/components/EventForm";
import type { Event } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("host_id", user.id)
    .single();

  if (!event) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href={`/dashboard/${id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
        &larr; Back to event
      </Link>
      <h1 className="text-3xl font-bold mb-8">Edit Event</h1>
      <EventForm event={event as Event} />
    </div>
  );
}
