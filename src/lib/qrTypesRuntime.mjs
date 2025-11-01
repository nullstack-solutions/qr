const ALLOWED_WIFI_AUTH = new Set(["WPA", "WPA2", "WEP", "NOPASS"]);
const ISO_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:Z|[+-]\d{2}:\d{2})?$/;

const QR_TYPES = [
  {
    type: "url",
    title: "URL",
    description: "Автодобавление схемы и базовая валидация",
    fields: [
      {
        name: "url",
        label: "Ссылка",
        placeholder: "example.com/page",
        prefill: "https://example.com",
        required: true,
        validate: (value) => {
          const trimmed = value.trim();
          if (!trimmed) return "Укажите ссылку";
          const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
          try {
            const url = new URL(normalized);
            if (!url.hostname.includes(".")) {
              return "Укажите корректный домен";
            }
          } catch (error) {
            return "Некорректный URL";
          }
          return null;
        }
      }
    ],
    buildPayload: (values) => {
      const raw = values.url?.trim() ?? "";
      if (!raw) return "";
      return raw.startsWith("http") ? raw : `https://${raw}`;
    }
  },
  {
    type: "text",
    title: "Текст",
    description: "Любой UTF-8 текст",
    fields: [
      {
        name: "text",
        label: "Текст",
        type: "textarea",
        placeholder: "Введите текст",
        prefill: "Привет из QR Suite!",
        required: true
      }
    ],
    buildPayload: (values) => values.text ?? ""
  },
  {
    type: "tel",
    title: "Телефон",
    description: "tap-to-call",
    fields: [
      {
        name: "phone",
        label: "Номер",
        placeholder: "+7 900 000-00-00",
        prefill: "+79991234567",
        required: true,
        validate: (value) => {
          const digits = value.replace(/[^\d+]/g, "");
          if (!/^\+?[\d]{5,15}$/.test(digits)) {
            return "Введите телефон в формате +79991234567";
          }
          return null;
        }
      }
    ],
    buildPayload: (values) => `tel:${values.phone?.replace(/[^\d+]/g, "") ?? ""}`
  },
  {
    type: "sms",
    title: "SMS",
    description: "SMSTO: номер и текст",
    fields: [
      {
        name: "phone",
        label: "Номер",
        required: true,
        placeholder: "+79001234567",
        prefill: "+79991234567"
      },
      {
        name: "message",
        label: "Сообщение",
        type: "textarea",
        placeholder: "Текст SMS",
        prefill: "Привет! Это демо сообщение."
      }
    ],
    buildPayload: (values) => {
      const phone = values.phone?.replace(/[^\d+]/g, "") ?? "";
      const text = encodeURIComponent(values.message ?? "");
      return `SMSTO:${phone}:${text}`;
    }
  },
  {
    type: "mailto",
    title: "Email",
    description: "mailto: адрес, тема, тело",
    fields: [
      {
        name: "address",
        label: "Email",
        type: "email",
        required: true,
        prefill: "hello@example.com"
      },
      {
        name: "subject",
        label: "Тема",
        prefill: "Встреча"
      },
      {
        name: "body",
        label: "Сообщение",
        type: "textarea",
        prefill: "Коллеги, давайте синхронизируемся завтра."
      }
    ],
    buildPayload: (values) => {
      const params = new URLSearchParams();
      if (values.subject) params.set("subject", values.subject);
      if (values.body) params.set("body", values.body);
      const search = params.toString();
      return `mailto:${values.address ?? ""}${search ? `?${search}` : ""}`;
    }
  },
  {
    type: "geo",
    title: "Геометка",
    description: "Координаты lat,lng",
    fields: [
      {
        name: "lat",
        label: "Широта",
        required: true,
        helper: "Напр. 59.9386",
        prefill: "59.9386",
        validate: (value) => {
          if (!value.trim()) return null;
          const normalized = value.replace(",", ".");
          const num = Number(normalized);
          if (!Number.isFinite(num)) return "Используйте числовое значение";
          if (num < -90 || num > 90) return "Широта от -90 до 90";
          return null;
        }
      },
      {
        name: "lng",
        label: "Долгота",
        required: true,
        helper: "Напр. 30.3141",
        prefill: "30.3141",
        validate: (value) => {
          if (!value.trim()) return null;
          const normalized = value.replace(",", ".");
          const num = Number(normalized);
          if (!Number.isFinite(num)) return "Используйте числовое значение";
          if (num < -180 || num > 180) return "Долгота от -180 до 180";
          return null;
        }
      },
      { name: "label", label: "Описание", prefill: "Санкт-Петербург" }
    ],
    buildPayload: (values) => {
      const lat = normalizeCoordinate(values.lat, 90);
      const lng = normalizeCoordinate(values.lng, 180);
      if (!lat || !lng) return "";
      const label = values.label ? `?q=${encodeURIComponent(values.label)}` : "";
      return `geo:${lat},${lng}${label}`;
    }
  },
  {
    type: "wifi",
    title: "Wi-Fi",
    description: "SSID, тип, пароль",
    fields: [
      { name: "ssid", label: "SSID", required: true, prefill: "OfficeWiFi" },
      {
        name: "auth",
        label: "Шифрование",
        placeholder: "WPA, WPA2, WEP или nopass",
        helper: "nopass для открытых сетей",
        prefill: "WPA2",
        validate: (value) => {
          if (!value.trim()) return null;
          const normalized = value.trim().toUpperCase();
          if (!ALLOWED_WIFI_AUTH.has(normalized)) {
            return `Допустимо: ${Array.from(ALLOWED_WIFI_AUTH).join(', ')}`;
          }
          return null;
        }
      },
      {
        name: "password",
        label: "Пароль",
        prefill: "SuperSecure123",
        validate: (value, allValues) => {
          const auth = normalizeWifiAuth(allValues.auth);
          if (auth !== "nopass" && !value.trim()) {
            return "Пароль обязателен для выбранного шифрования";
          }
          return null;
        }
      },
      {
        name: "hidden",
        label: "Скрытая сеть (true/false)",
        placeholder: "false",
        prefill: "false",
        validate: (value) => {
          if (!value.trim()) return null;
          if (!/^(true|false)$/i.test(value.trim())) {
            return "Введите true или false";
          }
          return null;
        }
      }
    ],
    buildPayload: (values) => {
      const ssid = values.ssid ?? "";
      const auth = normalizeWifiAuth(values.auth);
      const password = values.password ?? "";
      const passwordSection = auth === "nopass" ? "" : `;P:${escapeWifiValue(password)}`;
      const hidden = values.hidden?.toLowerCase() === "true" ? ";H:true" : "";
      return `WIFI:T:${auth};S:${escapeWifiValue(ssid)}${passwordSection}${hidden};;`;
    }
  },
  {
    type: "vcard",
    title: "vCard",
    description: "Контакты vCard 3.0",
    fields: [
      { name: "firstName", label: "Имя", required: true, prefill: "Иван" },
      { name: "lastName", label: "Фамилия", prefill: "Иванов" },
      { name: "organization", label: "Компания", prefill: "ООО «Пример»" },
      { name: "title", label: "Должность", prefill: "Менеджер" },
      { name: "phone", label: "Телефон", prefill: "+79991234567" },
      { name: "email", label: "Email", prefill: "ivan@example.com" },
      { name: "website", label: "Сайт", prefill: "https://example.com" },
      {
        name: "notes",
        label: "Заметки",
        type: "textarea",
        prefill: "Будьте на связи"
      }
    ],
    buildPayload: (values) => {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${values.lastName ?? ""};${values.firstName ?? ""};;;`,
        `FN:${[values.firstName, values.lastName].filter(Boolean).join(" ")}`
      ];
      if (values.organization) lines.push(`ORG:${values.organization}`);
      if (values.title) lines.push(`TITLE:${values.title}`);
      if (values.phone) lines.push(`TEL;TYPE=CELL:${values.phone}`);
      if (values.email) lines.push(`EMAIL;TYPE=INTERNET:${values.email}`);
      if (values.website) lines.push(`URL:${values.website}`);
      if (values.notes) lines.push(`NOTE:${values.notes}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
  },
  {
    type: "mecard",
    title: "MeCard",
    description: "Компактный формат визитки",
    fields: [
      { name: "name", label: "Имя", required: true, prefill: "Иван Иванов" },
      { name: "phone", label: "Телефон", prefill: "+79991234567" },
      { name: "email", label: "Email", prefill: "ivan@example.com" },
      { name: "address", label: "Адрес", type: "textarea", prefill: "Россия, Москва" },
      { name: "note", label: "Заметка", type: "textarea", prefill: "Добавьте меня в контакты" }
    ],
    buildPayload: (values) => {
      const parts = [`MECARD:N:${values.name ?? ""};`];
      if (values.phone) parts.push(`TEL:${values.phone};`);
      if (values.email) parts.push(`EMAIL:${values.email};`);
      if (values.address) parts.push(`ADR:${values.address};`);
      if (values.note) parts.push(`NOTE:${values.note};`);
      parts.push(";");
      return parts.join("");
    }
  },
  {
    type: "ics",
    title: "Событие ICS",
    description: "iCalendar (VEVENT)",
    fields: [
      { name: "summary", label: "Заголовок", required: true, prefill: "Командный созвон" },
      {
        name: "description",
        label: "Описание",
        type: "textarea",
        prefill: "Повестка: результаты спринта"
      },
      { name: "location", label: "Место", prefill: "Офис, переговорная 1" },
      {
        name: "start",
        label: "Начало (ISO 8601)",
        placeholder: "2024-03-12T10:00",
        prefill: "2024-03-12T10:00",
        validate: (value) => {
          const trimmed = value.trim();
          if (!trimmed) return null;
          if (!isValidISODateTime(trimmed)) {
            return "Используйте формат ISO 8601";
          }
          return null;
        }
      },
      {
        name: "end",
        label: "Конец (ISO 8601)",
        placeholder: "2024-03-12T12:00",
        prefill: "2024-03-12T11:00",
        validate: (value, allValues) => {
          const trimmed = value.trim();
          if (!trimmed) return null;
          if (!isValidISODateTime(trimmed)) {
            return "Используйте формат ISO 8601";
          }
          const start = allValues.start?.trim();
          if (start && isValidISODateTime(start)) {
            if (new Date(trimmed) <= new Date(start)) {
              return "Окончание должно быть позже начала";
            }
          }
          return null;
        }
      }
    ],
    buildPayload: (values) => {
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT"];
      if (values.summary) lines.push(`SUMMARY:${values.summary}`);
      if (values.description) lines.push(`DESCRIPTION:${values.description}`);
      if (values.location) lines.push(`LOCATION:${values.location}`);
      if (values.start) lines.push(`DTSTART:${formatICSDate(values.start)}`);
      if (values.end) lines.push(`DTEND:${formatICSDate(values.end)}`);
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\n");
    }
  }
];

function normalizeWifiAuth(value) {
  const upper = (value ?? "").trim().toUpperCase();
  if (upper === "NOPASS") return "nopass";
  if (ALLOWED_WIFI_AUTH.has(upper)) return upper;
  return "WPA";
}

function escapeWifiValue(value) {
  return (value ?? "").replace(/([\\;",:])/g, "\\$1");
}

function normalizeCoordinate(value, maxAbs) {
  if (!value) return "";
  const normalized = value.trim().replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return "";
  if (Math.abs(num) > maxAbs) return "";
  return String(num);
}

function isValidISODateTime(value) {
  if (!value) return false;
  if (!ISO_DATETIME_REGEX.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function formatICSDate(value) {
  if (!isValidISODateTime(value)) {
    return value;
  }

  try {
    const date = new Date(value);
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  } catch (error) {
    return value;
  }
}

function getTypeDefinition(type) {
  const def = QR_TYPES.find((item) => item.type === type);
  if (!def) {
    throw new Error(`Unsupported QR type: ${type}`);
  }
  return def;
}

export { QR_TYPES, getTypeDefinition };

