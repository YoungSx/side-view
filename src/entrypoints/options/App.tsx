import { PanelsTopLeft } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { loadSettings, type SettingsSnapshot, settings } from '@/settings/storage';

function SwitchRow(props: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <Label htmlFor={id}>{props.label}</Label>
        <p
          id={`${id}-hint`}
          className="mt-1.5 block text-sm font-normal leading-relaxed text-muted-foreground"
        >
          {props.hint}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-hint`}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={props.onCheckedChange}
      />
    </div>
  );
}

export function App() {
  const [s, setS] = useState<SettingsSnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [status, setStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [width, setWidth] = useState('');
  const [widthError, setWidthError] = useState('');
  const [overridesText, setOverridesText] = useState('');
  const [overridesError, setOverridesError] = useState('');

  useEffect(() => {
    loadSettings().then(
      (loaded) => {
        setS(loaded);
        setWidth(String(loaded.columnWidth));
        setOverridesText(JSON.stringify(loaded.selectorOverrides, null, 2));
      },
      () => setLoadError(true),
    );
  }, []);

  async function save<K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setSaveError('');
    setStatus('Saving…');
    try {
      // The key and value share K; the storage items otherwise form a union of setters.
      const item = settings[key] as { setValue: (value: SettingsSnapshot[K]) => Promise<void> };
      await item.setValue(value);
      setS((previous) => (previous ? { ...previous, [key]: value } : previous));
      setStatus('Changes saved');
    } catch {
      setStatus('');
      setSaveError('Couldn’t save this change. Please try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function saveWidth() {
    const value = Number(width);
    if (!Number.isInteger(value) || value < 320 || value > 1200) {
      setWidthError('Enter a whole number from 320 to 1200.');
      return;
    }
    setWidthError('');
    void save('columnWidth', value);
  }

  function saveOverrides() {
    try {
      const parsed: unknown = overridesText.trim() ? JSON.parse(overridesText) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Use a JSON object with selector names and CSS selectors.');
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string')
          throw new Error(`“${key}” must contain a CSS selector string.`);
        try {
          document.createDocumentFragment().querySelector(value);
        } catch {
          throw new Error(`“${key}” is not a valid CSS selector.`);
        }
      }
      setOverridesError('');
      void save('selectorOverrides', parsed as Record<string, string>);
    } catch (error) {
      setOverridesError(error instanceof Error ? error.message : 'Check your JSON and try again.');
    }
  }

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:ring-2 focus:ring-ring"
        href="#settings"
      >
        Skip to settings
      </a>
      <aside className="border-b bg-muted/40 p-6 lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:border-r lg:border-b-0">
        <a
          className="flex items-center gap-3 text-xl font-semibold tracking-tight"
          href="#settings"
        >
          <PanelsTopLeft className="size-6" aria-hidden="true" />
          side-view
        </a>
        <nav
          aria-label="Settings sections"
          className="mt-6 flex flex-wrap gap-1 lg:mt-12 lg:flex-col"
        >
          {['General', 'Layout', 'Platforms', 'Advanced'].map((label) => (
            <Button key={label} variant="ghost" asChild className="justify-start">
              <a href={`#${label.toLowerCase()}`}>{label}</a>
            </Button>
          ))}
        </nav>
        <p className="mt-auto hidden pt-10 text-sm leading-relaxed text-muted-foreground lg:block">
          Your timeline.
          <br />A little more room.
        </p>
      </aside>
      <main
        id="settings"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl min-w-0 space-y-8 px-6 py-10 sm:px-10 lg:px-16 lg:py-14"
      >
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Make room for the way you read.</p>
          <div className="min-h-5 text-sm text-muted-foreground" role="status">
            {status || 'Preferences sync with your browser account.'}
          </div>
          {saveError && (
            <Alert variant="destructive">
              <AlertTitle>Change not saved</AlertTitle>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
        </header>
        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Settings couldn’t load</AlertTitle>
            <AlertDescription>
              Reopen this page to try again. Your saved preferences haven’t changed.
            </AlertDescription>
          </Alert>
        ) : !s ? (
          <p role="status">Loading your preferences…</p>
        ) : (
          <>
            <section className="scroll-mt-8" id="general" aria-labelledby="general-title">
              <h2 className="text-xl font-semibold tracking-tight" id="general-title">
                General
              </h2>
              <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">
                Stay in your timeline while you explore.
              </p>
              <SwitchRow
                label="Enable side-view"
                hint="Open details beside your timeline. Reload X or Bluesky after changing this setting; Threads updates live."
                checked={s.enabled}
                disabled={busy}
                onCheckedChange={(value) => void save('enabled', value)}
              />
              <SwitchRow
                label="Open profiles, hashtags & searches"
                hint="Include these links in the detail column. Turn off to open only posts."
                checked={s.interceptProfilesAndTags}
                disabled={busy}
                onCheckedChange={(value) => void save('interceptProfilesAndTags', value)}
              />
            </section>
            <Separator />
            <section className="scroll-mt-8" id="layout" aria-labelledby="layout-title">
              <h2 className="text-xl font-semibold tracking-tight" id="layout-title">
                Layout
              </h2>
              <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">
                For X and Bluesky. Threads manages its own columns.
              </p>
              <fieldset disabled={busy} className="min-w-0 space-y-3">
                <legend className="text-sm font-medium">Where details open</legend>
                <RadioGroup
                  aria-label="Where details open"
                  value={s.layoutMode}
                  disabled={busy}
                  className="grid gap-4 sm:grid-cols-2"
                  onValueChange={(value) => {
                    if (value === 'replace-sidebar' || value === 'insert-column')
                      void save('layoutMode', value);
                  }}
                >
                  {(['replace-sidebar', 'insert-column'] as const).map((mode) => (
                    <Label
                      className="flex cursor-pointer flex-col items-stretch gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 data-[selected=true]:border-primary data-[selected=true]:bg-accent"
                      key={mode}
                      htmlFor={mode}
                      data-selected={s.layoutMode === mode}
                    >
                      <span
                        className="flex h-24 gap-1 rounded-md border bg-background p-2"
                        aria-hidden="true"
                      >
                        <span className="w-3 rounded-sm bg-muted" />
                        <span className="flex flex-1 items-center justify-center rounded-sm bg-muted text-xs text-muted-foreground">
                          Timeline
                        </span>
                        <span className="flex flex-1 items-center justify-center rounded-sm bg-primary text-xs text-primary-foreground">
                          Detail
                        </span>
                        {mode === 'insert-column' && <span className="w-8 rounded-sm bg-muted" />}
                      </span>
                      <span className="flex items-center gap-3">
                        <RadioGroupItem id={mode} value={mode} />
                        <span>
                          {mode === 'replace-sidebar' ? 'Replace sidebar' : 'Keep sidebar'}
                        </span>
                      </span>
                      <span className="mt-1.5 block text-sm font-normal leading-relaxed text-muted-foreground">
                        {mode === 'replace-sidebar'
                          ? 'Give the right sidebar to the detail view.'
                          : 'Add a detail column beside the sidebar.'}
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
              <form
                className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveWidth();
                }}
              >
                <div>
                  <Label htmlFor="sv-width">Maximum detail width</Label>
                  <p
                    id="width-hint"
                    className="mt-1.5 block text-sm font-normal leading-relaxed text-muted-foreground"
                  >
                    320–1200 px. Fits the available space.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-24 tabular-nums"
                      id="sv-width"
                      type="number"
                      min={320}
                      max={1200}
                      step={1}
                      value={width}
                      disabled={busy}
                      aria-describedby="width-hint width-error"
                      aria-invalid={!!widthError}
                      onChange={(event) => {
                        setWidth(event.target.value);
                        setWidthError('');
                      }}
                    />
                    <span className="mt-1.5 block text-sm font-normal leading-relaxed text-muted-foreground">
                      px
                    </span>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={busy || width === String(s.columnWidth)}
                    >
                      Apply
                    </Button>
                  </div>
                  <p id="width-error" className="mt-2 text-sm text-destructive">
                    {widthError}
                  </p>
                </div>
              </form>
              <SwitchRow
                label="Compact navigation"
                hint="Keep the left navigation as a slim icon rail, even after closing a detail."
                checked={s.compactNavigation}
                disabled={busy}
                onCheckedChange={(value) => void save('compactNavigation', value)}
              />
            </section>
            <Separator />
            <section className="scroll-mt-8" id="platforms" aria-labelledby="platforms-title">
              <h2 className="text-xl font-semibold tracking-tight" id="platforms-title">
                Platforms
              </h2>
              <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">
                One reading habit, three different homes.
              </p>
              <dl className="space-y-6 text-sm leading-relaxed [&_dt]:font-medium [&_dd]:mt-2 [&_dd]:max-w-prose [&_dd]:text-muted-foreground">
                <div>
                  <dt>X & Bluesky</dt>
                  <dd>
                    Use the layout and navigation preferences above. Changes apply live, except the
                    main enable switch.
                  </dd>
                </div>
                <div>
                  <dt>Threads</dt>
                  <dd>
                    Reuses one native column saved to your Threads account. Manage its width, order
                    and scrolling in Threads. To remove it, use the native column menu; disabling
                    side-view won’t delete it.
                  </dd>
                </div>
              </dl>
            </section>
            <Separator />
            <section className="scroll-mt-8" id="advanced" aria-labelledby="advanced-title">
              <h2 className="text-xl font-semibold tracking-tight" id="advanced-title">
                Advanced
              </h2>
              <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">
                For troubleshooting changes to X’s page structure.
              </p>
              <Accordion type="single" collapsible>
                <AccordionItem value="selectors" className="border-none">
                  <AccordionTrigger>Selector overrides</AccordionTrigger>
                  <AccordionContent>
                    <form
                      className="space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveOverrides();
                      }}
                    >
                      <Label htmlFor="sv-overrides">Custom selectors</Label>
                      <p
                        id="overrides-hint"
                        className="mt-1.5 block text-sm font-normal leading-relaxed text-muted-foreground"
                      >
                        A JSON object mapping selector keys to CSS selectors. Leave it empty to use
                        built-in selectors. Reload X after saving.
                      </p>
                      <Textarea
                        id="sv-overrides"
                        className="min-h-44 font-mono text-sm"
                        spellCheck={false}
                        value={overridesText}
                        disabled={busy}
                        aria-describedby="overrides-hint overrides-error"
                        aria-invalid={!!overridesError}
                        onChange={(event) => {
                          setOverridesText(event.target.value);
                          setOverridesError('');
                        }}
                      />
                      <p
                        id="overrides-error"
                        className="mt-2 text-sm text-destructive"
                        role="alert"
                      >
                        {overridesError}
                      </p>
                      <Button type="submit" disabled={busy}>
                        Save selectors
                      </Button>
                    </form>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>
            <Separator />
            <footer className="text-xs text-muted-foreground">
              side-view · Open a little wider.
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
