// app/page.tsx

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-10 text-center">
      <h1 className="text-4xl font-bold mb-4">
        Resume Analyzer
      </h1>

      <p className="text-gray-600 max-w-lg mb-8">
        Upload your resume, extract content, evaluate fit for roles, see missing skills,
        and get AI-based insights using OpenAI/Gemini/Claude.
      </p>

      <div className="flex gap-4">
        <Link href="/upload">
          <Button>Upload Resume</Button>
        </Link>

        <Link href="/dashboard">
          <Button variant="outline">View Dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
