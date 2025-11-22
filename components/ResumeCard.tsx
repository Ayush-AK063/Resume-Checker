// components/ResumeCard.tsx
"use client";

import { useState, useEffect } from "react";
import { Resume, Evaluation } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import DeleteResumeButton from "@/components/DeleteResumeButton";

type ResumeWithEvaluations = Resume & {
  evaluations?: Evaluation[];
};

interface ResumeCardProps {
  resume: Resume;
  evaluationResult?: {
    status: 'pending' | 'evaluating' | 'pass' | 'fail' | 'error';
    score?: number;
    error?: string;
  };
  refreshKey?: number; // new optional prop to trigger refresh from parent
  onDeleteSuccess?: () => void; // callback to notify parent when resume is deleted
}

export default function ResumeCard({ resume, refreshKey, onDeleteSuccess }: ResumeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeWithEvaluations | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResumeData = async (forceRefresh = false) => {
    if (resumeData && !forceRefresh) return; // Already loaded, unless forced
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching resume data for ID:', resume.id);
      const response = await fetch(`/api/getResume?id=${resume.id}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Resume data loaded successfully:', data);
        setResumeData(data);
      } else {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to fetch resume data`;
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error fetching resume data:', errorMessage);
      setError(errorMessage);
      setResumeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = () => {
    if (!isExpanded) {
      // Always refresh data when expanding to show latest evaluations
      fetchResumeData(true);
    }
    setIsExpanded(!isExpanded);
  };

  // Fetch basic resume data on mount to show evaluation badge
  useEffect(() => {
    fetchResumeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume.id]);

  // When parent signals a refresh (e.g. after evaluation completes), refetch resume data
  useEffect(() => {
    if (typeof refreshKey !== 'undefined') {
      // force refresh to pick up latest evaluation
      fetchResumeData(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <Card className="transition-all py-4! duration-200 hover:shadow-md group">
      <CardContent className="px-6 ">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div 
            className="flex items-start space-x-4 flex-1 cursor-pointer"
            onClick={toggleExpanded}
          >
            {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground bg-gray-100" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground bg-gray-100" />
                  )}
            <div className="p-1 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                  {resume.file_name}
                </h3>
                <div className="flex items-center space-x-2">
                  {resumeData?.file_url || resume.file_url ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = resumeData?.file_url || resume.file_url;
                        if (url) window.open(url, '_blank');
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-4 w-4" /><span>View</span>
                    </Button>
                  ) : null}
                  {/* {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )} */}
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>Uploaded {new Date(resume.created_at).toLocaleDateString()}</span>
                </div>
                {/* {resume.file_type ? (
                  <Badge variant="secondary" className="text-xs">
                    {formatFileType(resume.file_type)}
                  </Badge>
                ) : (resumeData?.file_url || resume.file_url) ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = resumeData?.file_url || resume.file_url;
                      if (url) window.open(url, '_blank');
                    }}
                    className="text-xs cursor-pointer"
                  >
                    View Resume
                  </Button>
                ) : null} */}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {isExpanded ? "Showing details below" : "Click to view details and create AI evaluations"}
              </div>
            </div>
          </div>
          
          {/* Evaluation Result and Delete button */}
          <div className="flex items-center space-x-2">
            {/* Evaluation Result Badge */}
            {/* {(() => {
              // Show bulk evaluation result if available, otherwise show persistent evaluation from database
              const currentEvaluation = evaluationResult || 
                (resumeData?.evaluations && resumeData.evaluations.length > 0 
                  ? (() => {
                      const latestEval = resumeData.evaluations.sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                      })[0];
                      return {
                        status: latestEval.fit_score >= 50 ? 'pass' : 'fail' as const,
                        score: latestEval.fit_score,
                        resumeId: resume.id,
                        resumeName: resume.file_name
                      };
                    })()
                  : null);

              return currentEvaluation ? (
                <div onClick={(e) => e.stopPropagation()}>
                  {currentEvaluation.status === 'pending' && (
                    <Badge variant="secondary" className="text-xs">
                      Pending
                    </Badge>
                  )}
                  {currentEvaluation.status === 'evaluating' && (
                    <Badge variant="default" className="text-xs">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Evaluating...
                    </Badge>
                  )}
                  {currentEvaluation.status === 'pass' && (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
                      ✓ Pass ({currentEvaluation.score}%)
                    </Badge>
                  )}
                  {currentEvaluation.status === 'fail' && (
                    <Badge variant="destructive" className="text-xs">
                      ✗ Fail ({currentEvaluation.score}%)
                    </Badge>
                  )}
                  {currentEvaluation.status === 'error' && (
                    <Badge variant="destructive" className="text-xs">
                      Error
                    </Badge>
                  )}
                </div>
              ) : null;
            })()} */}
            
            {/* Delete button - appears on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div onClick={(e) => e.stopPropagation()}>
                <DeleteResumeButton 
                  resumeId={resume.id} 
                  resumeName={resume.file_name} 
                  variant="compact"
                  onDeleteSuccess={onDeleteSuccess}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            <Separator className="my-6" />
            <div className="space-y-6">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse">Loading resume details...</div>
                </div>
              ) : resumeData ? (
                <div className="space-y-6">
                  {/* Content Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Resume Content</h3>
                    {resumeData.extracted_text ? (
                      <div className="bg-muted rounded-lg p-4">
                        <pre className="text-sm whitespace-pre-wrap max-h-64 overflow-auto text-muted-foreground">
                          {resumeData.extracted_text}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No text content extracted from this resume.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Failed to load resume details.</p>
                  {error && (
                    <p className="text-sm text-red-600 mt-2">Error: {error}</p>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => {
                      setResumeData(null);
                      setError(null);
                      fetchResumeData();
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
