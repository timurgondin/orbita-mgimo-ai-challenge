import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Орбита — Университет Будущего",
  description:
    "Концепт студенческого кабинета для конкурса MGIMO×AI Challenge. Все данные вымышлены.",
};

// viewport-fit=cover — страница под «чёлкой» и «подбородком» iPhone; отступы — env(safe-area-inset-*)
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={onest.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={["dark", "light"]}
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
