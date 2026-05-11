import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Heart className="h-4 w-4 text-red-500" fill="currentColor" />
          <span>HeartGuard</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2025 Parth Chavan™ — All rights reserved
        </p>
      </div>
    </footer>
  );
}
