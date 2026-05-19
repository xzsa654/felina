import { formatNumber } from "$lib/utils/format";

interface Props {
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  daysActive: number;
}

export default function StatsOverview({
  totalSessions,
  totalMessages,
  totalToolCalls,
  daysActive,
}: Props) {
  const cards = [
    { label: "Total Sessions", value: formatNumber(totalSessions), color: "text-accent" },
    { label: "Messages Sent", value: formatNumber(totalMessages), color: "text-success" },
    { label: "Tool Calls", value: formatNumber(totalToolCalls), color: "text-warning" },
    { label: "Days Active", value: formatNumber(daysActive), color: "text-info" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-bg-secondary border border-border rounded-lg p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
