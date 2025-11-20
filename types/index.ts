// types/index.ts

export interface Resume {
  id: string;
  file_name: string;
  file_url?: string;
  file_type?: string;
  extracted_text?: string;
  created_at: string;
}

export interface Criteria {
  role: string;
  skills: string[];
  job_description: string;
}

export interface Evaluation {
  id?: string;
  resume_id: string;
  criteria: Criteria;
  fit_score: number;
  missing_skills: string[];
  feedback: string;
  raw_response: Record<string, unknown>; // LLM response structure
  created_at?: string;
}

export interface EvaluationResult {
  fit_score: number;
  missing_skills: string[];
  feedback: string;
}
