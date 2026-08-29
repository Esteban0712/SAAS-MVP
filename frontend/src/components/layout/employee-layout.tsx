import { SectionLayout } from '@/components/layout/section-layout'

const navigation = [
  { label: 'Hoy', href: '/employee/today' },
  { label: 'Detalle de cita', href: '/employee/appointments/demo' },
]

export function EmployeeLayout() {
  return (
    <SectionLayout
      area="Espacio de empleado"
      title="Mi jornada"
      navigation={navigation}
    />
  )
}
