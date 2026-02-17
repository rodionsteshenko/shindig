import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSlug } from "@/lib/utils";
import { validateEventInput, validateSlug, validateCustomFields, MAX_EVENTS_PER_ACCOUNT } from "@/lib/validation";
import { sanitizeError } from "@/lib/apiResponse";
import type { CustomFieldConfig } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate input
  const validation = validateEventInput(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
  }

  // Validate custom fields if provided
  const customFields = body.custom_fields;
  if (customFields !== undefined) {
    if (!Array.isArray(customFields)) {
      return NextResponse.json({ error: "Validation failed", errors: { custom_fields: "Must be an array" } }, { status: 400 });
    }
    const cfValidation = validateCustomFields(customFields);
    if (!cfValidation.valid) {
      return NextResponse.json({ error: "Validation failed", errors: { custom_fields: cfValidation.errors } }, { status: 400 });
    }
  }

  // Check account limits
  const { count } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("host_id", user.id);

  if (count != null && count >= MAX_EVENTS_PER_ACCOUNT) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_EVENTS_PER_ACCOUNT} events` },
      { status: 400 }
    );
  }

  // Use custom slug if provided and valid, otherwise auto-generate
  let slug: string;
  if (body.slug && typeof body.slug === "string" && body.slug.trim()) {
    const customSlug = body.slug.trim();
    // Validate slug format
    const slugValidation = validateSlug(customSlug);
    if (!slugValidation.valid) {
      return NextResponse.json(
        { error: "Validation failed", errors: slugValidation.errors },
        { status: 400 }
      );
    }
    // Check if slug is already taken
    const { data: existingEvent } = await supabase
      .from("events")
      .select("id")
      .eq("slug", customSlug)
      .maybeSingle();
    if (existingEvent) {
      return NextResponse.json(
        { error: "Validation failed", errors: { slug: "This URL is already taken" } },
        { status: 400 }
      );
    }
    slug = customSlug;
  } else {
    slug = generateSlug(body.title);
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .insert({
        host_id: user.id,
        title: body.title,
        description: body.description,
        location: body.location,
        maps_url: body.maps_url,
        cover_image_url: body.cover_image_url,
        start_time: body.start_time,
        end_time: body.end_time,
        timezone: body.timezone,
        slug,
        is_public: body.is_public,
        allow_plus_ones: body.allow_plus_ones,
        gift_registry_url: body.gift_registry_url,
        gift_message: body.gift_message,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeError(error) }, { status: 400 });
    }

    // Insert custom fields if provided
    if (Array.isArray(customFields) && customFields.length > 0) {
      const fieldsToInsert = customFields.map((field, index) => ({
        event_id: data.id,
        type: field.type,
        label: field.label,
        description: field.description || null,
        required: field.required ?? false,
        sort_order: field.sort_order ?? index,
        options: field.options || null,
        config: (field.config || {}) as CustomFieldConfig,
      }));

      const { error: cfError } = await supabase
        .from("event_custom_fields")
        .insert(fieldsToInsert);

      if (cfError) {
        // Clean up the event if custom fields failed to insert
        await supabase.from("events").delete().eq("id", data.id);
        return NextResponse.json({ error: sanitizeError(cfError) }, { status: 400 });
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
  }
}
