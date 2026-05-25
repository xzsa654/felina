/** Skeleton that mirrors the TokensPage shell: tab bar + 4 stat cards + content area. */
function Sk({ w, h = "h-3", className = "" }: { w: string; h?: string; className?: string }) {
  return <div className={`${h} ${w} bg-bg-tertiary rounded animate-pulse ${className}`} />;
}

export default function TokensPageSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-0 flex-shrink-0">
        <Sk w="w-24" h="h-6" />
        <Sk w="w-32" h="h-6" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between px-6 mt-3 border-b border-border flex-shrink-0 pb-2">
        <div className="flex items-center gap-6">
          {[48, 36, 40, 36].map((w, i) => (
            <Sk key={i} w={`w-${w > 40 ? 12 : w > 36 ? 10 : 9}`} h="h-4" />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((i) => <Sk key={i} w="w-10" h="h-6" />)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-6 py-4 space-y-4">
        {/* Stat cards row */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-bg-secondary border border-border rounded-lg px-4 py-3 space-y-2">
              <Sk w="w-20" h="h-2.5" />
              <Sk w="w-16" h="h-5" />
              <Sk w="w-24" h="h-2" />
            </div>
          ))}
        </div>

        {/* Contribution graph */}
        <div className="bg-bg-secondary border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1.5">
              <Sk w="w-24" h="h-3" />
              <Sk w="w-32" h="h-2" />
            </div>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => <div key={i} className="w-3 h-3 bg-bg-tertiary rounded-sm animate-pulse" />)}
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

        {/* Table skeleton */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <Sk w="w-20" h="h-3" />
            <Sk w="w-12" h="h-3" />
          </div>
          <div className="space-y-3">
            {[1,2,3,4,5].map((i) => (
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
      </div>
    </div>
  );
}
