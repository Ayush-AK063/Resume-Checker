export function formatFileType(mimeType: string | null): string {
  if (!mimeType) return 'Unknown';
  
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'text/plain': 'TXT',
    'application/rtf': 'RTF',
    'application/vnd.oasis.opendocument.text': 'ODT'
  };
  
  return typeMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'Unknown';
}