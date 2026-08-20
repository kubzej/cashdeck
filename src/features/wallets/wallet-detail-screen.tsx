import { ArrowLeft, Pencil, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { type Wallet } from './api'
import './wallets.css'

export function WalletDetailScreen({
  wallet,
  onBack,
  onEdit,
}: {
  wallet: Wallet
  onBack: () => void
  onEdit: () => void
}) {
  return (
    <section className="wallet-detail-screen" aria-labelledby="wallet-detail-title">
      <header className="wallet-form-header">
        <Button variant="ghost" size="icon" aria-label="Zpět na peněženky" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 id="wallet-detail-title">{wallet.name}</h1>
        <Button variant="ghost" size="icon" aria-label="Upravit peněženku" onClick={onEdit}>
          <Pencil aria-hidden="true" />
        </Button>
      </header>

      <div className="wallet-detail-summary">
        <WalletCards className={`wallet-detail-icon wallet-icon color-key--${wallet.colorKey}`} aria-hidden="true" />
        <span className="wallet-detail-balance">{formatCzk(wallet.openingBalanceCzk)}</span>
      </div>
    </section>
  )
}

function formatCzk(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}
