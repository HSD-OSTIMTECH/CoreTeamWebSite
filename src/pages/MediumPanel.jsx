import React from 'react';
import CommitteeBoard from '../components/common/CommitteeBoard';
import { FileText } from 'lucide-react';

const MEDIUM_COLUMNS = [
  { id: 'TASLAK', label: 'TASLAKLAR' },
  { id: 'INCELEMEDE', label: 'İNCELEMEDE' },
  { id: 'TAMAMLANDI', label: 'TAMAMLANDI' }
];

const MediumPanel = ({ canEdit = true }) => {
  return (
    <CommitteeBoard
      committee="medium"
      title="Medium Paneli"
      subtitle="Makale yazımı, editörlük ve yayın yönetimi merkezi."
      icon={FileText}
      itemLabel="Yazı"
      columns={MEDIUM_COLUMNS}
      canEdit={canEdit}
    />
  );
};

export default MediumPanel;
