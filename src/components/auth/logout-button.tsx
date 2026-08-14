import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="outline" size="sm" type="submit">
        <LogOut className="h-4 w-4 mr-1.5" aria-hidden />
        Sign out
      </Button>
    </form>
  );
}
