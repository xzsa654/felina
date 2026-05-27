/** Compact skeleton for the TokensPage content area. */
function Sk({ w, h = "h-3", className = "" }: { w: string; h?: string; className?: string }) {
  return <div className={`${h} ${w} bg-bg-tertiary rounded animate-pulse ${className}`} />;
}

function TokenUsageCardSkeleton() {
  return (
    <div className="space-y-4">
      <Sk w="w-28" h="h-4" />
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Sk w="w-28" h="h-2.5" />
          <Sk w="w-20" h="h-2.5" />
        </div>
        <Sk w="w-24" h="h-2.5" />
        <div className="h-2 bg-bg-tertiary rounded-full animate-pulse" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Sk w="w-16" h="h-2.5" />
          <Sk w="w-24" h="h-2.5" />
        </div>
        <Sk w="w-24" h="h-2.5" />
        <div className="h-2 bg-bg-tertiary rounded-full animate-pulse" />
      </div>
    </div>
  );
}

export function TokenUsageSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-5 space-y-6">
      <div className="flex justify-between">
        <Sk w="w-32" h="h-4" />
        <Sk w="w-20" h="h-2.5" />
      </div>
      <div className="grid sm:grid-cols-3 gap-6 divide-x divide-border">
        {[1, 2, 3].map((i) => (
          <TokenUsageCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function StatCardsSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-bg-secondary border border-border rounded-lg px-4 py-3 space-y-2">
          <Sk w="w-20" h="h-2.5" />
          <Sk w="w-16" h="h-5" />
          <Sk w="w-24" h="h-2" />
        </div>
      ))}
    </div>
  );
}

function ContributionGraphSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <Sk w="w-24" h="h-3" />
          <Sk w="w-32" h="h-2" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-3 h-3 bg-bg-tertiary rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex gap-1" style={{ height: "84px" }}>
        {Array.from({ length: 52 }, (_, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, j) => (
              <div
                key={j}
                className="w-full h-4 bg-bg-tertiary rounded-sm animate-pulse"
                style={{ animationDelay: `${(i * 7 + j) * 8}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeBucketTableSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <Sk w="w-20" h="h-3" />
        <Sk w="w-12" h="h-3" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-1">
            <Sk w="w-4" h="h-2.5" />
            <Sk w="w-28" h="h-2.5" />
            <Sk w="w-10" h="h-2.5" />
            <div className="flex-1 h-2 bg-bg-tertiary rounded-full animate-pulse" />
            <Sk w="w-14" h="h-2.5" />
            <Sk w="w-12" h="h-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DailySummarySkeleton() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-bg-secondary border border-border rounded-lg px-4 py-3 space-y-2">
          <Sk w="w-24" h="h-2.5" />
          <Sk w="w-20" h="h-4" />
          <Sk w="w-28" h="h-2" />
        </div>
      ))}
    </div>
  );
}

function TopSessionsSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <Sk w="w-28" h="h-3" />
        <Sk w="w-16" h="h-2.5" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
            <Sk w="w-8" h="h-2.5" />
            <div className="flex-1 space-y-1.5">
              <Sk w="w-36" h="h-2.5" />
              <Sk w="w-24" h="h-2" />
            </div>
            <Sk w="w-16" h="h-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelTableSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <Sk w="w-32" h="h-3" className="mb-3" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-[minmax(160px,1fr)_80px_80px_80px_80px] gap-4 py-2 border-b border-border/40 last:border-0">
            <div className="space-y-1.5">
              <Sk w="w-40" h="h-2.5" />
              <Sk w="w-24" h="h-2" />
            </div>
            <Sk w="w-14" h="h-2.5" />
            <Sk w="w-14" h="h-2.5" />
            <Sk w="w-14" h="h-2.5" />
            <Sk w="w-12" h="h-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CostBudgetSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <Sk w="w-28" h="h-3" className="mb-3" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="space-y-1.5">
          <Sk w="w-20" h="h-2.5" />
          <Sk w="w-16" h="h-5" />
        </div>
        <div className="space-y-1.5">
          <Sk w="w-16" h="h-2.5" />
          <Sk w="w-14" h="h-5" />
        </div>
      </div>
      <Sk w="w-40" h="h-2.5" />
    </div>
  );
}

function ModelChartSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <Sk w="w-28" h="h-3" className="mb-5" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-3">
            <Sk w="w-20" h="h-2.5" />
            <div
              className="h-5 bg-bg-tertiary rounded animate-pulse"
              style={{ width: `${96 - i * 10}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewTokensPageSkeleton() {
  return (
    <div className="space-y-4">
      <TokenUsageSkeleton />
      <StatCardsSkeleton />
      <TopSessionsSkeleton />
    </div>
  );
}

export function DailyTokensPageSkeleton() {
  return (
    <div className="space-y-4">
      <DailySummarySkeleton />
      <ContributionGraphSkeleton />
      <TimeBucketTableSkeleton />
    </div>
  );
}

export function ModelsTokensPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <ModelTableSkeleton />
        <div className="space-y-4">
          <CostBudgetSkeleton />
          <ModelChartSkeleton />
        </div>
      </div>
    </div>
  );
}

export default OverviewTokensPageSkeleton;
