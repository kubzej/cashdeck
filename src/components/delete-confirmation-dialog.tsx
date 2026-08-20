import { Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/dialog'
import './delete-confirmation-dialog.css'

type DeleteConfirmationDialogProps = {
  title: string
  description: string
  triggerLabel: string
  triggerClassName?: string
  isDeleting?: boolean
  onConfirm: () => void
}

export function DeleteConfirmationDialog({
  title,
  description,
  triggerLabel,
  triggerClassName,
  isDeleting = false,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" className={`delete-confirmation-trigger ${triggerClassName ?? ''}`.trim()} aria-label={triggerLabel} title={triggerLabel} />}>
        <Trash2 aria-hidden="true" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader className="pb-4">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3">
          <AlertDialogClose render={<Button variant="ghost" className="justify-self-center px-6" disabled={isDeleting} />}>
            Zrušit
          </AlertDialogClose>
          <Button variant="destructive" loading={isDeleting} onClick={onConfirm}>
            Smazat
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
