import { Check } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { colorKeys, colorLabels, type ColorKey } from '../lib/color-keys'
import './color-picker.css'

export { colorKeys, type ColorKey } from '../lib/color-keys'

export function ColorPicker({ value, onValueChange, ariaLabel }: { value: ColorKey; onValueChange: (colorKey: ColorKey) => void; ariaLabel: string }) {
  return (
    <ToggleGroup type="single" value={value} variant="ghost" size="icon" aria-label={ariaLabel} className="color-picker" onValueChange={(colorKey) => { if (colorKey) onValueChange(colorKey as ColorKey) }}>
      {colorKeys.map((colorKey) => (
        <ToggleGroupItem key={colorKey} value={colorKey} aria-label={colorLabels[colorKey]} title={colorLabels[colorKey]} className="color-picker__choice">
          <span className={`color-picker__dot color-key--${colorKey}`} aria-hidden="true">
            {value === colorKey ? <Check className="color-picker__check" aria-hidden="true" /> : null}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
