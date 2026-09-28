import { useEffect, useId, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { LayoutMode } from '@/core/types';
import { loadSettings, type SettingsSnapshot, settings } from '@/settings/storage';

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  'replace-sidebar': 'Replace the right sidebar',
  'insert-column': 'Insert a new column (keep the sidebar)',
};

/** A malformed override would throw from querySelector at engine startup and kill the feature. */
function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

function SwitchRow(props: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{props.label}</Label>
        {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
      </div>
      <Switch id={id} checked={props.checked} onCheckedChange={props.onCheckedChange} />
    </div>
  );
}

export function App() {
  const [s, setS] = useState<SettingsSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overridesText, setOverridesText] = useState('');
  const [overridesError, setOverridesError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then(
      (loaded) => {
        setS(loaded);
        setOverridesText(JSON.stringify(loaded.selectorOverrides, null, 2));
      },
      (error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to load settings.');
      },
    );
  }, []);

  if (loadError) {
    return (
      <main className="p-6 text-sm text-destructive">
        Couldn’t load your settings: {loadError}. Try reopening this page.
      </main>
    );
  }
  if (!s) return <main className="p-6 text-sm text-muted-foreground">Loading…</main>;

  const patch = (next: Partial<SettingsSnapshot>): void =>
    setS((prev) => (prev ? { ...prev, ...next } : prev));

  const saveOverrides = (): void => {
    try {
      const parsed: unknown = overridesText.trim() === '' ? {} : JSON.parse(overridesText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Expected a JSON object.');
      }
      const clean: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value !== 'string') throw new Error(`"${key}" must map to a string.`);
        if (!isValidSelector(value)) throw new Error(`"${key}" is not a valid CSS selector.`);
        clean[key] = value;
      }
      setOverridesError(null);
      patch({ selectorOverrides: clean });
      void settings.selectorOverrides.setValue(clean);
    } catch (error) {
      setOverridesError(error instanceof Error ? error.message : 'Invalid JSON.');
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">side-view</h1>
        <p className="text-sm text-muted-foreground">
          Open a tweet's detail beside the timeline instead of navigating away.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Behaviour</CardTitle>
          <CardDescription>
            Changes apply live; toggling Enabled needs an x.com reload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SwitchRow
            label="Enabled"
            checked={s.enabled}
            onCheckedChange={(v) => {
              patch({ enabled: v });
              void settings.enabled.setValue(v);
            }}
          />

          <div className="space-y-2">
            <Label>Layout</Label>
            <RadioGroup
              value={s.layoutMode}
              onValueChange={(v) => {
                patch({ layoutMode: v as LayoutMode });
                void settings.layoutMode.setValue(v as LayoutMode);
              }}
            >
              {(Object.keys(LAYOUT_LABELS) as LayoutMode[]).map((mode) => (
                <div key={mode} className="flex items-center gap-2">
                  <RadioGroupItem id={`layout-${mode}`} value={mode} />
                  <Label htmlFor={`layout-${mode}`} className="font-normal">
                    {LAYOUT_LABELS[mode]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sv-width">Column width (px)</Label>
            <Input
              id="sv-width"
              type="number"
              min={320}
              max={1200}
              value={s.columnWidth}
              className="w-28"
              onChange={(e) => {
                const px = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(px)) return;
                patch({ columnWidth: px });
                void settings.columnWidth.setValue(px);
              }}
            />
          </div>

          <SwitchRow
            label="Also open profiles, hashtags & searches"
            hint="Off by default — only tweets open in the side column."
            checked={s.interceptProfilesAndTags}
            onCheckedChange={(v) => {
              patch({ interceptProfilesAndTags: v });
              void settings.interceptProfilesAndTags.setValue(v);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sv-overrides">Selector overrides</Label>
            <p className="text-xs text-muted-foreground">
              JSON map of selector keys to CSS selectors, applied over the built-ins if X changes
              its DOM. Saved when you click away.
            </p>
            <Textarea
              id="sv-overrides"
              className="h-40 font-mono text-xs"
              spellCheck={false}
              value={overridesText}
              onChange={(e) => setOverridesText(e.target.value)}
              onBlur={saveOverrides}
            />
            {overridesError && <p className="text-xs text-destructive">{overridesError}</p>}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
