'use client';

import { useState } from "react";
import dynamic from "next/dynamic";
import classNames from "classnames";
import { GeneratorNew } from "@/components/GeneratorNew";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "@/components/Generator.module.css";
import "./page.css";

// Haptic feedback helper
function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
  }
}

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

type MainTab = "generator" | "batch" | "scanner";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("generator");

  return (
    <main className="page">
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>QR Suite</h1>
        <p className={styles.headerSubtitle}>Генератор, пакетная сборка и сканер QR-кодов</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === "generator" })}
          onClick={() => {
            setActiveTab("generator");
            triggerHaptic('light');
          }}
        >
          🎨 Генератор
        </button>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === "batch" })}
          onClick={() => {
            setActiveTab("batch");
            triggerHaptic('light');
          }}
        >
          📦 Пакетная
        </button>
        <button
          className={classNames(styles.tab, { [styles.tabActive]: activeTab === "scanner" })}
          onClick={() => {
            setActiveTab("scanner");
            triggerHaptic('light');
          }}
        >
          📷 Сканер
        </button>
      </div>

      {activeTab === "generator" && <GeneratorNew />}
      {activeTab === "batch" && <BatchGenerator />}
      {activeTab === "scanner" && <Scanner />}

      <footer className="page__footer">
        <p>
          Черновики хранятся локально. Поддерживается CSV поле <code>slug</code> для будущей миграции на
          динамические ссылки.
        </p>
      </footer>
    </main>
  );
}
