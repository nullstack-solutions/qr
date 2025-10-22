'use client';

import dynamic from "next/dynamic";
import { GeneratorNew } from "@/components/GeneratorNew";
import { Skeleton } from "@/components/ui/Skeleton";
import "./page.css";

// Code-split heavy components to reduce initial bundle size
const BatchGenerator = dynamic(
  () => import("@/components/BatchGenerator").then((m) => ({ default: m.BatchGenerator })),
  {
    loading: () => <Skeleton />,
    ssr: false
  }
);

const Scanner = dynamic(
  () => import("@/components/Scanner").then((m) => ({ default: m.Scanner })),
  {
    loading: () => <Skeleton />,
    ssr: false
  }
);

export default function HomePage() {
  return (
    <main className="page">
      <GeneratorNew />
      <BatchGenerator />
      <Scanner />

      <footer className="page__footer">
        <p>
          Черновики хранятся локально. Поддерживается CSV поле <code>slug</code> для будущей миграции на
          динамические ссылки.
        </p>
      </footer>
    </main>
  );
}
