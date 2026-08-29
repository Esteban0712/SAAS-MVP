import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PagePlaceholderProps {
  eyebrow: string
  title: string
  description: string
}

export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section>
        <p className="text-sm text-muted-foreground">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </section>
      <Card className="min-h-64">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {description}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
