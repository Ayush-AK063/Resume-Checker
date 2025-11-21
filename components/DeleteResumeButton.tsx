"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteResumeButtonProps {
  resumeId: string;
  resumeName: string;
  variant?: "default" | "compact";
  onDeleteSuccess?: () => void;
}

export default function DeleteResumeButton({ resumeId, resumeName, variant = "default", onDeleteSuccess }: DeleteResumeButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      const response = await fetch("/api/deleteResume", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resumeId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete resume");
      }

      toast.success("Resume deleted successfully");
      
      // Call the callback to notify parent component
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      
      // Redirect to dashboard after successful deletion
      router.push("/dashboard");
      router.refresh();
      
    } catch (error) {
      console.error("Error deleting resume:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete resume");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size={variant === "compact" ? "sm" : "sm"}
          className={`text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 ${
            variant === "compact" ? "h-8 w-8 p-0" : ""
          }`}
          disabled={isDeleting}
        >
          <Trash2 className={variant === "compact" ? "h-3 w-3" : "h-4 w-4 mr-2"} />
          {variant === "compact" ? "" : "Delete Resume"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Resume</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;<strong>{resumeName}</strong>&quot;? 
            This will permanently remove the resume file and all its evaluations. 
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Resume
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
