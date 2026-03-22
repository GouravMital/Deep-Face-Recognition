import { Router } from "express";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.post("/mood/analyze", authMiddleware, async (req, res) => {
  const { imageDataUrl } = req.body as { imageDataUrl?: string };

  if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Valid imageDataUrl required" });
    return;
  }

  try {
    const completion = await openrouter.chat.completions.create({
      model: "meta-llama/llama-3.2-11b-vision-instruct",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
            {
              type: "text",
              text: `Analyze this person's facial expression and emotional state. Return ONLY valid JSON in this exact format, no markdown or explanation:
{
  "dominant_emotion": "<one of: Happy, Sad, Angry, Surprised, Fearful, Disgusted, Neutral, Calm, Excited, Anxious, Confused>",
  "confidence": <0.0-1.0>,
  "secondary_emotion": "<another emotion or null>",
  "mood_score": <integer 1-10 where 1=very negative, 10=very positive>,
  "description": "<2-3 sentence detailed description of facial expression, posture cues, and inferred emotional state>",
  "micro_expressions": ["<expression1>", "<expression2>"],
  "engagement_level": "<Low|Medium|High>"
}`,
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {
        dominant_emotion: "Neutral",
        confidence: 0.5,
        secondary_emotion: null,
        mood_score: 5,
        description: raw.slice(0, 200),
        micro_expressions: [],
        engagement_level: "Medium",
      };
    }

    res.json({ success: true, analysis: parsed });
  } catch (err) {
    console.error("Mood analysis error:", err);
    res.status(500).json({ error: "Mood analysis failed", details: String(err) });
  }
});

export default router;
