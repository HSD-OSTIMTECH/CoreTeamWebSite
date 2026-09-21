import React from 'react';
import CommitteeBoard from '../components/common/CommitteeBoard';
import { Calendar } from 'lucide-react';

const EVENTS_COLUMNS = [
  { id: 'PLANLAMA', label: 'PLANLAMA' },
  { id: 'DEVAM_EDEN', label: 'DEVAM EDEN' },
  { id: 'TAMAMLANAN', label: 'TAMAMLANAN' }
];

const Events = ({ canEdit = true }) => {
  return (
    <CommitteeBoard
      committee="etkinlik"
      title="Etkinlik ve Sponsorluk"
      subtitle="Kurumsal etkinlik planlama ve partnerlik yönetimi merkezi."
      icon={Calendar}
      itemLabel="Etkinlik"
      columns={EVENTS_COLUMNS}
      canEdit={canEdit}
    />
  );
};

export default Events;
