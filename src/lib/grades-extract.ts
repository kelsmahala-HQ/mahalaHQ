export type ExtractedGrades = {
  student: string | null;
  classes: { class_name: string; grade: string }[];
};

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Sends a PowerSchool "Grades and Attendance" printout (PDF) or screenshot to Claude and gets
 * back just the classes that currently have a grade. The result is only ever a draft -- the
 * parent reviews and edits it before anything is saved or paid, so a misread can't pay out.
 */
export async function extractGradesFromFile(file: File): Promise<ExtractedGrades | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "Grade reading isn't set up yet — an admin needs to add an Anthropic API key first." };

  if (file.size > MAX_BYTES) return { error: "That file is too big — try a smaller screenshot or a one-page printout." };

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) return { error: "Upload a PDF printout or a screenshot (PNG/JPG) of the PowerSchool grades page." };

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: file.type, data } };

  const prompt = `This is a PowerSchool parent-portal "Grades and Attendance" page. Extract the classes that currently have a grade.

Return strict JSON with no markdown fences and no commentary:
{"student": string|null, "classes": [{"class_name": string, "grade": string}]}

Rules:
- "student" is the student's name as shown at the top (e.g. "Bailee Torres"), or null if not visible.
- Include ONLY classes with an actual grade in the current grading-period column (typically Q1, Q2, ... or the final/F1 column). Skip classes whose grade cell is blank, "[ i ]", or "I", and skip non-academic rows like homeroom, lunch, recess, seminar, library, or study hall that have no grade.
- "grade" is exactly what PowerSchool shows: either a percentage number like "94" or a letter grade like "C-" or "A+". Do not convert between the two.
- "class_name" is the course name only -- no teacher name, room number, or "Email".
- If a class appears twice, include it once with its graded entry.
- If the page contains no grades at all, return {"student": null, "classes": []}.`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt }] }],
      }),
    });
  } catch {
    return { error: "Couldn't reach the grade-reading service. Try again in a moment." };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("grades-extract: API error", res.status, detail.slice(0, 500));
    return { error: `Grade reading failed (error ${res.status}). Try again in a moment.` };
  }

  const body = await res.json();
  // The reply can start with non-text blocks (e.g. reasoning), so don't assume content[0] is the
  // answer -- join every text block, then take the outermost {...} in case of any preamble.
  const raw = ((body?.content ?? []) as { type: string; text?: string }[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? raw.slice(start, end + 1) : "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("grades-extract: unparseable reply", { stop_reason: body?.stop_reason, raw: raw.slice(0, 500) });
    return { error: "Couldn't make sense of that file. Try a clearer screenshot of the grades page." };
  }

  const classes = Array.isArray(parsed.classes)
    ? parsed.classes
        .map((c) => {
          const obj = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
          return {
            class_name: typeof obj.class_name === "string" ? obj.class_name.trim() : "",
            grade: typeof obj.grade === "string" ? obj.grade.trim() : typeof obj.grade === "number" ? String(obj.grade) : "",
          };
        })
        .filter((c) => c.class_name && c.grade)
    : [];

  if (!classes.length) return { error: "Didn't find any graded classes in that file." };

  return { student: typeof parsed.student === "string" && parsed.student.trim() ? parsed.student.trim() : null, classes };
}
