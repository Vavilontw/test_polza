import "./globals.css";

export const metadata = { title: "Компании" };

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
