import { NavLink } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Deenova MVP</CardDescription>
          <CardTitle className="text-2xl">Acceso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La autenticación se implementará en una fase posterior.
          </p>
          <Button asChild className="w-full">
            <NavLink to="/app/dashboard">Ver panel provisional</NavLink>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
