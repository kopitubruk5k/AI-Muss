import { Outfit } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata = {
  title: "Finance Muss",
  description: "Sistem Pencatat Keuangan & Analisis Grafik",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${outfit.variable} font-sans antialiased`}>
        {/* Glow Effects */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] bg-primary-glow blur-[100px] rounded-full opacity-40 mix-blend-screen" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[800px] h-[800px] bg-income-glow blur-[100px] rounded-full opacity-40 mix-blend-screen" />
        </div>

        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
