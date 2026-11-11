export type VIPPlanId = 'VIP1' | 'VIP2';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid';
export type MomoProvider = 'MTN' | 'ORANGE' | 'MOOV' | 'WAVE';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  password?: string;
  country: string;
  bookmaker: string;
  vipTier: VIPPlanId;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentMethod?: MomoProvider;
  amountPaid?: number;
  paymentDate?: string;
  registeredAt: string;
  notes?: string;
}

export interface VIPPlan {
  id: VIPPlanId;
  name: string;
  price: number;
  capitalMin: number;
  capitalMax: number;
  availableSeats: number;
  totalSeats: number;
  badge: string;
  description: string;
  multiplierRange: string;
  successRate: string;
  features: string[];
  recommendedFor: string;
}

export interface BookmakerPlatform {
  id: string;
  name: string;
  badge: string;
  minDeposit: string;
  rating: string;
  aviatorGameName: string;
  popularCountries: string[];
  color: string;
}

export interface AdminSettings {
  adminPhone: string;
  adminPin: string;
  botRedirectUrl: string;
  botTitle: string;
  vip1Price: number;
  vip1Seats: number;
  vip2Price: number;
  vip2Seats: number;
  momoConfig: {
    provider: MomoProvider | 'CUSTOM_API';
    merchantPhone: string;
    merchantName: string;
    apiKey: string;
    secretKey: string;
    webhookUrl: string;
    autoValidation: boolean;
  };
}

export interface LiveSignal {
  id: string;
  game: string;
  predictedMultiplier: string;
  safetyCashout: string;
  probability: string;
  validUntil: string;
  status: 'ACTIVE' | 'WON' | 'NEXT';
}
