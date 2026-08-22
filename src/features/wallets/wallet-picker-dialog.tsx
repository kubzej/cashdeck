import { useState } from 'react'
import { Check, WalletCards } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import type { Wallet } from './api'
import { WalletTypeIcon } from './wallet-type-icon'

type WalletPickerDialogProps = {
  wallets: Wallet[]
  selectedWallet: Wallet | null
  placeholder: string
  onSelect: (walletId: string) => void
  buttonClassName?: string
}

export function WalletPickerDialog({ wallets, selectedWallet, placeholder, onSelect, buttonClassName = '' }: WalletPickerDialogProps) {
  const [open, setOpen] = useState(false)

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" className={`transaction-picker-button ${buttonClassName}`.trim()} data-selected={selectedWallet ? '' : undefined} />}>
      {selectedWallet ? <><WalletTypeIcon walletType={selectedWallet.walletType} className={`wallet-icon color-key--${selectedWallet.colorKey}`} /><span>{selectedWallet.name}</span></> : <><WalletCards aria-hidden="true" /><span>{placeholder}</span></>}
    </DialogTrigger>
    <DialogContent size="sm" className="transaction-picker-dialog">
      <DialogHeader><DialogTitle>Vyber peněženku</DialogTitle></DialogHeader>
      <DialogBody><div className="transaction-wallet-options">
        {wallets.map((wallet) => <button key={wallet.id} className={`transaction-wallet-option color-key--${wallet.colorKey}`} data-selected={selectedWallet?.id === wallet.id || undefined} type="button" onClick={() => { onSelect(wallet.id); setOpen(false) }}><WalletTypeIcon walletType={wallet.walletType} className={`wallet-icon color-key--${wallet.colorKey}`} /><span>{wallet.name}</span>{selectedWallet?.id === wallet.id ? <Check aria-hidden="true" /> : null}</button>)}
      </div></DialogBody>
    </DialogContent>
  </Dialog>
}
