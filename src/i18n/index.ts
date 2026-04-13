import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ru from "./locales/ru.json";

/**
 * i18n bootstrap.
 *
 * Resolution order at app startup:
 *   1. The user's saved `agent_settings.language` (applied by App.tsx
 *      after the auth store hydrates)
 *   2. The browser's `navigator.language` (LanguageDetector)
 *   3. Fallback to English
 *
 * `lng` is intentionally NOT set here so the detector picks it; the
 * authenticated app then calls i18n.changeLanguage(...) to override.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "ru"],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ta-language",
    },
  });

export default i18n;
