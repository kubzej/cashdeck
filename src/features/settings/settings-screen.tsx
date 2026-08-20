import { ChevronRight, FolderCog, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/auth-context'
import { Button } from '../../components/ui/button'
import {
  List,
  ListItem,
  ListItemActions,
  ListItemContent,
  ListItemDescription,
  ListItemTitle,
} from '../../components/ui/list'
import './settings.css'

export function SettingsScreen({ onOpenCategories }: { onOpenCategories: () => void }) {
  const { session, signOut } = useAuth()

  return (
    <section className="settings-screen" aria-label="Nastavení aplikace">
      <section className="settings-section" aria-labelledby="session-title">
        <h2 id="session-title">Účet</h2>
        <List gap="sm">
          <ListItem variant="quiet" size="spacious" className="surface-row settings-account-row" aria-label="Přihlášený účet">
            <UserRound className="settings-row-icon settings-row-icon--muted" aria-hidden="true" />
            <ListItemContent>
              <ListItemTitle>Přihlášený účet</ListItemTitle>
              <ListItemDescription>{session?.user.email ?? ''}</ListItemDescription>
            </ListItemContent>
          </ListItem>
        </List>
      </section>
      <section className="settings-section" aria-labelledby="management-title">
        <h2 id="management-title">Správa</h2>
        <List gap="sm">
          <ListItem render={<button type="button" onClick={onOpenCategories} />} interactive variant="quiet" size="spacious" className="surface-row settings-navigation-row">
            <FolderCog className="settings-row-icon settings-row-icon--primary" aria-hidden="true" />
            <ListItemContent>
              <ListItemTitle>Kategorie</ListItemTitle>
              <ListItemDescription>Výdaje a příjmy</ListItemDescription>
            </ListItemContent>
            <ListItemActions><ChevronRight aria-hidden="true" /></ListItemActions>
          </ListItem>
        </List>
      </section>
      <Button variant="outline" className="settings-sign-out" onClick={() => void signOut()}><LogOut aria-hidden="true" />Odhlásit se</Button>
    </section>
  )
}
