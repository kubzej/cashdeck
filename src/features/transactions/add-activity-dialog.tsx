import { ArrowRightLeft, ReceiptText } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import './transactions.css'

type AddActivityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateTransaction: () => void
  onCreateTransfer: () => void
}

export function AddActivityDialog({ open, onOpenChange, onCreateTransaction, onCreateTransfer }: AddActivityDialogProps) {
  function choose(action: () => void) {
    onOpenChange(false)
    action()
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="sm" className="activity-add-dialog">
      <DialogHeader><DialogTitle>Přidat záznam</DialogTitle></DialogHeader>
      <DialogBody><div className="activity-add-dialog__actions">
        <Button variant="outline" className="activity-add-dialog__action" onClick={() => choose(onCreateTransaction)}><ReceiptText aria-hidden="true" /><span>Transakce</span></Button>
        <Button variant="outline" className="activity-add-dialog__action" onClick={() => choose(onCreateTransfer)}><ArrowRightLeft aria-hidden="true" /><span>Převod</span></Button>
      </div></DialogBody>
    </DialogContent>
  </Dialog>
}
