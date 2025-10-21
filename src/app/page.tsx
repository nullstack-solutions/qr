'use client';

import dynamic from "next/dynamic";
import { Generator } from "@/components/Generator";
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
      <header className="page__hero">
        <div>
          <h1>QR Suite</h1>
          <p>
            Генератор, пакетная сборка и сканер QR-кодов. Полностью офлайн, с поддержкой всех ключевых
            форматов и автосохранением черновиков в IndexedDB.
          </p>
        </div>
        <div className="page__hero-meta">
          <span>Коррекция H</span>
          <span>10k файлов</span>
          <span>Web Worker</span>
        </div>
      </header>

      <Generator />
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
