"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Resume, Criteria } from "@/types";

export interface EvaluationResult {
  resumeId: string;
  resumeName: string;
  status: 'pending' | 'evaluating' | 'pass' | 'fail' | 'error';
  score?: number;
  error?: string;
}

interface BulkEvaluationModalProps {
  resumes: Resume[];
  trigger: React.ReactNode;
  onEvaluationComplete: (results: EvaluationResult[]) => void;
  onRefreshNeeded?: () => void;
}

export default function BulkEvaluationModal({ resumes, trigger, onEvaluationComplete, onRefreshNeeded }: BulkEvaluationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  
  const [criteria, setCriteria] = useState<Criteria>({
    role: '',
    skills: [],
    job_description: ''
  });

  const handleSkillsChange = (value: string) => {
    setSkillsInput(value);
    const skillsArray = value.split(',').map(skill => skill.trim()).filter(skill => skill.length > 0);
    setCriteria(prev => ({ ...prev, skills: skillsArray }));
  };

  const evaluateAllResumes = async () => {
    if (!criteria.role || criteria.skills.length === 0 || !criteria.job_description) {
      toast.error("Please fill in all criteria fields");
      return;
    }

    setIsEvaluating(true);
    toast.info(`Starting evaluation of ${resumes.length} resume${resumes.length === 1 ? '' : 's'}...`);

    // Initialize results with pending status
    const results: EvaluationResult[] = resumes.map(resume => ({
      resumeId: resume.id,
      resumeName: resume.file_name,
      status: 'pending'
    }));

    // Evaluate each resume
    for (let i = 0; i < resumes.length; i++) {
      const resume = resumes[i];
      
      // Update status to evaluating
      results[i].status = 'evaluating';
      onEvaluationComplete([...results]); // Update parent with current progress

      try {
        const response = await fetch('/api/checkResume', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumeId: resume.id,
            criteria
          }),
        });

        if (response.ok) {
          const evaluation = await response.json();
          const score = evaluation.fit_score;
          const status = score >= 50 ? 'pass' : 'fail';
          
          results[i] = { ...results[i], status, score };
        } else {
          const errorData = await response.json();
          results[i] = { ...results[i], status: 'error', error: errorData.error };
        }
      } catch (err) {
        results[i] = { ...results[i], status: 'error', error: 'Network error' };
      }

      // Update parent with progress
      onEvaluationComplete([...results]);

      // Small delay between evaluations to avoid overwhelming the API
      if (i < resumes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsEvaluating(false);
    toast.success("Bulk evaluation completed!");
    
    // Trigger refresh of resume data to show latest evaluations in dropdowns
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
    
    setIsOpen(false);
  };

  const resetModal = () => {
    setIsEvaluating(false);
    setSkillsInput('');
    setCriteria({ role: '', skills: [], job_description: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        resetModal();
      }
    }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            Evaluate All Resumes
          </DialogTitle>
          <DialogDescription>
            Enter criteria to evaluate {resumes.length} resume{resumes.length === 1 ? '' : 's'} at once. Results will appear on the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="role">Job Role</Label>
            <Input
              id="role"
              placeholder="e.g., Software Engineer, Data Scientist"
              value={criteria.role}
              onChange={(e) => setCriteria(prev => ({ ...prev, role: e.target.value }))}
              disabled={isEvaluating}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skills">Required Skills (comma-separated)</Label>
            <Input
              id="skills"
              placeholder="e.g., JavaScript, React, Node.js, Python"
              value={skillsInput}
              onChange={(e) => handleSkillsChange(e.target.value)}
              disabled={isEvaluating}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Job Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the job requirements, responsibilities, and qualifications..."
              className="min-h-[100px]"
              value={criteria.job_description}
              onChange={(e) => setCriteria(prev => ({ ...prev, job_description: e.target.value }))}
              disabled={isEvaluating}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isEvaluating}>
            Cancel
          </Button>
          <Button onClick={evaluateAllResumes} disabled={isEvaluating}>
            {isEvaluating ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                Evaluating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Start Evaluation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
