/**
 * ============================================================================
 * MODULE PASSERELLE DE PAIEMENT MOBILE MONEY (MOMO GATEWAY)
 * ============================================================================
 * Ce fichier est conçu pour vous permettre d'intégrer facilement votre propre API
 * de prélèvement automatique par Mobile Money (MTN MoMo, Orange Money, Moov, Wave, etc.)
 * ou des agrégateurs comme CinetPay, FedaPay, Kkiapay, PayDunya.
 *
 * Emplacement des configurations API :
 * - Vous pouvez définir vos clés directement dans l'Espace Administrateur
 * - Ou renseigner les variables dans ce module ci-dessous.
 */

import { MomoProvider } from '../types';
import { StorageService } from './storage';

export interface MomoPaymentRequest {
  userId: string;
  phone: string;
  amount: number;
  provider: MomoProvider;
  vipTier: 'VIP1' | 'VIP2';
  customerName: string;
}

export interface MomoPaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
}

export const MomoGateway = {
  /**
   * INITIATION DU PRÉLÈVEMENT AUTOMATIQUE MOMO
   * -------------------------------------------------------------
   * C'est ici que vous connectez votre API de prélèvement automatique.
   * Exemples d'API compatibles :
   * 1. MTN Mobile Money Open API (Disbursement / Collection RequestToPay)
   * 2. Orange Money Web Payment / Orange OM API
   * 3. Wave API (Checkout Session)
   * 4. CinetPay / FedaPay / Kkiapay API
   */
  async requestToPay(request: MomoPaymentRequest): Promise<MomoPaymentResult> {
    const adminSettings = StorageService.getAdminSettings();
    const config = adminSettings.momoConfig;

    // AFFICHER DANS LA CONSOLE LE PAYLOAD POUR DÉBOGUER VOTRE INTÉGRATION
    console.log('[MOMO GATEWAY] Initiation de prélèvement automatique :', {
      phone: request.phone,
      amount: request.amount,
      provider: request.provider,
      merchantPhone: config.merchantPhone,
      apiKeyPresent: Boolean(config.apiKey),
    });

    /**
     * SI VOUS AVEZ VOTRE PROPRE API BACKEND OU CLE API EN PRODUCTION :
     * Décommentez le bloc ci-dessous et personnalisez l'URL :
     *
     * try {
     *   const response = await fetch('/api/momo/request-to-pay', {
     *     method: 'POST',
     *     headers: {
     *       'Content-Type': 'application/json',
     *       'Authorization': `Bearer ${config.apiKey}`
     *     },
     *     body: JSON.stringify({
     *       amount: request.amount,
     *       currency: 'XOF',
     *       externalId: `VIP-${Date.now()}`,
     *       payer: {
     *         partyIdType: 'MSISDN',
     *         partyId: request.phone.replace(/[^0-9]/g, '')
     *       },
     *       payerMessage: `Paiement ${request.vipTier} Bot Aviator`,
     *       payeeNote: 'Acces instantane Bot Aviator'
     *     })
     *   });
     *   const data = await response.json();
     *   return {
     *     success: true,
     *     transactionId: data.referenceId || `TX-${Date.now()}`,
     *     message: 'Demande USSD envoyee avec succes sur votre telephone.',
     *     status: 'PENDING'
     *   };
     * } catch (error) {
     *   console.error('Erreur Momo API:', error);
     * }
     */

    // SIMULATION PAR DÉFAUT (FONCTIONNE IMMÉDIATEMENT EN ATTENDANT VOTRE API)
    const reference = `MOMO-${request.provider}-${Date.now().toString().slice(-6)}`;
    return {
      success: true,
      transactionId: reference,
      message: `Demande de débit de ${request.amount} FCFA initiée sur le numéro ${request.phone}.`,
      status: 'PENDING',
    };
  },

  /**
   * VÉRIFICATION DU STATUT DE LA TRANSACTION
   */
  async verifyPayment(transactionId: string): Promise<{ isPaid: boolean; status: string }> {
    console.log('[MOMO GATEWAY] Vérification statut transaction :', transactionId);
    return {
      isPaid: true,
      status: 'SUCCESSFUL',
    };
  },
};
