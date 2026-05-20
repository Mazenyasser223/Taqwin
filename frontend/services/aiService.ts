import apiClient, { ApiResponse } from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AiChatOptions {
  locale?: 'en' | 'ar';
}

class AiService {
  async chat(messages: ChatMessage[], options?: AiChatOptions): Promise<ApiResponse<{ reply: string }>> {
    return apiClient.post<{ reply: string }>('/api/ai/chat', {
      messages,
      locale: options?.locale,
    });
  }
}

export const aiService = new AiService();
export default aiService;
