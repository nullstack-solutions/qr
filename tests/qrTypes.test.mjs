import test from "node:test";
import assert from "node:assert/strict";

import { QR_TYPES, getTypeDefinition } from "../src/lib/qrTypesRuntime.mjs";

test("URL payload normalizes schema and validates hostname", () => {
  const def = getTypeDefinition("url");
  assert.equal(def.buildPayload({ url: "example.com" }), "https://example.com");
  assert.equal(def.buildPayload({ url: "http://already.com" }), "http://already.com");

  const field = def.fields[0];
  assert.equal(field.validate?.("", {}), "Укажите ссылку");
  assert.equal(field.validate?.("not_a_domain", {}), "Укажите корректный домен");
  assert.equal(field.validate?.("https://valid.ru", {}), null);
});

test("SMS payload encodes message and strips phone decorations", () => {
  const def = getTypeDefinition("sms");
  assert.equal(
    def.buildPayload({ phone: "+7 (900) 123-45-67", message: "Привет!" }),
    "sms:+79001234567?body=%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82!"
  );
});

test("Wi-Fi payload escapes special characters", () => {
  const def = getTypeDefinition("wifi");
  assert.equal(
    def.buildPayload({
      ssid: "Office;WiFi",
      auth: "wpa2",
      password: "pa:ss\\word",
      hidden: "true"
    }),
    "WIFI:T:WPA2;S:Office\\;WiFi;P:pa\\:ss\\\\word;H:true;;"
  );
});

test("ICS payload converts ISO date to UTC format", () => {
  const def = getTypeDefinition("ics");
  const payload = def.buildPayload({
    summary: "Demo",
    start: "2024-03-12T10:00:00+03:00",
    end: "2024-03-12T11:00:00+03:00"
  });

  assert.match(payload, /BEGIN:VCALENDAR/);
  assert.match(payload, /DTSTART:20240312T070000Z/);
  assert.match(payload, /DTEND:20240312T080000Z/);
});

test("getTypeDefinition throws for unsupported type", () => {
  assert.throws(() => getTypeDefinition("unknown"), /Unsupported QR type/);
});

test("registry includes all supported types", () => {
  const order = QR_TYPES.map((item) => item.type);
  assert.deepEqual(order, ["url", "text", "tel", "sms", "mailto", "geo", "wifi", "vcard", "mecard", "ics"]);
});

