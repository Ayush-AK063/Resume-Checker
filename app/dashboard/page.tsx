import ResumeCard from "@/components/ResumeCard";
import { Resume } from "@/types";
import { supabaseServer } from "@/supabase/serverClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Plus, Sparkles } from "lucide-react";

async function getData(): Promise<Resume[]> {
  try {
    const { data, error } = await supabaseServer
      .from("resumes")
      .select("id, file_name, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching resumes:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching resumes:", error);
    return [];
  }
}

export default async function Dashboard() {
  const resumes = await getData();

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
            <Button asChild size="lg">
              <Link href="/upload">
                <Plus className="h-4 w-4 mr-2" />
                Upload Resume
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {resumes.length > 0 && (
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
        )}

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
              {resumes.map((resume: Resume) => (
                <div key={resume.id} className="animate-in fade-in-50 duration-300">
                  <ResumeCard resume={resume} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
