import { ArrowLeft, CheckCircle2, Database, Flag, LockKeyhole, Monitor, Route, Users, type LucideIcon } from "lucide-react";
import { plannedFeatures } from "../config/plannedFeatures";

type PlannedFeaturePageProps = {
  featureCode: string | null;
  onBack: () => void;
};

export function PlannedFeaturePage({ featureCode, onBack }: PlannedFeaturePageProps) {
  const feature = featureCode ? plannedFeatures[featureCode.toUpperCase()] : null;
  if (!feature) {
    return <section className="planned-feature-page"><button className="planned-back" onClick={onBack}><ArrowLeft size={16} /> 홈으로</button><div className="empty">등록되지 않은 예정 기능입니다.</div></section>;
  }

  return (
    <section className="planned-feature-page">
      <button className="planned-back" onClick={onBack}><ArrowLeft size={16} /> 임직원 포털로</button>
      <header className="planned-feature-hero">
        <div><span>PLANNED FEATURE · {feature.code}</span><h1>{feature.name}</h1><p>{feature.purpose}</p></div>
        <dl><div><dt>상태</dt><dd>{statusLabel(feature.status)}</dd></div><div><dt>우선순위</dt><dd>{priorityLabel(feature.priority)}</dd></div></dl>
      </header>
      <div className="planned-feature-grid">
        <InfoCard icon={Users} title="대상 사용자" items={feature.targetUsers} />
        <InfoCard icon={Monitor} title="예상 화면" items={feature.expectedScreens} />
        <InfoCard icon={LockKeyhole} title="예상 권한" items={feature.expectedPermissions} />
        <InfoCard icon={Route} title="연관 기능" items={feature.relatedFeatures} />
        <InfoCard icon={Database} title="필요한 API·DB 작업" items={feature.apiDbWork} wide />
        <InfoCard icon={Flag} title="원격 참고 범위" items={[feature.remoteReference]} wide />
      </div>
      <p className="planned-feature-notice"><CheckCircle2 size={17} /> 이 화면은 다음 개발을 위한 읽기 전용 안내입니다. 동작하지 않는 임시 업무 버튼이나 가짜 저장 기능은 제공하지 않습니다.</p>
    </section>
  );
}

function InfoCard({ icon: Icon, title, items, wide = false }: { icon: LucideIcon; title: string; items: string[]; wide?: boolean }) {
  return <article className={wide ? "planned-info-card wide" : "planned-info-card"}><h2><Icon size={19} /> {title}</h2><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>;
}

function statusLabel(status: "RESEARCH" | "DESIGN" | "READY") {
  return status === "RESEARCH" ? "요구사항 조사" : status === "DESIGN" ? "설계 중" : "개발 준비";
}

function priorityLabel(priority: "HIGH" | "MEDIUM" | "LOW") {
  return priority === "HIGH" ? "높음" : priority === "MEDIUM" ? "보통" : "낮음";
}
