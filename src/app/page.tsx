import { Generator } from "@/components/Generator";
import { BatchGenerator } from "@/components/BatchGenerator";
import { Scanner } from "@/components/Scanner";
import "./page.css";

export default function HomePage() {
  return (
    <main className="page">
      <header className="page__hero">
        <div>
          <h1>QR Suite · этап A</h1>
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
