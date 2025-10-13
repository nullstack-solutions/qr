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
        placeholder: "+79001234567"
      },
      {
        name: "message",
        label: "Сообщение",
        type: "textarea",
        placeholder: "Текст SMS"
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
        required: true
      },
      {
        name: "subject",
        label: "Тема"
      },
      {
        name: "body",
        label: "Сообщение",
        type: "textarea"
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
      { name: "lat", label: "Широта", required: true, helper: "Напр. 59.9386" },
      { name: "lng", label: "Долгота", required: true, helper: "Напр. 30.3141" },
      { name: "label", label: "Описание" }
    ],
    buildPayload: (values) => {
      const lat = values.lat?.trim();
      const lng = values.lng?.trim();
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
      { name: "ssid", label: "SSID", required: true },
      {
        name: "auth",
        label: "Шифрование",
        placeholder: "WPA, WPA2, WEP или nopass",
        helper: "nopass для открытых сетей"
      },
      { name: "password", label: "Пароль" },
      { name: "hidden", label: "Скрытая сеть (true/false)", placeholder: "false" }
    ],
    buildPayload: (values) => {
      const ssid = values.ssid ?? "";
      const auth = values.auth?.toUpperCase() || "WPA";
      const password = values.password ?? "";
      const hidden = values.hidden?.toLowerCase() === "true" ? ";H:true" : "";
      return `WIFI:T:${auth};S:${escapeWifiValue(ssid)};P:${escapeWifiValue(password)}${hidden};;`;
    }
  },
  {
    type: "vcard",
    title: "vCard",
    description: "Контакты vCard 3.0",
    fields: [
      { name: "firstName", label: "Имя", required: true },
      { name: "lastName", label: "Фамилия" },
      { name: "organization", label: "Компания" },
      { name: "title", label: "Должность" },
      { name: "phone", label: "Телефон" },
      { name: "email", label: "Email" },
      { name: "website", label: "Сайт" },
      { name: "notes", label: "Заметки", type: "textarea" }
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
      { name: "name", label: "Имя", required: true },
      { name: "phone", label: "Телефон" },
      { name: "email", label: "Email" },
      { name: "address", label: "Адрес", type: "textarea" },
      { name: "note", label: "Заметка", type: "textarea" }
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
      { name: "summary", label: "Заголовок", required: true },
      { name: "description", label: "Описание", type: "textarea" },
      { name: "location", label: "Место" },
      {
        name: "start",
        label: "Начало (ISO 8601)",
        placeholder: "2024-03-12T10:00"
      },
      {
        name: "end",
        label: "Конец (ISO 8601)",
        placeholder: "2024-03-12T12:00"
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

function escapeWifiValue(value) {
  return value.replace(/([\\;",:])/g, "\\$1");
}

function formatICSDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
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

