'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import TopBar from '@/components/landlord/TopBar'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/LoadingSkeleton'
import {
  LANDLORD_APPLICATIONS,
  KANBAN_STAGES,
  STAGE_HEADER_CLASS,
  type LandlordApplication,
  type KanbanStage,
} from '@/lib/landlordApplications'


const NEXT_STAGE: Partial<Record<KanbanStage, KanbanStage>> = {
  New: 'Reviewing',
  Reviewing: 'Info Requested',
  'Info Requested': 'Approved',
}

export default function LandlordApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<LandlordApplication[]>(LANDLORD_APPLICATIONS)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  function advance(id: string) {
    setApps((prev) =>
      prev.map((a) => (a.id === id && NEXT_STAGE[a.stage] ? { ...a, stage: NEXT_STAGE[a.stage] as KanbanStage } : a))
    )
  }

  function reject(id: string) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage: 'Rejected' } : a)))
  }

  return (
    <>
      <TopBar title="Applications" subtitle="Review incoming applications and move them through your pipeline." />

      <div className="flex-1 px-6 py-8 sm:px-8">
        {loading ? (
          <SkeletonList count={3} />
        ) : apps.length === 0 ? (
          <EmptyState
            icon="document"
            title="No applications yet"
            description="When tenants apply for your properties, their applications will appear here."
          />
        ) : (
        <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
          {KANBAN_STAGES.map((stage) => {
            const items = apps.filter((a) => a.stage === stage)
            return (
              <div key={stage} className="min-w-[220px] rounded-lg border border-charcoal/10 bg-white p-3">
                <div className="flex items-center justify-between px-1 pb-2">
                  <h2 className={`font-display text-sm font-semibold ${STAGE_HEADER_CLASS[stage]}`}>{stage}</h2>
                  <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-charcoal/50">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.map((app) => (
                    <div key={app.id} className="rounded border border-charcoal/10 bg-cream p-3">
                      <div className="flex items-center gap-2">
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-sand">
                          <Image src={app.avatar} alt={app.applicantName} fill sizes="32px" className="object-cover" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-charcoal">{app.applicantName}</p>
                          <p className="truncate text-xs text-charcoal/40">{app.propertyTitle}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-charcoal/40">{app.submittedOn}</p>

                      {stage !== 'Approved' && stage !== 'Rejected' ? (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => advance(app.id)}
                            className="flex-1 rounded bg-rust px-2 py-1 text-[11px] font-medium text-white hover:bg-rust-dark"
                          >
                            {stage === 'Info Requested' ? 'Approve' : 'Advance'}
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(app.id)}
                            className="flex-1 rounded border border-charcoal/15 px-2 py-1 text-[11px] font-medium text-charcoal/60 hover:bg-sand"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {items.length === 0 ? <p className="px-1 py-3 text-center text-xs text-charcoal/30">No applications</p> : null}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>
    </>
  )
}
