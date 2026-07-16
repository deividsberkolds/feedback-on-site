import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">404 — Page not found</h1>
      <Link href="/" className={buttonVariants()}>
        Back home
      </Link>
    </div>
  );
}
