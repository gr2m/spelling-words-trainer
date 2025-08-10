export async function GET() {
  const enabled = Boolean(process.env.ELEVENLABS_API_KEY)
  console.log("TTS Status check - API key present:", enabled)
  return Response.json({
    enabled,
    provider: enabled ? "elevenlabs" : "browser",
    timestamp: new Date().toISOString(),
  })
}

export async function POST(req: Request) {
  try {
    console.log("TTS POST request received")

    if (!process.env.ELEVENLABS_API_KEY) {
      console.log("No ElevenLabs API key configured")
      return new Response("TTS not configured - no API key", { status: 400 })
    }

    const { text, voiceId } = (await req.json()) as { text: string; voiceId?: string }
    console.log("TTS request for text:", text, "voiceId:", voiceId)

    if (!text || typeof text !== "string") {
      console.log("Invalid text provided:", text)
      return new Response("Missing or invalid text", { status: 400 })
    }

    const vid = voiceId || "21m00Tcm4TlvDq8ikWAM" // Rachel (friendly US English)
    console.log("Using voice ID:", vid)

    const requestBody = {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.9,
        style: 0.4,
        use_speaker_boost: true,
      },
    }

    console.log("Making request to ElevenLabs API...")
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify(requestBody),
    })

    console.log("ElevenLabs API response status:", res.status)

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error")
      console.error("ElevenLabs API error:", res.status, errorText)
      return new Response(`ElevenLabs API error: ${res.status} ${errorText}`, { status: res.status })
    }

    const buf = await res.arrayBuffer()
    console.log("Successfully received audio data, size:", buf.byteLength, "bytes")

    return new Response(buf, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    })
  } catch (error) {
    console.error("TTS route error:", error)
    return new Response(`TTS failure: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 })
  }
}
