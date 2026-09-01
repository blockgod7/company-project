const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MINUTES = ["00", "10", "20", "30", "40", "50"];

export function WorkTimeInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [rawHour = "00", minute = "00"] = value.split(":");
  const hour24 = Number(rawHour);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = String(hour24 % 12 || 12).padStart(2, "0");

  const updateTime = (part: "period" | "hour" | "minute", nextValue: string) => {
    const nextPeriod = part === "period" ? nextValue : period;
    const nextHour12 = Number(part === "hour" ? nextValue : hour12);
    const nextMinute = part === "minute" ? nextValue : minute;
    const nextHour24 = nextHour12 % 12 + (nextPeriod === "PM" ? 12 : 0);
    onChange(`${String(nextHour24).padStart(2, "0")}:${nextMinute}`);
  };

  return <div className="work-time-input" role="group" aria-label={`${label} 시간`}>
    <select aria-label={`${label} 오전/오후`} value={period} onChange={(event) => updateTime("period", event.target.value)}>
      <option value="AM">오전</option><option value="PM">오후</option>
    </select>
    <select aria-label={`${label} 시`} value={hour12} onChange={(event) => updateTime("hour", event.target.value)}>
      {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
    </select>
    <span aria-hidden="true">:</span>
    <select aria-label={`${label} 분 (10분 단위)`} value={minute} onChange={(event) => updateTime("minute", event.target.value)}>
      {!MINUTES.includes(minute) && <option value={minute} disabled hidden>{minute}</option>}
      {MINUTES.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  </div>;
}
