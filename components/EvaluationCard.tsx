// components/EvaluationCard.tsx
"use client";

import { useState } from "react";
import { Evaluation } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Calendar, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EvaluationCardProps {
  evaluation: Evaluation;
  onDelete?: () => void;
}

export default function EvaluationCard({ evaluation, onDelete }: EvaluationCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!evaluation.id) return;

    setIsDeleting(true);
    toast.loading("Deleting evaluation...", { id: "delete-eval" });
    
    try {
      const response = await fetch(`/api/deleteEvaluation`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ evaluationId: evaluation.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete evaluation");
      }

      toast.success("Evaluation deleted successfully!", { id: "delete-eval" });
      onDelete?.();
    } catch (error) {
      console.error("Error deleting evaluation:", error);
      toast.error("Failed to delete evaluation. Please try again.", { id: "delete-eval" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getScoreVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <Badge variant={getScoreVariant(evaluation.fit_score)} className="px-3 py-1">
                {evaluation.fit_score}% Match
              </Badge>
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1" />
                {evaluation.created_at && new Date(evaluation.created_at).toLocaleDateString()}
              </div>
            </div>
            <Progress value={evaluation.fit_score} className="w-32" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Target Role */}
        <div className="flex items-center space-x-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Target Role:</span>
          <Badge variant="outline">{evaluation.criteria.role}</Badge>
        </div>

        <Separator />

        {/* Missing Skills */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Missing Skills:</span>
          </div>
          <div className="ml-6">
            {evaluation.missing_skills.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {evaluation.missing_skills.map((skill, index) => (
                  <Badge key={index} variant="destructive" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <Badge variant="default" className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                No missing skills!
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Feedback */}
        <div className="space-y-2">
          <span className="text-sm font-medium">AI Feedback:</span>
          <div className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed border">
            {evaluation.feedback}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
  