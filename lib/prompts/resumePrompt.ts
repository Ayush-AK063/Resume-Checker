import { Criteria } from "@/types";

export function buildResumePrompt(
  text: string,
  criteria: Criteria
) {
  return `You are a resume evaluation expert. Analyze the following resume against the given criteria and provide a JSON response.

Resume:
${text.slice(0, 5000)}

Criteria:
${JSON.stringify(criteria, null, 2)}

IMPORTANT: Respond with ONLY valid JSON in this exact format (no markdown, no extra text, no code blocks):

{
  "fit_score": 85,
  "missing_skills": ["skill1", "skill2"],
  "feedback": "Detailed feedback about the candidate's fit for the role, including strengths and areas for improvement."
}

The fit_score should be a number between 0-100 representing how well the resume matches the criteria.
The missing_skills should be an array of specific skills mentioned in the criteria that are missing from the resume.
The feedback should be a comprehensive evaluation in 2-3 sentences.`;
}
