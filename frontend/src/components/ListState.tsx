import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type ListStateProps = {
  loading: boolean;
  error: string;
  hasData: boolean;
  onRetry: () => void | Promise<void>;
  empty: ReactNode;
  children: ReactNode;
  loadingText?: string;
  recoveryScope?: string | number | null;
};

export function ListState({
  loading,
  error,
  hasData,
  onRetry,
  empty,
  children,
  loadingText = "목록을 불러오고 있습니다.",
  recoveryScope = null
}: ListStateProps) {
  const wasBlockingRef = useRef(!hasData);
  const previousScopeRef = useRef(recoveryScope);
  const suppressNextRecoveryRef = useRef(false);
  const recoveringToContent = hasData && wasBlockingRef.current && !suppressNextRecoveryRef.current;

  useEffect(() => {
    if (!Object.is(previousScopeRef.current, recoveryScope)) {
      const hadEstablishedScope = previousScopeRef.current !== null;
      previousScopeRef.current = recoveryScope;
      if (hadEstablishedScope) suppressNextRecoveryRef.current = true;
    }
    wasBlockingRef.current = !hasData;
    if (hasData) suppressNextRecoveryRef.current = false;
  }, [hasData, recoveryScope]);

  if (loading && !hasData) {
    return <div className="list-state list-state-loading" role="status">{loadingText}</div>;
  }

  if (error && !hasData) {
    return (
      <div className="list-state list-state-error" role="alert">
        <AlertTriangle size={20} />
        <div><strong>목록을 불러오지 못했습니다.</strong><span>{error}</span></div>
        <button type="button" className="ghost" onClick={() => void onRetry()}><RefreshCw size={16} /> 다시 시도</button>
      </div>
    );
  }

  return (
    <>
      {loading && <div className="list-state-notice" role="status">목록을 새로 고치는 중입니다.</div>}
      {error && (
        <div className="list-state-notice list-state-notice-error" role="alert">
          <span>새로고침하지 못했습니다. 기존 목록을 표시합니다. {error}</span>
          <button type="button" className="ghost" onClick={() => void onRetry()}><RefreshCw size={15} /> 다시 시도</button>
        </div>
      )}
      {hasData ? (
        <div className="list-state-content" data-recovering={recoveringToContent ? "true" : undefined}>
          {children}
        </div>
      ) : empty}
    </>
  );
}
