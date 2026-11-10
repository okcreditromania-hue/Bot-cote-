export type CountryCode = 'BJ' | 'CI' | 'SN' | 'TG' | 'BF' | 'CM';

export type OperatorId =
  | 'mtn_bj'
  | 'moov_bj'
  | 'celtiis_bj'
  | 'orange_ci'
  | 'mtn_ci'
  | 'wave_ci'
  | 'moov_ci'
  | 'orange_sn'
  | 'wave_sn'
  | 'yas_sn'
  | 'moov_tg'
  | 'mtn_tg'
  | 'orange_bf'
  | 'moov_bf'
  | 'mtn_cm'
  | 'orange_cm';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Operator {
  id: OperatorId;
  name: string;
  brand: 'MTN' | 'ORANGE' | 'MOOV' | 'WAVE' | 'CELTIIS' | 'YAS';
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
  currency: 'XOF' | 'XAF';
  phonePrefix: string;
  phonePlaceholder: string;
  phoneFormatRegex: string;
  operators: Operator[];
}

export interface SasPayCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export interface SasPayPaymentRequest {
  amount: string; // e.g. "2500.00"
  currency: 'XOF' | 'XAF';
  country: CountryCode;
  network: OperatorId;
  description: string;
  customer: SasPayCustomer;
}

export interface TransactionRecord {
  id: string; // Internal ID
  saspayPaymentId?: string; // ID returned by SasPay API
  amount: number;
  currency: 'XOF' | 'XAF';
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
  totalTransactions: number;
  successfulTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  successRate: number;
  volumeByCountry: Record<CountryCode, number>;
  volumeByOperator: Record<string, number>;
  countByStatus: Record<PaymentStatus, number>;
}
