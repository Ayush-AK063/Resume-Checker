import { Criteria } from "@/types";

export function buildResumePrompt(
  text: string,
  criteria: Criteria
) {
  return `You are a resume evaluation expert. First, determine if this is a valid resume document. Then analyze it against the given criteria and provide a JSON response.

Document Content:
${text.slice(0, 5000)}

Criteria:
${JSON.stringify(criteria, null, 2)}

IMPORTANT: Respond with ONLY valid JSON in this exact format (no markdown, no extra text, no code blocks):

{
  "is_resume": true,
  "fit_score": 85,
  "missing_skills": ["skill1", "skill2"],
  "feedback": "Very brief feedback (max 60 characters) highlighting the main reason for pass/fail."
}

First, check if "is_resume" should be true or false:
- Set "is_resume" to false if the document is clearly NOT a resume (e.g., random text, articles, books, code files, etc.)
- A valid resume should contain career information, work experience, education, or professional skills
- If "is_resume" is false, set fit_score to 0, missing_skills to [], and feedback to "Not a resume document"

If it IS a resume:
- The fit_score should be a number between 0-100 representing how well the resume matches the criteria.
- The missing_skills should be an array of specific skills mentioned in the criteria that are missing from the resume.
- The feedback should be VERY SHORT AND CONCISE (maximum 60 characters) - just the key reason for the score. Examples:
  - "Missing Supabase, React experience"
  - "Strong match for all requirements"
  - "Lacks required AWS and Docker skills"
  - "Perfect fit with 5+ years experience"`;
}
