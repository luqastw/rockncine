import type { Metadata, Viewport } from "next";
import { Geologica, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rockncine",
  description: "Assista junto, em sync — link colado, sala compartilhada.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Rockncine",
    title: "Rockncine",
    description: "Assista junto, em sync — cole um link e todo mundo entra na mesma sala.",
  },
  twitter: {
    card: "summary",
    title: "Rockncine",
    description: "Assista junto, em sync — cole um link e todo mundo entra na mesma sala.",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1a14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geologica.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.dataset.js='';setTimeout(function(){if(!document.documentElement.hasAttribute('data-hydrated'))document.documentElement.setAttribute('data-reveal','')},1200);",
          }}
        />
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
