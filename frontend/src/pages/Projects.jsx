import React from 'react';
import CommitteeBoard from '../components/common/CommitteeBoard';
import { CheckSquare } from 'lucide-react';

const PROJECTS_COLUMNS = [
  { id: 'YAPILACAKLAR', label: 'YAPILACAKLAR' },
  { id: 'DEVAM_EDENLER', label: 'DEVAM EDENLER' },
  { id: 'TAMAMLANDI', label: 'TAMAMLANDI' }
];

const Projects = ({ canEdit = true }) => {
  return (
    <CommitteeBoard
      committee="proje"
      title="Teknoloji ve Proje"
      subtitle="Yazılım, donanım ve teknik projelerin yönetim merkezi."
      icon={CheckSquare}
      itemLabel="Proje Görevi"
      columns={PROJECTS_COLUMNS}
      canEdit={canEdit}
    />
  );
};

export default Projects;
