# 🎯 Resume Checker - AI-Powered Resume Evaluation System

A modern, full-stack Next.js application that uses AI to analyze resumes against job criteria and provide intelligent feedback.

## ✨ Features

- **📁 File Upload**: Support for PDF and DOCX resume uploads
- **🤖 AI Evaluation**: Google Gemini AI-powered resume analysis
- **📊 Scoring System**: Fit scores (0-100) based on job criteria
- **🔍 Smart Analysis**: Identifies missing skills and provides detailed feedback
- **💾 Cloud Storage**: Supabase integration for file storage and database
- **🎨 Modern UI**: Clean, responsive interface with Shadcn UI components
- **🔄 CRUD Operations**: Create, read, update, and delete evaluations
- **🗑️ Complete Cleanup**: Delete resumes with automatic file and database cleanup
- **📱 Responsive Design**: Works seamlessly on desktop and mobile

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** (App Router)
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn UI** components
- **Sonner** for toast notifications

### Backend
- **Next.js API Routes**
- **Supabase** (Database + Storage)
- **Google Gemini AI** for resume evaluation
- **PDF-Parse** for PDF text extraction
- **Mammoth** for DOCX text extraction

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Google AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ayush-AK063/Resume-Checker.git
   cd Resume-Checker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   GEMINI_API_KEY=your_google_ai_api_key
   ```

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL scripts in `SUPABASE_SETUP.md`
   - Set up storage bucket named "resumes"

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## 📖 Usage

### Upload Resume
1. Navigate to the upload page
2. Select a PDF or DOCX resume file
3. Upload and wait for text extraction

### Create Evaluation
1. Go to the dashboard and select a resume
2. Click "Create Evaluation"
3. Fill in job criteria (role, skills, description)
4. Submit to get AI-powered analysis

### Manage Resumes
- **View**: Click on any resume card to see details
- **Re-evaluate**: Create multiple evaluations with different criteria
- **Delete**: Remove evaluations or entire resumes (includes file cleanup)

## 🏗️ Project Structure

```
├── app/
│   ├── api/                 # API routes
│   ├── dashboard/           # Dashboard pages
│   ├── upload/              # Upload page
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── ui/                  # Shadcn UI components
│   ├── CriteriaForm.tsx     # Evaluation form
│   ├── EvaluationCard.tsx   # Evaluation display
│   └── ResumeCard.tsx       # Resume card
├── lib/
│   ├── extract/             # File extraction utilities
│   ├── llm/                 # AI integration
│   └── prompts/             # AI prompts
├── supabase/                # Supabase clients
├── types/                   # TypeScript definitions
└── utils/                   # Utility functions
```

## 🔧 Configuration

### Supabase Setup
Follow the instructions in `SUPABASE_SETUP.md` to:
- Create required tables (`resumes`, `evaluations`)
- Set up storage bucket and policies
- Configure Row Level Security (optional)

### Google AI Setup
1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your `.env.local` file as `GEMINI_API_KEY`

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy automatically

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

---

**Made with ❤️ by [Ayush-AK063](https://github.com/Ayush-AK063)**
