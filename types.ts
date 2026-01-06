export type CampaignType = 'EXISTING' | 'NEW_PURCHASE';

export interface TVCode {
  code: string; // ID del documento y valor
  tvModel: string;
  inches: number;
  ticketMultiplier: number;
  active: boolean;
  used: boolean;
  usedByParticipantId?: string;
  createdAt?: any;
}

export interface Participant {
  participantId: string;
  campaignType: CampaignType;
  fullName: string;
  ciHash: string; // Para deduplicación
  email: string;
  phone: string;
  city: string;
  code: string;
  files: {
    ciFrontPath: string;
    ciBackPath: string;
    invoicePath?: string;
  };
  ticketsCount: number;
  notified: {
    email: boolean;
    whatsapp: boolean;
    lastError?: string;
  };
  createdAt: any;
}

export interface Ticket {
  ticketId: string;
  participantId: string;
  code: string;
  inches: number;
  campaignType: CampaignType;
  codeString: string; // El código visible ej: SKY-2025-XXXXX
  createdAt: any;
}

export interface RegistrationResponse {
  success: boolean;
  tickets: string[];
  message: string;
}

export interface AdminStats {
  totalParticipants: number;
  totalTickets: number;
  codesUsed: number;
}