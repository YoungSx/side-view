import { useEffect, useId, useState } from 'react';
import { i18n } from '#i18n';
import { browser } from '#imports';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { loadSettings, type SettingsSnapshot, settings } from '@/settings/storage';
import { readTabState, type TabState } from './tab-state';

/** Column width bounds, mirroring the settings page so both surfaces agree on what is valid. */
const WIDTH_MIN = 320;
const WIDTH_MAX = 1200;

/** Maps a platform to the suffix of its display-name message key. */
const PLATFORM_LABEL_KEYS = {
  x: 'X',
  bluesky: 'Bluesky',
  threads: 'Threads',
} as const satisfies Record<TabState extends { platform: infer P } ? P : never, string>;

/** Status line copy for each derived tab state. `null` means "no badge". */
function statusLabel(state: TabState): string | null {
  if (state.kind === 'unsupported') return i18n.t('popup.status.unsupported');
  if (state.kind === 'active') return i18n.t('popup.status.active');
  if (state.kind === 'inactive') return i18n.t('popup.status.inactive');
  return i18n.t('popup.status.needsReload');
}

/**
 * The badge's full label as ONE string. Splitting the platform and the status into sibling spans
 * reads the same to the eye but breaks text selection and leaves screen readers to stitch two
 * fragments together, so the separator lives in the string instead.
 */
function statusText(state: TabState): string {
  const status = statusLabel(state) ?? '';
  if (state.kind === 'unsupported') return status;
  const platform = i18n.t(`popup.platform.${PLATFORM_LABEL_KEYS[state.platform]}`);
  return i18n.t('popup.status.format', [platform, status]);
}

function SwitchRow(props: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <Label htmlFor={id} className="text-sm font-normal leading-snug">
        {props.label}
      </Label>
      <Switch
        id={id}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={props.onCheckedChange}
      />
    </div>
  );
}

export function App() {
  const [s, setS] = useState<SettingsSnapshot | null>(null);
  const [tab, setTab] = useState<TabState | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let live = true;
    loadSettings().then(
      async (loaded) => {
        if (!live) return;
        setS(loaded);
        // Read the tab after the settings so `enabled` is already known — the two signals are
        // combined into one status and a second round trip would outlive the popup anyway.
        setTab(await readTabState(browser, loaded.enabled));
      },
      () => {
        if (live) setS(null);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  async function save<K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) {
    if (busy) return;
    setBusy(true);
    setSaveError('');
    try {
      // The key and value share K; the storage items otherwise form a union of setters.
      const item = settings[key] as { setValue: (value: SettingsSnapshot[K]) => Promise<void> };
      await item.setValue(value);
      const next = s ? { ...s, [key]: value } : null;
      setS(next);
      // `enabled` is the one setting the engine cannot apply to a live tab, so the status line has
      // to be re-derived: switching it on over a supported page turns "inactive" into exactly the
      // "reload this tab" case the user now needs to act on.
      if (key === 'enabled' && next) setTab(await readTabState(browser, next.enabled));
    } catch {
      setSaveError(i18n.t('popup.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function reloadTab() {
    try {
      const [current] = await browser.tabs.query({ active: true, currentWindow: true });
      if (current?.id !== undefined) await browser.tabs.reload(current.id);
      window.close();
    } catch {
      // Nothing useful to say from a popup that is already closing; leave it open.
    }
  }

  const platform = tab && tab.kind !== 'unsupported' ? tab.platform : null;
  // Threads renders into a native column it owns, so width and placement genuinely do not apply.
  const isThreads = platform === 'threads';

  if (!s) {
    return (
      <div className="space-y-3 p-4" role="status" aria-label={i18n.t('popup.loading')}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <span className="sr-only">{i18n.t('popup.loading')}</span>
      </div>
    );
  }

  return (
    // No width class: the fixed 360px comes from the popup stylesheet, which is also what Chrome
    // measures to size the popup. Setting it here as well would only risk the two disagreeing.
    <div className="flex flex-col">
      <header className="flex h-12 items-center gap-2.5 px-4">
        <img src="/icons/32.png" alt="" width={20} height={20} className="size-5 shrink-0" />
        <span className="flex-1 truncate text-sm font-semibold tracking-tight">
          {i18n.t('brand')}
        </span>
        {tab === null ? (
          <Skeleton className="h-5 w-24 rounded-full" />
        ) : (
          <Badge
            variant={tab.kind === 'active' ? 'secondary' : 'outline'}
            className="gap-1.5"
            // The popup is the only status surface the user has, so the whole line is announced.
            role="status"
          >
            {tab.kind === 'active' && (
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            )}
            {statusText(tab)}
          </Badge>
        )}
      </header>

      <Separator />

      <div className="px-4 pt-1">
        <SwitchRow
          label={i18n.t('popup.enableTitle')}
          checked={s.enabled}
          disabled={busy}
          onCheckedChange={(value) => void save('enabled', value)}
        />
      </div>

      {tab?.kind === 'needs-reload' && (
        <div className="px-4 pt-1 pb-1">
          <Alert>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{i18n.t('popup.reloadHint')}</span>
              <Button size="sm" variant="outline" onClick={() => void reloadTab()}>
                {i18n.t('popup.reloadAction')}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {saveError && (
        <div className="px-4 pt-2">
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        </div>
      )}

      <Separator className="mt-3" />

      {isThreads ? (
        <p className="px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {i18n.t('popup.threadsOwnsColumn')}
        </p>
      ) : (
        <div className="space-y-4 px-4 py-3">
          <fieldset disabled={busy} className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">{i18n.t('popup.layoutLegend')}</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              value={s.layoutMode}
              aria-label={i18n.t('popup.layoutLegend')}
              className="w-full"
              onValueChange={(value) => {
                if (value === 'replace-sidebar' || value === 'insert-column')
                  void save('layoutMode', value);
              }}
            >
              <ToggleGroupItem value="replace-sidebar" className="flex-1">
                {i18n.t('popup.layout.replaceSidebar')}
              </ToggleGroupItem>
              <ToggleGroupItem value="insert-column" className="flex-1">
                {i18n.t('popup.layout.insertColumn')}
              </ToggleGroupItem>
            </ToggleGroup>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span id="popup-width-label" className="text-sm font-medium">
                {i18n.t('popup.widthTitle')}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {i18n.t('popup.widthValue', [String(s.columnWidth)])}
              </span>
            </div>
            <Slider
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              step={10}
              value={[s.columnWidth]}
              disabled={busy}
              aria-labelledby="popup-width-label"
              // Written straight through: a popup has no Apply affordance worth the extra click,
              // and the running engine already watches this item.
              onValueChange={([value]) => {
                if (value !== undefined) void save('columnWidth', value);
              }}
            />
          </div>
        </div>
      )}

      <Separator />

      <div className="px-4 py-1">
        {!isThreads && !(tab?.kind === 'active' && tab.compactNavigationAvailable === false) && (
          <SwitchRow
            label={i18n.t('popup.compactTitle')}
            checked={s.compactNavigation}
            disabled={busy}
            onCheckedChange={(value) => void save('compactNavigation', value)}
          />
        )}
        <SwitchRow
          label={i18n.t('popup.interceptTitle')}
          checked={s.interceptProfilesAndTags}
          disabled={busy}
          onCheckedChange={(value) => void save('interceptProfilesAndTags', value)}
        />
      </div>

      <Separator className="mt-2" />

      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            void browser.runtime.openOptionsPage();
            window.close();
          }}
        >
          {i18n.t('popup.allSettings')}
        </Button>
      </div>
    </div>
  );
}
