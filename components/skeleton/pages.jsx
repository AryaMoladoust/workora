import { Sk, SkCard, SkCardHead, SkFeedRows, SkHeading, SkLines, SkProgressRows, SkStatGrid, SkStatus, SkTaskRows, SkToolbar } from "./Sk";

/* ---------------------------------------------------------------- dashboard */
export function DashboardSkeleton() {
  return (
    <div className="dashboard" aria-busy="true">
      <SkStatus />
      <Sk className="sk-hero" h={150} w="100%" />
      <SkStatGrid />
      <div className="dash-grid" aria-hidden="true">
        <SkCard className="span-7"><SkCardHead /><SkTaskRows count={5} /></SkCard>
        <SkCard className="span-5">
          <SkCardHead />
          <div className="donut-wrap">
            <Sk className="sk-donut" circle w={170} h={170} />
            <span className="sk-stack" style={{ minWidth: 150, gap: 14 }}><SkLines widths={[100, 100, 100, 70]} h={14} /></span>
          </div>
        </SkCard>
        <SkCard className="span-7"><SkCardHead /><SkProgressRows count={4} /></SkCard>
        <SkCard className="span-5">
          <SkCardHead />
          <div className="bars" style={{ height: 170 }}>
            {[55, 80, 40, 20, 95, 30, 70].map((h, i) => (
              <div className="bar-col" key={i}><Sk w="70%" h={`${h}%`} r={8} d={i} /></div>
            ))}
          </div>
        </SkCard>
        <SkCard className="span-5">
          <SkCardHead />
          <div className="sk-row">{[0, 1, 2, 3, 4].map((i) => <Sk key={i} w={44} h={44} circle d={i} />)}</div>
          <SkLines widths={[80, 70, 76, 60]} h={14} />
        </SkCard>
        <SkCard className="span-7"><SkCardHead /><SkFeedRows count={4} /></SkCard>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- projects */
export function ProjectCardSkeleton({ i = 0 }) {
  return (
    <div className="project-card" aria-hidden="true">
      <div className="project-card-top"><Sk w={44} h={44} r={14} d={i} /><Sk w={60} h={24} r={999} d={i} /></div>
      <SkLines widths={[70, 100, 82]} h={13} d={i} />
      <span className="sk-stack" style={{ gap: 8 }}><Sk w="100%" h={8} r={999} d={i} /><Sk w={120} h={10} d={i + 1} /></span>
      <div className="project-card-foot"><span className="sk-row">{[0, 1, 2].map((k) => <Sk key={k} w={30} h={30} circle d={i + k} />)}</span><Sk w={70} h={12} d={i} /></div>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="page-shell" aria-busy="true">
      <SkStatus />
      <SkHeading action />
      <SkToolbar tabs={4} action={false} />
      <div className="project-grid">{Array.from({ length: 6 }, (_, i) => <ProjectCardSkeleton key={i} i={i} />)}</div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="page-shell narrow-page" aria-busy="true">
      <SkStatus />
      <SkHeading narrow />
      <SkCard>
        {[0, 1, 2, 3].map((i) => (
          <span className="sk-stack" style={{ gap: 8 }} key={i}><Sk w={90} h={13} d={i} /><Sk w="100%" h={i === 1 ? 110 : 44} r={12} d={i + 1} /></span>
        ))}
        <Sk w={140} h={44} r={12} />
      </SkCard>
    </div>
  );
}

/* ---------------------------------------------------------------- project page */
export function ProjectHeadSkeleton() {
  return (
    <div aria-busy="true">
      <SkStatus />
      <div className="project-head card" aria-hidden="true">
        <Sk w={56} h={56} r={18} />
        <div className="project-head-main">
          <span className="sk-row"><Sk w={220} h={26} /><Sk w={56} h={24} r={999} d={1} /></span>
          <SkLines widths={[80, 55]} h={12} d={1} />
          <span className="sk-row"><Sk w={110} h={12} d={2} /><Sk w={110} h={12} d={3} /></span>
        </div>
        <div className="project-head-team"><span className="sk-row">{[0, 1, 2].map((i) => <Sk key={i} w={30} h={30} circle d={i} />)}</span></div>
      </div>
      <div className="tabs" aria-hidden="true">{[90, 70, 70, 60, 80].map((w, i) => <Sk key={i} w={w} h={36} r={11} d={i} />)}</div>
    </div>
  );
}

export function ProjectOverviewSkeleton() {
  return (
    <div className="dashboard" aria-busy="true">
      <SkStatus />
      <SkStatGrid />
      <div className="dash-grid" aria-hidden="true">
        <SkCard className="span-7"><SkCardHead /><SkTaskRows count={5} /></SkCard>
        <SkCard className="span-5">
          <SkCardHead />
          <div className="donut-wrap"><Sk circle w={170} h={170} /><span className="sk-stack" style={{ minWidth: 140, gap: 14 }}><SkLines widths={[100, 100, 100]} h={14} /></span></div>
        </SkCard>
        <SkCard className="span-5"><SkCardHead /><SkLines widths={[100, 100, 100, 100]} h={14} /></SkCard>
        <SkCard className="span-7"><SkCardHead /><SkFeedRows count={3} /></SkCard>
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="tworkspace" aria-busy="true">
      <SkStatus />
      <div className="toolbar" aria-hidden="true">
        <Sk w={260} h={44} r={12} /><Sk w={140} h={44} r={12} d={1} /><Sk w={140} h={44} r={12} d={2} />
        <span className="sk-row" style={{ marginInlineStart: "auto" }}><Sk w={150} h={44} r={12} d={2} /><Sk w={130} h={44} r={12} d={3} /></span>
      </div>
      <div className="kanban" aria-hidden="true">
        {[3, 2, 2].map((count, c) => (
          <section className="kcol" key={c}>
            <header className="kcol-head"><Sk w={10} h={10} circle /><Sk w={90} h={14} d={c} /></header>
            <div className="kcol-body">
              {Array.from({ length: count }, (_, i) => (
                <div className="tcard" key={i}>
                  <SkLines widths={[85, 55]} h={13} d={c + i} />
                  <span className="sk-row"><Sk w={56} h={22} r={999} d={i} /><Sk w={64} h={12} d={i + 1} /><Sk w={28} h={28} circle d={i} className="sk-push" /></span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function MyTasksSkeleton() {
  return (
    <div className="page-shell" aria-busy="true">
      <SkStatus />
      <SkHeading />
      <div className="scope-tabs filter-tabs" aria-hidden="true">{[120, 130, 160].map((w, i) => <Sk key={i} w={w} h={34} r={10} d={i} />)}</div>
      <div className="toolbar" aria-hidden="true"><Sk w={260} h={44} r={12} /><Sk w={140} h={44} r={12} d={1} /><Sk w={140} h={44} r={12} d={2} /><Sk w={130} h={44} r={12} d={3} className="sk-push" /></div>
      <div className="stack-wide" aria-hidden="true">
        {[4, 3].map((n, g) => (
          <section className="lgroup" key={g}>
            <span className="sk-row" style={{ padding: "4px 6px" }}><Sk w={16} h={16} d={g} /><Sk w={100} h={15} d={g + 1} /></span>
            <div className="lrows card"><SkTaskRows count={n} /></div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- people / lists */
export function MembersSkeleton() {
  return (
    <div className="page-shell" aria-busy="true">
      <SkStatus />
      <SkHeading />
      <SkCard className="invite-card"><span className="sk-row"><Sk w={32} h={32} r={10} /><Sk w={220} h={16} d={1} /></span><Sk w={220} h={52} r={14} d={1} /></SkCard>
      <SkToolbar tabs={3} />
      <div className="member-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="member-card" key={i}>
            <div className="member-top"><Sk w={46} h={46} circle d={i} /><span className="sk-stack" style={{ gap: 8 }}><Sk w="60%" h={14} d={i} /><Sk w="80%" h={11} d={i + 1} /></span><Sk w={44} h={24} r={999} d={i} /></div>
            <Sk w="100%" h={56} r={12} d={i} />
            <span className="sk-row"><Sk w={96} h={24} r={999} d={i} /><Sk w={80} h={24} r={999} d={i + 1} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="page-shell" aria-busy="true">
      <SkStatus />
      <SkHeading />
      <div className="toolbar" aria-hidden="true">{[0, 1, 2, 3].map((i) => <Sk key={i} w={150} h={44} r={12} d={i} />)}</div>
      <section className="card" aria-hidden="true"><Sk w={60} h={13} /><div style={{ height: 14 }} /><SkFeedRows count={6} /></section>
    </div>
  );
}

export function ProjectActivitySkeleton() {
  return (
    <div aria-busy="true">
      <SkStatus />
      <div className="toolbar" aria-hidden="true">{[0, 1, 2].map((i) => <Sk key={i} w={150} h={44} r={12} d={i} />)}</div>
      <section className="card" aria-hidden="true"><SkFeedRows count={5} /></section>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div className="page-shell narrow-page" aria-busy="true">
      <SkStatus />
      <SkHeading narrow />
      <div className="scope-tabs filter-tabs" aria-hidden="true"><Sk w={70} h={34} r={10} /><Sk w={110} h={34} r={10} d={1} /></div>
      <div className="card" aria-hidden="true"><SkFeedRows count={7} /></div>
    </div>
  );
}

export function NotesSkeleton() {
  return (
    <div className="page-shell" aria-busy="true">
      <SkStatus />
      <SkHeading />
      <SkToolbar tabs={3} />
      <div className="note-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="note-card" key={i} style={{ cursor: "default" }}>
            <span className="sk-row"><Sk w={36} h={36} r={11} d={i} /><Sk w="55%" h={16} d={i} /></span>
            <SkLines widths={[100, 92, 64]} h={12} d={i} />
            <span className="sk-row"><Sk w={46} h={22} r={999} d={i} /><Sk w={56} h={22} r={999} d={i + 1} /></span>
            <span className="sk-row" style={{ paddingTop: 10, borderTop: "1px dashed var(--border)" }}><Sk w={70} h={22} r={999} d={i} /><Sk w={90} h={11} d={i} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <div className="page-shell narrow-page" aria-busy="true">
      <SkStatus />
      <SkHeading narrow />
      <div className="announce-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div className="announce" key={i}>
            <span className="sk-row"><Sk w={40} h={40} r={12} d={i} /><span className="sk-stack" style={{ gap: 8 }}><Sk w="50%" h={16} d={i} /><Sk w="30%" h={11} d={i + 1} /></span></span>
            <SkLines widths={[100, 96, 80, 50]} h={12} d={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chat */
export function ThreadSkeleton({ embedded = false }) {
  const rows = [
    { mine: false, w: 52 }, { mine: false, w: 38 }, { mine: true, w: 44 }, { mine: false, w: 60 }, { mine: true, w: 30 }, { mine: true, w: 48 }, { mine: false, w: 42 },
  ];
  return (
    <section className={`thread ${embedded ? "thread-embedded" : ""}`} aria-busy="true">
      <SkStatus />
      <header className="thread-head" aria-hidden="true">
        <Sk w={52} h={52} circle />
        <span className="sk-stack" style={{ gap: 7, flex: 1 }}><Sk w={160} h={15} d={1} /><Sk w={100} h={11} d={2} /></span>
      </header>
      <div className="thread-list" aria-hidden="true">
        {rows.map((r, i) => (
          <div className={`msg ${r.mine ? "is-mine" : ""}`} key={i}>
            {!r.mine && <Sk w={30} h={30} circle d={i} />}
            <Sk w={`${r.w}%`} h={i % 3 === 0 ? 60 : 42} r={20} d={i} />
          </div>
        ))}
      </div>
      <div className="composer" aria-hidden="true"><Sk w="100%" h={54} r={26} /></div>
    </section>
  );
}

export function ChatSkeleton() {
  return (
    <div className="chat-shell" aria-busy="true">
      <SkStatus />
      <aside className="chat-list" aria-hidden="true">
        <div className="chat-list-top"><Sk w={48} h={48} r={18} d={1} /><Sk w="100%" h={48} r={18} d={1} /><Sk w={48} h={48} r={18} d={1} /></div>
        <div className="chat-list-body">
          {[3, 4].map((count, g) => (
            <section className="chat-card" key={g}>
              <div style={{ padding: "2px 8px 10px" }}><Sk w={70} h={16} d={g} /></div>
              <ul>
                {Array.from({ length: count }, (_, i) => (
                  <li key={i}>
                    <div className="conv" style={{ cursor: "default" }}>
                      <Sk w={46} h={46} circle d={i} />
                      <span className="sk-stack" style={{ gap: 8, flex: 1 }}><Sk w={`${60 - (i % 3) * 10}%`} h={14} d={i} /><Sk w={`${85 - (i % 2) * 15}%`} h={11} d={i + 1} /></span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
      <div className="chat-main"><ThreadSkeleton /></div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="page-shell" aria-busy="true">
      <SkStatus />
      <SkHeading />
      <SkCard><Sk w={64} h={64} circle /><SkLines widths={[50, 80, 65]} h={14} /></SkCard>
    </div>
  );
}
