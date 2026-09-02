// Supabase Edge Function: Process Scheduled Notifications
// Deploy to Supabase and trigger via HTTP or cron

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process all pending notification jobs
    const { data: pendingJobs, error: fetchErr } = await supabase
      .from("notification_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(100);

    if (fetchErr) throw fetchErr;

    let processed = 0;
    let failed = 0;

    for (const job of pendingJobs || []) {
      try {
        let sent = false;

        if (job.job_type === "booking_reminder_12h") {
          sent = await sendBookingReminder12h(supabase, job.booking_id);
        } else if (job.job_type === "booking_reminder_1h") {
          sent = await sendBookingReminder1h(supabase, job.booking_id);
        } else if (job.job_type === "weekly_earnings") {
          sent = await sendWeeklyEarnings(supabase, job.user_id);
        }

        // Mark job as executed
        await supabase
          .from("notification_jobs")
          .update({
            status: sent ? "executed" : "skipped",
            executed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        if (sent) processed++;
      } catch (jobErr: any) {
        // Mark job as failed
        await supabase
          .from("notification_jobs")
          .update({
            status: "failed",
            error_message: jobErr.message,
            executed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingJobs?.length || 0,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Helper functions

async function sendBookingReminder12h(
  supabase: any,
  bookingId: string
): Promise<boolean> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `id, sitter_id, pet_parent_id, pet_profiles(name),
       sitter_profiles(users(name, phone)), users(phone, email)`
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking) return false;

  // Create in-app notifications
  await supabase.from("notifications").insert([
    {
      user_id: booking.sitter_id,
      type: "booking_reminder_12h",
      title: "⏰ Booking Tomorrow",
      body: `Don't forget: ${booking.pet_profiles?.name || "Your pet"}'s walk tomorrow at the scheduled time`,
    },
    {
      user_id: booking.pet_parent_id,
      type: "booking_reminder_12h",
      title: "⏰ Walk Tomorrow",
      body: `${booking.sitter_profiles?.users?.name || "Your sitter"} is confirmed tomorrow`,
    },
  ]);

  return true;
}

async function sendBookingReminder1h(
  supabase: any,
  bookingId: string
): Promise<boolean> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `id, sitter_id, pet_parent_id, scheduled_time, pet_profiles(name),
       sitter_profiles(users(name, phone)), users(phone, email)`
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking) return false;

  // Create in-app notifications (urgent)
  await supabase.from("notifications").insert([
    {
      user_id: booking.sitter_id,
      type: "booking_reminder_1h",
      title: "🚶 Walk Starting Soon",
      body: `${booking.pet_profiles?.name || "Your pet"}'s walk is in 1 hour!`,
    },
    {
      user_id: booking.pet_parent_id,
      type: "booking_reminder_1h",
      title: "🚶 Sitter Arriving Soon",
      body: `${booking.sitter_profiles?.users?.name || "Your sitter"} will arrive in about 1 hour`,
    },
  ]);

  return true;
}

async function sendWeeklyEarnings(
  supabase: any,
  userId: string
): Promise<boolean> {
  // Get sitter profile and weekly stats
  const { data: sitter, error: sitterErr } = await supabase
    .from("sitter_profiles")
    .select("id, rating, users(name, email, phone)")
    .eq("user_id", userId)
    .single();

  if (sitterErr || !sitter) return false;

  // Get bookings from past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: bookings, error: bookingErr } = await supabase
    .from("bookings")
    .select("gross_amount_paise, rating")
    .eq("sitter_id", sitter.id)
    .eq("status", "completed")
    .gte("completed_at", sevenDaysAgo);

  if (bookingErr) return false;

  const walkCount = bookings?.length || 0;
  const totalEarnings = (bookings || []).reduce(
    (sum: number, b: any) => sum + (b.gross_amount_paise || 0),
    0
  );
  const sitterEarnings = Math.round(totalEarnings * 0.85); // 85% goes to sitter
  const avgRating = bookings?.length
    ? bookings.reduce((sum: number, b: any) => sum + (b.rating || 5), 0) /
      bookings.length
    : sitter.rating || 5.0;

  // Create in-app notification
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "weekly_earnings",
    title: "📊 Weekly Summary",
    body: `${walkCount} walks, Rs.${Math.round(sitterEarnings / 100)} earned, ${avgRating.toFixed(1)}⭐`,
  });

  return true;
}
