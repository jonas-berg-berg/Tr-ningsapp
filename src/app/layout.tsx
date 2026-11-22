import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Träningsappen",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Träning", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/icon-192.png" },
  description: "Logga dina träningspass, håll din streak vid liv och hjälp laget nå lagmålet.",
};

export const viewport: Viewport = {
  themeColor: "#070b1e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
