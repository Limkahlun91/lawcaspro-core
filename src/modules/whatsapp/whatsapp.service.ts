import { supabase } from '../../lib/supabaseClient';

export interface WhatsAppMessage {
  phone: string;
  message: string;
  template_id?: string;
  template_params?: any;
}

export class WhatsAppService {
  /**
   * Send WhatsApp Notification via Provider (Meta/Twilio)
   * For now, this is a mock implementation that logs to DB.
   */
  async sendMessage(firmId: string, message: WhatsAppMessage): Promise<boolean> {
    try {
      // 1. Call Provider API (Mock)
      const providerResponse = await this.mockProviderCall(message);
      
      // 2. Log to DB
      await supabase.from('whatsapp_logs').insert({
        firm_id: firmId,
        phone: message.phone,
        message: message.message,
        status: providerResponse.status,
        provider_message_id: providerResponse.id,
        sent_at: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('WhatsApp Send Failed', error);
      return false;
    }
  }

  private async mockProviderCall(msg: WhatsAppMessage) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      id: `wamid.${Date.now()}`,
      status: 'sent'
    };
  }
}

export const whatsappService = new WhatsAppService();
