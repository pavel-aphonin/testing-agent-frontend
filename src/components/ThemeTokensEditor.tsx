import { Button, ColorPicker, InputNumber, Select, Space, theme as antdTheme, Typography } from "antd";
import { useEffect, useState } from "react";

import { DEFAULTS, SIDEBAR_DEFAULTS } from "@/hooks/useBranding";
import type { ThemeModeTokens, ThemeTokens } from "@/types";

/**
 * Chrome-token editor. Focused on UI decoration that *isn't* already
 * covered by dedicated dictionaries (notification colors, priority
 * colors, defect severity — those live in /справочники).
 *
 * Covers:
 *   Per theme mode (light / dark):
 *     • Accent (colorPrimary)          — buttons, active state
 *     • Link (colorLink + hover)
 *     • Content surface (colorBgContainer) — cards, white surfaces
 *     • Layout background (colorBgLayout)  — page wash
 *     • Sidebar bg, sidebar hover, sidebar active  — dark panel chrome
 *   Global:
 *     • borderRadius
 *     • fontFamily
 *     • fontSize
 *
 * Shared between Settings → Бренд and Profile → Моя тема. The ``labels``
 * prop lets the host tune copy (system-wide vs personal overrides).
 */

export interface PaletteLabels {
  intro?: React.ReactNode;
  saveLabel?: string;
  resetAllLabel?: string | null;
}

interface Props {
  value: ThemeTokens | null;
  saving: boolean;
  onSave: (tokens: ThemeTokens | null) => void;
  labels?: PaletteLabels;
  /** Show font-size slider (we expose it to users but not to system brand). */
  allowFontSize?: boolean;
}

interface ColorRow {
  key: keyof ThemeModeTokens;
  title: string;
  description: string;
}

const ACCENT_ROWS: ColorRow[] = [
  { key: "colorPrimary",     title: "Акцент",          description: "Кнопки, активные вкладки, выделения" },
  { key: "colorLink",        title: "Ссылки",          description: "Цвет обычных ссылок в тексте" },
  { key: "colorLinkHover",   title: "Ссылки при наведении", description: "Как подсвечивается ссылка под курсором" },
];

const SURFACE_ROWS: ColorRow[] = [
  { key: "colorBgContainer", title: "Карточки и поверхности", description: "Фон карточек, модалок, таблиц" },
  { key: "colorBgLayout",    title: "Основной фон страницы", description: "Широкие зоны между карточками" },
];

const SIDEBAR_ROWS: ColorRow[] = [
  { key: "sidebarBg",        title: "Фон боковой панели",  description: "Всегда тёмный по умолчанию" },
  { key: "sidebarItemHoverBg", title: "Пункт при наведении", description: "Подсветка под курсором" },
  { key: "sidebarItemSelectedBg", title: "Активный пункт", description: "Текущий выбранный раздел" },
];

const FONT_OPTIONS = [
  { value: "", label: "По умолчанию (системный)" },
  { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", label: "Системный" },
  { value: "'Inter', -apple-system, sans-serif", label: "Inter" },
  { value: "'SF Pro Display', -apple-system, sans-serif", label: "SF Pro" },
  { value: "Georgia, 'Times New Roman', serif", label: "Serif (Georgia)" },
  { value: "'JetBrains Mono', 'Courier New', monospace", label: "Моноширинный" },
];

export function ThemeTokensEditor({ value, saving, onSave, labels, allowFontSize = false }: Props) {
  const { token } = antdTheme.useToken();
  const [draft, setDraft] = useState<ThemeTokens>(() => cloneWithDefaults(value));
  useEffect(() => setDraft(cloneWithDefaults(value)), [value]);

  const setModeValue = (mode: "light" | "dark", key: keyof ThemeModeTokens, v: string) => {
    setDraft((d) => ({ ...d, [mode]: { ...(d[mode] ?? {}), [key]: v } }));
  };
  const resetAll = () => setDraft(cloneWithDefaults(null));
  const changed = JSON.stringify(draft) !== JSON.stringify(cloneWithDefaults(value));

  const group = (mode: "light" | "dark", heading: string, rows: ColorRow[]) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
        {heading}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {rows.map((row) => {
          const modeTokens = draft[mode] ?? {};
          const v: string =
            ((modeTokens[row.key] as string | null | undefined) ||
              (DEFAULTS as any)[mode][row.key] ||
              (SIDEBAR_DEFAULTS as any)[row.key] ||
              "#000000") as string;
          return (
            <div key={row.key}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
                {row.title}
              </div>
              <div style={{ fontSize: 11, margin: "0 0 6px", color: token.colorTextTertiary }}>
                {row.description}
              </div>
              <ColorPicker
                value={v}
                onChange={(c) => setModeValue(mode, row.key, c.toHexString())}
                format="hex"
                showText
                disabledAlpha
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {labels?.intro && (
        <div style={{ marginBottom: 16, color: token.colorTextSecondary }}>{labels.intro}</div>
      )}

      {(["light", "dark"] as const).map((mode) => (
        <div
          key={mode}
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 16,
          }}
        >
          <Typography.Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
            {mode === "light" ? "Светлая тема" : "Тёмная тема"}
          </Typography.Text>
          {group(mode, "Акценты и ссылки", ACCENT_ROWS)}
          {group(mode, "Поверхности", SURFACE_ROWS)}
          {group(mode, "Боковая панель", SIDEBAR_ROWS)}
        </div>
      ))}

      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          padding: "16px 18px",
          marginBottom: 16,
        }}
      >
        <Typography.Text strong style={{ fontSize: 14 }}>
          Общие параметры
        </Typography.Text>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginTop: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
              Скругление углов
            </div>
            <div style={{ fontSize: 11, margin: "0 0 6px", color: token.colorTextTertiary }}>
              0 — острые, 16 — совсем круглые.
            </div>
            <InputNumber
              min={0}
              max={20}
              value={draft.borderRadius ?? 6}
              onChange={(v) => setDraft((d) => ({ ...d, borderRadius: v ?? 6 }))}
              style={{ width: "100%", maxWidth: 140 }}
              addonAfter="px"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
              Шрифт
            </div>
            <div style={{ fontSize: 11, margin: "0 0 6px", color: token.colorTextTertiary }}>
              Используется во всём интерфейсе.
            </div>
            <Select
              options={FONT_OPTIONS}
              value={draft.fontFamily ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, fontFamily: v || null }))}
              style={{ width: "100%" }}
            />
          </div>
          {allowFontSize && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
                Размер шрифта
              </div>
              <div style={{ fontSize: 11, margin: "0 0 6px", color: token.colorTextTertiary }}>
                Базовый размер в пикселях. 14 — стандартный, 16 — крупнее.
              </div>
              <InputNumber
                min={12}
                max={18}
                value={draft.fontSize ?? 14}
                onChange={(v) => setDraft((d) => ({ ...d, fontSize: v ?? 14 }))}
                style={{ width: "100%", maxWidth: 140 }}
                addonAfter="px"
              />
            </div>
          )}
        </div>
      </div>

      <Space>
        <Button
          type="primary"
          disabled={!changed}
          loading={saving}
          onClick={() => onSave(cleanForWire(draft))}
        >
          {labels?.saveLabel ?? "Сохранить палитру"}
        </Button>
        {labels?.resetAllLabel !== null && (
          <Button onClick={resetAll} disabled={saving}>
            {labels?.resetAllLabel ?? "Сбросить всё до стандартного"}
          </Button>
        )}
      </Space>
    </>
  );
}

function cloneWithDefaults(v: ThemeTokens | null): ThemeTokens {
  const mode = (m: "light" | "dark") => ({
    colorPrimary: v?.[m]?.colorPrimary ?? DEFAULTS[m].colorPrimary,
    colorLink: v?.[m]?.colorLink ?? (DEFAULTS[m] as any).colorLink ?? DEFAULTS[m].colorPrimary,
    colorLinkHover: v?.[m]?.colorLinkHover ?? (DEFAULTS[m] as any).colorLinkHover ?? DEFAULTS[m].colorPrimary,
    colorBgContainer: v?.[m]?.colorBgContainer ?? (DEFAULTS[m] as any).colorBgContainer,
    colorBgLayout: v?.[m]?.colorBgLayout ?? (DEFAULTS[m] as any).colorBgLayout,
    sidebarBg: v?.[m]?.sidebarBg ?? SIDEBAR_DEFAULTS.sidebarBg,
    sidebarItemHoverBg: v?.[m]?.sidebarItemHoverBg ?? SIDEBAR_DEFAULTS.sidebarItemHoverBg,
    sidebarItemSelectedBg: v?.[m]?.sidebarItemSelectedBg ?? SIDEBAR_DEFAULTS.sidebarItemSelectedBg,
  });
  return {
    light: mode("light"),
    dark: mode("dark"),
    borderRadius: typeof v?.borderRadius === "number" ? v.borderRadius : 6,
    fontFamily: v?.fontFamily ?? null,
    fontSize: typeof v?.fontSize === "number" ? v.fontSize : 14,
  };
}

function cleanForWire(t: ThemeTokens): ThemeTokens | null {
  const stripMode = (mode: "light" | "dark"): ThemeModeTokens | undefined => {
    const src = t[mode] ?? {};
    const defaults: Record<string, string | undefined> = {
      ...(DEFAULTS[mode] as Record<string, string | undefined>),
      ...(SIDEBAR_DEFAULTS as Record<string, string | undefined>),
    };
    const out: ThemeModeTokens = {};
    for (const k of Object.keys(src) as (keyof ThemeModeTokens)[]) {
      const v = src[k];
      if (v && v !== defaults[k]) (out as any)[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const lightT = stripMode("light");
  const darkT = stripMode("dark");
  const radius = t.borderRadius === 6 ? undefined : t.borderRadius;
  const font = t.fontFamily || undefined;
  const size = t.fontSize === 14 ? undefined : t.fontSize;
  if (!lightT && !darkT && radius === undefined && !font && size === undefined) return null;
  return {
    ...(lightT ? { light: lightT } : {}),
    ...(darkT ? { dark: darkT } : {}),
    ...(radius !== undefined ? { borderRadius: radius } : {}),
    ...(font ? { fontFamily: font } : {}),
    ...(size !== undefined ? { fontSize: size } : {}),
  };
}
