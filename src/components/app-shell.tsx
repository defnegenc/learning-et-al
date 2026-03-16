"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TodayPage } from "@/components/today/today-page";

interface Session {
  userId: string | null;
  apiKey: string;
  provider: string;
  model: string;
  baseUrl: string;
  isSetUp: boolean;
}

interface AppShellProps {
  session: Session;
}

export function AppShell({ session }: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-12">
          <h1 className="text-base font-semibold tracking-tight">
            Paper Processor
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="vault">Vault</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <TodayPage session={session} />
          </TabsContent>

          <TabsContent value="vault">
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">
                Vault coming soon
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
