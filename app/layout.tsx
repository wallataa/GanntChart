import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gantt Chart",
  description: "Google Sheets–style Gantt chart with Google Calendar integration",
};

// Lock page zoom: the grid is an app surface (panning + drag gestures), and
// pinch-zooming out strands the layout at an unusable scale. maximumScale also
// stops iOS auto-zooming the page when a small grid input gets focus.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/** Applied before hydration so a saved dark theme doesn't flash light. */
const themeInitScript = `try{if(JSON.parse(localStorage.getItem("gantt:theme"))==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
