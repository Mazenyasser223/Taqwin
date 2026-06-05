import apiClient, { type ApiResponse } from './api';
import type { SupportCategory } from '../features/support/supportFaq';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  description: string;
  imageUrl?: string | null;
  status: SupportTicketStatus;
  createdAt: string;
}

export interface CreateSupportTicketData {
  category: SupportCategory;
  subject: string;
  description: string;
  imageUrl?: string | null;
}

class SupportService {
  async listTickets(): Promise<ApiResponse<SupportTicket[]>> {
    return apiClient.get<SupportTicket[]>('/api/support/tickets');
  }

  async createTicket(data: CreateSupportTicketData): Promise<ApiResponse<SupportTicket>> {
    return apiClient.post<SupportTicket>('/api/support/tickets', data);
  }
}

export const supportService = new SupportService();
export default supportService;
