import { Tables } from '@/database.types';

import { Organization } from './Organization';

interface Props {
  organizations: Tables<'organization'>[];
}

export async function Organizations({ organizations }: Props) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-4">
      {organizations.map((o) => (
        <Organization key={o.id} {...o} />
      ))}
    </div>
  );
}
