import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Shindig — Event Invites That Don't Suck",
  description: "Create beautiful event invitations. Collect RSVPs. Send reminders. All free.",
  openGraph: {
    title: "Shindig — Event Invites That Don't Suck",
    description: "Create beautiful event invitations. Collect RSVPs. Send reminders. All free.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
