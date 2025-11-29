import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

// Initialize tiktoken encoder for GPT-4
const encoder = new Tiktoken(cl100k_base);

/**
 * Count tokens in a text string
 * @param text - The text to count tokens for
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Split text into chunks with a maximum token count
 * @param text - The text to split
 * @param maxTokens - Maximum tokens per chunk (default: 3000)
 * @param overlap - Number of tokens to overlap between chunks (default: 200)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  maxTokens: number = 3000,
  overlap: number = 200
): string[] {
  // Clean and normalize the text
  const cleanedText = text.trim().replace(/\s+/g, " ");
  
  // Split by sentences/paragraphs first
  const sentences = cleanedText.split(/(?<=[.!?])\s+/);
  
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokenCount = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);
    
    // If a single sentence exceeds maxTokens, split it further
    if (sentenceTokens > maxTokens) {
      // Save current chunk if it has content
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
        currentTokenCount = 0;
      }
      
      // Split large sentence by words
      const words = sentence.split(/\s+/);
      let wordChunk: string[] = [];
      let wordTokenCount = 0;
      
      for (const word of words) {
        const wordTokens = countTokens(word);
        
        if (wordTokenCount + wordTokens > maxTokens) {
          chunks.push(wordChunk.join(" "));
          
          // Add overlap from previous chunk
          const overlapWords = wordChunk.slice(-Math.ceil(overlap / 10));
          wordChunk = [...overlapWords, word];
          wordTokenCount = countTokens(wordChunk.join(" "));
        } else {
          wordChunk.push(word);
          wordTokenCount += wordTokens;
        }
      }
      
      if (wordChunk.length > 0) {
        chunks.push(wordChunk.join(" "));
      }
      
      continue;
    }
    
    // Check if adding this sentence would exceed the limit
    if (currentTokenCount + sentenceTokens > maxTokens) {
      // Save current chunk
      chunks.push(currentChunk.join(" "));
      
      // Start new chunk with overlap
      const overlapSentences = currentChunk.slice(-2); // Keep last 2 sentences for context
      currentChunk = [...overlapSentences, sentence];
      currentTokenCount = countTokens(currentChunk.join(" "));
    } else {
      // Add sentence to current chunk
      currentChunk.push(sentence);
      currentTokenCount += sentenceTokens;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  console.log(`📄 Split text into ${chunks.length} chunks`);
  chunks.forEach((chunk, idx) => {
    const tokens = countTokens(chunk);
    console.log(`   Chunk ${idx + 1}: ${tokens} tokens`);
  });

  return chunks;
}

/**
 * Prepare chunks with metadata for embedding
 * @param text - The text to chunk
 * @param maxTokens - Maximum tokens per chunk
 * @returns Array of chunks with metadata
 */
export function prepareChunksForEmbedding(
  text: string,
  maxTokens: number = 3000
): Array<{ text: string; chunkIndex: number; tokenCount: number }> {
  const chunks = chunkText(text, maxTokens);
  
  return chunks.map((chunk, index) => ({
    text: chunk,
    chunkIndex: index,
    tokenCount: countTokens(chunk),
  }));
}

/**
 * Free the encoder resources (not needed for js-tiktoken)
 */
export function freeEncoder() {
  // js-tiktoken doesn't require explicit cleanup
}
