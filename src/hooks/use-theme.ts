/**
 * Theme Hook - 主题管理
 * 支持 light/dark/auto 模式，持久化到 localStorage
 */
import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "auto";

const THEME_KEY = "zentri-theme";

/**
 * 获取系统主题偏好
 */
function getSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * 应用主题到 document
 */
function applyTheme(theme: Theme) {
    const effectiveTheme = theme === "auto" ? getSystemTheme() : theme;

    if (effectiveTheme === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }

    // 设置 meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute("content", effectiveTheme === "dark" ? "#18181b" : "#ffffff");
    }
}

/**
 * 主题管理 Hook
 */
export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === "undefined") return "light";
        return (localStorage.getItem(THEME_KEY) as Theme) || "light";
    });

    // 设置主题
    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
        applyTheme(newTheme);
    }, []);

    // 初始化和系统偏好监听
    useEffect(() => {
        // 初始应用主题
        applyTheme(theme);

        // 监听系统主题变化（仅在 auto 模式下有效）
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = () => {
            if (theme === "auto") {
                applyTheme("auto");
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    return {
        theme,
        setTheme,
        effectiveTheme: theme === "auto" ? getSystemTheme() : theme,
    };
}

/**
 * 获取当前存储的主题（不使用 Hook）
 */
export function getStoredTheme(): Theme {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(THEME_KEY) as Theme) || "light";
}

/**
 * 初始化主题（在应用启动时调用）
 */
export function initializeTheme() {
    const theme = getStoredTheme();
    applyTheme(theme);
}
