import * as React from 'react';

import { getStatsigValues } from '../../utils/statsig-server';
import ProxyExample from './ProxyExample';

export default async function Index(): Promise<React.ReactElement> {
  const user = { userID: 'a-user', customIDs: { stableID: 'my-stable-id' } };
  const values = await getStatsigValues(user);
  return <ProxyExample user={user} values={values} />;
}
