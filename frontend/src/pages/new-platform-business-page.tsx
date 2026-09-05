import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PlatformBusinessForm } from '@/features/platform-businesses/platform-business-form'

export function NewPlatformBusinessPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section>
        <p className="text-sm text-muted-foreground">Plataforma</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Nuevo negocio
        </h1>
      </section>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Alta de negocio</CardTitle>
          <CardDescription>
            Se crearán conjuntamente el tenant, su sucursal principal y el
            administrador inicial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformBusinessForm />
        </CardContent>
      </Card>
    </main>
  )
}
