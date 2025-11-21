import { NextResponse } from "next/server";
import { generateWithGemini, generateWithTools } from "@/lib/llm/gemini";
import { Criteria } from "@/types";

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  resumeCount: number;
}

const SYSTEM_PROMPT = `You are a resume evaluation assistant. You help evaluate resumes based on job criteria.

CONVERSATION RULES:

1. GREETINGS (Respond warmly):
   - "Hi", "Hello", "Hey", "Good morning", "Good afternoon"
   → Respond: "Hi! I'm here to help you evaluate resumes. Just tell me what job role or skills you're looking for, and I'll evaluate all the resumes immediately."

2. EVALUATION REQUESTS (Call function immediately, NO text):
   - User mentions job role: "Node.js developer", "React engineer"
   - User mentions skills: "Python", "AWS", "TypeScript"  
   - Keywords: evaluate, find, check, assess, need, want, looking for
   → IMMEDIATELY call evaluate_resumes function (extract role/skills, NO TEXT RESPONSE)

3. OTHER QUESTIONS (Reject politely):
   - Questions about you: "What can you do?", "How do you work?"
   - Off-topic: Weather, jokes, news, unrelated topics
   → Respond: "I can only help with resume evaluation. Please tell me what job role or skills you're looking for."

EXAMPLES:

User: "Hi"
→ TEXT: "Hi! I'm here to help you evaluate resumes. Just tell me what job role or skills you're looking for, and I'll evaluate all the resumes immediately."

User: "Hello, how are you?"
→ TEXT: "Hello! I'm doing great. I'm here to help you evaluate resumes. Just tell me what job role or skills you're looking for!"

User: "I want a Node.js developer"
→ CALL FUNCTION evaluate_resumes (role="Node.js Developer", skills=["Node.js"]) - NO TEXT

User: "What can you do?"
→ TEXT: "I can only help with resume evaluation. Please tell me what job role or skills you're looking for."

CRITICAL:
- Greetings = Friendly response, encourage evaluation
- Evaluation requests = Call function ONLY (no text)
- Other questions = Polite rejection`;

export async function POST(req: Request) {
  try {
    const body: RequestBody = await req.json();
    const { messages, resumeCount } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required" },
        { status: 400 }
      );
    }

    // Build conversation history for the LLM (exclude the last user message as we'll send it separately)
    const previousMessages = messages.slice(0, -1);
    const conversationHistory = previousMessages.map(msg => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content };
      } else {
        return { role: 'assistant', content: msg.content };
      }
    });

    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1].content;

    // Check if this is an evaluation request (aggressive detection)
    const evaluationKeywords = /\b(evaluate|assessment|assess|find|check|analyze|screen|look|looking|search|searching|need|want|require|seeking|hire|hiring|developer|engineer|designer|analyst|scientist|manager|architect|programmer|candidate|applicant|start|begin)\b/i;
    const isEvaluationIntent = evaluationKeywords.test(latestUserMessage);
    
    console.log('📊 Message intent analysis:', { 
      message: latestUserMessage, 
      isEvaluationIntent,
      keywords: latestUserMessage.match(evaluationKeywords) 
    });

    // SUPER AGGRESSIVE: If evaluation intent detected, bypass LLM and force tool call
    if (isEvaluationIntent) {
      console.log('🚀 FORCING IMMEDIATE EVALUATION - bypassing LLM completely');
      
      // Extract criteria directly from the user message
      const forcedCriteria = extractCriteriaFromText(latestUserMessage, messages);
      
      if (forcedCriteria) {
        console.log('✅ Forced criteria extraction successful:', forcedCriteria);
        
        // Return as if tool was called
        return NextResponse.json({
          response: '', // Empty response - frontend will handle messaging
          criteria: forcedCriteria,
          autoStart: true  // Always auto-start when we force it
        });
      }
    }

    // Define tools available to the AI (following Gemini's function calling format)
    const tools = [
      {
        name: "evaluate_resumes",
        description: "Immediately trigger resume evaluation. Call this function whenever user mentions evaluation, finding candidates, checking resumes, or describes job requirements. Extract role and skills from context. DO NOT generate text when calling this - just call it.",
        parameters: {
          type: "object",
          properties: {
            role: {
              type: "string",
              description: "The job role/title (e.g., 'Node.js Developer', 'Data Scientist'). Use 'Not specified' if unclear."
            },
            skills: {
              type: "array",
              description: "Array of required skills (e.g., ['React', 'Node.js']). Use ['General'] if no specific skills mentioned.",
              items: {
                type: "string"
              }
            },
            job_description: {
              type: "string",
              description: "Summary of job requirements from the conversation"
            }
          },
          required: ["role", "skills", "job_description"]
        }
      }
    ];

    // Create the prompt for Gemini with tool calling
    const prompt = `${SYSTEM_PROMPT}

Context: The recruiter is evaluating ${resumeCount} resume${resumeCount === 1 ? '' : 's'}.

Latest user message: "${latestUserMessage}"

ANALYZE THE MESSAGE:

1. Is it a greeting? (hi, hello, hey, good morning, etc.)
   → YES: Respond with warm greeting + encourage evaluation
   Example: "Hi! I'm here to help you evaluate resumes. Just tell me what job role or skills you're looking for!"

2. Is it an evaluation request? (mentions role, skills, or keywords: evaluate, find, need, want, looking for)
   → YES: Call evaluate_resumes function IMMEDIATELY (extract role/skills, NO TEXT)

3. Is it something else? (questions about you, off-topic)
   → YES: Politely redirect to evaluation
   Example: "I can only help with resume evaluation. Please tell me what job role or skills you're looking for."

NOW: Analyze "${latestUserMessage}" and respond accordingly.`;

    // Call Gemini with tool support
    let result;
    try {
      result = await generateWithTools(prompt, conversationHistory, tools);
      console.log('generateWithTools result:', {
        hasResponse: !!result.response,
        responseLength: result.response?.length || 0,
        hasToolCalls: !!result.toolCalls,
        toolCallsLength: result.toolCalls?.length || 0
      });
    } catch (geminiError) {
      console.error("Gemini API error in chat-criteria:", geminiError);
      console.error("Full error details:", JSON.stringify(geminiError, null, 2));
      
      // Fallback: Try without tools for simple conversation
      try {
        console.log("Attempting fallback to regular generateWithGemini...");
        const fallbackPrompt = `${SYSTEM_PROMPT}

Context: The recruiter is evaluating ${resumeCount} resume${resumeCount === 1 ? '' : 's'}.

Conversation so far:
${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Latest user message: "${latestUserMessage}"

Respond naturally and conversationally. If the user wants to evaluate resumes and has provided job criteria (role/skills), format your response like this:

Perfect! I have the information needed:

**Role:** [role or "Not specified"]
**Required Skills:** [skills or "General"]
**Job Description:** [summary]

✅ Ready to evaluate! Click 'Start Evaluation' to begin analyzing the resumes.`;

        const fallbackResponse = await generateWithGemini(fallbackPrompt);
        const extractedCriteria = extractCriteriaFromText(fallbackResponse, messages);
        
        return NextResponse.json({
          response: fallbackResponse,
          criteria: extractedCriteria
        });
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        return NextResponse.json({
          response: "I apologize, but I'm having trouble processing your message right now. Could you please try again? If the issue persists, try rephrasing your message.",
          criteria: null
        });
      }
    }

    // Check if AI wants to call the evaluate_resumes tool
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];
      
      if (toolCall.name === 'evaluate_resumes') {
        const { role, skills, job_description } = toolCall.args;
        
        // Create criteria from tool call
        const criteria: Criteria = {
          role: role || 'Not specified',
          skills: Array.isArray(skills) && skills.length > 0 ? skills : ['General'],
          job_description: job_description || 'Resume evaluation based on provided criteria'
        };

        console.log('✅ Tool called! Auto-starting evaluation with criteria:', criteria);

        // Generate a response confirming the evaluation is starting
        const confirmationResponse = `🚀 **Starting Evaluation Now!**

I've extracted your requirements:
📋 **Role:** ${criteria.role}
💼 **Skills:** ${criteria.skills.join(', ')}

⏳ Processing ${resumeCount} resume${resumeCount === 1 ? '' : 's'} now...`;

        // Always auto-start when tool is called
        return NextResponse.json({
          response: confirmationResponse,
          criteria: criteria,
          autoStart: true  // Always true when tool is called
        });
      }
    }

    // If no tool call, just return the conversational response
    // But try to extract criteria from the response text
    const extractedCriteria = extractCriteriaFromText(result.response, messages);
    
    // FALLBACK: If we detected evaluation intent but no tool was called, force it
    if (isEvaluationIntent && !extractedCriteria) {
      console.log('⚠️ Evaluation intent detected but no tool call - forcing extraction');
      const forcedCriteria = extractCriteriaFromText(latestUserMessage, messages);
      
      if (forcedCriteria) {
        console.log('✅ Forced criteria extraction successful:', forcedCriteria);
        
        // Auto-start with forced criteria
        const confirmationResponse = `🚀 **Starting Evaluation Now!**

I've extracted your requirements:
📋 **Role:** ${forcedCriteria.role}
💼 **Skills:** ${forcedCriteria.skills.join(', ')}

⏳ Processing ${resumeCount} resume${resumeCount === 1 ? '' : 's'} now...`;

        return NextResponse.json({
          response: confirmationResponse,
          criteria: forcedCriteria,
          autoStart: true
        });
      }
    }
    
    return NextResponse.json({
      response: result.response,
      criteria: extractedCriteria
    });

  } catch (error) {
    console.error("Error in chat-criteria API:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to process chat message";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to extract criteria from conversation
function extractCriteriaFromText(responseText: string, messages: ChatMessage[]): Criteria | null {
  console.log('🔍 Attempting to extract criteria from response:', responseText.substring(0, 200) + '...');
  
  // Check if response contains the confirmation format
  const roleMatch = responseText.match(/\*\*Role:\*\*\s*(.+?)(?:\n|$)/i);
  const skillsMatch = responseText.match(/\*\*Required Skills:\*\*\s*(.+?)(?:\n|$)/i);
  const descMatch = responseText.match(/\*\*Job Description:\*\*\s*(.+?)(?:\n|$)/i);
  
  if (roleMatch || skillsMatch) {
    const role = roleMatch && !roleMatch[1].toLowerCase().includes('not specified') 
      ? roleMatch[1].trim() 
      : 'Not specified';
    
    const skillsRaw = skillsMatch ? skillsMatch[1].trim() : '';
    const skills = skillsRaw && !skillsRaw.toLowerCase().includes('not specified') && skillsRaw.toLowerCase() !== 'general'
      ? skillsRaw.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0)
      : ['General'];
    
    const job_description = descMatch 
      ? descMatch[1].trim()
      : messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    
    // Accept criteria if we have either a role or specific skills
    if (role !== 'Not specified' || skills[0] !== 'General') {
      console.log('✅ Criteria extracted from formatted response:', { role, skills, job_description: job_description.substring(0, 100) });
      return { role, skills, job_description };
    }
  }
  
  // Try to extract from conversation context
  const conversationText = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  
  // Look for explicit evaluation requests OR strong intent signals
  const evaluationKeywords = /evaluate|start evaluation|find (me )?(candidates|developers|engineers|designers|analysts)|analyze resumes|check resumes|screen resumes|assess (candidates|resumes)/i;
  const intentKeywords = /looking for|need|hiring|want|require|seeking|searching for/i;
  
  const hasEvaluationRequest = evaluationKeywords.test(conversationText) || evaluationKeywords.test(responseText);
  const hasIntent = intentKeywords.test(conversationText);
  
  console.log('Intent detection:', { hasEvaluationRequest, hasIntent, conversationText: conversationText.substring(0, 150) });
  
  if (!hasEvaluationRequest && !hasIntent) {
    console.log('⚠ No evaluation intent detected in conversation');
    return null; // User hasn't requested evaluation yet
  }
  
  // Extract role - look for common job titles
  const rolePatterns = [
    /(?:looking for|need|hiring|want|find|evaluate|seeking|require)\s+(?:a|an)?\s*([A-Z][a-zA-Z\s]+?(?:Engineer|Developer|Designer|Manager|Analyst|Scientist|Architect|Specialist|Consultant|Lead|Director|Administrator|Programmer|Tester)s?)\b/i,
    /(?:role|position|job|title):\s*([A-Z][a-zA-Z\s]+)/i,
    /\b(Senior|Junior|Lead|Staff|Principal)\s+([A-Z][a-zA-Z\s]+?(?:Engineer|Developer|Designer)s?)\b/i,
    /\b(Software|Frontend|Backend|Full[- ]?Stack|Data|Machine Learning|DevOps|Cloud|Mobile|Web)\s+(Engineer|Developer|Architect)s?\b/i,
    // More aggressive patterns for simple statements like "I want a Node.js developer"
    /(?:want|need|looking for|find|seeking)\s+(?:a|an)?\s*([A-Za-z\.\s]+?\s+(?:developer|engineer|designer|programmer|architect)s?)\b/i,
    /\b([A-Za-z\.\s]+?\s+(?:developer|engineer|designer|programmer|architect)s?)\b/i
  ];
  
  let extractedRole = 'Not specified';
  for (const pattern of rolePatterns) {
    const match = conversationText.match(pattern);
    if (match) {
      // Get the captured group that has the role
      extractedRole = (match[1] || match[2] || match[0]).trim();
      // Clean up the role (capitalize properly)
      extractedRole = extractedRole.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      console.log('Role found:', extractedRole);
      break;
    }
  }
  
  // Extract skills - look for technologies, languages, frameworks
  const skillKeywords = [
    // Languages
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C\\+\\+', 'Ruby', 'PHP', 'Go', 'Rust', 'Swift', 'Kotlin',
    // Frontend
    'React', 'Angular', 'Vue', 'Next\\.js', 'Svelte', 'HTML', 'CSS', 'Tailwind', 'jQuery',
    // Backend
    'Node\\.js', 'Node', 'Express', 'Django', 'Flask', 'Spring', 'ASP\\.NET', 'Laravel', 'FastAPI',
    // Databases
    'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'DynamoDB', 'Elasticsearch', 'NoSQL',
    // Cloud & DevOps
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'GitLab', 'GitHub Actions', 'CI/CD',
    // Other
    'Git', 'REST', 'GraphQL', 'Microservices', 'API', 'Agile', 'Scrum', 'Redux', 'Webpack'
  ];
  
  const extractedSkills: string[] = [];
  for (const skill of skillKeywords) {
    if (new RegExp(skill, 'i').test(conversationText)) {
      // Clean up the skill name (remove escaped characters)
      const cleanSkill = skill.replace(/\\/g, '');
      extractedSkills.push(cleanSkill);
    }
  }
  
  // Also look for skills mentioned directly (e.g., "Node.js developer" should extract "Node.js")
  const directSkillMatch = conversationText.match(/\b(Node\.?js|React\.?js|Vue\.?js|Angular\.?js|Python|Java|JavaScript|TypeScript)\b/gi);
  if (directSkillMatch) {
    directSkillMatch.forEach(skill => {
      const normalizedSkill = skill.replace(/\.?js$/i, '.js'); // Normalize to .js
      if (!extractedSkills.some(s => s.toLowerCase() === normalizedSkill.toLowerCase())) {
        extractedSkills.push(normalizedSkill);
      }
    });
  }
  
  // Deduplicate skills (remove similar ones like "Node" if "Node.js" exists)
  const deduplicatedSkills = extractedSkills.filter((skill, index, self) => {
    // Keep only the first occurrence of each skill (case-insensitive)
    const firstIndex = self.findIndex(s => s.toLowerCase() === skill.toLowerCase());
    if (firstIndex !== index) return false;
    
    // Remove "Node" if "Node.js" exists
    if (skill.toLowerCase() === 'node' && self.some(s => s.toLowerCase() === 'node.js')) {
      return false;
    }
    return true;
  });
  
  console.log('Skills found (deduplicated):', deduplicatedSkills);
  
  // Extract years of experience if mentioned
  const expMatch = conversationText.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
  const experience = expMatch ? `${expMatch[1]}+ years experience` : '';
  
  if (extractedRole !== 'Not specified' || deduplicatedSkills.length > 0) {
    const job_description = conversationText.trim() || 'Resume evaluation based on extracted criteria';
    console.log('✅ Criteria extracted from conversation:', { extractedRole, deduplicatedSkills, experience });
    return {
      role: extractedRole,
      skills: deduplicatedSkills.length > 0 ? deduplicatedSkills : ['General'],
      job_description: experience ? `${job_description}\n\nExperience: ${experience}` : job_description
    };
  }
  
  console.log('⚠ Could not extract sufficient criteria from conversation');
  return null;
}