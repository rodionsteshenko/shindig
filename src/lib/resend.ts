import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "your_resend_api_key") {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}
