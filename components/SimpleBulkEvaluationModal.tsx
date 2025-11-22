"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, Send, Bot, User } from "lucide-react";
import { toast } from "sonner";
import { Resume, Criteria } from "@/types";

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

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
  onEvaluationComplete?: (results: EvaluationResult[]) => void;
}

export default function BulkEvaluationModal({ resumes, trigger, onEvaluationComplete }: BulkEvaluationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', content: `👋 **Hi! I'm your Resume Evaluation Assistant**\n\nI can help you evaluate ${resumes.length} resume${resumes.length === 1 ? '' : 's'} based on job requirements.\n\n**How to use:**\nJust tell me what you're looking for:\n• "I need a React developer"\n• "Find Node.js engineers"\n• "Python programmer with 3 years experience"\n\nI'll immediately evaluate all resumes and show you the results!` }
  ]);
  const [userInput, setUserInput] = useState('');
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isProcessing) return;

    const userMessage = userInput.trim();
    setUserInput('');
    setIsProcessing(true);

    // Add user message to chat
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];
    setMessages(updatedMessages);

    // Check if this looks like an evaluation request (contains job requirements keywords)
    const isEvaluationRequest = /\b(want|need|find|looking for|require|search|developer|engineer|programmer|candidate|applicant)\b/i.test(userMessage);
    
    // Only show processing message for evaluation requests
    if (isEvaluationRequest) {
      const processingMessage: ChatMessage = {
        role: 'bot',
        content: '⏳ **Processing your request...**\n\n🔍 Fetching resumes from database...\n📊 Evaluating all candidates against your requirements...\n⚙️ This may take a few moments, please wait...'
      };
      setMessages([...updatedMessages, processingMessage]);
    }

    try {
      // Call LLM to process the conversation and extract criteria
      const response = await fetch('/api/chat-criteria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          resumeCount: resumes.length
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to process message');
      }

      const data = await response.json();
      
      console.log('Chat response received:', data);
      
      // Check if we got evaluations back (LLM already evaluated everything)
      if (data.evaluations && data.evaluations.length > 0) {
        console.log('✅ Evaluations completed by backend:', data.evaluations);
        
        // Build detailed results message
        const passedResumes = data.evaluations.filter((ev: { status: string }) => ev.status === 'pass');
        const failedResumes = data.evaluations.filter((ev: { status: string }) => ev.status === 'fail');
        
        let detailedMessage = `✅ **Evaluation Complete!**\n\n📋 **Requirement:** ${userMessage}\n\n`;
        detailedMessage += `📊 **Summary:**\n- Total: ${data.evaluations.length}\n- ✅ Passed: ${passedResumes.length}\n- ❌ Failed: ${failedResumes.length}\n\n`;
        
        // Show passed resumes
        if (passedResumes.length > 0) {
          detailedMessage += `**✅ PASSED RESUMES:**\n\n`;
          passedResumes.forEach((ev: { resumeName: string; score: number; feedback: string; missing_skills: string[] }, idx: number) => {
            detailedMessage += `${idx + 1}. **${ev.resumeName}**\n`;
            detailedMessage += `   📈 Score: ${ev.score}/100\n`;
            detailedMessage += `   💬 Reason: ${ev.feedback}\n`;
            if (ev.missing_skills && ev.missing_skills.length > 0) {
              detailedMessage += `   ⚠️ Missing: ${ev.missing_skills.join(', ')}\n`;
            }
            detailedMessage += `\n`;
          });
        }
        
        // Show failed resumes
        if (failedResumes.length > 0) {
          detailedMessage += `**❌ FAILED RESUMES:**\n\n`;
          failedResumes.forEach((ev: { resumeName: string; score: number; feedback: string; missing_skills: string[] }, idx: number) => {
            detailedMessage += `${idx + 1}. **${ev.resumeName}**\n`;
            
            // Check if it's not a resume document
            if (ev.feedback && ev.feedback.includes('Not a valid resume')) {
              detailedMessage += `   � ${ev.feedback}\n`;
            } else {
              detailedMessage += `   �📉 Score: ${ev.score}/100\n`;
              detailedMessage += `   💬 Reason: ${ev.feedback}\n`;
              if (ev.missing_skills && ev.missing_skills.length > 0) {
                detailedMessage += `   ❌ Missing: ${ev.missing_skills.join(', ')}\n`;
              }
            }
            detailedMessage += `\n`;
          });
        }
        
        // Replace processing message with detailed results
        setMessages([...updatedMessages, { role: 'bot', content: detailedMessage }]);
        
        // Convert evaluations to our format and update results
        const results: EvaluationResult[] = data.evaluations.map((ev: { resumeId: string; resumeName: string; status: string; score: number }) => ({
          resumeId: ev.resumeId,
          resumeName: ev.resumeName,
          status: ev.status as 'pass' | 'fail',
          score: ev.score
        }));
        
        if (onEvaluationComplete) {
          onEvaluationComplete(results);
        }
        setCriteria(data.criteria);
        toast.success(`✅ Evaluation complete! ${passedResumes.length} passed, ${failedResumes.length} failed`);
        return;
      }
      
      // Normal flow - replace processing message with bot response
      if (data.response && data.response.trim()) {
        const newMessages = [
          ...updatedMessages,
          { role: 'bot' as const, content: data.response }
        ];
        setMessages(newMessages);
      } else {
        // If no response, remove processing message
        setMessages(updatedMessages);
      }

      // Update criteria if extracted
      if (data.criteria) {
        console.log('✓ Criteria extracted and set:', data.criteria);
        setCriteria(data.criteria);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      // Replace processing message with error message
      setMessages([
        ...updatedMessages,
        { role: 'bot', content: `Sorry, I encountered an error: ${errorMessage}. Please try again.` }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setIsProcessing(false);
    setMessages([
      { role: 'bot', content: `👋 **Hi! I'm your Resume Evaluation Assistant**\n\nI can help you evaluate ${resumes.length} resume${resumes.length === 1 ? '' : 's'} based on job requirements.\n\n**How to use:**\nJust tell me what you're looking for:\n• "I need a React developer"\n• "Find Node.js engineers"\n• "Python programmer with 3 years experience"\n\nI'll immediately evaluate all resumes and show you the results!` }
    ]);
    setUserInput('');
    setCriteria(null);
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
      <DialogContent className="max-w-[1000px]! w-[95vw]" style={{ maxWidth: '1400px', width: '95vw' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="w-5 h-5 mr-2" />
            Evaluate All Resumes with AI Assistant
          </DialogTitle>
          <DialogDescription>
            Chat with our AI to define criteria for evaluating {resumes.length} resume{resumes.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        {/* Chat Interface */}
        <div className="flex flex-col h-[500px]">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30 rounded-lg">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex items-start space-x-2 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      message.role === 'user' ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-primary-foreground" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {/* Convert markdown-style links to clickable links */}
                      {message.content.split(/(\[.*?\]\(.*?\))/).map((part, i) => {
                        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
                        if (linkMatch) {
                          return (
                            <a
                              key={i}
                              href={linkMatch[2]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {linkMatch[1]}
                            </a>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex items-center space-x-2 mt-4">
            <Input
              placeholder="Type your message..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isProcessing}
              size="icon"
            >
              {isProcessing ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {/* Quick action suggestions */}
          {!criteria && messages.length <= 2 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => {
                  setUserInput("I need a React developer with Node.js experience");
                }}
                disabled={isProcessing}
                className="text-xs px-3 py-1 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                💡 Example: React + Node.js
              </button>
              <button
                onClick={() => {
                  setUserInput("Find Python developers");
                }}
                disabled={isProcessing}
                className="text-xs px-3 py-1 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                💡 Example: Python
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
