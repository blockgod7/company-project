import { useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import type { PortalMode } from "../navigation";
import type { EffectiveMenu, MenuPreferenceItem } from "../types";

export function useEffectiveMenus(empId: number, portal: PortalMode) {
  const [menus, setMenus] = useState<EffectiveMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const portalCode = portal.toUpperCase();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<EffectiveMenu[]>(`/menus/effective?portal=${portalCode}`, { signal: controller.signal })
      .then(setMenus)
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [empId, portalCode]);

  async function updatePreferences(items: MenuPreferenceItem[]) {
    setSaving(true);
    setError("");
    try {
      const updated = await api<EffectiveMenu[]>(`/menus/preferences?portal=${portalCode}`, {
        method: "PUT",
        body: jsonBody({ items })
      });
      setMenus(updated);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메뉴 설정을 저장하지 못했습니다.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function resetPreferences() {
    setSaving(true);
    setError("");
    try {
      const updated = await api<EffectiveMenu[]>(`/menus/preferences?portal=${portalCode}`, {
        method: "DELETE"
      });
      setMenus(updated);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메뉴 설정을 초기화하지 못했습니다.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { menus, loading, saving, error, updatePreferences, resetPreferences };
}
