import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "@/components/shell/service-worker";

export const metadata: Metadata = {
  title: { default: "Hiraya", template: "%s · Hiraya" },
  description: "Hiraya — Where Family Stories Live Forever.",
  applicationName: "Hiraya",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Hiraya", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efdc" },
    { media: "(prefers-color-scheme: dark)", color: "#141c22" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies saved theme / motion / text-size preferences before first paint (no flash).
const prefsScript = `(function(){try{var p=JSON.parse(localStorage.getItem('hiraya:prefs')||'{}');var d=document.documentElement;var dark=p.theme==='dark'||(p.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(dark)d.classList.add('dark');if(p.motion==='reduce')d.classList.add('reduce-motion');if(p.text==='large')d.classList.add('text-large');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
