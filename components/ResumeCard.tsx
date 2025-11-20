// components/ResumeCard.tsx
"use client";

import { useState, useEffect } from "react";
import { Resume, Evaluation } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, ExternalLink, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { formatFileType } from "@/utils/formatter";
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
}

export default function ResumeCard({ resume, evaluationResult, refreshKey }: ResumeCardProps) {
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
    <Card className="transition-all duration-200 hover:shadow-md group">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div 
            className="flex items-start space-x-4 flex-1 cursor-pointer"
            onClick={toggleExpanded}
          >
            <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
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
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>Uploaded {new Date(resume.created_at).toLocaleDateString()}</span>
                </div>
                {resume.file_type ? (
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
                ) : null}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {isExpanded ? "Showing details below" : "Click to view details and create AI evaluations"}
              </div>
            </div>
          </div>
          
          {/* Evaluation Result and Delete button */}
          <div className="flex items-center space-x-2">
            {/* Evaluation Result Badge */}
            {(() => {
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
            })()}
            
            {/* Delete button - appears on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div onClick={(e) => e.stopPropagation()}>
                <DeleteResumeButton 
                  resumeId={resume.id} 
                  resumeName={resume.file_name} 
                  variant="compact"
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
                  {/* Overview Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Overview
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Type:</span>
                            {resumeData.file_type ? (
                              <Badge variant="outline">{formatFileType(resumeData.file_type)}</Badge>
                            ) : (resumeData?.file_url || resume.file_url) ? (
                              <Button variant="ghost" size="sm" onClick={() => window.open(resumeData?.file_url || resume.file_url, '_blank')}>
                                View Resume
                              </Button>
                            ) : null}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant="default">Active</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Date:</span>
                            <span>{new Date(resumeData.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Time:</span>
                            <span>{new Date(resumeData.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Evaluations:</span>
                            <Badge variant="default">{resumeData.evaluations?.length || 0}</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={resumeData.evaluations?.length ? "default" : "secondary"}>
                              {resumeData.evaluations?.length ? "Evaluated" : "Pending"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

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

                  {/* Evaluations Section - Show Only Latest Evaluation */}
                  {resumeData.evaluations && resumeData.evaluations.length > 0 && (() => {
                    // Get the latest evaluation (most recent by created_at)
                    const latestEvaluation = resumeData.evaluations.sort((a, b) => {
                      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                      return dateB - dateA;
                    })[0];
                    
                    return (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Latest Evaluation Result</h3>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium">
                              {latestEvaluation.criteria?.role || 'Evaluation'}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <Badge variant="default">
                                Score: {latestEvaluation.fit_score}/100
                              </Badge>
                              <Badge variant={latestEvaluation.fit_score >= 50 ? "default" : "destructive"}>
                                {latestEvaluation.fit_score >= 50 ? "Pass" : "Fail"}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Missing Skills */}
                          {latestEvaluation.missing_skills && latestEvaluation.missing_skills.length > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium mb-2 text-muted-foreground">Missing Skills:</p>
                              <div className="flex flex-wrap gap-2">
                                {latestEvaluation.missing_skills.map((skill, index) => (
                                  <Badge key={index} variant="destructive" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Feedback */}
                          {latestEvaluation.feedback && (
                            <div>
                              <p className="text-sm font-medium mb-2 text-muted-foreground">Feedback:</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {latestEvaluation.feedback}
                              </p>
                            </div>
                          )}
                          
                          {/* Evaluation Date */}
                          {latestEvaluation.created_at && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs text-muted-foreground">
                                Evaluated on {new Date(latestEvaluation.created_at).toLocaleDateString()} at {new Date(latestEvaluation.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}


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
