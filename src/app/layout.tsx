import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Volta",
  description: "Campanhas de recompra compreensíveis, controladas e mensuráveis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={cn("h-full", bricolage.variable, figtree.variable)}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
