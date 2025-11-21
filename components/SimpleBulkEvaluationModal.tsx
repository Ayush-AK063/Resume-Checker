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
  onEvaluationComplete: (results: EvaluationResult[]) => void;
  onRefreshNeeded?: () => void;
}

export default function BulkEvaluationModal({ resumes, trigger, onEvaluationComplete, onRefreshNeeded }: BulkEvaluationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', content: `👋 **Hi! I'm your Resume Evaluation Assistant**\n\nI can help you evaluate ${resumes.length} resume${resumes.length === 1 ? '' : 's'} based on job requirements.\n\n**How to use:**\nJust tell me what you're looking for:\n• "I need a React developer"\n• "Find Node.js engineers"\n• "Python programmer with 3 years experience"\n\nI'll immediately evaluate all resumes and show you the results!` }
  ]);
  const [userInput, setUserInput] = useState('');
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  // Single updating processing bubble content (used during bulk evaluation progress)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
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
      
      console.log('Chat response received:', { 
        hasResponse: !!data.response, 
        hasCriteria: !!data.criteria,
        criteria: data.criteria,
        autoStart: data.autoStart,
        responsePreview: data.response?.substring(0, 100) || '(empty response)'
      });
      
      // If autoStart is true, DON'T add the LLM response to chat
      // We'll add our own messages during evaluation
      if (data.autoStart && data.criteria) {
        console.log('✓ Auto-start detected - skipping LLM response, starting evaluation directly');
        console.log('✓ Criteria received from backend:', data.criteria);
        setCriteria(data.criteria);
        
        // Add our custom starting message instead of LLM's response
        const autoStartMessage: ChatMessage = {
          role: 'bot',
          content: `🚀 **Starting Evaluation Now!**\n\nI've extracted your requirements:\n📋 **Role:** ${data.criteria.role}\n💼 **Skills:** ${data.criteria.skills.join(', ')}\n\n⏳ Processing ${resumes.length} resume${resumes.length === 1 ? '' : 's'} now...`
        };
        setMessages([...updatedMessages, autoStartMessage]);
        
        // Trigger evaluation automatically - pass criteria directly to avoid state timing issues
        setTimeout(() => {
          evaluateAllResumes(data.criteria);
        }, 500);
        return; // Exit early - don't process normal flow
      }
      
      // Normal flow - add bot response (only if there is one)
      if (data.response && data.response.trim()) {
        const newMessages = [
          ...updatedMessages,
          { role: 'bot' as const, content: data.response }
        ];
        setMessages(newMessages);
      }

      // Update criteria if extracted (but only if not already handled by autoStart above)
      if (data.criteria && !data.autoStart) {
        console.log('✓ Criteria extracted and set:', data.criteria);
        setCriteria(data.criteria);
        toast.success("Criteria detected!");
      } else if (!data.criteria) {
        console.log('⚠ No criteria extracted from response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMessages([
        ...updatedMessages,
        { role: 'bot', content: `Sorry, I encountered an error: ${errorMessage}. Please try again or provide more details about the job role, required skills, and job description.` }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const evaluateAllResumes = async (criteriaToUse?: Criteria) => {
    // Use passed criteria if available, otherwise fall back to state
    const activeCriteria = criteriaToUse || criteria;
    
    if (!activeCriteria) {
      console.error('❌ No criteria available for evaluation');
      toast.error("Please provide job criteria through the chat first");
      return;
    }

    console.log('✅ Using criteria for evaluation:', activeCriteria);

    // Check if we have at least role OR skills
    const hasRole = activeCriteria.role && activeCriteria.role !== 'Not specified';
    const hasSkills = activeCriteria.skills && activeCriteria.skills.length > 0 && !activeCriteria.skills.includes('General');
    
    console.log('📋 Evaluation criteria check:', { hasRole, hasSkills, criteria: activeCriteria });
    
    if (!hasRole && !hasSkills) {
      console.error('❌ Insufficient criteria for evaluation');
      toast.error("Please provide either a job role or required skills through the chat");
      return;
    }

    console.log('✅ Starting evaluation with criteria:', activeCriteria);
    setIsEvaluating(true);
    
    // Update state with the active criteria (in case it was passed as parameter)
    if (criteriaToUse) {
      setCriteria(criteriaToUse);
    }
    
    // DON'T add starting message here - it's already added by the autoStart flow
    // The message "Starting Evaluation Now!" is shown before this function is called

    // Initialize results with pending status
    const results: EvaluationResult[] = resumes.map(resume => ({
      resumeId: resume.id,
      resumeName: resume.file_name,
      status: 'pending'
    }));

    try {
      // Start SSE connection for bulk evaluation
      console.log('🌐 Calling /api/bulkEvaluate with:', {
        resumeCount: resumes.length,
        resumeIds: resumes.map(r => r.id),
        criteria: activeCriteria
      });
      
      const response = await fetch('/api/bulkEvaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeIds: resumes.map(r => r.id),
          criteria: activeCriteria
        }),
      });

      console.log('📡 Bulk evaluate response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Bulk evaluate failed:', errorText);
        throw new Error(`Failed to start bulk evaluation: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Store all evaluation results to display at once
      const evaluationResults: Array<{
        resumeName: string;
        resumeId: string;
        resumeUrl?: string;
        status: 'pass' | 'fail' | 'error';
        score?: number;
        feedback?: string;
        error?: string;
        isNotResume?: boolean;
      }> = [];

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Decode the chunk
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                // Update status to evaluating
                const index = results.findIndex(r => r.resumeId === data.resumeId);
                if (index !== -1) {
                  results[index].status = 'evaluating';
                  onEvaluationComplete([...results]);
                }
                
                // Update a single processing bubble instead of adding many messages
                setProcessingStatus(`⏳ Processing: **${data.resumeName}**...`);
              } else if (data.type === 'result') {
                // Store result for later display
                const index = results.findIndex(r => r.resumeId === data.resumeId);
                if (index !== -1) {
                  results[index].status = data.evaluation.status;
                  results[index].score = data.evaluation.score;
                  onEvaluationComplete([...results]);
                }

                evaluationResults.push({
                  resumeName: data.resumeName,
                  resumeId: data.resumeId,
                  resumeUrl: data.resumeUrl,
                  status: data.evaluation.status,
                  score: data.evaluation.score,
                  feedback: data.evaluation.feedback
                });
              } else if (data.type === 'error') {
                // Store error for later display
                const index = results.findIndex(r => r.resumeId === data.resumeId);
                if (index !== -1) {
                  results[index].status = 'error';
                  results[index].error = data.error;
                  onEvaluationComplete([...results]);
                }

                evaluationResults.push({
                  resumeName: data.resumeName,
                  resumeId: data.resumeId,
                  resumeUrl: data.resumeUrl,
                  status: 'error',
                  error: data.error,
                  isNotResume: data.isNotResume
                });
              } else if (data.type === 'complete') {
                // Display all results in ONE consolidated message
                setProcessingStatus(null);
                
                setMessages(prev => {
                  const newMessages = [...prev];
                  
                   // Build a single consolidated message with all results
                   let consolidatedMessage = `🎉 **Evaluation Complete!**\n\n`;
                   
                  // Add summary first
                  const summary = data.summary;
                  consolidatedMessage += `📊 **Summary:**\n`;
                  consolidatedMessage += `✅ Passed: ${summary.passed}\n`;
                  consolidatedMessage += `❌ Failed: ${summary.failed}\n`;
                  
                  if (summary.rejected > 0) {
                    consolidatedMessage += `🚫 Rejected (Not Resume): ${summary.rejected}\n`;
                  }
                  
                  if (summary.errors > 0) {
                    consolidatedMessage += `⚠️ Other Errors: ${summary.errors}\n`;
                  }
                  
                  consolidatedMessage += `\nTotal: ${summary.total} file${summary.total === 1 ? '' : 's'} evaluated.\n\n`;
                  consolidatedMessage += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                  consolidatedMessage += `📄 **Detailed Results:**\n\n`;
                  
                  // Add all evaluation results to the same message
                  for (let i = 0; i < evaluationResults.length; i++) {
                    const result = evaluationResults[i];
                    // Use the resume URL from the API response
                    const resumeFileUrl = result.resumeUrl || '';
                    const resumeLink = resumeFileUrl ? ` [View Resume](${resumeFileUrl})` : '';
                    
                    if (result.status === 'error') {
                      const errorEmoji = result.isNotResume ? '🚫' : '❌';
                      consolidatedMessage += `${errorEmoji} **${result.resumeName}**\n`;
                      consolidatedMessage += `   ${result.error}${resumeLink}\n\n`;
                    } else {
                      const resultEmoji = result.status === 'pass' ? '✅' : '❌';
                      const resultText = result.status === 'pass' ? 'PASS' : 'FAIL';
                      consolidatedMessage += `${resultEmoji} **${result.resumeName}**\n`;
                      consolidatedMessage += `   **${resultText}** - Score: ${result.score}/100${resumeLink}\n`;
                      if (result.feedback) {
                        consolidatedMessage += `   💬 ${result.feedback}\n`;
                      }
                      consolidatedMessage += `\n`;
                    }
                  }
                  
                  // Add the single consolidated message
                  newMessages.push({
                    role: 'bot',
                    content: consolidatedMessage
                  });

                  return newMessages;
                });
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }

      setIsEvaluating(false);
      // clear any processing bubble if evaluation ended unexpectedly
      setProcessingStatus(null);
      toast.success("Bulk evaluation completed!");
      
      // Trigger refresh of resume data to show latest evaluations in dropdowns
      if (onRefreshNeeded) {
        onRefreshNeeded();
      }
    } catch (error) {
      console.error('Bulk evaluation error:', error);
      // ensure processing indicator removed on error
      setProcessingStatus(null);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: '❌ An error occurred during bulk evaluation. Please try again.'
      }]);
      setIsEvaluating(false);
      toast.error("Bulk evaluation failed");
    }
  };

  const resetModal = () => {
    setIsEvaluating(false);
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
            
            {/* Single updating processing bubble (shows current file being processed) */}
            {processingStatus && (
              <div className={`flex justify-start`}>
                <div className={`flex items-start space-x-2 max-w-[80%]`}>
                  <div className={`p-2 rounded-full bg-muted`}>
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className={`px-4 py-2 rounded-lg bg-card border`}>
                    <div className="text-sm whitespace-pre-wrap">
                      {processingStatus.split(/(\[.*?\]\(.*?\))/).map((part, i) => {
                        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
                        if (linkMatch) {
                          return (
                            <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 underline" onClick={(e) => e.stopPropagation()}>{linkMatch[1]}</a>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
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
              disabled={isEvaluating || isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isEvaluating || isProcessing}
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
                disabled={isEvaluating || isProcessing}
                className="text-xs px-3 py-1 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                💡 Example: React + Node.js
              </button>
              <button
                onClick={() => {
                  setUserInput("Find Python developers");
                }}
                disabled={isEvaluating || isProcessing}
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
