/** The theme chosen in Settings, mirrored in a cookie so the server renders `data-theme` without a flash. "system" removes it. */
export function setThemeCookie(theme: string): void {
    document.cookie = theme === "system" ? "theme=; path=/; max-age=0" : `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
}
