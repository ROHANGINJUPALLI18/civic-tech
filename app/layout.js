import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { RootNavbar } from "@/components/civic/root-navbar";
import { MuiProvider } from "@/components/civic/mui-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Civic Accountability Engine",
  description:
    "Structured civic issue lifecycle with validation, duplicate control, SLA and trust workflows.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MuiProvider>
          <RootNavbar />
          <div className="pt-16">{children}</div>
        </MuiProvider>
      </body>
    </html>
  );
}
