export type CountryCode = 'BJ' | 'BF' | 'CI' | 'GW' | 'ML' | 'NE' | 'SN' | 'TG';

export type OperatorId =
  | 'mtn_bj'
  | 'moov_bj'
  | 'celtiis_bj'
  | 'orange_bf'
  | 'moov_bf'
  | 'orange_ci'
  | 'mtn_ci'
  | 'moov_ci'
  | 'wave_ci'
  | 'orange_ml'
  | 'moov_ml'
  | 'mobi_cash_ml'
  | 'wave_ml'
  | 'airtel_ne'
  | 'orange_sn'
  | 'wave_sn'
  | 'freemoney_sn'
  | 'expresso_sn'
  | 'moov_tg'
  | 'togocel';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Operator {
  id: OperatorId;
  name: string;
  brand:
    | 'MTN'
    | 'ORANGE'
    | 'MOOV'
    | 'WAVE'
    | 'CELTIIS'
    | 'AIRTEL'
    | 'FREE'
    | 'EXPRESSO'
    | 'TMONEY'
    | 'MOBICASH';
  logoText: string;
  colorBg: string;
  colorText: string;
  accentBorder: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  instructionFr: string;
}

export interface CountryInfo {
  code: CountryCode;
  name: string;
  flag: string;
  currency: 'XOF';
  phonePrefix: string;
  phonePlaceholder: string;
  phoneFormatRegex: string;
  operators: Operator[];
  gatewayNote?: string;
}

export interface SasPayCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface SasPayPaymentRequest {
  amount: string; // e.g. "2500.00"
  currency: 'XOF';
  country: CountryCode;
  network: OperatorId;
  description: string;
  customer: SasPayCustomer;
}

export type TransactionCategory = 'VIP_ACTIVATION' | 'RECHARGE' | 'WITHDRAWAL';

export interface TransactionRecord {
  id: string; // Internal ID
  userId?: string; // Strict binding to authenticated user ID
  firebaseUid?: string; // Firebase Auth UID for cross-device sync
  bookmakerUserId?: string; // Betting site ID entered by client
  saspayPaymentId?: string; // ID returned by payment gateway
  transactionType?: TransactionCategory;
  amount: number;
  currency: 'XOF';
  country: CountryCode;
  countryName: string;
  network: OperatorId;
  operatorName: string;
  operatorBrand: string;
  phone: string;
  customerName: string;
  customerEmail: string;
  description: string;
  status: PaymentStatus;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
  apiResponse?: any;
}

export interface DashboardStats {
  totalVolume: number;
  totalVipRevenue?: number;
  totalRecharges?: number;
  totalWithdrawals?: number;
  adminBalance?: number;
  totalTransactions: number;
  successfulTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  successRate: number;
  volumeByCountry: Record<CountryCode, number>;
  volumeByOperator: Record<string, number>;
  countByStatus: Record<PaymentStatus, number>;
}
