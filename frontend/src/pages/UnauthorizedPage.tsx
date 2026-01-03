import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-4">
          <ShieldAlert className="h-24 w-24 mx-auto text-destructive" />
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page. Please contact your
              administrator if you believe this is an error.
            </p>
          </div>
        </div>

        <Button asChild>
          <Link to="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
