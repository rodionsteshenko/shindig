/**
 * Twilio SMS utility for sending text messages.
 * Returns null gracefully when credentials are not configured.
 */

import twilio from "twilio";
import type { Twilio } from "twilio";

let twilioClient: Twilio | null = null;

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Gets the Twilio client configuration, or null if not configured.
 * Checks for required environment variables.
 */
function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  // Return null if any required credential is missing or is a placeholder
  if (
    !accountSid ||
    accountSid === "your_twilio_account_sid" ||
    !authToken ||
    authToken === "your_twilio_auth_token" ||
    !fromNumber ||
    fromNumber === "your_twilio_phone_number"
  ) {
    return null;
  }

  return { accountSid, authToken, fromNumber };
}

/**
 * Gets the Twilio client instance, or null if credentials are not configured.
 * Uses a singleton pattern like the Resend client.
 */
export function getTwilioClient(): Twilio | null {
  const config = getTwilioConfig();
  if (!config) {
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(config.accountSid, config.authToken);
  }

  return twilioClient;
}

/**
 * Gets the configured "from" phone number, or null if not configured.
 */
export function getTwilioFromNumber(): string | null {
  return process.env.TWILIO_PHONE_NUMBER || null;
}

export interface SendSmsResult {
  success: true;
  messageSid: string;
}

export interface SendSmsError {
  success: false;
  error: string;
}

export type SendSmsResponse = SendSmsResult | SendSmsError;

/**
 * Check if Twilio test mode is enabled.
 * When TWILIO_TEST_MODE=true, SMS sends will be simulated without actually sending.
 * This is useful for E2E testing.
 */
function isTestMode(): boolean {
  return process.env.TWILIO_TEST_MODE === "true";
}

/**
 * Check if SMS is configured (either real credentials or test mode).
 */
export function isSmsConfigured(): boolean {
  return isTestMode() || getTwilioConfig() !== null;
}

/**
 * Sends an SMS message using Twilio.
 *
 * @param to - The recipient phone number in E.164 format (e.g., +15551234567)
 * @param body - The message body text
 * @returns A result object with success status and either messageSid or error
 *
 * @example
 * const result = await sendSms("+15551234567", "Hello from Shindig!");
 * if (result.success) {
 *   console.log("Sent:", result.messageSid);
 * } else {
 *   console.error("Failed:", result.error);
 * }
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResponse> {
  // Test mode: simulate successful SMS send without actually sending
  if (isTestMode()) {
    console.log(`[TEST MODE] Would send SMS to ${to}: ${body.substring(0, 50)}...`);
    return {
      success: true,
      messageSid: `TEST_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  const client = getTwilioClient();
  const fromNumber = getTwilioFromNumber();

  if (!client || !fromNumber) {
    return {
      success: false,
      error: "SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    };
  }

  try {
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });

    return {
      success: true,
      messageSid: message.sid,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown SMS error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
