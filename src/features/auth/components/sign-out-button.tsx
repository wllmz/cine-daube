import { Button } from "@/components/ui/button";
import { signOut } from "../actions/auth-actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost">
        Se déconnecter
      </Button>
    </form>
  );
}
