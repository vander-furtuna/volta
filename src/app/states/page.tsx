import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-chrome";
import { StatesGallery } from "@/components/states/states-gallery";

export const metadata: Metadata = { title: "Volta: estados e exceções" };

export default function StatesPage() {
  return (
    <div className="bg-paper min-h-screen">
      <AppHeader />
      <StatesGallery />
    </div>
  );
}
