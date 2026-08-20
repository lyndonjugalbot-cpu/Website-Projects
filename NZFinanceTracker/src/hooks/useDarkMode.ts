import { useEffect } from "react";
import { LOCAL_STORAGE_KEYS } from "../config";
import { useLocalStorage } from "./useLocalStorage";

export function useDarkMode() {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [isDark, setIsDark] = useLocalStorage<boolean>(LOCAL_STORAGE_KEYS.theme, prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return [isDark, setIsDark] as const;
}
