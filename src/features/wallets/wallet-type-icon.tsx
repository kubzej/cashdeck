import type { ComponentType } from 'react'
import { Banknote, Bitcoin, Landmark, PiggyBank, TrendingUp, Umbrella, WalletCards } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '../../components/ui/toggle-group'
import { walletTypes, type WalletType } from './api'
import './wallet-type-picker.css'

const icons: Record<WalletType, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  investment: TrendingUp,
  pension: Umbrella,
  crypto: Bitcoin,
  other: WalletCards,
}

const labels: Record<WalletType, string> = {
  cash: 'Hotovost',
  checking: 'Běžný účet',
  savings: 'Spořicí účet',
  investment: 'Investice',
  pension: 'Penzijní spoření',
  crypto: 'Kryptoměny',
  other: 'Jiné',
}

export function WalletTypeIcon({ walletType, className = '' }: { walletType: WalletType; className?: string }) {
  const Icon = icons[walletType]
  return <Icon className={className} aria-hidden />
}

export function walletTypeLabel(walletType: WalletType) {
  return labels[walletType]
}

export function WalletTypePicker({ value, onValueChange, ariaLabel }: { value: WalletType; onValueChange: (walletType: WalletType) => void; ariaLabel: string }) {
  return (
    <ToggleGroup type="single" value={value} aria-label={ariaLabel} className="wallet-type-picker" onValueChange={(next) => { if (next) onValueChange(next as WalletType) }}>
      {walletTypes.map((walletType) => (
        <ToggleGroupItem key={walletType} value={walletType} className="wallet-type-picker__choice">
          <WalletTypeIcon walletType={walletType} />
          <span>{labels[walletType]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
