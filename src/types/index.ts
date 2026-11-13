export type VIPPlanId = 'VIP1' | 'VIP2';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid';
export type MomoProvider = 'MTN' | 'ORANGE' | 'MOOV' | 'WAVE';

export interface User {
  id: string;
  firebaseUid?: string;
  email?: string;
  fullName: string;
  phone: string;
  password?: string;
  country: string;
  bookmaker: string;
  bookmakerUserId?: string;
  vipTier: VIPPlanId;
  paymentStatus: PaymentStatus;
  balance?: number;
  paymentReference?: string;
  paymentMethod?: MomoProvider;
  amountPaid?: number;
  paymentDate?: string;
  registeredAt: string;
  notes?: string;
}

export type ClientOperationType = 'VIP_ACTIVATION' | 'RECHARGE' | 'WITHDRAWAL' | 'BET' | 'WIN';
export type ClientOperationStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface ClientOperation {
  id: string;
  userId: string;
  firebaseUid?: string;
  userPhone: string;
  type: ClientOperationType;
  amount: number;
  status: ClientOperationStatus;
  title: string;
  description: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AviatorRoundHistoryItem {
  roundNumber: number;
  crashPoint: number;
  code15: string;
  timestamp: string;
}

export interface AviatorActiveBet {
  betId: string;
  userId: string;
  amount: number;
  roundNumber: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  winAmount?: number;
}

export interface AviatorGameState {
  phase: 'COUNTDOWN' | 'FLYING' | 'CRASHED';
  roundNumber: number;
  roundId: string;
  code15: string;
  nextCrashPoint: number | null;
  currentMultiplier: number;
  countdownSeconds: number;
  elapsedFlightSeconds: number;
  history: AviatorRoundHistoryItem[];
  activeBet?: AviatorActiveBet | null;
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
