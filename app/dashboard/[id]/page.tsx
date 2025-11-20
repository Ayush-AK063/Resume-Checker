import { Resume, Evaluation } from "@/types";
import { supabaseServer } from "@/supabase/serverClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, ExternalLink, ArrowLeft } from "lucide-react";
import EvaluationSection from "@/components/EvaluationSection";
import { formatFileType } from "@/utils/formatter";
import DeleteResumeButton from "@/components/DeleteResumeButton";

type ResumeWithEvaluations = Resume & {
  evaluations: Evaluation[];
};

async function getResumeData(id: string): Promise<ResumeWithEvaluations | null> {
  try {
    const { data, error } = await supabaseServer
      .from("resumes")
      .select("*, evaluations(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching resume:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching resume:", error);
    return null;
  }
}

export default async function ResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resume = await getResumeData(id);

  if (!resume) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Resume Not Found</h1>
        <p className="text-gray-600 mb-6">
          The resume you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{resume.file_name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Uploaded {new Date(resume.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              {formatFileType(resume.file_type || null)}
            </Badge>
            {resume.file_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={resume.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View File
                </a>
              </Button>
            )}
            <DeleteResumeButton 
              resumeId={resume.id} 
              resumeName={resume.file_name} 
            />
          </div>
        </div>

        <Separator />

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="content">Resume Content</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">File Information</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium">{resume.file_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Type:</span>
                      <Badge variant="outline">{formatFileType(resume.file_type || null)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Size:</span>
                      <span className="text-sm text-gray-500">Available</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upload Details</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Date:</span>
                      <span className="text-sm font-medium">
                        {new Date(resume.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Time:</span>
                      <span className="text-sm text-gray-500">
                        {new Date(resume.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
                  <Badge variant="default">{resume.evaluations?.length || 0}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total:</span>
                      <span className="text-sm font-medium">{resume.evaluations?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <Badge variant={resume.evaluations?.length ? "default" : "secondary"}>
                        {resume.evaluations?.length ? "Evaluated" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle>Extracted Resume Content</CardTitle>
              </CardHeader>
              <CardContent>
                {resume.extracted_text ? (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <pre className="text-sm whitespace-pre-wrap text-gray-800 max-h-96 overflow-auto">
                      {resume.extracted_text}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No text content extracted from this resume.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evaluations">
            <EvaluationSection
              resumeId={resume.id} 
              initialEvaluations={resume.evaluations || []} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}