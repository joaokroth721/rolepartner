import "./globals.css";
import Providers from "./providers";

export const metadata = { title: "Sprach-Rollenspiel" };

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
