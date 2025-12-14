import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const ADMIN_EMAIL = "unexplainedarchive.suport@gmail.com"
const FROM_EMAIL = "onboarding@resend.dev"  // Resend default domain

interface ContactFormData {
  name: string
  email: string
  message: string
  category?: string
}

serve(async (req) => {
  // Handle CORS for all requests (allow public access)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }

  try {
    const { name, email, message, category = "general" }: ContactFormData = await req.json()

    // Validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured")
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        reply_to: email,
        subject: `[${category.toUpperCase()}] New contact form submission from ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Contact Form Submission</h2>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p><strong>Category:</strong> ${escapeHtml(category)}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="margin: 20px 0;">
              <h3>Message:</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              Reply to this email to respond directly to ${escapeHtml(email)}.
            </p>
          </div>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const error = await emailResponse.text()
      console.error("Resend API error:", error, "Status:", emailResponse.status)
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: error }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          } 
        }
      )
    }

    const result = await emailResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        id: result.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    )
  }
})

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
