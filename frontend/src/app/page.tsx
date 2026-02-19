import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-6xl font-black tracking-tighter text-center bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
          Outpost
        </h1>
        <p className="text-xl text-muted-foreground text-center max-w-2xl">
          AI-powered lead research and outreach automation. Stop manual prospecting. Start closing.
        </p>

        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/features">Learn More</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
