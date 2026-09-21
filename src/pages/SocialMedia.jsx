import React from 'react';
import CommitteeBoard from '../components/common/CommitteeBoard';
import { Cpu } from 'lucide-react';

const SOCIAL_COLUMNS = [
  { id: 'PLANLANAN', label: 'PLANLANAN' },
  { id: 'URETIMDE', label: 'ÜRETİMDE' },
  { id: 'TAMAMLANAN', label: 'TAMAMLANAN' }
];

const SocialMedia = ({ canEdit = true }) => {
  return (
    <CommitteeBoard
      committee="sosyal"
      title="Sosyal Medya"
      subtitle="İçerik takvimi ve kampanya yönetimi merkezi."
      icon={Cpu}
      itemLabel="İçerik"
      columns={SOCIAL_COLUMNS}
      canEdit={canEdit}
    />
  );
};

export default SocialMedia;
