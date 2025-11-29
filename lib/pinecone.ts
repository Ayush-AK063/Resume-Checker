import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Get the index name from environment variable
const indexName = process.env.PINECONE_INDEX_NAME || "resume-checker";

/**
 * Get the Pinecone index for resume storage
 */
export async function getPineconeIndex() {
  return pinecone.index(indexName);
}

/**
 * Store resume chunks in Pinecone
 * @param resumeId - Unique resume identifier
 * @param chunks - Array of text chunks with their metadata
 */
export async function storeResumeChunks(
  resumeId: string,
  chunks: Array<{
    text: string;
    embedding: number[];
    chunkIndex: number;
  }>,
  metadata: {
    fileName: string;
    userId?: string;
  }
) {
  const index = await getPineconeIndex();
  
  // Prepare vectors for upsert
  const vectors = chunks.map((chunk) => ({
    id: `${resumeId}_chunk_${chunk.chunkIndex}`,
    values: chunk.embedding,
    metadata: {
      resumeId,
      fileName: metadata.fileName,
      ...(metadata.userId && { userId: metadata.userId }),
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
    },
  }));

  // Upsert vectors to Pinecone
  await index.upsert(vectors);
  
  console.log(`✅ Stored ${vectors.length} chunks for resume ${resumeId} in Pinecone`);
}

/**
 * Search for relevant resume chunks based on query
 * @param queryEmbedding - The embedding of the search query
 * @param topK - Number of results to return
 * @param filter - Optional metadata filter
 */
export async function searchResumeChunks(
  queryEmbedding: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
) {
  const index = await getPineconeIndex();
  
  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter,
  });

  return queryResponse.matches?.map((match) => ({
    id: match.id,
    score: match.score,
    resumeId: match.metadata?.resumeId as string,
    fileName: match.metadata?.fileName as string,
    chunkIndex: match.metadata?.chunkIndex as number,
    text: match.metadata?.text as string,
  })) || [];
}

/**
 * Delete all chunks for a specific resume
 * @param resumeId - The resume ID to delete
 */
export async function deleteResumeChunks(resumeId: string) {
  const index = await getPineconeIndex();
  
  // Delete by metadata filter
  await index.deleteMany({
    filter: {
      resumeId: { $eq: resumeId }
    }
  });
  
  console.log(`✅ Deleted all chunks for resume ${resumeId} from Pinecone`);
}

/**
 * Delete all vectors in the index (use with caution)
 */
export async function deleteAllVectors() {
  const index = await getPineconeIndex();
  await index.deleteAll();
  console.log("✅ Deleted all vectors from Pinecone");
}
