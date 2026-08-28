// supabase/functions/send-booking-email/index.ts
// Sends booking confirmation emails to both the pet parent and the sitter.
// Called after payment succeeds. Uses Resend (server-side, no CORS issue).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Fursday <noreply@fursday.in>";

const SERVICE_NAMES: Record<string, string> = {
  walk30: "Dog walk",
  boarding: "Home boarding",
  daycare: "Doggy daycare",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function money(paise: number) {
  return "Rs." + Math.round((paise || 0) / 100);
}

function parentEmail(b: any) {
  const svc = SERVICE_NAMES[b.service_type] || b.service_type;
  const dateLine = b.end_date
    ? `${b.scheduled_date} to ${b.end_date}`
    : `${b.scheduled_date} at ${b.scheduled_time}`;
  return `
  <div style="font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff">
    <div style="background:#FF6B35;padding:28px 24px;border-radius:0 0 16px 16px">
      <div style="font-size:22px;font-weight:800;color:#fff">fursday 🐾</div>
    </div>
    <div style="padding:28px 24px">
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 8px">Your booking is confirmed!</h1>
      <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px">
        Hi ${b.parent_name || "there"}, your ${svc.toLowerCase()} with ${b.sitter_name || "your care pro"} is booked. Here are the details:
      </p>
      <div style="background:#F8F8F8;border-radius:12px;padding:18px;margin-bottom:20px">
        <table style="width:100%;font-size:14px;color:#1a1a1a">
          <tr><td style="padding:6px 0;color:#888">Booking ref</td><td style="padding:6px 0;text-align:right;font-weight:600">${b.booking_ref || "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Service</td><td style="padding:6px 0;text-align:right;font-weight:600">${svc}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Care pro</td><td style="padding:6px 0;text-align:right;font-weight:600">${b.sitter_name || "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#888">When</td><td style="padding:6px 0;text-align:right;font-weight:600">${dateLine}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Amount paid</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#FF6B35">${money(b.gross_amount_paise)}</td></tr>
        </table>
      </div>
      ${b.start_otp ? `
      <div style="background:#FFF0EB;border-radius:12px;padding:16px;margin-bottom:20px;text-align:center">
        <div style="font-size:12px;color:#888;margin-bottom:6px">Your start code — show this to your care pro</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:8px;color:#FF6B35">${b.start_otp}</div>
      </div>` : ""}
      <p style="font-size:13px;color:#888;line-height:1.6">
        Track everything in the Fursday app. Questions? Reply to this email or reach us on WhatsApp.
      </p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #F0F0F0;font-size:12px;color:#BBB;text-align:center">
      Fursday · Trusted pet care in India · Made with 🐾
    </div>
  </div>`;
}

function sitterEmail(b: any) {
  const svc = SERVICE_NAMES[b.service_type] || b.service_type;
  const dateLine = b.end_date
    ? `${b.scheduled_date} to ${b.end_date}`
    : `${b.scheduled_date} at ${b.scheduled_time}`;
  return `
  <div style="font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff">
    <div style="background:#0f0f1a;padding:28px 24px;border-radius:0 0 16px 16px">
      <div style="font-size:22px;font-weight:800;color:#fff">fursday 🐾 <span style="font-size:13px;color:#FF6B35;font-weight:600">Pro</span></div>
    </div>
    <div style="padding:28px 24px">
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 8px">New booking — payment received 🎉</h1>
      <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px">
        Hi ${b.sitter_name || "there"}, ${b.parent_name || "a pet parent"} has booked and paid for a ${svc.toLowerCase()}. Get ready!
      </p>
      <div style="background:#F8F8F8;border-radius:12px;padding:18px;margin-bottom:20px">
        <table style="width:100%;font-size:14px;color:#1a1a1a">
          <tr><td style="padding:6px 0;color:#888">Booking ref</td><td style="padding:6px 0;text-align:right;font-weight:600">${b.booking_ref || "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Service</td><td style="padding:6px 0;text-align:right;font-weight:600">${svc}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Pet parent</td><td style="padding:6px 0;text-align:right;font-weight:600">${b.parent_name || "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#888">When</td><td style="padding:6px 0;text-align:right;font-weight:600">${dateLine}</td></tr>
          <tr><td style="padding:6px 0;color:#888">You earn</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#2E7D32">${money(b.gross_amount_paise)}</td></tr>
        </table>
      </div>
      <p style="font-size:13px;color:#888;line-height:1.6">
        Open the Fursday app to see the pet details and message ${b.parent_name || "the parent"}. When you arrive, ask for their start code to begin.
      </p>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #F0F0F0;font-size:12px;color:#BBB;text-align:center">
      Fursday · Trusted pet care in India · Made with 🐾
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const b = await req.json();
    const results: any = {};

    if (b.parent_email) {
      results.parent = await sendEmail(
        b.parent_email,
        `Booking confirmed — ${SERVICE_NAMES[b.service_type] || "Fursday"} (${b.booking_ref})`,
        parentEmail(b)
      );
    }
    if (b.sitter_email) {
      results.sitter = await sendEmail(
        b.sitter_email,
        `New paid booking — ${b.booking_ref}`,
        sitterEmail(b)
      );
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
