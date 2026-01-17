export interface Product {
  id?: string;
  model_name: string;
  model_key: string;
  description: string;
  ticket_multiplier: number;
  is_active: boolean;
}

export interface Client {
  clientId: string;
  fullName: string;
  ci: string;
  city: string; // La Paz, Cochabamba, Santa Cruz, El Alto, Other
  email: string;
  phone: string;
  tvModel: string;
  serial?: string;
  invoicePath: string;
  ticketId?: string; // Legacy single ticket
  ticketIds?: string[]; // New multiple tickets
  createdAt: any; // Timestamp
}

export interface Seller {
  uid: string;
  fullName: string;
  ci: string;
  city: string;
  phone: string;
  email: string;
  leaderCi?: string; // CI of the seller who invited this user
  totalSales: number;
  lastSaleAt?: any;
  isCertified?: boolean;
  quizScore?: number;
  certifiedAt?: any;
}

export interface Sale {
  saleId: string;
  sellerId: string;
  tvModel: string;
  invoiceNumber: string;
  invoicePath: string;
  createdAt: any;
  city: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface LeaderboardData {
  city: string;
  topSellers: {
    name: string;
    sales: number;
  }[];
}

export interface RegistrationResponse {
  success: boolean;
  ticketId?: string;
  ticketIds?: string[];
  message: string;
}

export interface NotificationConfig {
  whatsapp: {
    enabled: boolean;
    token: string;
    phoneId: string;
    templateName: string;
  };
  email: {
    enabled: boolean;
    provider: 'SENDGRID' | 'SMTP';
    apiKey?: string;
    host?: string;
    port?: string;
    user?: string;
    pass?: string;
  };
}

export interface ValidCode {
  code: string;
  model: string; // This should ideally match Product model_key or model_name
  productId?: string; // Optional link to specific product
  used: boolean;
  usedBy?: string; // ClientId
  usedAt?: any;
  batchId?: string;
}

export interface Winner {
  ticketId: string;
  fullName: string;
  ci: string;
  city: string;
  tvModel: string;
  phone: string;
  wonAt: any;
  selectedBy?: string;
}
