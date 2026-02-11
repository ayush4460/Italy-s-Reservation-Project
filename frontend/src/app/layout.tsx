import type { Metadata } from "next";
import { Poppins, Montserrat } from "next/font/google";
import "./globals.css";
import { GlobalLoaderProvider } from "@/components/global-loader-provider";
import { Footer } from "@/components/footer";
import { Toaster } from "sonner";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Italys Reservation System",
  description: "Powered by Axiom HiTech",
};

import { ThemeProvider } from "@/context/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${poppins.variable} ${montserrat.variable} antialiased bg-white text-black dark:bg-black dark:text-white transition-colors duration-200`}
      >
        <ThemeProvider defaultTheme="system" storageKey="italys-theme">
          <GlobalLoaderProvider />
          <Toaster
            richColors
            position="top-right"
            duration={3000}
            theme="system"
          />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
