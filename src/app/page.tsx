import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
// The AuthHeader in layout.tsx will handle showing Sign In/Dashboard links based on session.

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen justify-center items-center text-center p-4">
      <main className="flex-grow flex flex-col justify-center items-center">
        <h1 className="text-5xl tracking-tighter font-medium mb-4">
          Welcome to Zeitlist
        </h1>
        <p className="tracking-tight text-xl mb-8 max-w-md">
          The easiest way to create and manage waitlists for your projects.
          Sign up or log in to get started!
        </p>
        {/* AuthHeader in layout.tsx already provides Sign In / Dashboard links */}
        {/* If specific buttons are desired here, they can be added, e.g.:
        <div className="space-x-4">
          <Link href="/auth/signin">
            <Button variant="default" size="lg">Sign In</Button>
          </Link>
          <Link href="/dashboard"> // This link is more for users already signed in
            <Button variant="outline" size="lg">Go to Dashboard</Button>
          </Link>
        </div>
        */}
         <p className="text-sm text-muted-foreground mt-4">
          (Use email <code>jsmith@example.com</code> and password <code>password</code> to sign in.)
        </p>
      </main>
      <footer className="py-4">
        <Button size="icon" variant="ghost" asChild>
          <Link href="https://github.com/zeitgg/zeitlist" target="_blank">
            <FaGithub />
            <span className="sr-only">GitHub Repository</span>
          </Link>
        </Button>
      </footer>
    </div>
  );
}
