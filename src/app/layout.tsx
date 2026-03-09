import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מילה בערפל",
  description: "משחק חברתי מרובה משתתפים של רמזים, חשדות וניבויים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Heebo', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
