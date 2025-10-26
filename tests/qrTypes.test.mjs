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
    "SMSTO:+79001234567:%D0%9F%D1%80%D0%B8%D0%B2%D0%B5%D1%82!"
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

test("Wi-Fi validation checks encryption, password and hidden flag", () => {
  const def = getTypeDefinition("wifi");
  const authField = def.fields.find((field) => field.name === "auth");
  const passwordField = def.fields.find((field) => field.name === "password");
  const hiddenField = def.fields.find((field) => field.name === "hidden");

  assert.equal(authField?.validate?.("wpa3", {}), "Допустимо: WPA, WPA2, WEP или nopass");
  assert.equal(authField?.validate?.("WEP", {}), null);

  assert.equal(
    passwordField?.validate?.("", { auth: "wpa2" }),
    "Пароль обязателен для выбранного шифрования"
  );
  assert.equal(passwordField?.validate?.("", { auth: "nopass" }), null);

  assert.equal(hiddenField?.validate?.("maybe", {}), "Введите true или false");
  assert.equal(hiddenField?.validate?.("TRUE", {}), null);
});

test("Wi-Fi payload omits password for open networks", () => {
  const def = getTypeDefinition("wifi");
  assert.equal(
    def.buildPayload({ ssid: "Cafe", auth: "nopass", password: "" }),
    "WIFI:T:nopass;S:Cafe;;"
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

test("ICS validation enforces ISO format and chronological order", () => {
  const def = getTypeDefinition("ics");
  const startField = def.fields.find((field) => field.name === "start");
  const endField = def.fields.find((field) => field.name === "end");

  assert.equal(startField?.validate?.("не дата", {}), "Используйте формат ISO 8601");
  assert.equal(
    endField?.validate?.("2024-03-12T08:00", { start: "2024-03-12T09:00" }),
    "Окончание должно быть позже начала"
  );
  assert.equal(endField?.validate?.("2024-03-12T10:00", { start: "2024-03-12T09:00" }), null);
});

test("Geo coordinates are validated and normalized", () => {
  const def = getTypeDefinition("geo");
  const latField = def.fields.find((field) => field.name === "lat");
  const lngField = def.fields.find((field) => field.name === "lng");

  assert.equal(latField?.validate?.("91", {}), "Широта от -90 до 90");
  assert.equal(lngField?.validate?.("200", {}), "Долгота от -180 до 180");
  assert.equal(latField?.validate?.("59.9386", {}), null);
  assert.equal(lngField?.validate?.("30.3141", {}), null);

  assert.equal(
    def.buildPayload({ lat: "59,9386", lng: "30,3141", label: "СПб" }),
    "geo:59.9386,30.3141?q=%D0%A1%D0%9F%D0%B1"
  );
});

test("getTypeDefinition throws for unsupported type", () => {
  assert.throws(() => getTypeDefinition("unknown"), /Unsupported QR type/);
});

test("registry includes all supported types", () => {
  const order = QR_TYPES.map((item) => item.type);
  assert.deepEqual(order, ["url", "text", "tel", "sms", "mailto", "geo", "wifi", "vcard", "mecard", "ics"]);
});

