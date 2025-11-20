"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Evaluation } from "@/types";
import EvaluationCard from "@/components/EvaluationCard";
import CriteriaForm from "@/components/CriteriaForm";
import { Plus, RotateCcw, Sparkles, ClipboardList } from "lucide-react";

interface EvaluationSectionProps {
  resumeId: string;
  initialEvaluations: Evaluation[];
}

export default function EvaluationSection({ resumeId, initialEvaluations }: EvaluationSectionProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>(initialEvaluations);
  const [showForm, setShowForm] = useState(false);

  const handleEvaluationComplete = () => {
    // Refresh the page to show new evaluation
    window.location.reload();
  };

  const handleNewEvaluation = () => {
    setShowForm(true);
  };

  const handleReEvaluate = () => {
    setShowForm(true);
  };

  const handleEvaluationDeleted = () => {
    // Refresh the page to update the evaluations list
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold">Resume Evaluations</h2>
            <p className="text-sm text-muted-foreground">
              {evaluations.length === 0 
                ? "No evaluations yet"
                : `${evaluations.length} evaluation${evaluations.length === 1 ? '' : 's'} completed`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {evaluations.length > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              {evaluations.length} total
            </Badge>
          )}
          <div className="flex gap-2">
            {evaluations.length > 0 && (
              <Button variant="outline" onClick={handleReEvaluate} size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Re-evaluate
              </Button>
            )}
            <Button onClick={handleNewEvaluation} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {evaluations.length === 0 ? "Create Evaluation" : "New Evaluation"}
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <CriteriaForm 
            resumeId={resumeId} 
            onEvaluationComplete={handleEvaluationComplete}
          />
        </div>
      )}

      {evaluations.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">AI Evaluations</h3>
          </div>
          <div className="grid gap-4">
            {evaluations.map((evaluation) => (
              <div key={evaluation.id} className="animate-in fade-in-50 duration-300">
                <EvaluationCard 
                  evaluation={evaluation} 
                  onDelete={handleEvaluationDeleted}
                />
              </div>
            ))}
          </div>
        </div>
      ) : !showForm ? (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No evaluations yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first evaluation to analyze how well this resume matches specific job requirements using AI.
            </p>
            <Button onClick={handleNewEvaluation} size="lg">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Your First Evaluation
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
