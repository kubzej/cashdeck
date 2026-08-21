import { Skeleton } from '../../components/ui/skeleton'

export function OverviewSkeleton() {
  return <div className="overview-skeleton" aria-label="Načítání přehledu">
    <Skeleton className="h-11 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-52 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
}
