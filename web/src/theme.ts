import { theme, type ThemeConfig } from "antd";

/** Tema antd com as cores do launcher do LoL (dourado sobre fundo escuro hextech). */
export const lolTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#C8AA6E",
    colorBgBase: "#010A13",
    colorTextBase: "#F0E6D2",
    colorSuccess: "#0ACF83",
    colorError: "#E84057",
    colorInfo: "#0AC8B9",
    fontSize: 16,
    borderRadius: 4,
  },
};
