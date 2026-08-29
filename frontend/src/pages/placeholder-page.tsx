import { PagePlaceholder } from '@/components/shared/page-placeholder'

interface PlaceholderPageProps {
  eyebrow: string
  title: string
  description?: string
}

export function PlaceholderPage({
  eyebrow,
  title,
  description = 'Esta sección está preparada para su implementación funcional.',
}: PlaceholderPageProps) {
  return (
    <PagePlaceholder
      eyebrow={eyebrow}
      title={title}
      description={description}
    />
  )
}
