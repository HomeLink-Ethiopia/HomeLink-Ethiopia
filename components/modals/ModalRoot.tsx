'use client'

import ApplicationModal from './ApplicationModal'
import ViewingModal from './ViewingModal'
import MaintenanceModal from './MaintenanceModal'
import FraudModal from './FraudModal'

export default function ModalRoot() {
  return (
    <>
      <ApplicationModal />
      <ViewingModal />
      <MaintenanceModal />
      <FraudModal />
    </>
  )
}
