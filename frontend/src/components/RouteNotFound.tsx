import { ArrowLeft, Home } from "lucide-react";

export function RouteNotFound({ onHome }: { onHome: () => void }) {
  return (
    <main className="content">
      <section className="panel route-state-page" role="alert">
        <span className="eyebrow">404</span>
        <h2>페이지를 찾을 수 없습니다.</h2>
        <p>주소가 변경됐거나 사용할 수 없는 화면입니다.</p>
        <div className="route-state-actions">
          <button type="button" onClick={() => window.history.back()}>
            <ArrowLeft size={16} /> 이전 화면
          </button>
          <button type="button" className="primary-action" onClick={onHome}>
            <Home size={16} /> 홈으로
          </button>
        </div>
      </section>
    </main>
  );
}
