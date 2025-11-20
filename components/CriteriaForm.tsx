"use client";

import { useState } from "react";
import { Evaluation } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Target, Users, FileText } from "lucide-react";
import { toast } from "sonner";

export default function CriteriaForm({ resumeId, onEvaluationComplete }: { 
  resumeId: string;
  onEvaluationComplete?: () => void;
}) {
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!role.trim() || !skills.trim() || !jobDesc.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError(null);
    toast.loading("Analyzing resume with AI...", { id: "eval-loading" });

    try {
      const criteria = {
        role: role.trim(),
        skills: skills.split(",").map((s) => s.trim()).filter(s => s.length > 0),
        job_description: jobDesc.trim(),
      };

      const res = await fetch("/api/checkResume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resumeId, criteria }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid response from server. Please try again.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Evaluation failed");
      }

      setResult(data);
      toast.success("Resume evaluation completed!", { id: "eval-loading" });
      onEvaluationComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Evaluation failed";
      setError(errorMessage);
      toast.error(errorMessage, { id: "eval-loading" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setRole("");
    setSkills("");
    setJobDesc("");
    setResult(null);
    setError(null);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Create New Evaluation</CardTitle>
          </div>
          {result && (
            <Button variant="outline" onClick={reset} size="sm">
              New Evaluation
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!result ? (
          <>
            {/* Target Role */}
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>Target Role</span>
              </Label>
              <Input
                id="role"
                type="text"
                placeholder="e.g. Full Stack Developer, Data Scientist, Product Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Required Skills */}
            <div className="space-y-2">
              <Label htmlFor="skills" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Required Skills</span>
              </Label>
              <Input
                id="skills"
                type="text"
                placeholder="React, Next.js, Node.js, TypeScript, Python (comma separated)"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple skills with commas
              </p>
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <Label htmlFor="jobDesc" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Job Description</span>
              </Label>
              <Textarea
                id="jobDesc"
                placeholder="Paste the complete job description here for detailed analysis..."
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                disabled={loading}
                className="min-h-[120px] resize-none"
              />
            </div>

            <Separator />

            <Button
              onClick={submit}
              disabled={loading || !role.trim() || !skills.trim() || !jobDesc.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Resume...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Evaluate Resume
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>AI Evaluation Complete</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Fit Score</p>
                  <p className="text-3xl font-bold text-primary">{result.fit_score}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Missing Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {result.missing_skills && result.missing_skills.length > 0 ? (
                      result.missing_skills.map((skill, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                        All skills present!
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed">
                  {result.feedback}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
