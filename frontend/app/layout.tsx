import type { Metadata } from "next";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";

import { wagmiConfig } from "@/lib/web3modal-config";
import { Web3ModalProvider } from "@/components/providers/web3-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Inheritance - Digital Inheritance",
  description: "Securely manage your digital legacy",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Ambil cookies dari request headers untuk SSR hydration Wagmi
  // Ini memungkinkan koneksi wallet tetap ada setelah page refresh
  const headersList = await headers();
  const cookies = headersList.get("cookie");
  const initialState = cookieToInitialState(wagmiConfig, cookies);

  return (
    <html lang="en">
      <body className="antialiased">
        <Web3ModalProvider initialState={initialState}>
          {children}
        </Web3ModalProvider>
      </body>
    </html>
  );
}
