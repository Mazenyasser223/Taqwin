import apiClient, { ApiResponse } from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

class AiService {
  async chat(messages: ChatMessage[], system?: string): Promise<ApiResponse<{ reply: string }>> {
    return apiClient.post<{ reply: string }>('/api/ai/chat', { messages, system });
  }
}

export const aiService = new AiService();
export default aiService;
