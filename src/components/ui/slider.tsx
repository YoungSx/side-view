import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from '@/lib/utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );
  // A single-value slider's thumb gets no name from Radix (`getLabel` returns undefined below
  // three values), and the Root is a plain span, so `htmlFor` on a Label cannot reach it either.
  // Forwarding the labelling props to the thumb is what makes the control announce itself.
  const { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy } = props;

  // Radix renders one thumb per value and identifies them by position, so the keys are the slot
  // names rather than loop indices: a two-value slider has a stable start and end thumb no matter
  // what the user drags, and a single-value slider has exactly one.
  const thumb = (slot: string) => (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      key={slot}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    />
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full',
          )}
        />
      </SliderPrimitive.Track>
      {_values.length > 1 ? [thumb('start'), thumb('end')] : thumb('single')}
    </SliderPrimitive.Root>
  );
}

export { Slider };
