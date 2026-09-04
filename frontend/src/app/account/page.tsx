'use client';

import { CloudOff, Laptop, Lock, Users } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/AppShell/PageHeader';
import { PrivacyChip, SyncChip } from '@/components/AppShell/StateChips';
import { CURRENT_SYNC_STATE } from '@/lib/privacy';

export default function AccountPage() {
  return (
    <PageBody>
      <div className="pt-enter flex flex-col gap-8">
        <PageHeader
          eyebrow="Account and sync"
          title="Everything stays on this device."
          description="PulseTalq does not have an account yet. Your dictations, meetings, and summaries are stored locally and never leave this computer unless you choose a cloud provider in Settings."
        />

        <section className="pt-card p-6 md:p-7" aria-labelledby="sync-status">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--pt-fill)] text-[var(--pt-text-secondary)]" aria-hidden="true">
                <Laptop size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h2 id="sync-status" className="text-[17px] font-semibold tracking-[-0.01em]">This device</h2>
                <p className="mt-1 max-w-lg text-[14px] leading-6 text-[var(--pt-text-secondary)]">
                  Nothing is synced. If you reinstall or move to another computer, export from the Library first.
                </p>
              </div>
            </div>
            <SyncChip state={CURRENT_SYNC_STATE} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <PrivacyChip state="stored-on-device" />
            <PrivacyChip state="processed-on-device" />
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="coming-heading">
          <h2 id="coming-heading" className="pt-section-title">What sync will mean</h2>
          <div className="pt-group">
            {[
              { icon: Lock, title: 'Synced to your account', body: 'An encrypted copy of your Library, available on your other devices. Off by default.' },
              { icon: Users, title: 'Shared with your workspace', body: 'Individual meetings you choose to share with teammates. Never automatic.' },
              { icon: CloudOff, title: 'Local only, always available', body: 'You can keep everything on this device. Sync is optional and reversible.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="pt-row">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--pt-fill)] text-[var(--pt-text-secondary)]" aria-hidden="true">
                  <Icon size={15} strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-5">{title}</p>
                  <p className="text-[13px] leading-5 text-[var(--pt-text-secondary)]">{body}</p>
                </div>
                <span className="pt-badge pt-badge--outline shrink-0">Coming later</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageBody>
  );
}
