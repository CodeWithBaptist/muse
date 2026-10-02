export default function SettingsPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="type-page-title">Settings</h1>
      
      <div className="space-y-6 max-w-2xl">
        <section className="space-y-4">
          <h2 className="type-section-label">Account</h2>
          <div className="p-4 rounded-lg bg-surface border border-border-subtle">
            <p className="type-body font-medium">Manage your Spotify connection and account data.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="type-section-label">Preferences</h2>
          <div className="p-4 rounded-lg bg-surface border border-border-subtle">
            <p className="type-body font-medium">Adjust how MUSE recommends music to you.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
