// components/ResumeCard.tsx
"use client";

import { Resume } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatFileType } from "@/utils/formatter";
import DeleteResumeButton from "@/components/DeleteResumeButton";

export default function ResumeCard({ resume }: { resume: Resume }) {
    return (
      <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/20 group relative">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <Link href={`/dashboard/${resume.id}`} className="flex items-start space-x-4 flex-1 cursor-pointer">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                    {resume.file_name}
                  </h3>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>Uploaded {new Date(resume.created_at).toLocaleDateString()}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {formatFileType(resume.file_type || null)}
                  </Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Click to view details and create AI evaluations
                </div>
              </div>
            </Link>
            
            {/* Delete button - appears on hover */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div onClick={(e) => e.stopPropagation()}>
                <DeleteResumeButton 
                  resumeId={resume.id} 
                  resumeName={resume.file_name} 
                  variant="compact"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  