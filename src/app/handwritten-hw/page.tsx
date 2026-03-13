import type { Metadata } from "next";
import HandwrittenHwStudio from "@/components/handwritten-hw/HandwrittenHwStudio";

export const metadata: Metadata = {
  title: "Handwritten HW | Automate NYU",
  description:
    "Upload a homework PDF and handwriting reference to generate handwritten paper solutions.",
};

export default function HandwrittenHwPage() {
  return <HandwrittenHwStudio />;
}
