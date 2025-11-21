"use client";

import { useState, useEffect } from "react";
import ResumeCard from "@/components/ResumeCard";
import { Resume } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Plus, Sparkles, Loader2 } from "lucide-react";
import SimpleBulkEvaluationModal, { EvaluationResult } from "@/components/SimpleBulkEvaluationModal";

export default function Dashboard() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Use a plain object for evaluation results so React state updates reliably trigger renders
  const [evaluationResults, setEvaluationResults] = useState<Record<string, EvaluationResult>>({});
  // Incrementing key to signal resume cards to refresh their data
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const response = await fetch('/api/getResumes');
      if (response.ok) {
        const data = await response.json();
        setResumes(data);
        // Do not clear evaluationResults here — preserve any in-progress or just-completed results
        // setEvaluationResults(new Map());
      }
    } catch (error) {
      console.error('Error fetching resumes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshResumeData = () => {
    // Refresh resume data without clearing evaluation results or showing loading
    fetchResumes();
  };

  const handleEvaluationComplete = (results: EvaluationResult[]) => {
    // Merge incoming results into existing evaluationResults object
    setEvaluationResults((prev) => {
      const next = { ...prev };
      results.forEach((result) => {
        const existing = next[result.resumeId];

        // If we already have a final result for this resume, don't overwrite with a transient state
        if (existing && (existing.status === 'pass' || existing.status === 'fail' || existing.status === 'error')) {
          return;
        }

        // Otherwise set/overwrite with the latest result
        next[result.resumeId] = result;

        // If this result is final, bump refreshKey so ResumeCard will re-fetch its data
        if (result.status === 'pass' || result.status === 'fail' || result.status === 'error') {
          setRefreshKey((k) => k + 1);
        }
      });
      return next;
    });
  };

  const handleResumeDeleted = (resumeId: string) => {
    // Immediately remove the resume from the UI
    setResumes((prev) => prev.filter((r) => r.id !== resumeId));
    // Also remove any evaluation results for this resume
    setEvaluationResults((prev) => {
      const next = { ...prev };
      delete next[resumeId];
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading resumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Resume Dashboard</h1>
              <p className="text-muted-foreground">
                Manage and analyze your resumes with AI-powered insights
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {resumes.length > 0 && (
              <Badge variant="secondary" className="px-3 py-1">
                {resumes.length} resume{resumes.length === 1 ? '' : 's'}
              </Badge>
            )}
            {resumes.length > 0 && (
              <SimpleBulkEvaluationModal 
                resumes={resumes}
                onEvaluationComplete={handleEvaluationComplete}
                onRefreshNeeded={refreshResumeData}
                trigger={
                  <Button variant="outline" size="lg">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Evaluate All Resumes
                  </Button>
                }
              />
            )}
            <Button asChild size="lg">
              <Link href="/upload">
                <Plus className="h-4 w-4 mr-2" />
                Upload Resume
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {/* {resumes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Resumes</p>
                    <p className="text-2xl font-bold">{resumes.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">AI Analysis</p>
                    <p className="text-2xl font-bold">Ready</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Latest Upload</p>
                    <p className="text-sm font-medium">
                      {new Date(resumes[0]?.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )} */}

        {/* Resume Grid */}
        {resumes.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/25">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-6">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">
                No Resumes Uploaded Yet
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md">
                Upload your first resume to get started with AI-powered analysis and insights. 
                Discover how well your resume matches different job requirements.
              </p>
              <Button asChild size="lg">
                <Link href="/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Resume
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Your Resumes</h2>
            </div>
            <div className="grid gap-4">
              {resumes.map((resume: Resume) => {
                const evaluationResult = evaluationResults[resume.id];
                 return (
                   <div key={resume.id} className="animate-in fade-in-50 duration-300">
                     <ResumeCard 
                       resume={resume} 
                       evaluationResult={evaluationResult}
                       refreshKey={refreshKey}
                       onDeleteSuccess={() => handleResumeDeleted(resume.id)}
                     />
                   </div>
                 );
               })}
             </div>
           </div>
         )}
       </div>
     </div>
   );
 }
