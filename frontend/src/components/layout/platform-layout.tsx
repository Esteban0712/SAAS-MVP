import { SectionLayout } from '@/components/layout/section-layout'

const navigation = [
  { label: 'Negocios', href: '/platform/businesses' },
  { label: 'Nuevo negocio', href: '/platform/businesses/new' },
]

export function PlatformLayout() {
  return (
    <SectionLayout
      area="Plataforma"
      title="Administración de negocios"
      navigation={navigation}
    />
  )
}
